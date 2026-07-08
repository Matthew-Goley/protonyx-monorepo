"""Fixed-seed portfolio corpus for the calibration study.

Portfolios are the main source of variation (as-of dates are few and disjoint).
Each portfolio is defined by target WEIGHTS (ticker -> fraction) plus a risk tier
that is part of its identity. Share counts are derived per as-of date at scoring
time (from as-of-T prices), so weights are exact at every date.

To span the full 1..99 caution range, the corpus is stratified across INPUT-SPACE
archetypes (holding count / sub-universe / concentration). This stratification is
decided up front and is OUTCOME-BLIND: it depends only on inputs the engine sees
(and on tickers' historical volatility, which is an engine input), never on the
forward realized outcome, which is not computed here at all. Regenerates
byte-identical from the fixed seed.

Usage:  python metrics/generate_corpus.py
"""

from __future__ import annotations

import json
import random
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))  # lens-api on path

from metrics.common import BENCHMARK, CORPUS_PATH, TIERS, master_series

SEED = 20260707
N_PORTFOLIOS = 250

# Low-volatility "sleepy" sub-universe (broad ETFs + large-cap blue chips) vs the
# speculative remainder. This split is on the tickers' own historical character,
# an engine input, not on any forward outcome.
SLEEPY_POOL = ["SCHD", "VYM", "VXUS", "AAPL", "MSFT", "JPM", "UNH", "PG", "XOM", "GOOG"]


def _spec_pool(uni: list[str]) -> list[str]:
    return [t for t in uni if t not in SLEEPY_POOL]


# Archetypes: (name, fraction, holding-count choices, pool selector, dirichlet alpha).
# alpha large -> near-equal weights; alpha small -> one name dominates.
ARCHETYPES = [
    ("diversified_sleepy", 0.20, (5, 8, 10, 12), "sleepy", 6.0),
    ("diversified_mixed", 0.25, (5, 8, 10, 12), "all", 3.0),
    ("balanced_small", 0.20, (2, 3, 4), "all", 3.0),
    ("concentrated", 0.20, (1, 2, 3), "all", 0.35),
    ("speculative_heavy", 0.15, (3, 5, 8), "spec", 2.0),
]


def _pool(kind: str, uni: list[str]) -> list[str]:
    if kind == "sleepy":
        return list(SLEEPY_POOL)
    if kind == "spec":
        return _spec_pool(uni)
    return list(uni)


def build_corpus() -> dict:
    rng = random.Random(SEED)
    uni = sorted(t for t in master_series() if t != BENCHMARK)

    # Expand archetype fractions into an exact count per archetype summing to N.
    counts = []
    allocated = 0
    for i, (name, frac, *_rest) in enumerate(ARCHETYPES):
        if i == len(ARCHETYPES) - 1:
            counts.append(N_PORTFOLIOS - allocated)
        else:
            c = round(frac * N_PORTFOLIOS)
            counts.append(c)
            allocated += c

    portfolios = []
    pid = 0
    tier_cycle = 0
    for (name, _frac, ncs, pool_kind, alpha), count in zip(ARCHETYPES, counts):
        pool = _pool(pool_kind, uni)
        for _ in range(count):
            n = rng.choice(ncs)
            n = min(n, len(pool))
            tickers = rng.sample(pool, n)
            # Dirichlet weights via independent gammas (stdlib only, deterministic).
            raw = [rng.gammavariate(alpha, 1.0) for _ in tickers]
            s = sum(raw) or 1.0
            weights = {tk: r / s for tk, r in zip(tickers, raw)}
            # Balanced tier assignment across the whole corpus (identity, not a sweep).
            tier = TIERS[tier_cycle % len(TIERS)]
            tier_cycle += 1
            portfolios.append({
                "id": pid,
                "archetype": name,
                "tier": tier,
                "weights": {tk: round(w, 6) for tk, w in weights.items()},
            })
            pid += 1

    return {
        "_meta": {
            "seed": SEED,
            "n_portfolios": len(portfolios),
            "universe_size": len(uni),
            "archetype_counts": {name: c for (name, *_r), c in zip(ARCHETYPES, counts)},
            "tier_counts": {
                t: sum(1 for p in portfolios if p["tier"] == t) for t in TIERS
            },
            "note": "Stratified on input-space archetypes (holding count / sub-universe / "
                    "concentration). Outcome-blind; forward outcomes are not consulted here.",
        },
        "portfolios": portfolios,
    }


def main() -> None:
    corpus = build_corpus()
    Path(CORPUS_PATH).write_text(
        json.dumps(corpus, indent=2, ensure_ascii=False), encoding="utf-8"
    )
    m = corpus["_meta"]
    print(f"[corpus] wrote {m['n_portfolios']} portfolios to {CORPUS_PATH.name}")
    print(f"  archetypes: {m['archetype_counts']}")
    print(f"  tiers:      {m['tier_counts']}")
    print(f"  universe:   {m['universe_size']} holding tickers")


if __name__ == "__main__":
    main()
