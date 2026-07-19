"""Referral Service — FastAPI service for the Lens Arc pre-launch waitlist.

Someone enters an email on the marketing site. The service creates a `waitlist`
row, issues a single-use magic token, and emails a verification link. Clicking
it marks the row verified and destroys the token. Verified users get their own
referral code and share link; when someone joins through that link and verifies,
the referrer's count goes up, banking more Pro time (capping at lifetime).

Runs as its own Railway service, sharing only the Postgres DB with the rest of
the stack. Owns exactly one table (`waitlist`); the only write outside it is the
launch-time Pro grant in POST /redeem. See CLAUDE.md.
"""

from __future__ import annotations

import hashlib
import os
import secrets
from contextlib import asynccontextmanager

from dotenv import load_dotenv

load_dotenv()

import asyncpg
from email_validator import EmailNotValidError, validate_email
from fastapi import Depends, FastAPI, HTTPException, Query, Request, Security
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security.api_key import APIKeyHeader
from pydantic import BaseModel
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

import db
from entitlement import entitlement
from mailer import send_magic_link

# ------------------------------------------------------------------
# Config (read once at module load, same style as lens-api)
# ------------------------------------------------------------------

FRONTEND_BASE_URL = os.environ.get("FRONTEND_BASE_URL", "http://localhost:5173").rstrip("/")
REFERRAL_LINK_BASE = os.environ.get("REFERRAL_LINK_BASE", "lens-arc.com/r/")
MAGIC_LINK_TTL_MINUTES = int(os.environ.get("MAGIC_LINK_TTL_MINUTES", "30"))
REDEEM_SECRET = os.environ.get("REDEEM_SECRET", "")

MSG_CHECK_EMAIL = "Check your email for your verification link."

# Base36; ambiguity is fine here, codes are copied not typed.
_CODE_ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789"

# ------------------------------------------------------------------
# App + lifespan (open/close the DB pool, create the waitlist table)
# ------------------------------------------------------------------


@asynccontextmanager
async def lifespan(_: FastAPI):
    await db.init_pool()
    yield
    await db.close_pool()


limiter = Limiter(key_func=get_remote_address)
app = FastAPI(title="Referral Service", version="1.0.0", lifespan=lifespan)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    # The marketing SPA calls /join, /verify, /status directly from the browser,
    # so these are the only origins allowed. allow_credentials is False (no
    # cookies; the frontend keeps the referral code in localStorage).
    allow_origins=[
        "https://lens-arc.com",
        "http://localhost:5173",
        "http://localhost:5174",
    ],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ------------------------------------------------------------------
# Auth: shared secret guarding the internal /redeem endpoint only
# ------------------------------------------------------------------

_redeem_header = APIKeyHeader(name="X-Redeem-Secret", auto_error=False)


def _require_redeem_secret(secret: str | None = Security(_redeem_header)) -> None:
    if not REDEEM_SECRET:
        raise HTTPException(status_code=500, detail="REDEEM_SECRET not configured on server")
    if secret != REDEEM_SECRET:
        raise HTTPException(status_code=401, detail="Invalid or missing redeem secret")


# ------------------------------------------------------------------
# Request models + token/code helpers
# ------------------------------------------------------------------


class JoinRequest(BaseModel):
    email: str
    referral_code: str | None = None


class RedeemRequest(BaseModel):
    email: str


def _new_token() -> str:
    return secrets.token_urlsafe(32)


def _hash_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def _new_code(length: int = 6) -> str:
    return "".join(secrets.choice(_CODE_ALPHABET) for _ in range(length))


def _normalize_email(raw: str) -> str:
    """Validate + normalize an email or raise 400. check_deliverability is off so
    we never do a network MX lookup on the request path."""
    try:
        result = validate_email(raw, check_deliverability=False)
    except EmailNotValidError:
        raise HTTPException(status_code=400, detail="Enter a valid email address")
    return result.normalized.lower()


# ------------------------------------------------------------------
# Endpoints
# ------------------------------------------------------------------


@app.get("/health")
async def health() -> dict:
    return {"status": "ok"}


@app.post("/join")
@limiter.limit("5/hour")
async def join(request: Request, body: JoinRequest) -> dict:
    email = _normalize_email(body.email)
    ref_code = (body.referral_code or "").strip().lower() or None

    async with db.pool().acquire() as conn:
        row = await conn.fetchrow("SELECT verified FROM waitlist WHERE email = $1", email)

        token = _new_token()
        token_hash = _hash_token(token)

        if row is None:
            # First touch: capture the referrer only if the code belongs to a
            # verified row and isn't the joiner's own. Unknown/invalid codes are
            # silently dropped (a bad referral link never blocks a signup).
            referred_by = None
            if ref_code:
                ref_row = await conn.fetchrow(
                    "SELECT email FROM waitlist WHERE referral_code = $1 AND verified = TRUE",
                    ref_code,
                )
                if ref_row is not None and ref_row["email"] != email:
                    referred_by = ref_code
            await conn.execute(
                """
                INSERT INTO waitlist (email, referred_by_code, magic_token_hash, magic_token_expires_at)
                VALUES ($1, $2, $3, NOW() + make_interval(mins => $4))
                """,
                email, referred_by, token_hash, MAGIC_LINK_TTL_MINUTES,
            )
            returning = False
        elif row["verified"]:
            # Already verified: this is someone trying to get back into an
            # account they already made (their original single-use link is long
            # since consumed). Issue a fresh token exactly like the resend path
            # below so they can still get in via email; referral_code and
            # referred_by_code are untouched. The email copy is worded as a
            # login, not a signup, but the API response stays identical to the
            # other branches so the endpoint remains enumeration-neutral.
            await conn.execute(
                """
                UPDATE waitlist
                SET magic_token_hash = $1, magic_token_expires_at = NOW() + make_interval(mins => $2)
                WHERE email = $3
                """,
                token_hash, MAGIC_LINK_TTL_MINUTES, email,
            )
            returning = True
        else:
            # Existing unverified row: refresh the token (acts as a resend).
            # referred_by_code is deliberately left as first-touch captured it.
            await conn.execute(
                """
                UPDATE waitlist
                SET magic_token_hash = $1, magic_token_expires_at = NOW() + make_interval(mins => $2)
                WHERE email = $3
                """,
                token_hash, MAGIC_LINK_TTL_MINUTES, email,
            )
            returning = False

    verify_url = f"{FRONTEND_BASE_URL}/verify?token={token}"
    send_magic_link(email, verify_url, returning=returning)
    return {"success": True, "message": MSG_CHECK_EMAIL}


@app.get("/verify")
@limiter.limit("20/hour")
async def verify(request: Request, token: str = Query(...)) -> dict:
    token_hash = _hash_token(token)

    async with db.pool().acquire() as conn:
        row = await conn.fetchrow(
            """
            SELECT id, email, referral_code
            FROM waitlist
            WHERE magic_token_hash = $1 AND magic_token_expires_at > NOW()
            """,
            token_hash,
        )
        if row is None:
            raise HTTPException(status_code=400, detail="Invalid or expired verification link")

        code = row["referral_code"]
        if code is None:
            # Verify + issue a unique referral code atomically, retrying on the
            # rare unique collision.
            code = await _verify_and_issue_code(conn, row["id"])
        else:
            # Already had a code (re-verify path); just re-stamp and clear token.
            await conn.execute(
                """
                UPDATE waitlist
                SET verified = TRUE, verified_at = NOW(),
                    magic_token_hash = NULL, magic_token_expires_at = NULL
                WHERE id = $1
                """,
                row["id"],
            )

        count = await db.count_verified_referrals(conn, code)

    return {
        "success": True,
        "email": row["email"],
        "referral_code": code,
        "referral_link": REFERRAL_LINK_BASE + code,
        "entitlement": entitlement(True, count),
    }


@app.get("/status")
@limiter.limit("60/hour")
async def status(request: Request, code: str = Query(...)) -> dict:
    code = code.strip().lower()
    async with db.pool().acquire() as conn:
        row = await conn.fetchrow(
            "SELECT verified FROM waitlist WHERE referral_code = $1", code
        )
        if row is None:
            raise HTTPException(status_code=404, detail="Unknown referral code")
        count = await db.count_verified_referrals(conn, code)

    return {
        "success": True,
        "verified": True,
        "referral_count": count,
        "entitlement": entitlement(True, count),
    }


@app.post("/redeem")
async def redeem(body: RedeemRequest, _: None = Depends(_require_redeem_secret)) -> dict:
    """Internal only (X-Redeem-Secret). Grants banked Pro to a real account at
    launch. This is the single write the service makes outside `waitlist`.
    Idempotent: a second call for an already-redeemed email re-reports the grant
    without writing again, so a referral can never be double-credited."""
    email = _normalize_email(body.email)

    async with db.pool().acquire() as conn:
        async with conn.transaction():
            row = await conn.fetchrow("SELECT id, verified, referral_code, redeemed FROM waitlist WHERE email = $1", email)
            if row is None:
                raise HTTPException(status_code=404, detail="No waitlist entry for that email")
            if not row["verified"]:
                raise HTTPException(status_code=400, detail="Waitlist entry is not verified")

            count = await db.count_verified_referrals(conn, row["referral_code"])
            ent = entitlement(True, count)

            if row["redeemed"]:
                return {"success": True, "already_redeemed": True, "entitlement": ent}

            user = await conn.fetchrow("SELECT id FROM users WHERE email = $1", email)
            if user is None:
                raise HTTPException(status_code=404, detail="No account found for that email")

            months = None if ent["lifetime"] else ent["months"]
            plan_expires_at = await conn.fetchval(
                """
                UPDATE users
                SET plan = 'pro',
                    subscription_status = 'active',
                    plan_expires_at = CASE WHEN $2::int IS NULL THEN NULL
                                           ELSE NOW() + make_interval(months => $2) END
                WHERE email = $1
                RETURNING plan_expires_at
                """,
                email, months,
            )
            await conn.execute(
                "UPDATE waitlist SET redeemed = TRUE, redeemed_at = NOW() WHERE id = $1",
                row["id"],
            )

    return {
        "success": True,
        "already_redeemed": False,
        "entitlement": ent,
        "plan_expires_at": plan_expires_at.isoformat() if plan_expires_at else None,
    }


# ------------------------------------------------------------------
# Internal helpers that need a live connection
# ------------------------------------------------------------------


async def _verify_and_issue_code(conn: asyncpg.Connection, row_id: int) -> str:
    """Mark a row verified and assign a fresh unique referral code, retrying on
    the (rare) unique-constraint collision."""
    for _ in range(8):
        candidate = _new_code()
        try:
            await conn.execute(
                """
                UPDATE waitlist
                SET verified = TRUE, verified_at = NOW(),
                    magic_token_hash = NULL, magic_token_expires_at = NULL,
                    referral_code = $1
                WHERE id = $2
                """,
                candidate, row_id,
            )
            return candidate
        except asyncpg.UniqueViolationError:
            continue
    raise HTTPException(status_code=500, detail="Could not allocate a referral code")
