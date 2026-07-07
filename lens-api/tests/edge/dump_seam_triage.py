"""Read-only full-output dump for the concentration-seam triage.

Runs a handful of edge-corpus portfolios offline (same bootstrap as
run_edge_report.py) and prints the FULL engine result verbatim. Touches nothing
under engine/. No interpretation, no fixes - just faithful values.

Writes the same text to tests/edge/seam_triage_dump.txt.

Run:  python tests/edge/dump_seam_triage.py
"""

from __future__ import annotations

import json
import sys
from typing import Any

import edge_common as ec
from engine.constants import sector_for

# The engine's sentence templates contain em-dashes (U+2014). Force UTF-8 on
# stdout so the faithful dump prints on a cp1252 Windows console instead of
# raising / dropping those lines. The written file is UTF-8 already.
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

REPORT_PATH = ec.SELF_DIR / "edge_report.json"
OUT_PATH = ec.SELF_DIR / "seam_triage_dump.txt"

# The two named extremes.
EXTREME_HIGH = "struct-two"              # 50/50 two-sector end
EXTREME_ISSUER = "adv-two-share-classes"  # ~90% single-issuer end

_buf: list[str] = []


def out(line: str = "") -> None:
    print(line)
    _buf.append(line)


def _load(path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def dominant_weight(entry: dict) -> tuple[float, dict]:
    """Return (max ticker weight, full result) for an entry's primary run."""
    res = ec.run(entry["positions"], entry.get("settings", {}))
    weights = (res.get("pool_results", {}) or {}).get(
        "_positions_summary", {}).get("ticker_weights", {}) or {}
    dom = max(weights.values()) if weights else 0.0
    return dom, res


def flagged_ids(report: dict) -> list[str]:
    ids = []
    for p in report["portfolios"]:
        for c in p["checks"]:
            if c["name"] == "concentration_flag_actionable" and not c["passed"] and c["applicable"]:
                ids.append(p["id"])
                break
    return ids


def dump_portfolio(entry: dict, result: dict, report_port: dict) -> None:
    settings = entry.get("settings", {})
    tier = settings.get("risk_tier", "regular")
    pr = result.get("pool_results", {}) or {}
    summary = pr.get("_positions_summary", {}) or {}
    weights = summary.get("ticker_weights", {}) or {}
    cur_vals = summary.get("ticker_current_values", {}) or {}
    total_eq = summary.get("total_equity", 0.0)

    out("=" * 78)
    out(f"PORTFOLIO: {entry['id']}")
    out("=" * 78)

    # 1. identity
    out("[1] IDENTITY")
    out(f"    id        : {entry['id']}")
    out(f"    label     : {entry['label']}")
    out(f"    category  : {entry['category']}")
    out(f"    targets   : {entry['targets']}")
    out(f"    settings  : {json.dumps(settings)}")
    out(f"    risk_tier : {tier}")
    out(f"    total_equity (current market value): {total_eq:.2f}")
    out("")

    # 2. input positions, sorted by weight desc
    out("[2] INPUT POSITIONS (sorted by current weight desc)")
    out(f"    {'ticker':8} {'sector':22} {'shares':>16} {'equity':>16} "
        f"{'cur_value':>16} {'weight%':>9}")
    rows = []
    for p in entry["positions"]:
        t = p["ticker"]
        sec = sector_for(t, p.get("sector"))
        rows.append((weights.get(t, 0.0), t, sec, p.get("shares"),
                     p.get("equity"), cur_vals.get(t, 0.0)))
    rows.sort(key=lambda r: r[0], reverse=True)
    for w, t, sec, sh, eq, cv in rows:
        marker = "  <== DOMINANT" if (rows and w == rows[0][0]) else ""
        sh_s = f"{sh:.6f}" if isinstance(sh, float) else str(sh)
        eq_s = f"{eq:.2f}" if isinstance(eq, (int, float)) else str(eq)
        out(f"    {t:8} {sec:22} {sh_s:>16} {eq_s:>16} {cv:>16.2f} "
            f"{w * 100:>8.4f}%{marker}")
    out("")

    # 3. full brief
    out("[3] BRIEF (verbatim)")
    out(f"    {result.get('brief', '')}")
    out("")

    # 4. scores
    out("[4] SCORES")
    out(f"    caution_score : {result.get('caution_score')}")
    out(f"    threat_level  : {result.get('threat_level')}")
    out(f"    action_type   : {result.get('action_type')}")
    out("")

    # 5. full ctas
    out("[5] CTAS (full list)")
    ctas = result.get("ctas", []) or []
    if not ctas:
        out("    (none)")
    for i, c in enumerate(ctas):
        det = c.get("details", {}) or {}
        # 'sector' is not a top-level CTA field; surface whatever sector info the
        # CTA carries in details, faithfully labelled as its source key.
        sec = det.get("sector") or det.get("target_sector") or det.get("heavy_sector") or ""
        out(f"    [{i}] action={c.get('action')} ticker={c.get('ticker')!r} "
            f"dollars={c.get('dollars')} reason={c.get('reason')} "
            f"severity={c.get('severity')} priority={c.get('priority')}")
        out(f"        sector(from details)={sec!r}  details={json.dumps(det, default=str)}")
    out("")

    # 6. concentration analyzer output
    out("[6] CONCENTRATION ANALYZER OUTPUT (pool_results['concentration'])")
    conc = pr.get("concentration", {}) or {}
    port = conc.get("portfolio_result", {}) or {}
    out("    portfolio_result:")
    out(f"        value    : {port.get('value')}")
    out(f"        severity : {port.get('severity')}")
    out(f"        flag     : {port.get('flag')}")
    out(f"        details  : {json.dumps(port.get('details', {}), default=str)}")
    out("    ticker_results (per held ticker):")
    for t, d in (conc.get("ticker_results", {}) or {}).items():
        out(f"        {t}:")
        out(f"            value    : {d.get('value')}")
        out(f"            severity : {d.get('severity')}")
        out(f"            flag     : {d.get('flag')}")
        out(f"            weight   : {d.get('weight')}")
        out(f"            details  : {json.dumps(d.get('details', {}), default=str)}")
    out("")

    # 7. soft-check flags from edge_report.json
    out("[7] SOFT-CHECK FLAGS (from edge_report.json)")
    any_flag = False
    for c in report_port.get("checks", []):
        if c["passed"] or not c["applicable"]:
            continue
        tag = "HARD" if c["hard"] else "SOFT"
        any_flag = True
        for v in c["violations"]:
            out(f"    ({tag}) {c['name']}: {v['reason']}")
            out(f"           offending={json.dumps(v['offending'], default=str)}")
    if not any_flag:
        out("    (no checks flagged)")
    out("")


def main() -> None:
    corpus = _load(ec.CORPUS_PATH)
    report = _load(REPORT_PATH)
    entries = {p["id"]: p for p in corpus["portfolios"]}
    report_ports = {p["id"]: p for p in report["portfolios"]}

    flagged = flagged_ids(report)

    # Compute dominant weight for every flagged portfolio to choose the middle set.
    doms: dict[str, tuple[float, dict]] = {fid: dominant_weight(entries[fid]) for fid in flagged}

    out("SEAM TRIAGE: dominant weight of every concentration_flag_actionable portfolio")
    out("-" * 78)
    for fid, (dom, _) in sorted(doms.items(), key=lambda kv: kv[1][0], reverse=True):
        mark = ""
        if fid == EXTREME_HIGH:
            mark = "   [named extreme: 50/50 end]"
        elif fid == EXTREME_ISSUER:
            mark = "   [named extreme: single-issuer end]"
        out(f"    {fid:28} dominant_weight={dom * 100:7.4f}%{mark}")
    out("")

    # Pick the middle 2-3: exclude the two named extremes, order by dominant
    # weight, take those whose dominant weight sits between the extremes' values
    # (nearest the midpoint first).
    hi = doms[EXTREME_HIGH][0]
    lo = doms[EXTREME_ISSUER][0]
    mid = (hi + lo) / 2.0
    candidates = [fid for fid in flagged if fid not in (EXTREME_HIGH, EXTREME_ISSUER)]
    candidates.sort(key=lambda fid: abs(doms[fid][0] - mid))
    chosen_mid = candidates[:3]

    out("SELECTED MIDDLE PORTFOLIOS (nearest the midpoint dominant weight):")
    out(f"    extremes: {EXTREME_HIGH}={hi * 100:.4f}%  |  "
        f"{EXTREME_ISSUER}={lo * 100:.4f}%  |  midpoint={mid * 100:.4f}%")
    for fid in chosen_mid:
        out(f"    picked: {fid:28} dominant_weight={doms[fid][0] * 100:.4f}%")
    note = ("NOTE: the individual dominant weights across the flagged set are nearly "
            "uniform (~50%); the real gradient is in the secondary structure "
            "(single-issuer aggregation, sector make-up), not the top single weight.")
    out(f"    {note}")
    out("")

    dump_order = [EXTREME_ISSUER] + chosen_mid + [EXTREME_HIGH]
    out(f"DUMP ORDER: {dump_order}")
    out("")

    for fid in dump_order:
        _, res = doms[fid]
        dump_portfolio(entries[fid], res, report_ports[fid])

    OUT_PATH.write_text("\n".join(_buf) + "\n", encoding="utf-8")
    print(f"\n[written] {OUT_PATH}")


if __name__ == "__main__":
    main()
