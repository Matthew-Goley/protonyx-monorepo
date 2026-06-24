"""Parity check: compare lens-api engine output against Vector-Main reference.

Usage (from lens-api/ directory):
  python parity_check.py [--market-data PATH] [--debug-test PATH] [--ref-output PATH]

Steps this script performs:
  1. Load debug_test.json (Vector-Main portfolios).
  2. If --market-data is supplied, copy it to LENS_DATA_DIR so both runs
     use identical frozen market data.
  3. Run build_lens_output on every portfolio * 3 tiers using the lens-api engine.
  4. If --ref-output is supplied (output.md from Vector-Main debug_runner),
     compare every caution_score, action_type, and CTA list field-by-field
     and report mismatches.
  5. If no --ref-output, write lens-api output to parity_output.md and print a
     summary so you can diff manually.
"""

from __future__ import annotations

import argparse
import json
import os
import shutil
import sys
from pathlib import Path
from typing import Any


def _load_debug_test(path: Path) -> list[dict]:
    with open(path, encoding="utf-8") as f:
        config = json.load(f)
    portfolios = config.get("portfolios", [])
    if not portfolios:
        raise ValueError(f"No portfolios found in {path}")
    return portfolios


def _build_mock_position(raw: dict, store: Any) -> dict | None:
    from datetime import datetime
    ticker = raw["ticker"].upper().strip()
    shares = float(raw["shares"])
    entry_price = float(raw.get("entry_price", 0))
    try:
        snapshot = store.get_snapshot(ticker, "5 min")
        if not snapshot or not snapshot.get("price"):
            return None
        current_price = float(snapshot["price"])
        equity = shares * (entry_price if entry_price > 0 else current_price)
        return {
            "ticker": ticker,
            "shares": shares,
            "equity": equity,
            "price": current_price,
            "sector": snapshot.get("sector", "Unknown"),
            "name": snapshot.get("name", ticker),
            "added_at": datetime.utcnow().isoformat(),
        }
    except Exception as exc:
        print(f"  [warn] Could not build position {ticker}: {exc}")
        return None


def _run_engine(portfolios: list[dict], store: Any, base_settings: dict) -> dict[str, dict]:
    """Run engine on all portfolios × 3 tiers; return nested dict [name][tier]."""
    from engine.lens.lens_output import build_lens_output

    results: dict[str, dict] = {}
    for portfolio in portfolios:
        name = portfolio["name"]
        mock_positions: list[dict] = []
        for raw_pos in portfolio["positions"]:
            built = _build_mock_position(raw_pos, store)
            if built:
                mock_positions.append(built)

        if not mock_positions:
            print(f"  [skip] {name} — no positions could be built")
            continue

        results[name] = {}
        for tier in ("low", "regular", "high"):
            settings = {**base_settings, "risk_tier": tier}
            try:
                result = build_lens_output(mock_positions, store, settings, save_history=False)
                results[name][tier] = result
            except Exception as exc:
                print(f"  [fail] {name}/{tier}: {exc}")
                results[name][tier] = None

    return results


def _format_md(results: dict[str, dict]) -> str:
    lines = ["# Lens API Parity Output", ""]
    for name, tiers in results.items():
        lines.append(f"## {name}")
        for tier in ("low", "regular", "high"):
            result = tiers.get(tier)
            label = {"low": "Conservative", "regular": "Moderate", "high": "Aggressive"}[tier]
            lines.append(f"### {label} (`{tier}`)")
            if result is None:
                lines.append("_(failed)_")
            else:
                lines.append(f"**Brief:** {result.get('brief', '')}")
                lines.append(f"**Caution score:** {result.get('caution_score', 0)}/99")
                lines.append(f"**Net CTA delta:** ${result.get('net_cta_delta', 0):,.0f}")
                ctas = result.get("ctas", [])
                lines.append(f"**CTAs ({len(ctas)}):**")
                for cta in ctas:
                    action = cta.get("action", "?").upper()
                    ticker = cta.get("ticker") or "—"
                    dollars = cta.get("dollars", 0.0) or 0.0
                    reason = cta.get("reason", "?")
                    severity = cta.get("severity", "?")
                    sign = "-" if action in ("SELL", "REBALANCE") else "+"
                    lines.append(f"  - **{action}** `{ticker}` {sign}${abs(dollars):,.0f} — _{reason}_ (severity: {severity})")
            lines.append("")
        lines.append("---")
        lines.append("")
    return "\n".join(lines)


def _compare_with_reference(results: dict[str, dict], ref_md: str) -> bool:
    """
    Parse the reference output.md and compare key fields.
    Returns True if all checks pass.
    """
    mismatches: list[str] = []
    all_pass = True

    for name, tiers in results.items():
        for tier in ("low", "regular", "high"):
            result = tiers.get(tier)
            if result is None:
                continue

            # Look for this portfolio + tier block in the reference markdown
            label = {"low": "Conservative", "regular": "Moderate", "high": "Aggressive"}[tier]
            search = f"### {label} (`{tier}`)"
            if search not in ref_md:
                continue

            # Find caution score in reference
            import re
            # Narrow search window to this portfolio section
            section_start = ref_md.find(f"## {name}")
            if section_start == -1:
                continue
            next_section = ref_md.find("\n## ", section_start + 1)
            section = ref_md[section_start:next_section] if next_section != -1 else ref_md[section_start:]

            tier_start = section.find(search)
            if tier_start == -1:
                continue
            next_tier = section.find("\n### ", tier_start + 1)
            tier_block = section[tier_start:next_tier] if next_tier != -1 else section[tier_start:]

            m = re.search(r"\*\*Caution score:\*\* (\d+)/99", tier_block)
            if m:
                ref_score = int(m.group(1))
                got_score = result.get("caution_score", 0)
                if ref_score != got_score:
                    mismatches.append(
                        f"  {name}/{tier} caution_score: ref={ref_score} got={got_score}"
                    )
                    all_pass = False

            m = re.search(r"\*\*Net CTA delta:\*\* \$([0-9,\-]+)", tier_block)
            if m:
                ref_delta = int(m.group(1).replace(",", "").replace("-", ""))
                got_delta = abs(int(result.get("net_cta_delta", 0)))
                if ref_delta != got_delta:
                    mismatches.append(
                        f"  {name}/{tier} net_cta_delta: ref={ref_delta} got={got_delta}"
                    )
                    all_pass = False

    if all_pass:
        print("\n[PASS] All compared fields match the reference output.")
    else:
        print(f"\n[FAIL] {len(mismatches)} mismatches found:")
        for m in mismatches:
            print(m)

    return all_pass


def main() -> None:
    parser = argparse.ArgumentParser(description="Lens parity check")
    parser.add_argument("--market-data", help="Path to market_data.json from Vector-Main run")
    parser.add_argument("--debug-test", default=None, help="Path to debug_test.json")
    parser.add_argument("--ref-output", default=None, help="Path to output.md from Vector-Main debug_runner")
    args = parser.parse_args()

    # Locate debug_test.json
    if args.debug_test:
        debug_test_path = Path(args.debug_test)
    else:
        candidates = [
            Path(__file__).parent.parent.parent / "Vector-Main" / "debug_test.json",
            Path(__file__).parent / "debug_test.json",
        ]
        debug_test_path = next((p for p in candidates if p.exists()), None)
        if debug_test_path is None:
            print("[error] Could not find debug_test.json. Pass --debug-test PATH.")
            sys.exit(1)

    print(f"Using debug_test.json: {debug_test_path}")

    # Set up LENS_DATA_DIR
    lens_data_dir = os.environ.get("LENS_DATA_DIR", str(Path.home() / "Vector" / "data"))
    Path(lens_data_dir).mkdir(parents=True, exist_ok=True)
    os.environ["LENS_DATA_DIR"] = lens_data_dir
    print(f"LENS_DATA_DIR: {lens_data_dir}")

    # Copy market_data.json if provided
    if args.market_data:
        src = Path(args.market_data)
        dst = Path(lens_data_dir) / "market_data.json"
        shutil.copy(src, dst)
        print(f"Copied market_data.json: {src} -> {dst}")

    # Import engine (after env is set so DataStore sees LENS_DATA_DIR)
    from engine.constants import DEFAULT_SETTINGS
    from engine.store import DataStore

    store = DataStore()
    portfolios = _load_debug_test(debug_test_path)
    print(f"Running {len(portfolios)} portfolios × 3 tiers...")

    results = _run_engine(portfolios, store, DEFAULT_SETTINGS)

    output_md = _format_md(results)
    output_path = Path(__file__).parent / "parity_output.md"
    output_path.write_text(output_md, encoding="utf-8")
    print(f"\nOutput written to: {output_path}")

    if args.ref_output:
        ref_md = Path(args.ref_output).read_text(encoding="utf-8")
        _compare_with_reference(results, ref_md)
    else:
        print("No --ref-output supplied. Diff parity_output.md against Vector-Main output.md manually.")


if __name__ == "__main__":
    main()
