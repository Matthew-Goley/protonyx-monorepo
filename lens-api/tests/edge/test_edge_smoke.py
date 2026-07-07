"""Smoke tests for the edge-case failure harness.

These do NOT test the Lens engine's correctness (that is what the invariants +
report do). They test that the DETECTOR itself works: the checker fires on
deliberately broken output, the corpus is well-formed, and a full offline report
build runs and honours the HARD/SOFT split. Run with:  pytest tests/edge -q
"""

from __future__ import annotations

import json

import edge_common as ec
import invariants as inv


def _ctx(result, entry=None, tiers=None):
    return inv.Ctx(
        entry=entry or {"id": "t", "positions": [{"ticker": "AAA"}]},
        result=result, tier_results=tiers or {}, tier="regular")


def _base():
    return dict(
        brief="", color="#8d98af", caution_score=50, threat_level=0.5,
        action_type="hold", recommended_tickers=[], deposit_amount=0.0,
        underweight_sector="", ctas=[], full_report=[],
        pool_results={"_positions_summary": {
            "total_equity": 1000.0, "ticker_weights": {"AAA": 0.5, "BBB": 0.5},
            "ticker_current_values": {"AAA": 500.0, "BBB": 500.0}}},
        projected_positions=[
            {"ticker": "AAA", "shares": 5, "equity": 500.0, "price": 100.0,
             "sector": "Technology", "name": "AAA"},
            {"ticker": "BBB", "shares": 5, "equity": 500.0, "price": 100.0,
             "sector": "Energy", "name": "BBB"}],
        net_cta_delta=0.0)


def test_detector_catches_contradiction():
    r = _base()
    r["ctas"] = [
        {"action": "buy_new", "ticker": "AAA", "dollars": 10, "severity": "low", "details": {}},
        {"action": "sell", "ticker": "AAA", "dollars": 10, "severity": "low", "details": {}},
    ]
    assert inv.inv_no_contradictory_ctas(_ctx(r))


def test_detector_catches_out_of_range_caution():
    r = _base()
    r["caution_score"] = 150
    assert inv.inv_caution_in_range(_ctx(r))


def test_detector_catches_nonfinite():
    r = _base()
    r["deposit_amount"] = float("inf")
    assert inv.inv_finite_outputs(_ctx(r))


def test_detector_catches_oversell():
    r = _base()
    r["ctas"] = [{"action": "sell", "ticker": "AAA", "dollars": 9999,
                  "severity": "low", "reason": "x", "details": {}}]
    assert inv.inv_sell_not_exceed_holding(_ctx(r))


def test_detector_passes_clean_result():
    # A minimal, internally consistent HOLD result must trip NO invariant.
    r = _base()
    r["ctas"] = [{"action": "hold", "ticker": "", "dollars": 0.0,
                  "severity": "none", "reason": "portfolio_healthy", "details": {}}]
    for chk in inv.CHECKS:
        assert chk.fn(_ctx(r)) == [], f"{chk.name} false-fired on a clean result"


def test_corpus_loads_and_covers_categories():
    corpus = json.loads(ec.CORPUS_PATH.read_text(encoding="utf-8"))
    ports = corpus["portfolios"]
    assert len(ports) >= 40
    cats = {p["category"] for p in ports}
    for expected in ("structural", "numeric_boundary", "data_quality",
                     "settings", "severity_driver"):
        assert expected in cats
    # Every entry is well-formed.
    for p in ports:
        assert p["id"] and p["label"] and p["category"]
        assert isinstance(p["positions"], list)


def test_full_report_build_has_no_hard_violations():
    """Guards against a harness regression re-introducing cross-run contamination
    or breaking offline setup: a full build must run and report 0 HARD violations
    (the current, verified state of the engine)."""
    import run_edge_report as rr
    report = rr.build_report()
    hard = 0
    for p in report["portfolios"]:
        for c in p["checks"]:
            if c["hard"] and c["applicable"] and not c["passed"]:
                hard += len(c["violations"])
    assert hard == 0, f"{hard} HARD violation(s) - triage before changing the baseline"
