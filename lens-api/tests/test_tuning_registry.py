"""Minimal tests for the tuning config surface and the analyzer registry.

These are structural/smoke tests, not a behavior-parity suite. Byte-level parity
against the pre-refactor engine is verified separately by the 50-portfolio x
3-tier parity harness (see lens-api/CLAUDE.md section 8).

Run from lens-api/:  python -m pytest tests/ -q
"""

from __future__ import annotations

from dataclasses import fields, is_dataclass
from typing import Any


# ---------------------------------------------------------------------------
# A tiny in-memory store so the smoke analyze runs with no network / yfinance.
# It returns neutral data; the analyzers take their insufficient-data paths and
# the pipeline still produces a well-formed result dict.
# ---------------------------------------------------------------------------
class _FakeStore:
    def get_snapshot(self, ticker: str, refresh: str) -> dict[str, Any]:
        return {'ticker': ticker, 'price': 100.0, 'sector': 'Technology', 'name': ticker}

    def get_history(self, ticker: str, period: str, refresh: str) -> list[float]:
        return []

    def get_dividends(self, ticker: str) -> list:
        return []

    def get_earnings(self, ticker: str) -> list:
        return []

    def get_quote(self, ticker: str) -> dict:
        return {}

    def get_meta(self, ticker: str) -> dict:
        return {}


# ---------------------------------------------------------------------------
# (a) tuning.py imports and every dataclass instantiates
# ---------------------------------------------------------------------------
def test_tuning_imports_and_dataclasses_instantiate():
    from engine.tuning import (
        TUNING,
        TUNING_VERSION,
        AnalyzerBounds,
        CtaPolicy,
        DEFAULT_RISK_TIER,
        RISK_TIER_PROFILES,
        Tuning,
    )

    assert isinstance(TUNING_VERSION, str) and TUNING_VERSION
    assert TUNING.version == TUNING_VERSION

    # Every group is a frozen dataclass and instantiates on its own.
    for cls in (CtaPolicy, AnalyzerBounds):
        assert is_dataclass(cls)
        inst = cls()
        assert fields(inst)  # has at least one field

    assert is_dataclass(Tuning)
    assert isinstance(TUNING.cta, CtaPolicy)
    assert isinstance(TUNING.analyzers, AnalyzerBounds)

    # Frozen: attributes cannot be reassigned.
    import pytest
    with pytest.raises(Exception):
        TUNING.cta.min_sell_dollars = 0  # type: ignore[misc]

    # Risk profiles are re-exported to constants as the SAME object.
    from engine.constants import DEFAULT_RISK_PROFILES
    assert DEFAULT_RISK_PROFILES is RISK_TIER_PROFILES
    assert set(RISK_TIER_PROFILES) == {'low', 'regular', 'high'}
    assert DEFAULT_RISK_TIER in RISK_TIER_PROFILES


# ---------------------------------------------------------------------------
# (b) the registry contains exactly the 8 expected analyzers in correct phases
# ---------------------------------------------------------------------------
def test_registry_has_eight_analyzers_in_correct_phases():
    from engine.lens.registry import EXECUTION_ORDER, REGISTRY

    expected_phase = {
        'slope': 1,
        'volatility': 1,
        'earnings': 2,
        'concentration': 3,
        'dividends': 3,
        'beta': 3,
        'performance': 3,
        'index_fund': 3,
    }

    assert len(REGISTRY) == 8
    assert {s.name for s in REGISTRY} == set(expected_phase)
    for spec in REGISTRY:
        assert spec.phase == expected_phase[spec.name]
        assert callable(spec.analyze)

    # Only earnings consumes phase-1 output.
    assert [s.name for s in REGISTRY if s.needs_prior] == ['earnings']

    # Execution order is a stable phase sort: phases never decrease, and the
    # concrete sequence matches the original hand-wired pool.
    phases = [s.phase for s in EXECUTION_ORDER]
    assert phases == sorted(phases)
    assert [s.name for s in EXECUTION_ORDER] == [
        'slope', 'volatility', 'earnings',
        'concentration', 'dividends', 'beta', 'performance', 'index_fund',
    ]

    # REGISTRY (output) order is the original result-dict key order.
    assert [s.name for s in REGISTRY] == [
        'slope', 'volatility', 'concentration', 'earnings',
        'dividends', 'beta', 'performance', 'index_fund',
    ]


# ---------------------------------------------------------------------------
# (c) smoke analyze on a 3-ticker portfolio returns a well-formed result dict
# ---------------------------------------------------------------------------
def test_smoke_analyze_three_ticker_portfolio():
    from engine.constants import DEFAULT_SETTINGS
    from engine.lens_engine import generate_lens_full

    positions = [
        {'ticker': 'AAPL', 'shares': 10, 'equity': 2300, 'price': 230,
         'sector': 'Technology', 'name': 'Apple Inc.'},
        {'ticker': 'JNJ', 'shares': 8, 'equity': 1120, 'price': 140,
         'sector': 'Healthcare', 'name': 'Johnson & Johnson'},
        {'ticker': 'JPM', 'shares': 5, 'equity': 1050, 'price': 210,
         'sector': 'Financial Services', 'name': 'JPMorgan Chase'},
    ]
    settings = {**DEFAULT_SETTINGS, 'risk_tier': 'regular'}

    result = generate_lens_full(positions, _FakeStore(), settings)

    # Shape / type checks on the canonical result dict.
    for key in (
        'brief', 'color', 'caution_score', 'action_type', 'ctas',
        'pool_results', 'projected_positions', 'net_cta_delta', 'threat_level',
    ):
        assert key in result, f'missing result key: {key}'

    assert isinstance(result['brief'], str) and result['brief']
    assert isinstance(result['caution_score'], int)
    assert 0 <= result['caution_score'] <= 99
    assert isinstance(result['ctas'], list)
    assert result['action_type'] in ('sell', 'rebalance', 'buy_new', 'buy_more', 'hold')

    # All 8 analyzers reported into pool_results.
    for name in (
        'slope', 'volatility', 'concentration', 'earnings',
        'dividends', 'beta', 'performance', 'index_fund',
    ):
        assert name in result['pool_results']


if __name__ == '__main__':
    import sys
    import pytest as _pytest
    sys.exit(_pytest.main([__file__, '-q']))
