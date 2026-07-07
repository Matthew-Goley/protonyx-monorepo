"""Invariant checker for the Lens edge harness.

Each function below is a small, pure predicate that checks ONE property of the
engine's output for a given input portfolio. A check returns a list of
``Violation`` (empty == pass). Nothing here mutates or repairs engine state - a
violated invariant is a FINDING, reported as-is.

Two classes of check, kept deliberately separate:
  * HARD  - a structural guarantee the engine's own code sets out to enforce. A
            HARD violation gates CI (the report exits non-zero).
  * SOFT  - a judgment call ("how quiet is quiet", desired-but-not-guaranteed
            ordering). SOFT violations are reported but never gate. Their
            thresholds are named constants at the top of this file so they are
            easy to adjust.

Every check carries a one-line ``guarantee`` describing what it protects and,
where relevant, which engine code path establishes it.
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field
from typing import Any, Callable

from engine.constants import INDEX_ETFS, sector_for
from engine.lens.cta_engine import _get_ticker_sector
from engine.tuning import TUNING

# ── tolerances / soft thresholds (adjust here) ───────────────────────────────
DOLLAR_TOL = 11.0            # one _round10 step + epsilon, for dollar comparisons
REL_TOL = 1e-6              # relative tolerance for ratio/float identity checks
WEIGHT_SUM_TOL = 0.02       # |Σ weights - 1| allowed before flagging (SOFT)
# Clean-portfolio quietness (SOFT): a portfolio tagged "clean" must not emit a
# CTA at or above this severity. Defined precisely so it is easy to move.
QUIET_MAX_SEVERITY = "high"   # i.e. no 'high' and no 'critical' CTAs
# Corpus ids that are asserted to be CLEAN / quiet books.
CLEAN_PORTFOLIO_IDS = frozenset({
    "struct-3fund-index",
    "struct-single-index",
    "struct-many-diversified",
    "data-insufficient-history",
})

_ACTIONS = {"sell", "rebalance", "buy_new", "buy_more", "hold"}
_SELL_ACTIONS = {"sell", "rebalance"}
_BUY_ACTIONS = {"buy_new", "buy_more"}
_SEVERITIES = {"none", "low", "moderate", "high", "critical"}
_SEV_ORDER = {"none": 0, "low": 1, "moderate": 2, "high": 3, "critical": 4}

_ACTION_COLORS = {
    "sell": "#ff4d4d", "rebalance": "#ff9f43",
    "buy_new": "#38bdf8", "buy_more": "#38bdf8", "hold": "#8d98af",
}

DOC_KEYS = (
    "brief", "color", "caution_score", "threat_level", "action_type",
    "recommended_tickers", "deposit_amount", "underweight_sector", "ctas",
    "full_report", "pool_results", "projected_positions", "net_cta_delta",
)


# ── data types ───────────────────────────────────────────────────────────────

@dataclass
class Violation:
    reason: str
    offending: dict[str, Any] = field(default_factory=dict)


@dataclass
class CheckResult:
    name: str
    hard: bool
    guarantee: str
    passed: bool
    violations: list[Violation]
    applicable: bool = True


@dataclass
class Ctx:
    """Everything a check needs about one corpus entry's run."""
    entry: dict[str, Any]
    result: dict[str, Any]            # primary run (entry's own settings)
    tier_results: dict[str, dict]     # {tier: result} for low/regular/high
    tier: str                         # the risk tier of the primary run

    @property
    def positions(self) -> list[dict]:
        return self.entry.get("positions", [])

    @property
    def ctas(self) -> list[dict]:
        return self.result.get("ctas", []) or []

    @property
    def summary(self) -> dict:
        return (self.result.get("pool_results", {}) or {}).get("_positions_summary", {}) or {}

    @property
    def total_equity(self) -> float:
        return float(self.summary.get("total_equity", 0.0) or 0.0)

    @property
    def current_values(self) -> dict[str, float]:
        return self.summary.get("ticker_current_values", {}) or {}


# ── helpers ──────────────────────────────────────────────────────────────────

def _iter_floats(obj: Any):
    if isinstance(obj, float):
        yield obj
    elif isinstance(obj, dict):
        for v in obj.values():
            yield from _iter_floats(v)
    elif isinstance(obj, (list, tuple)):
        for v in obj:
            yield from _iter_floats(v)


def _nonfinite_paths(obj: Any, path: str = "$"):
    """Yield (path, value) for every non-finite float in a nested structure."""
    if isinstance(obj, float):
        if not math.isfinite(obj):
            yield path, obj
    elif isinstance(obj, dict):
        for k, v in obj.items():
            if k == "_store":
                continue
            yield from _nonfinite_paths(v, f"{path}.{k}")
    elif isinstance(obj, (list, tuple)):
        for i, v in enumerate(obj):
            yield from _nonfinite_paths(v, f"{path}[{i}]")


def _dollars(cta: dict) -> float:
    try:
        return abs(float(cta.get("dollars", 0.0) or 0.0))
    except (TypeError, ValueError):
        return 0.0


# ── HARD invariants ──────────────────────────────────────────────────────────

def inv_no_contradictory_ctas(ctx: Ctx) -> list[Violation]:
    """GUARANTEE: a single result never both buys and sells the same ticker.
    Protects: _dedupe_ctas sell-vs-rebalance resolution + the priority skips that
    drop a drift/loss line when a sell already exists."""
    buys: dict[str, dict] = {}
    sells: dict[str, dict] = {}
    for c in ctx.ctas:
        t = c.get("ticker", "")
        if not t:
            continue
        if c.get("action") in _BUY_ACTIONS:
            buys[t] = c
        elif c.get("action") in _SELL_ACTIONS:
            sells[t] = c
    out = []
    for t in set(buys) & set(sells):
        out.append(Violation(
            f"ticker {t} is both bought ({buys[t]['action']}) and sold ({sells[t]['action']})",
            {"ticker": t, "buy": buys[t], "sell": sells[t]}))
    return out


def inv_budget_caps(ctx: Ctx) -> list[Violation]:
    """GUARANTEE: total buy dollars <= per-tier max-buy fraction of equity, and no
    single buy exceeds the per-CTA cap (0.25 x equity). Protects: _cap_total_buys
    and _cap_buy_amount."""
    te = ctx.total_equity
    if te <= 0:
        return []
    out = []
    base = TUNING.cta.max_total_buy_fraction_by_tier.get(
        ctx.tier, TUNING.cta.max_total_buy_fraction)
    total_buys = sum(_dollars(c) for c in ctx.ctas if c.get("action") in _BUY_ACTIONS)
    cap = base * te
    if total_buys > cap + DOLLAR_TOL:
        out.append(Violation(
            f"total buys ${total_buys:.0f} exceed tier '{ctx.tier}' cap "
            f"${cap:.0f} ({base:.0%} of ${te:.0f})",
            {"total_buys": total_buys, "cap": cap, "tier": ctx.tier}))
    per_cap = TUNING.cta.per_cta_buy_cap_fraction * te
    for c in ctx.ctas:
        if c.get("action") in _BUY_ACTIONS and _dollars(c) > per_cap + DOLLAR_TOL:
            out.append(Violation(
                f"single buy {c.get('ticker')} ${_dollars(c):.0f} exceeds per-CTA "
                f"cap ${per_cap:.0f} (25% of equity)",
                {"cta": c, "per_cta_cap": per_cap}))
    return out


def inv_no_concentration_increasing_buy(ctx: Ctx) -> list[Violation]:
    """GUARANTEE: a concentration-driven buy never targets the flagged heavy
    ticker, nor a ticker in the flagged heavy sector. Protects the sector-aware
    suggestion logic in priorities 6/7 (buys must be OUTSIDE the problem sector)."""
    out = []
    for c in ctx.ctas:
        if c.get("action") not in _BUY_ACTIONS:
            continue
        det = c.get("details", {}) or {}
        tgt = c.get("ticker", "")
        heavy_ticker = det.get("heavy_ticker")
        heavy_sector = det.get("heavy_sector")
        if heavy_ticker and tgt == heavy_ticker:
            out.append(Violation(
                f"buy targets the concentrated ticker {tgt} itself",
                {"cta": c}))
        if heavy_sector and tgt:
            tgt_sector = _get_ticker_sector(tgt)
            if tgt_sector != "Unknown" and tgt_sector == heavy_sector:
                out.append(Violation(
                    f"buy {tgt} sits in the over-concentrated sector "
                    f"'{heavy_sector}'",
                    {"cta": c, "target_sector": tgt_sector}))
    return out


def inv_caution_in_range(ctx: Ctx) -> list[Violation]:
    """GUARANTEE: caution_score is an int in [1,99] for a non-empty book (0 for
    empty), and threat_level == caution_score / 100. Protects _compute_caution_score
    and the threat_level line in build_lens_output."""
    out = []
    cs = ctx.result.get("caution_score")
    tl = ctx.result.get("threat_level")
    empty = len(ctx.positions) == 0
    if not isinstance(cs, int):
        out.append(Violation(f"caution_score is not an int: {cs!r}", {"caution_score": cs}))
    else:
        if empty:
            if cs != 0:
                out.append(Violation(f"empty book caution_score {cs} != 0", {"caution_score": cs}))
        elif not (1 <= cs <= 99):
            out.append(Violation(f"caution_score {cs} out of [1,99]", {"caution_score": cs}))
    if isinstance(cs, (int, float)) and isinstance(tl, (int, float)):
        if abs(float(tl) - cs / 100.0) > REL_TOL:
            out.append(Violation(
                f"threat_level {tl} != caution_score/100 ({cs / 100.0})",
                {"threat_level": tl, "caution_score": cs}))
    return out


def inv_finite_outputs(ctx: Ctx) -> list[Violation]:
    """GUARANTEE: no NaN/inf anywhere in the result dict. Same intent as main.py's
    _finitize, but here we ASSERT rather than repair."""
    bad = list(_nonfinite_paths(ctx.result))
    if not bad:
        return []
    return [Violation(
        f"{len(bad)} non-finite float(s) in result",
        {"paths": [{"path": p, "value": str(v)} for p, v in bad[:20]]})]


def inv_result_well_formed(ctx: Ctx) -> list[Violation]:
    """GUARANTEE: every documented key is present; each CTA has a known action and
    severity, non-negative dollars, a ticker field, and non-hold CTAs name a
    ticker; color matches action_type. Protects the documented /analyze contract."""
    out = []
    for k in DOC_KEYS:
        if k not in ctx.result:
            out.append(Violation(f"missing documented key '{k}'", {"key": k}))
    action_type = ctx.result.get("action_type")
    color = ctx.result.get("color")
    if action_type in _ACTION_COLORS and color != _ACTION_COLORS[action_type]:
        out.append(Violation(
            f"color {color} does not match action_type '{action_type}'",
            {"color": color, "action_type": action_type}))
    for i, c in enumerate(ctx.ctas):
        if c.get("action") not in _ACTIONS:
            out.append(Violation(f"cta[{i}] unknown action {c.get('action')!r}", {"cta": c}))
        if c.get("severity") not in _SEVERITIES:
            out.append(Violation(f"cta[{i}] unknown severity {c.get('severity')!r}", {"cta": c}))
        d = c.get("dollars", 0.0)
        try:
            if float(d) < 0:
                out.append(Violation(f"cta[{i}] negative dollars {d}", {"cta": c}))
        except (TypeError, ValueError):
            out.append(Violation(f"cta[{i}] non-numeric dollars {d!r}", {"cta": c}))
        if "ticker" not in c:
            out.append(Violation(f"cta[{i}] missing ticker field", {"cta": c}))
        elif c.get("action") in (_BUY_ACTIONS | _SELL_ACTIONS) and not c.get("ticker"):
            out.append(Violation(f"cta[{i}] {c.get('action')} has empty ticker", {"cta": c}))
    return out


def inv_sell_not_exceed_holding(ctx: Ctx) -> list[Violation]:
    """GUARANTEE: a sell/rebalance never sheds more dollars than the position is
    currently worth. Protects _apply_all_ctas value conservation (you cannot sell
    what you do not hold)."""
    out = []
    cv = ctx.current_values
    for c in ctx.ctas:
        if c.get("action") not in _SELL_ACTIONS:
            continue
        t = c.get("ticker", "")
        if not t or t not in cv:
            continue
        held = float(cv.get(t, 0.0) or 0.0)
        if _dollars(c) > held + DOLLAR_TOL:
            out.append(Violation(
                f"{c.get('action')} {t} sheds ${_dollars(c):.0f} > held ${held:.0f}",
                {"cta": c, "held_value": held}))
    return out


def inv_deadweight_value_cutoff(ctx: Ctx) -> list[Violation]:
    """GUARANTEE: a dead_weight sell only fires on a position worth at least the
    dead-weight floor ($25). Protects the _MIN_DEAD_WEIGHT_VALUE guard in priority 8."""
    out = []
    floor = TUNING.cta.min_dead_weight_value
    for c in ctx.ctas:
        if c.get("reason") != "dead_weight":
            continue
        pv = float((c.get("details", {}) or {}).get("position_value", 0.0) or 0.0)
        if pv < floor:
            out.append(Violation(
                f"dead_weight sell {c.get('ticker')} on position worth ${pv:.2f} "
                f"< floor ${floor:.0f}",
                {"cta": c, "floor": floor}))
    return out


def inv_net_delta_matches_flows(ctx: Ctx) -> list[Violation]:
    """GUARANTEE: net_cta_delta == Σ buys - Σ sells/rebalances (dollars>0). Protects
    the running net_delta in _apply_all_ctas."""
    buys = sum(_dollars(c) for c in ctx.ctas
               if c.get("action") in _BUY_ACTIONS and c.get("ticker") and _dollars(c) > 0)
    sells = sum(_dollars(c) for c in ctx.ctas
                if c.get("action") in _SELL_ACTIONS and c.get("ticker") and _dollars(c) > 0)
    expected = buys - sells
    actual = float(ctx.result.get("net_cta_delta", 0.0) or 0.0)
    if abs(expected - actual) > DOLLAR_TOL:
        return [Violation(
            f"net_cta_delta {actual:.0f} != buys ${buys:.0f} - sells ${sells:.0f} "
            f"= {expected:.0f}",
            {"net_cta_delta": actual, "buys": buys, "sells": sells})]
    return []


def inv_dominant_position_addressed(ctx: Ctx) -> list[Violation]:
    """GUARANTEE: a single NON-index position worth more than half the book
    (> dominant_position_weight) is always trimmed - it carries a sell/rebalance
    CTA, never a bare hold. Protects the >50% exceptions in
    _conservative_sell_blocked, priority 3, and priority 6 (the engine's
    'trim, do not tell them to deposit into a position that is already most of
    the book' rule). Index ETFs are exempt: they are instant diversification."""
    out = []
    weights = ctx.summary.get("ticker_weights", {}) or {}
    dom = TUNING.cta.dominant_position_weight
    for t, w in weights.items():
        if t in INDEX_ETFS or float(w or 0.0) <= dom:
            continue
        if not any(c.get("ticker") == t and c.get("action") in _SELL_ACTIONS
                   for c in ctx.ctas):
            actions = [(c.get("action"), c.get("reason")) for c in ctx.ctas if c.get("ticker") == t]
            out.append(Violation(
                f"dominant position {t} ({w:.0%}) is not trimmed (no sell/rebalance)",
                {"ticker": t, "weight": w, "its_ctas": actions}))
    return out


def inv_output_fields_consistent(ctx: Ctx) -> list[Violation]:
    """GUARANTEE: the top-line summary fields are derived from the top CTA -
    deposit_amount == top CTA dollars, action_type == top CTA action, and
    recommended_tickers == the top CTA's suggested_tickers (or [its ticker]).
    Protects the field-derivation block in build_lens_output."""
    out = []
    ctas = ctx.ctas
    top = ctas[0] if ctas else {}
    exp_action = top.get("action", "hold")
    if ctx.result.get("action_type") != exp_action:
        out.append(Violation(
            f"action_type {ctx.result.get('action_type')!r} != top CTA action {exp_action!r}",
            {"action_type": ctx.result.get("action_type"), "top": top}))
    exp_dep = top.get("dollars", 0.0)
    if abs(float(ctx.result.get("deposit_amount", 0.0) or 0.0) - float(exp_dep or 0.0)) > REL_TOL:
        out.append(Violation(
            f"deposit_amount {ctx.result.get('deposit_amount')} != top CTA dollars {exp_dep}",
            {"deposit_amount": ctx.result.get("deposit_amount"), "top": top}))
    det = top.get("details", {}) or {}
    suggested = det.get("suggested_tickers", [])
    if suggested:
        exp_rec = suggested
    elif top.get("ticker"):
        exp_rec = [top["ticker"]]
    else:
        exp_rec = []
    if ctx.result.get("recommended_tickers", []) != exp_rec:
        out.append(Violation(
            f"recommended_tickers {ctx.result.get('recommended_tickers')} != "
            f"derived {exp_rec}",
            {"recommended_tickers": ctx.result.get("recommended_tickers"),
             "expected": exp_rec}))
    return out


def inv_projected_value_conservation(ctx: Ctx) -> list[Violation]:
    """GUARANTEE: applying the CTAs conserves value, so Σ projected equity ==
    Σ current values + net_cta_delta. A cheap reproduction of _apply_all_ctas
    without re-fetching store metadata."""
    proj = ctx.result.get("projected_positions", []) or []
    if not proj and not ctx.positions:
        return []
    proj_total = sum(float(p.get("equity", 0.0) or 0.0) for p in proj)
    cur_total = sum(float(v or 0.0) for v in ctx.current_values.values())
    net = float(ctx.result.get("net_cta_delta", 0.0) or 0.0)
    expected = cur_total + net
    # Tolerance scales a touch with book size (float accumulation over positions).
    tol = max(DOLLAR_TOL, abs(cur_total) * 1e-6)
    if abs(proj_total - expected) > tol:
        return [Violation(
            f"projected equity ${proj_total:.0f} != current ${cur_total:.0f} + "
            f"net_delta ${net:.0f} = ${expected:.0f}",
            {"projected_total": proj_total, "current_total": cur_total,
             "net_cta_delta": net})]
    return []


# ── SOFT invariants (judgment / desired behavior; never gate) ────────────────

def inv_tier_monotonicity(ctx: Ctx) -> list[Violation]:
    """SOFT / JUDGMENT: for the SAME portfolio, caution should be non-increasing
    from Conservative -> Moderate -> Aggressive (low >= regular >= high). This is a
    desired ordering, not a code-enforced guarantee, so it never gates."""
    tr = ctx.tier_results
    if not all(t in tr for t in ("low", "regular", "high")):
        return []
    lo = tr["low"].get("caution_score", 0)
    md = tr["regular"].get("caution_score", 0)
    hi = tr["high"].get("caution_score", 0)
    out = []
    if lo < md:
        out.append(Violation(
            f"caution inverts: low {lo} < regular {md}",
            {"low": lo, "regular": md, "high": hi}))
    if md < hi:
        out.append(Violation(
            f"caution inverts: regular {md} < high {hi}",
            {"low": lo, "regular": md, "high": hi}))
    return out


def inv_clean_is_quiet(ctx: Ctx) -> list[Violation]:
    """SOFT / JUDGMENT: a portfolio tagged CLEAN (well-diversified / all-index /
    no-usable-signal) should not emit a CTA at or above QUIET_MAX_SEVERITY. Not a
    code guarantee - a threshold on what "quiet" means, easy to adjust."""
    if ctx.entry.get("id") not in CLEAN_PORTFOLIO_IDS:
        return []  # not applicable
    thresh = _SEV_ORDER[QUIET_MAX_SEVERITY]
    loud = [c for c in ctx.ctas if _SEV_ORDER.get(c.get("severity", "none"), 0) >= thresh]
    if loud:
        return [Violation(
            f"clean book emitted {len(loud)} CTA(s) >= {QUIET_MAX_SEVERITY}",
            {"ctas": loud})]
    return []


def inv_min_sell_floor(ctx: Ctx) -> list[Violation]:
    """SOFT: a NON-dead-weight sell/rebalance is expected to clear the min-sell
    dollar floor ($500) and min-position-value floor ($1000). Documented
    exceptions (so this is SOFT not HARD): low-tier winner-drift rebalances and
    priority-6 concentration trims bypass _sell_too_small by design."""
    out = []
    min_sell = TUNING.cta.min_sell_dollars
    min_pos = TUNING.cta.min_position_value_for_sell
    cv = ctx.current_values
    for c in ctx.ctas:
        if c.get("action") not in _SELL_ACTIONS:
            continue
        if c.get("reason") in ("dead_weight",):
            continue
        d = _dollars(c)
        if d <= 0:
            continue
        t = c.get("ticker", "")
        held = float(cv.get(t, 0.0) or 0.0)
        if d < min_sell:
            out.append(Violation(
                f"{c.get('action')} {t} ${d:.0f} below min-sell floor ${min_sell}",
                {"cta": c}))
        elif held and held < min_pos:
            out.append(Violation(
                f"{c.get('action')} {t} on ${held:.0f} position below "
                f"min-position floor ${min_pos}",
                {"cta": c, "held_value": held}))
    return out


def inv_concentration_flag_actionable(ctx: Ctx) -> list[Violation]:
    """SOFT / JUDGMENT: when a non-index holding is flagged with high/critical
    single-stock concentration, the engine is expected to offer an ACTIONABLE
    response (trim it, or diversify around it) rather than only an informational
    hold. Fires on the seam between the 40% high-concentration flag and the 50%
    dominant-trim trigger: a ~40-50% position is flagged 'high' but is neither
    trimmed nor diversified (its dilution buys get dropped by the budget / dedupe
    path and are replaced by a bare concentration_informational hold).

    This is a debatable 'should', not a code guarantee - hence SOFT, never gates.
    If you decide bare-hold on a ~45% position is acceptable, drop this check."""
    flagged = [
        t for t, d in (
            (ctx.result.get("pool_results", {}) or {})
            .get("concentration", {}) or {}
        ).get("ticker_results", {}).items()
        if t not in INDEX_ETFS and d.get("flag")
        and _SEV_ORDER.get(d.get("severity", "none"), 0) >= _SEV_ORDER["high"]
    ]
    if not flagged:
        return []
    actionable = [c for c in ctx.ctas if c.get("action") in (_SELL_ACTIONS | _BUY_ACTIONS)]
    if actionable:
        return []
    return [Violation(
        f"high/critical concentration on {flagged} but no actionable CTA "
        f"(only holds)",
        {"flagged_tickers": flagged,
         "cta_actions": [(c.get("action"), c.get("reason")) for c in ctx.ctas]})]


def inv_weight_sum(ctx: Ctx) -> list[Violation]:
    """SOFT: ticker weights should sum to ~1.0. Deliberately degenerate inputs
    (negative/zero shares) legitimately break this - the check surfaces those
    rather than asserting a guarantee. build_positions_summary itself only logs."""
    if not ctx.positions:
        return []
    weights = ctx.summary.get("ticker_weights", {}) or {}
    if not weights:
        return []
    s = sum(float(w or 0.0) for w in weights.values())
    if abs(s - 1.0) > WEIGHT_SUM_TOL:
        return [Violation(
            f"ticker_weights sum to {s:.4f} (expected ~1.0)",
            {"weight_sum": s, "weights": weights})]
    return []


# ── registry ─────────────────────────────────────────────────────────────────

@dataclass
class Check:
    name: str
    fn: Callable[[Ctx], list[Violation]]
    hard: bool
    guarantee: str


CHECKS: list[Check] = [
    # HARD - structural guarantees; gate CI.
    Check("no_contradictory_ctas", inv_no_contradictory_ctas, True,
          "never buy and sell the same ticker in one result"),
    Check("budget_caps", inv_budget_caps, True,
          "total buys within tier max-buy fraction; no buy over per-CTA cap"),
    Check("no_concentration_increasing_buy", inv_no_concentration_increasing_buy, True,
          "concentration buys avoid the heavy ticker and heavy sector"),
    Check("caution_in_range", inv_caution_in_range, True,
          "caution_score int in [1,99] (0 empty); threat_level == score/100"),
    Check("finite_outputs", inv_finite_outputs, True,
          "no NaN/inf anywhere in the result dict"),
    Check("result_well_formed", inv_result_well_formed, True,
          "documented keys present; CTAs structurally valid; color matches action"),
    Check("sell_not_exceed_holding", inv_sell_not_exceed_holding, True,
          "a sell/rebalance never exceeds the held position value"),
    Check("deadweight_value_cutoff", inv_deadweight_value_cutoff, True,
          "dead_weight sells respect the $25 value floor"),
    Check("net_delta_matches_flows", inv_net_delta_matches_flows, True,
          "net_cta_delta == buys minus sells"),
    Check("projected_value_conservation", inv_projected_value_conservation, True,
          "projected equity == current value + net_cta_delta"),
    Check("dominant_position_addressed", inv_dominant_position_addressed, True,
          "a >50% non-index position is always trimmed, never a bare hold"),
    Check("output_fields_consistent", inv_output_fields_consistent, True,
          "deposit_amount / action_type / recommended_tickers match the top CTA"),
    # SOFT - judgment calls; report only, never gate.
    Check("concentration_flag_actionable", inv_concentration_flag_actionable, False,
          "a high/critical concentration flag yields actionable advice, not only holds"),
    Check("tier_monotonicity", inv_tier_monotonicity, False,
          "caution non-increasing across low >= regular >= high"),
    Check("clean_is_quiet", inv_clean_is_quiet, False,
          f"clean books emit no CTA >= {QUIET_MAX_SEVERITY}"),
    Check("min_sell_floor", inv_min_sell_floor, False,
          "non-dead-weight sells clear the min-sell / min-position floors"),
    Check("weight_sum", inv_weight_sum, False,
          "ticker weights sum to ~1.0"),
]


def run_checks(ctx: Ctx) -> list[CheckResult]:
    """Run EVERY check against one context; collect ALL results (no fail-fast)."""
    results: list[CheckResult] = []
    for chk in CHECKS:
        try:
            violations = chk.fn(ctx)
        except Exception as exc:  # a checker throwing is itself a finding
            violations = [Violation(f"checker raised {type(exc).__name__}: {exc}")]
        # 'applicable' == False when a scoped SOFT check chose not to run.
        applicable = True
        if chk.name in ("clean_is_quiet",) and ctx.entry.get("id") not in CLEAN_PORTFOLIO_IDS:
            applicable = False
        if chk.name == "tier_monotonicity" and not all(
                t in ctx.tier_results for t in ("low", "regular", "high")):
            applicable = False
        results.append(CheckResult(
            name=chk.name, hard=chk.hard, guarantee=chk.guarantee,
            passed=len(violations) == 0, violations=violations, applicable=applicable))
    return results
