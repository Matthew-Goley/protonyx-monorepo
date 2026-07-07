"""Registry of the Lens analyzers.

``analysis_pool.run_analysis`` iterates this list instead of importing and
calling each analyzer by name. The registry is the single source of truth for
which analyzers run, in what phase, and which config/risk-profile namespace each
one reads.

Phase model (unchanged from the original hand-wired pool):
  * phase 1 - slope, volatility (run first; earnings needs their output)
  * phase 2 - earnings (receives phase-1 results via ``prior_results``)
  * phase 3 - concentration, dividends, beta, performance, index_fund

Two orderings matter and are BOTH preserved:
  * REGISTRY list order == the original ``run_analysis`` result-dict key order
    (slope, volatility, concentration, earnings, dividends, beta, performance,
    index_fund), so the assembled output dict is byte-identical.
  * A STABLE sort of REGISTRY by ``phase`` reproduces the original EXECUTION
    order (slope, volatility, earnings, then the phase-3 group), so effects
    happen in the same sequence as before.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Callable

from .analyzers import (
    beta,
    concentration,
    dividends,
    earnings,
    index_fund,
    performance,
    slope,
    volatility,
)


@dataclass(frozen=True)
class AnalyzerSpec:
    """One analyzer's wiring metadata.

    name         key used in the pool_results dict.
    analyze      the ``analyze(positions, store, settings, risk_profile)`` callable.
    phase        execution phase (1, 2, 3) - encodes the dependency ordering.
    profile_key  the DEFAULT_RISK_PROFILES / risk_profile namespace this analyzer
                 reads its severity thresholds from, or None for analyzers with no
                 per-tier thresholds (earnings/dividends/index_fund).
    needs_prior  True if the analyzer receives phase-1 output via the
                 ``prior_results`` keyword (only earnings does today).
    """

    name: str
    analyze: Callable[..., dict[str, Any]]
    phase: int
    profile_key: str | None = None
    needs_prior: bool = False


# Listed in the original result-dict output order (see module docstring).
REGISTRY: list[AnalyzerSpec] = [
    AnalyzerSpec('slope', slope.analyze, phase=1, profile_key='slope'),
    AnalyzerSpec('volatility', volatility.analyze, phase=1, profile_key='volatility'),
    AnalyzerSpec('concentration', concentration.analyze, phase=3, profile_key='concentration'),
    AnalyzerSpec('earnings', earnings.analyze, phase=2, needs_prior=True),
    AnalyzerSpec('dividends', dividends.analyze, phase=3),
    AnalyzerSpec('beta', beta.analyze, phase=3, profile_key='beta'),
    AnalyzerSpec('performance', performance.analyze, phase=3, profile_key='performance'),
    AnalyzerSpec('index_fund', index_fund.analyze, phase=3),
]

# Execution order: stable-sorted by phase, so phase-1 analyzers run first (in
# registry order), then phase 2, then phase 3 - reproducing the original
# slope -> volatility -> earnings -> concentration/dividends/beta/performance/
# index_fund sequence exactly.
EXECUTION_ORDER: list[AnalyzerSpec] = sorted(REGISTRY, key=lambda s: s.phase)
