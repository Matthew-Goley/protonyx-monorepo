"""Postgres access for the referral service (asyncpg pool + waitlist queries).

The service owns exactly one table: `waitlist`. It NEVER runs DDL against
`users`/`positions` — the Fastify backend owns those and drops them on every
dev boot. `waitlist` is not in that drop list, so it survives Fastify dev
restarts. The one and only write outside `waitlist` is the Pro grant in
POST /redeem, which updates an existing `users` row (never creating one).
"""

from __future__ import annotations

import os

import asyncpg

_pool: asyncpg.Pool | None = None

CREATE_WAITLIST = """
CREATE TABLE IF NOT EXISTS waitlist (
    id                     SERIAL PRIMARY KEY,
    email                  TEXT UNIQUE NOT NULL,
    verified               BOOLEAN NOT NULL DEFAULT FALSE,
    verified_at            TIMESTAMPTZ DEFAULT NULL,
    referral_code          TEXT UNIQUE DEFAULT NULL,
    referred_by_code       TEXT DEFAULT NULL,
    magic_token_hash       TEXT DEFAULT NULL,
    magic_token_expires_at TIMESTAMPTZ DEFAULT NULL,
    redeemed               BOOLEAN NOT NULL DEFAULT FALSE,
    redeemed_at            TIMESTAMPTZ DEFAULT NULL,
    created_at             TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
"""

CREATE_INDEXES = [
    "CREATE INDEX IF NOT EXISTS idx_waitlist_referral_code ON waitlist(referral_code);",
    "CREATE INDEX IF NOT EXISTS idx_waitlist_referred_by_code ON waitlist(referred_by_code);",
    "CREATE INDEX IF NOT EXISTS idx_waitlist_magic_token_hash ON waitlist(magic_token_hash);",
]


async def init_pool() -> None:
    """Create the connection pool and ensure the waitlist table exists."""
    global _pool
    if _pool is not None:
        return
    dsn = os.environ.get("DATABASE_URL")
    if not dsn:
        raise RuntimeError("DATABASE_URL is not set")
    _pool = await asyncpg.create_pool(dsn, min_size=1, max_size=5)
    async with _pool.acquire() as conn:
        await conn.execute(CREATE_WAITLIST)
        for stmt in CREATE_INDEXES:
            await conn.execute(stmt)


async def close_pool() -> None:
    global _pool
    if _pool is not None:
        await _pool.close()
        _pool = None


def pool() -> asyncpg.Pool:
    if _pool is None:
        raise RuntimeError("DB pool not initialized")
    return _pool


async def count_verified_referrals(conn: asyncpg.Connection, code: str | None) -> int:
    """Direct verified referrals for a code. Never walks the tree, so the system
    is non-cascading by construction: a referral only ever counts once, for the
    person whose code it was, and only after that referred person verifies."""
    if not code:
        return 0
    return await conn.fetchval(
        "SELECT COUNT(*) FROM waitlist WHERE referred_by_code = $1 AND verified = TRUE",
        code,
    )
