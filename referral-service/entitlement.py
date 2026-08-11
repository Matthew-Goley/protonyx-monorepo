"""Pure reward math for the referral service.

Pro time is never stored as a balance. Entitlement is computed on demand from
two facts: whether the person verified their own email, and how many of the
people they referred have themselves verified. This single pure function maps
those inputs to a reward, so there is nothing to keep in sync and no way to
double-credit.

This formula is LINEAR and must stay in lockstep with the two other places that
express it: BASE_MONTHS/MAX_MONTHS in backend/src/waitlist.ts (the path that
actually grants at signup) and REFERRAL_BASE_MONTHS/REFERRAL_MAX_MONTHS in
lens-ref-web/src/content.ts (what the site displays).

It used to be a step function (thresholds 0/1/3/5/10, topping out at lifetime),
which disagreed with the backend for every count between thresholds: 2 verified
referrals computed 2 months here while the backend granted 3. The lifetime tier
was worse, an unbackable promise, since the grant caps at 12 months. Do not
reintroduce thresholds. If the reward changes, change all three files together.
"""

from __future__ import annotations

BASE_MONTHS = 1   # earned by verifying your own email
MAX_MONTHS = 12   # hard cap; there is no lifetime tier

# Referrals needed to reach the cap: the base month is free, every other month
# costs exactly one verified referral.
MAX_REFERRALS = MAX_MONTHS - BASE_MONTHS  # 11


def entitlement(verified: bool, referral_count: int) -> dict:
    """Map (verified, referral_count) to a reward.

    Returns months=0 when unverified (unverified emails are worthless, so nobody
    can farm the system by signing up without confirming). When verified, grants
    one base month plus one month per verified referral, capped at MAX_MONTHS.

    `lifetime` is retained in the response shape (main.py's /redeem branches on
    it, and it is part of the public /verify and /status payloads) but is now
    always False: no input produces a lifetime grant.
    """
    if not verified:
        return {"verified": False, "months": 0, "lifetime": False, "referral_count": referral_count}

    months = min(BASE_MONTHS + max(0, referral_count), MAX_MONTHS)

    return {
        "verified": True,
        "months": months,
        "lifetime": False,
        "referral_count": referral_count,
    }
