"""Generate the edge-case torture corpus and save it to ``edge_corpus.json``.

The corpus is engineered to trigger EDGE cases, not average ones. It is
deterministic: a fixed seed drives the only randomized field (jitter on a couple
of "near a boundary" weights), and share counts are derived from the FROZEN
market-cache prices so every portfolio lands on precise, reproducible weights and
values. Re-running this script reproduces the same file byte-for-byte.

Every corpus entry carries:
  id        stable slug
  label     one line describing the edge condition it targets
  category  one of the buckets below
  targets   a short machine-ish note of the exact pathology
  settings  the settings object to send (may omit / mis-set risk_tier on purpose)
  positions list of position dicts (ticker/shares/equity/price/sector/name/added_at)

Design notes on what is and isn't controllable offline (see also ``data_notes``):
  * Portfolio current value uses the frozen snapshot price (the engine reads it
    via ``get_snapshot``), so weights are set by choosing shares = w*T / price.
  * ``equity`` is COST BASIS. Unrealized return = price/(equity/shares) - 1, so
    performance-severity bands are set exactly by choosing the entry price.
  * Concentration severity is pure weight math, so those bands are exact and use
    clean 0-history blue chips (no vol/slope/beta noise) to isolate the signal.
  * Slope / volatility / beta severities come from the frozen price series and
    cannot be dialed to an arbitrary value, so those bands use the closest
    real ticker from the 41 full-history names (catalogued at build time).

Run:  python tests/edge/generate_corpus.py
"""

from __future__ import annotations

import json
import random
from typing import Any

import edge_common as ec

SEED = 20260707
random.seed(SEED)

PRICES = ec.frozen_prices()

# Round portfolio total used when solving shares from a target weight.
T = 100_000.0

ADDED = "2024-01-01T00:00:00"


# ── position builders ────────────────────────────────────────────────────────

def _pos(
    ticker: str,
    *,
    value: float,
    sector: str | None = "AUTO",
    name: str | None = "AUTO",
    unrealized_pct: float | None = None,
    added_at: str | None = ADDED,
    price: float | None = None,
) -> dict[str, Any]:
    """Build one position worth ``value`` at current (frozen) price.

    ``unrealized_pct`` sets the cost basis so price/entry - 1 == unrealized_pct
    (negative => a loss). ``sector``/``name`` == "AUTO" fills from the frozen /
    static maps; pass ``None`` to deliberately OMIT the field, or a literal to
    force a value (used for malformed-sector cases).
    """
    px = price if price is not None else PRICES.get(ticker, 0.0)
    shares = value / px if px > 0 else 0.0
    if unrealized_pct is None:
        equity = value  # cost basis == current value (no unrealized P&L)
    else:
        entry = px / (1.0 + unrealized_pct / 100.0)
        equity = shares * entry
    out: dict[str, Any] = {"ticker": ticker, "shares": shares, "equity": equity, "price": px}
    if sector != "AUTO":
        out["sector"] = sector           # may be None (omit downstream) or a literal
    if name != "AUTO":
        out["name"] = name
    if added_at is not None:
        out["added_at"] = added_at
    # Drop the keys we intend to be "missing" so the JSON truly omits them.
    if sector is None:
        out.pop("sector", None)
    if name is None:
        out.pop("name", None)
    if added_at is None:
        out.pop("added_at", None)
    return out


def _weighted(book: list[tuple[str, float]], total: float = T, **kw) -> list[dict]:
    """Build positions from (ticker, weight-fraction) pairs summing to ~1.0."""
    return [_pos(t, value=w * total, **kw) for t, w in book]


ENTRIES: list[dict[str, Any]] = []


def add(id: str, label: str, category: str, targets: str,
        positions: list[dict], settings: dict | None = None) -> None:
    ENTRIES.append({
        "id": id,
        "label": label,
        "category": category,
        "targets": targets,
        "settings": settings if settings is not None else {"risk_tier": "regular"},
        "positions": positions,
    })


# ── 1. Structural degenerates ────────────────────────────────────────────────

add("struct-empty", "empty portfolio", "structural",
    "positions=[] -> documented empty-result shape", [])

add("struct-single", "single position (whole book)", "structural",
    "1 holding == 100% weight", [_pos("AAPL", value=T)])

add("struct-two", "two positions", "structural",
    "2 holdings, 50/50", _weighted([("AAPL", 0.5), ("XOM", 0.5)]))

add("struct-one-sector-clean", "all one sector (Technology), clean names", "structural",
    "single-sector book -> concentration sector-count escalation",
    _weighted([("AAPL", 0.34), ("MSFT", 0.33), ("ORCL", 0.33)]))

add("struct-3fund-index", "healthy 3-fund index portfolio (should NOT nag)", "structural",
    "SPY+VXUS+SCHD, all index ETFs -> index-dominance downgrade, no high/critical",
    _weighted([("SPY", 0.6), ("VXUS", 0.25), ("SCHD", 0.15)]))

add("struct-single-index", "single broad-market index fund", "structural",
    "100% SPY -> index informational hold, quiet", [_pos("SPY", value=T)])

add("struct-many-diversified", "broadly diversified 10-sector clean book", "structural",
    "10 sectors ~even -> should be healthy/quiet",
    _weighted([("AAPL", 0.1), ("JPM", 0.1), ("JNJ", 0.1), ("KO", 0.1), ("XOM", 0.1),
               ("HD", 0.1), ("GE", 0.1), ("NEE", 0.1), ("LIN", 0.1), ("PLD", 0.1)]))


# ── 2. Numeric / boundary ────────────────────────────────────────────────────
# Concentration (regular tier): >50 crit, >40 high, >30 moderate, >20 low. The
# comparisons are strict-greater, so a position sitting EXACTLY on a threshold
# stays in the lower band -- the classic off-by-epsilon boundary.

for pct, tag in [(30.0, "moderate"), (40.0, "high"), (50.0, "critical")]:
    add(f"bound-conc-eq-{int(pct)}",
        f"single-stock weight exactly {pct:.0f}% (regular {tag} threshold)",
        "numeric_boundary",
        f"weight=={pct}% -> strict-'>' means still the band BELOW {tag}",
        _weighted([("KO", pct / 100), ("JNJ", (100 - pct) / 100)]))
    add(f"bound-conc-just-over-{int(pct)}",
        f"single-stock weight {pct + 0.5:.1f}% (just over {tag} threshold)",
        "numeric_boundary",
        f"weight just over {pct}% -> should classify {tag}",
        _weighted([("KO", (pct + 0.5) / 100), ("JNJ", (100 - pct - 0.5) / 100)]))

add("bound-vol-just-over-high", "volatility just over regular high (PLTR ~51.8%)",
    "numeric_boundary", "PLTR vol 51.8 > regular high 50 at >15% weight -> vol sell",
    _weighted([("PLTR", 0.5), ("KO", 0.5)]))

add("bound-vol-moderate", "volatility in moderate band (F ~36.7%)",
    "numeric_boundary", "F vol 36.7 in (35,50] -> moderate, no flag",
    _weighted([("F", 0.5), ("KO", 0.5)]))

add("bound-beta-high", "beta just over regular high (F ~1.29 vs 1.3)",
    "numeric_boundary", "F beta 1.29 sits right under regular high 1.3",
    _weighted([("F", 0.5), ("KO", 0.5)]))

add("bound-near-100pct", "one position ~99.99% of the book",
    "numeric_boundary", "dominant >50% single stock -> trim path, not buy-to-dilute",
    _weighted([("AAPL", 0.9999), ("KO", 0.0001)]))

add("bound-perf-eq-moderate", "unrealized loss exactly -15% (regular moderate edge)",
    "numeric_boundary", "return==-15 -> strict-'<' means NOT yet moderate",
    [_pos("AAPL", value=0.5 * T, unrealized_pct=-15.0),
     _pos("KO", value=0.5 * T)])

add("bound-deadweight-just-above-25", "sub-2% odd-lot worth ~$26 (just over $25 floor)",
    "numeric_boundary", "weight<2% and value>$25 -> dead_weight sell (regular/high)",
    [_pos("AAPL", value=0.985 * T), _pos("KO", value=26.0),
     _pos("XOM", value=0.015 * T - 26.0)])

add("bound-deadweight-below-25", "sub-2% odd-lot worth ~$20 (below $25 floor)",
    "numeric_boundary", "penny stub below dead-weight floor -> must NOT be sold",
    [_pos("AAPL", value=0.985 * T), _pos("KO", value=20.0),
     _pos("XOM", value=0.015 * T - 20.0)])

add("bound-penny-fractional", "fractional penny position",
    "numeric_boundary", "0.0005 shares of AMC (~$0.0008) -> near-zero weight",
    [_pos("AAPL", value=0.999 * T),
     {"ticker": "AMC", "shares": 0.0005, "equity": 0.0005 * PRICES["AMC"],
      "price": PRICES["AMC"], "sector": "Unknown", "name": "AMC", "added_at": ADDED}])


# ── 3. Data quality ──────────────────────────────────────────────────────────

add("data-unknown-sector", "holding whose sector resolves to Unknown (GOOG)",
    "data_quality", "GOOG not in TICKER_SECTOR, sector omitted -> Unknown bucket",
    _weighted([("GOOG", 0.5), ("AAPL", 0.5)], sector=None))

add("data-malformed-sector", "malformed/garbage sector string",
    "data_quality", "sector='Blahsector' -> normalize keeps it, used as a real sector",
    [_pos("AAPL", value=0.5 * T, sector="Blahsector"),
     _pos("KO", value=0.5 * T)])

add("data-missing-optionals", "positions missing name / sector / added_at",
    "data_quality", "optional fields omitted -> engine must fill defaults",
    [_pos("AAPL", value=0.5 * T, sector=None, name=None, added_at=None),
     _pos("XOM", value=0.5 * T, sector=None, name=None, added_at=None)])

add("data-insufficient-history", "holdings with < min-data-points 1y/6mo history",
    "data_quality",
    "KO/JNJ/JPM have no usable frozen history -> slope none, vol 0, beta 1.0; "
    "three distinct sectors so it stays genuinely quiet",
    _weighted([("KO", 0.34), ("JNJ", 0.33), ("JPM", 0.33)]))

add("data-zero-price", "a position with price 0 (and zero current value)",
    "data_quality", "price==0 -> current value 0, weight math must not divide-by-0",
    [{"ticker": "AAPL", "shares": 100, "equity": 0.0, "price": 0.0,
      "sector": "Technology", "name": "AAPL", "added_at": ADDED},
     _pos("XOM", value=T)])

add("data-zero-shares", "a position with 0 shares",
    "data_quality", "shares==0 -> zero value, entry_price div-guard",
    [{"ticker": "AAPL", "shares": 0, "equity": 0.0, "price": PRICES["AAPL"],
      "sector": "Technology", "name": "AAPL", "added_at": ADDED},
     _pos("XOM", value=T)])

add("data-negative-shares", "a malformed position with NEGATIVE shares",
    "data_quality", "shares<0 -> negative weight; stresses weight-sum & finite checks",
    [{"ticker": "AAPL", "shares": -10, "equity": -10 * PRICES["AAPL"],
      "price": PRICES["AAPL"], "sector": "Technology", "name": "AAPL", "added_at": ADDED},
     _pos("XOM", value=T)])

add("data-huge-shares", "an absurdly large share count",
    "data_quality", "1e12 shares -> very large equity; stresses caps & finite outputs",
    [{"ticker": "AAPL", "shares": 1e12, "equity": 1e12 * PRICES["AAPL"],
      "price": PRICES["AAPL"], "sector": "Technology", "name": "AAPL", "added_at": ADDED},
     _pos("KO", value=T)])

add("data-nan-inf-stress", "extreme-magnitude entry price (unrealized overflow bait)",
    "data_quality",
    "near-zero cost basis -> +huge unrealized %; performance/finite stress",
    [{"ticker": "AAPL", "shares": 1000, "equity": 1e-9, "price": PRICES["AAPL"],
      "sector": "Technology", "name": "AAPL", "added_at": ADDED},
     _pos("XOM", value=T)])


# ── 4. Settings edge cases ───────────────────────────────────────────────────
# A moderately risky book so the tier actually changes the output.
_RISKY = _weighted([("COIN", 0.4), ("HL", 0.3), ("AAPL", 0.3)], unrealized_pct=-20.0)

add("set-missing-risk-tier", "settings omit risk_tier entirely",
    "settings", "no risk_tier -> load_risk_profile default 'regular'",
    [dict(p) for p in _RISKY], settings={})

add("set-unknown-risk-tier", "settings name an unknown risk_tier",
    "settings", "risk_tier='ferocious' -> unknown -> fallback 'regular' (Tier-C .get)",
    [dict(p) for p in _RISKY], settings={"risk_tier": "ferocious"})

for tier in ("low", "regular", "high"):
    add(f"set-tier-{tier}", f"explicit risk_tier={tier} on a risky book", "settings",
        f"exercise {tier} thresholds + sell suppression",
        [dict(p) for p in _RISKY], settings={"risk_tier": tier})


# ── 5. Concentration / severity drivers ──────────────────────────────────────
# Concentration severity bands (regular tier), isolated on clean 0-history names.

_conc_bands = [
    ("none", 15.0), ("low", 25.0), ("moderate", 35.0), ("high", 45.0), ("critical", 55.0),
]
for band, pct in _conc_bands:
    add(f"sev-conc-{band}", f"single-stock concentration -> {band} (weight {pct:.0f}%)",
        "severity_driver", f"KO weight {pct}% -> concentration severity {band}",
        _weighted([("KO", pct / 100), ("JNJ", (100 - pct) / 100)]))

# Performance (unrealized loss) severity bands (regular: <-5 low, <-15 mod,
# <-30 high, <-50 crit). Isolated on a clean name so slope/vol don't interfere.
_perf_bands = [("low", -10.0), ("moderate", -22.0), ("high", -40.0), ("critical", -60.0)]
for band, ur in _perf_bands:
    add(f"sev-perf-{band}", f"unrealized loss -> {band} ({ur:.0f}%)",
        "severity_driver", f"AAPL unrealized {ur}% -> performance severity {band}",
        [_pos("AAPL", value=0.6 * T, unrealized_pct=ur), _pos("KO", value=0.4 * T)])

# Forced SELL: a high-vol name above the 15% weight + $1000 value gates.
add("sev-force-sell-vol", "force a volatility SELL CTA",
    "severity_driver", "OPEN vol 143 crit at 40% weight -> priority-2 sell",
    _weighted([("OPEN", 0.4), ("AAPL", 0.6)]))

add("sev-force-sell-decline", "force a steep-decline SELL CTA",
    "severity_driver", "UEC slope -80 crit at 30% weight -> priority-1 sell",
    _weighted([("UEC", 0.3), ("AAPL", 0.7)]))

# Forced BUY: over-concentrated single stock -> buy-to-diversify CTAs.
add("sev-force-buy-conc", "force buy-to-diversify from single-stock concentration",
    "severity_driver", "AAPL 45% (high) clean -> priority-6 buy_new suggestions",
    _weighted([("AAPL", 0.45), ("XOM", 0.30), ("KO", 0.25)]))

add("sev-force-buy-beta", "force a reduce-beta BUY CTA",
    "severity_driver", "high-beta book (SOXL/TQQQ) -> priority-5 buy low-beta name",
    _weighted([("SOXL", 0.34), ("TQQQ", 0.33), ("RIOT", 0.33)]))

# Dead-weight pruning: several sub-2% odd-lots above the $25 floor.
add("sev-deadweight-prune", "multiple sub-2% odd-lots -> dead-weight sells",
    "severity_driver", "3 tiny lots (<2%, >$25) -> priority-8 dead_weight sells (reg/high)",
    [_pos("AAPL", value=0.94 * T),
     _pos("KO", value=0.02 * T), _pos("XOM", value=0.02 * T), _pos("JNJ", value=0.02 * T)])

# Conservative-suppression: a dangerous large-cap book at the LOW tier, where
# sells are mostly blocked but the risk floor must still surface caution.
add("sev-conservative-suppressed", "dangerous book on conservative tier (sells blocked)",
    "severity_driver", "low tier + declining large caps -> suppressed sells, high floor",
    _weighted([("MSFT", 0.4), ("AAPL", 0.3), ("COIN", 0.3)], unrealized_pct=-25.0),
    settings={"risk_tier": "low"})

# Leveraged-ETF fire: heavy in a single leveraged ETF -> must not tell the user
# to deposit fresh capital into the fire.
add("sev-leveraged-fire", "78% in a leveraged ETF (deposit-into-fire trap)",
    "severity_driver", "SOXL 78% crit vol/beta -> trim, never buy-to-dilute",
    _weighted([("SOXL", 0.78), ("AAPL", 0.22)]))

add("sev-all-critical", "book that is wholly in crisis",
    "severity_driver", "5 critical-vol names even weight -> danger gate, no buys",
    _weighted([("OPEN", 0.2), ("RGTI", 0.2), ("QUBT", 0.2), ("RUN", 0.2), ("FCEL", 0.2)],
              unrealized_pct=-45.0))

add("sev-winner-drift", "runaway winner that drifted up",
    "severity_driver", "AAPL up 220% -> >2x drift at >30% weight -> rebalance",
    [_pos("AAPL", value=0.55 * T, unrealized_pct=220.0),
     _pos("XOM", value=0.25 * T), _pos("KO", value=0.20 * T)])


# ── 6. Adversarial seams (aimed at the SOFT / judgment invariants) ────────────
# These target the specific interplays the engine's own comments worry about:
# tier ordering under per-tier sell scaling, buys near an Unknown heavy sector,
# small trims below the sell floor, and the dominant-trim-vs-sell path.

# Per-tier sell_scale is low=0.10, regular=0.50, high=0.25. Caution counts sells
# at full weight, so the MIDDLE (regular) tier can produce the biggest sells and
# thus the highest trade-flow caution -- a candidate low<regular inversion.
add("adv-tier-inversion-riskbook", "risk book that may invert tier caution ordering",
    "adversarial", "per-tier sell_scale (0.10/0.50/0.25) vs risk floor -> ordering",
    _weighted([("PLTR", 0.34), ("RIVN", 0.33), ("HOOD", 0.33)], unrealized_pct=-20.0))

add("adv-tier-inversion-highsev", "all-high (not critical) severity book across tiers",
    "adversarial", "high-severity names -> danger half-weight; tier ordering",
    _weighted([("PLTR", 0.5), ("RIVN", 0.5)], unrealized_pct=-28.0))

add("adv-tier-inversion-midcaps", "mid-cap decliners, moderate weights, all tiers",
    "adversarial", "sell-driven caution may peak at regular tier",
    _weighted([("SOFI", 0.25), ("COIN", 0.25), ("HL", 0.25), ("CDE", 0.25)],
              unrealized_pct=-18.0))

# Heavy position whose sector resolves to Unknown (GOOG). The buy-to-diversify
# path has an EMPTY exclude set, so it may recommend a sector that is actually
# GOOG's real home (Communication Services) -> effectively concentration-adding.
add("adv-unknown-sector-conc", "60% in an Unknown-sector name (GOOG)",
    "adversarial", "heavy sector Unknown -> exclude set empty -> buy targeting",
    _weighted([("GOOG", 0.6), ("KO", 0.4)], sector=None))

add("adv-unknown-heavy-multi", "Unknown-sector cluster dominates the book",
    "adversarial", "CLSK/MARA/RIOT all Unknown -> heaviest 'sector' is Unknown",
    _weighted([("CLSK", 0.34), ("MARA", 0.33), ("RIOT", 0.33)], sector=None))

# Two share classes of the same issuer: GOOG (Unknown) + GOOGL (Comm Services).
add("adv-two-share-classes", "GOOG + GOOGL (same issuer, split sector accounting)",
    "adversarial", "one class Unknown, one Comm Services -> sector double-count",
    _weighted([("GOOG", 0.45), ("GOOGL", 0.45), ("KO", 0.10)], sector=None))

# A dominant (>50%) position that is ALSO a small risk sell -> the code's
# "trim supersedes a smaller same-direction sell" path (priority 6).
add("adv-dominant-trim-vs-sell", "55% high-vol name (trim vs risk-sell contest)",
    "adversarial", "SOXL 55% crit vol -> priority-6 trim must beat the vol sell",
    _weighted([("SOXL", 0.55), ("AAPL", 0.45)]))

# Winner drift on the CONSERVATIVE tier where a >50% dominant position is trimmed
# but a sub-floor small trim could slip through _sell_too_small bypass.
add("adv-lowtier-winner-drift", "dominant drifted winner on conservative tier",
    "adversarial", "low tier + >50% winner -> trim path bypasses sell floor",
    [_pos("AAPL", value=0.62 * T, unrealized_pct=220.0),
     _pos("XOM", value=0.20 * T), _pos("KO", value=0.18 * T)],
    settings={"risk_tier": "low"})

# A barely-over-threshold single-stock concentration whose dilution buy is tiny
# and whose trim (priority 6, >50% path not taken) could round small.
add("adv-tiny-conc-trim", "single stock just over 50% -> possibly small trim",
    "adversarial", "51% single stock -> priority-6 trim near the rounding/floor edge",
    _weighted([("KO", 0.51), ("JNJ", 0.49)]))

# Sector over-concentration where every underweight suggestion may already be held
# or index-suppressed -> does a buy still get emitted sensibly?
add("adv-sector-conc-crowded", "sector over-concentration with most sectors held",
    "adversarial", "8 sectors held + heavy Tech -> limited underweight room",
    _weighted([("AAPL", 0.30), ("MSFT", 0.18), ("JPM", 0.09), ("JNJ", 0.09),
               ("XOM", 0.09), ("HD", 0.07), ("KO", 0.07), ("NEE", 0.06), ("LIN", 0.05)]))


# ── data_notes: pathologies NOT fully buildable from frozen tickers ───────────

DATA_NOTES = [
    "Only 41 of 142 frozen tickers carry >= 30 daily closes; the rest resolve to "
    "slope 'none' / vol 0 / beta 1.0. 'data-insufficient-history' exploits that "
    "real gap (KO/PG/JNJ) instead of a synthetic ticker, so it stays fully offline.",
    "A genuinely SHORT-but-nonempty series (e.g. exactly 29 closes) cannot be built "
    "without editing the frozen cache, which would change parity inputs; the "
    "min-data-points path is instead reached via the no-usable-history tickers above.",
    "True yfinance NaN/inf response rows (CLAUDE.md section 6) live in the main.py "
    "HTTP layer, not the analyze pipeline; 'data-nan-inf-stress' exercises the "
    "closest analyze-side path (extreme unrealized %) rather than a fabricated bar.",
    "Exact on-threshold vol/beta/slope values are not dialable from a fixed price "
    "series; those boundary entries use the nearest real full-history ticker and "
    "note the intended band. Concentration and performance boundaries ARE exact.",
]


def main() -> None:
    payload = {
        "_meta": {
            "seed": SEED,
            "portfolio_total_used": T,
            "count": len(ENTRIES),
            "frozen_market_data": ec.FROZEN_MARKET_DATA.name,
            "note": "Deterministic torture corpus for the Lens edge harness. "
                    "Regenerate with: python tests/edge/generate_corpus.py",
        },
        "data_notes": DATA_NOTES,
        "portfolios": ENTRIES,
    }
    ec.CORPUS_PATH.write_text(
        json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8")
    cats: dict[str, int] = {}
    for e in ENTRIES:
        cats[e["category"]] = cats.get(e["category"], 0) + 1
    print(f"[corpus] wrote {len(ENTRIES)} portfolios to {ec.CORPUS_PATH.name}")
    for c in sorted(cats):
        print(f"  {c:18} {cats[c]}")


if __name__ == "__main__":
    main()
