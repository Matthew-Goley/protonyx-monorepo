"""Pure reward math for the referral service.

Pro time is never stored as a balance. Entitlement is computed on demand from
two facts: whether the person verified their own email, and how many of the
people they referred have themselves verified. This single pure function maps
those inputs to a reward, so there is nothing to keep in sync and no way to
double-credit.

MILESTONES must stay in lockstep with REFERRAL_MILESTONES in
lens-ref-web/src/content.ts. It is a step function keyed on referral thresholds,
NOT a linear "X months per referral" formula: counts between thresholds map down
to the nearest lower milestone (2 referrals -> 2 months, 4 -> 4 months, etc).
"""

from __future__ import annotations

# (referrals_threshold, months); months=None means lifetime (the cap).
MILESTONES: list[tuple[int, int | None]] = [
    (0, 1),
    (1, 2),
    (3, 4),
    (5, 6),
    (10, None),
]

MAX_REFERRALS = MILESTONES[-1][0]  # 10 — the lifetime tier


def entitlement(verified: bool, referral_count: int) -> dict:
    """Map (verified, referral_count) to a reward.

    Returns months=0 when unverified (unverified emails are worthless, so nobody
    can farm the system by signing up without confirming). When verified, walks
    the milestone table and takes the highest tier whose threshold is met.
    Lifetime is a distinct terminal state: months=None, lifetime=True.
    """
    if not verified:
        return {"verified": False, "months": 0, "lifetime": False, "referral_count": referral_count}

    months: int | None = 1
    lifetime = False
    for threshold, reward_months in MILESTONES:
        if referral_count >= threshold:
            lifetime = reward_months is None
            months = None if lifetime else reward_months

    return {
        "verified": True,
        "months": months,
        "lifetime": lifetime,
        "referral_count": referral_count,
    }
