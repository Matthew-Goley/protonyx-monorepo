"""Run the edge corpus through the Lens engine offline and report invariant
violations.

Pipeline:
  1. Load edge_corpus.json (deterministic torture portfolios).
  2. For each portfolio: run the engine once with the entry's own settings
     (primary run) and once per risk tier (low/regular/high) for the
     tier-monotonicity check. All runs are offline against the frozen cache.
  3. Apply EVERY invariant to EVERY portfolio (no fail-fast) and collect all
     violations.
  4. Write edge_report.json (machine-readable) and print a human summary,
     separating HARD failures from SOFT/judgment ones.

Exit code: non-zero iff any HARD invariant failed (so this can gate CI later).
SOFT checks report but never change the exit code.

Run:  python tests/edge/run_edge_report.py
"""

from __future__ import annotations

import json
import math
import sys
from dataclasses import asdict
from typing import Any

import edge_common as ec
import invariants as inv


def _finitize(obj: Any) -> Any:
    """Replace NaN/inf with None so the report JSON is valid (json.dumps would
    otherwise emit non-standard Infinity/NaN tokens). We only touch the SAVED
    copy - the invariant checker already saw the raw values."""
    if isinstance(obj, float):
        return obj if math.isfinite(obj) else None
    if isinstance(obj, dict):
        return {k: _finitize(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_finitize(v) for v in obj]
    return obj


def _slim(result: dict) -> dict:
    """A compact view of a result for the report (drop the heavy pool_results,
    keep the decision-relevant fields)."""
    return {
        "brief": result.get("brief", ""),
        "caution_score": result.get("caution_score"),
        "threat_level": result.get("threat_level"),
        "action_type": result.get("action_type"),
        "net_cta_delta": result.get("net_cta_delta"),
        "ctas": result.get("ctas", []),
    }


def build_report() -> dict[str, Any]:
    corpus = json.loads(ec.CORPUS_PATH.read_text(encoding="utf-8"))
    portfolios = corpus["portfolios"]

    per_portfolio: list[dict[str, Any]] = []
    for entry in portfolios:
        positions = entry.get("positions", [])
        settings = entry.get("settings", {})
        primary = ec.strip_store(ec.run(positions, settings))
        tier_results = {
            tier: ec.strip_store(res)
            for tier, res in ec.run_all_tiers(positions).items()
        } if positions else {}

        ctx = inv.Ctx(
            entry=entry, result=primary, tier_results=tier_results,
            tier=settings.get("risk_tier", "regular")
            if settings.get("risk_tier") in ("low", "regular", "high") else "regular",
        )
        checks = inv.run_checks(ctx)

        per_portfolio.append({
            "id": entry["id"],
            "label": entry["label"],
            "category": entry["category"],
            "targets": entry["targets"],
            "tier": ctx.tier,
            "result": _finitize(_slim(primary)),
            "tier_caution": {t: r.get("caution_score") for t, r in tier_results.items()},
            "checks": [
                {
                    "name": cr.name,
                    "hard": cr.hard,
                    "guarantee": cr.guarantee,
                    "applicable": cr.applicable,
                    "passed": cr.passed,
                    "violations": [_finitize(asdict(v)) for v in cr.violations],
                }
                for cr in checks
            ],
        })

    return {"_meta": corpus.get("_meta", {}), "portfolios": per_portfolio}


def summarize(report: dict[str, Any]) -> int:
    ports = report["portfolios"]
    n = len(ports)

    hard_by_check: dict[str, int] = {}
    soft_by_check: dict[str, int] = {}
    hard_total = 0
    soft_total = 0
    offenders: list[tuple[int, int, dict]] = []  # (hard_count, soft_count, port)

    for p in ports:
        h = s = 0
        for c in p["checks"]:
            if c["passed"] or not c["applicable"]:
                continue
            v = len(c["violations"])
            if c["hard"]:
                hard_by_check[c["name"]] = hard_by_check.get(c["name"], 0) + v
                h += v
            else:
                soft_by_check[c["name"]] = soft_by_check.get(c["name"], 0) + v
                s += v
        hard_total += h
        soft_total += s
        if h or s:
            offenders.append((h, s, p))

    line = "=" * 72
    print(line)
    print("LENS ENGINE - EDGE-CASE INVARIANT REPORT")
    print(line)
    print(f"portfolios run          : {n}")
    print(f"HARD violations (gating): {hard_total}")
    print(f"SOFT violations (report): {soft_total}")
    print(f"portfolios with any     : {len(offenders)}")

    print("\n-- HARD failures by invariant " + "-" * 42)
    if hard_by_check:
        for name, cnt in sorted(hard_by_check.items(), key=lambda x: -x[1]):
            print(f"  {name:34} {cnt}")
    else:
        print("  (none)")

    print("\n-- SOFT / judgment findings by invariant " + "-" * 31)
    if soft_by_check:
        for name, cnt in sorted(soft_by_check.items(), key=lambda x: -x[1]):
            print(f"  {name:34} {cnt}")
    else:
        print("  (none)")

    # Top offenders, HARD first then SOFT.
    offenders.sort(key=lambda x: (x[0], x[1]), reverse=True)
    print("\n-- Top offending portfolios " + "-" * 44)
    if offenders:
        for h, s, p in offenders[:12]:
            print(f"  [{p['category']:16}] {p['id']:26} HARD={h} SOFT={s}  {p['label']}")
            for c in p["checks"]:
                if c["passed"] or not c["applicable"]:
                    continue
                tag = "HARD" if c["hard"] else "soft"
                for v in c["violations"][:2]:
                    print(f"       ({tag}) {c['name']}: {v['reason']}")
    else:
        print("  (none - every invariant held)")

    print("\n" + line)
    if hard_total:
        print(f"RESULT: FAIL - {hard_total} HARD violation(s). See edge_report.json.")
    else:
        print("RESULT: PASS - no HARD invariant violated."
              + (f" ({soft_total} soft finding(s) to review.)" if soft_total else ""))
    print(line)
    return 1 if hard_total else 0


def main() -> None:
    report = build_report()
    ec.REPORT_PATH.write_text(
        json.dumps(report, indent=2, ensure_ascii=False), encoding="utf-8")
    code = summarize(report)
    print(f"\nwrote {ec.REPORT_PATH.name} ({len(report['portfolios'])} portfolios)")
    sys.exit(code)


if __name__ == "__main__":
    main()
