"""Transactional email for the referral service (Resend).

NOTE: this module is deliberately NOT named `email.py` — a module by that name
in the service root would shadow Python's stdlib `email` package, which
email_validator (and others) import, breaking the whole process.

Mirrors backend/src/email.ts: the send is fire-and-forget from the caller's
perspective — any failure is logged and swallowed so an email outage never
breaks POST /join. FROM comes from RESEND_FROM (default noreply@protonyxdata.com,
the currently verified Resend domain). If RESEND_API_KEY is unset, the send is
skipped and the verification link is logged instead, which is what makes local
testing possible without actually delivering mail.
"""

from __future__ import annotations

import logging
import os

import resend

from templates import magic_link_html

_log = logging.getLogger(__name__)

FROM_ADDRESS = os.environ.get("RESEND_FROM", "noreply@protonyxdata.com")


def send_magic_link(to: str, verify_url: str) -> None:
    api_key = os.environ.get("RESEND_API_KEY")
    if not api_key:
        # Dev fallback: no key configured, so log the link instead of sending.
        _log.warning("RESEND_API_KEY not set; magic link for %s: %s", to, verify_url)
        return
    resend.api_key = api_key
    try:
        resend.Emails.send(
            {
                "from": FROM_ADDRESS,
                "to": to,
                "subject": "Confirm your Lens Arc early access",
                "html": magic_link_html(verify_url),
            }
        )
    except Exception as exc:  # noqa: BLE001 - never let email failure break /join
        _log.error("Failed to send magic-link email to %s: %s", to, exc)
