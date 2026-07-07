"""Deterministic, offline parity harness for the Lens engine.

Proves that engine output is UNCHANGED for every debug_test portfolio x 3 risk
tiers. It runs build_lens_output / generate_lens_full against a FROZEN copy of
market_data.json with the DataStore forced offline (cache always fresh, network
blocked), so results are byte-stable across runs and live price drift can never
masquerade as a regression.

Self-contained: the frozen cache, the 50 portfolios (debug_test.json), and the
captured baseline all live next to this file. No network, no Vector-Main, no
LOCALAPPDATA dependency.

Usage (from lens-api/):
  python tests/parity/parity_harness.py                 # check vs saved baseline
  python tests/parity/parity_harness.py --check FILE    # check vs a specific file
  python tests/parity/parity_harness.py --out FILE      # (re)capture a baseline

Capture a NEW baseline only when you have deliberately, knowingly changed engine
output. For a behavior-preserving change (e.g. editing tuning.py values that are
meant to stay identical, or syncing from Vector-Main), do NOT recapture: run the
default check and it must PASS. See README.md in this directory.
"""

from __future__ import annotations

import argparse
import json
import os
import shutil
import sys
import tempfile
from datetime import datetime
from pathlib import Path
from typing import Any

SELF_DIR = Path(__file__).resolve().parent
LENS_API_DIR = SELF_DIR.parent.parent          # tests/parity -> tests -> lens-api
FROZEN_MARKET_DATA = SELF_DIR / "frozen_market_data.json"
DEBUG_TEST = SELF_DIR / "debug_test.json"
DEFAULT_BASELINE = SELF_DIR / "parity_baseline.json"

TIERS = ("low", "regular", "high")


def _setup_offline_env() -> str:
    """Copy the frozen market cache into a throwaway LENS_DATA_DIR and point the
    engine at it. Must run BEFORE importing engine."""
    tmp = tempfile.mkdtemp(prefix="lens_parity_")
    shutil.copy(FROZEN_MARKET_DATA, Path(tmp) / "market_data.json")
    os.environ["LENS_DATA_DIR"] = tmp
    if str(LENS_API_DIR) not in sys.path:
        sys.path.insert(0, str(LENS_API_DIR))
    return tmp


def _force_offline() -> None:
    """Make the DataStore fully deterministic: any cached entry is treated as
    fresh (so the frozen values are used verbatim) and every yfinance entry point
    raises (so a cache miss degrades identically every run instead of drifting)."""
    from engine import store as store_mod

    store_mod.DataStore._is_fresh = staticmethod(lambda ts, ttl: bool(ts))  # type: ignore[assignment]
    store_mod.DataStore._is_quote_fresh = lambda self, ts, ri: bool(ts)  # type: ignore[assignment]

    class _Blocked(Exception):
        pass

    def _no_network(*a: Any, **k: Any):
        raise _Blocked("network blocked in parity harness")

    store_mod.yf.Ticker = _no_network  # type: ignore[assignment]
    store_mod.yf.download = _no_network  # type: ignore[assignment]


def _strip_nonserializable(obj: Any) -> Any:
    """Recursively drop engine-internal, non-JSON objects (the DataStore under
    pool_results['_store'], whose repr carries a per-run memory address) so the
    snapshot is stable and JSON-clean."""
    if isinstance(obj, dict):
        return {k: _strip_nonserializable(v) for k, v in obj.items() if k != "_store"}
    if isinstance(obj, list):
        return [_strip_nonserializable(v) for v in obj]
    return obj


def _build_positions(portfolio: dict, store: Any) -> list[dict]:
    positions: list[dict] = []
    for raw in portfolio["positions"]:
        ticker = raw["ticker"].upper().strip()
        shares = float(raw["shares"])
        entry_price = float(raw.get("entry_price", 0))
        try:
            snap = store.get_snapshot(ticker, "5 min")
        except Exception:
            continue
        if not snap or not snap.get("price"):
            continue
        current_price = float(snap["price"])
        equity = shares * (entry_price if entry_price > 0 else current_price)
        positions.append({
            "ticker": ticker,
            "shares": shares,
            "equity": equity,
            "price": current_price,
            "sector": snap.get("sector", "Unknown"),
            "name": snap.get("name", ticker),
            "added_at": "2024-01-01T00:00:00",  # fixed so it never perturbs output
        })
    return positions


def run_engine() -> dict[str, Any]:
    from engine.constants import DEFAULT_SETTINGS
    from engine.lens_engine import generate_lens_full
    from engine.store import DataStore

    store = DataStore()
    with open(DEBUG_TEST, encoding="utf-8") as f:
        portfolios = json.load(f)["portfolios"]

    snapshot: dict[str, Any] = {}
    for portfolio in portfolios:
        name = portfolio["name"]
        positions = _build_positions(portfolio, store)
        for tier in TIERS:
            key = f"{name}::{tier}"
            if not positions:
                snapshot[key] = {"_empty": True}
                continue
            settings = {**DEFAULT_SETTINGS, "risk_tier": tier}
            # Fresh copy per run: run_analysis mutates positions (_current_value).
            pos_copy = [dict(p) for p in positions]
            result = generate_lens_full(pos_copy, store, settings)
            snapshot[key] = _strip_nonserializable(result)
    return snapshot


def _canonical(obj: Any) -> str:
    return json.dumps(obj, sort_keys=True, ensure_ascii=False, default=str)


def _diff(base: Any, cur: Any, path: str, out: list[str]) -> None:
    if isinstance(base, dict) and isinstance(cur, dict):
        for k in sorted(set(base) | set(cur)):
            if k not in base:
                out.append(f"{path}.{k}: ADDED ({_canonical(cur[k])[:80]})")
            elif k not in cur:
                out.append(f"{path}.{k}: REMOVED")
            else:
                _diff(base[k], cur[k], f"{path}.{k}", out)
    elif isinstance(base, list) and isinstance(cur, list):
        if len(base) != len(cur):
            out.append(f"{path}: LEN {len(base)} -> {len(cur)}")
        for i in range(min(len(base), len(cur))):
            _diff(base[i], cur[i], f"{path}[{i}]", out)
    else:
        if _canonical(base) != _canonical(cur):
            out.append(f"{path}: {_canonical(base)[:80]} -> {_canonical(cur)[:80]}")


def _canonical_pretty(obj: Any) -> str:
    return json.dumps(obj, sort_keys=True, ensure_ascii=False, indent=2, default=str)


def main() -> None:
    ap = argparse.ArgumentParser(description="Lens engine offline parity check")
    g = ap.add_mutually_exclusive_group()
    g.add_argument("--out", help="write a fresh baseline snapshot to this file")
    g.add_argument("--check", nargs="?", const=str(DEFAULT_BASELINE),
                   help="compare a fresh run against this baseline "
                        f"(default: {DEFAULT_BASELINE.name})")
    args = ap.parse_args()
    # Default action when no flag is given: check against the saved baseline.
    if args.out is None and args.check is None:
        args.check = str(DEFAULT_BASELINE)

    _setup_offline_env()
    _force_offline()
    snapshot = run_engine()

    n_portfolios = len({k.split("::")[0] for k in snapshot})
    n_runs = len(snapshot)
    n_empty = sum(1 for v in snapshot.values() if v.get("_empty"))

    if args.out:
        payload = {
            "_meta": {
                "captured_at": datetime.now().isoformat(timespec="seconds"),
                "portfolios": n_portfolios,
                "runs": n_runs,
                "empty_runs": n_empty,
                "frozen_market_data": FROZEN_MARKET_DATA.name,
            },
            "results": snapshot,
        }
        Path(args.out).write_text(_canonical_pretty(payload), encoding="utf-8")
        print(f"[baseline] wrote {n_runs} runs ({n_portfolios} portfolios x 3 tiers), "
              f"{n_empty} empty, to {args.out}")
        return

    base = json.loads(Path(args.check).read_text(encoding="utf-8"))["results"]
    mism: list[str] = []
    for key in sorted(set(base) | set(snapshot)):
        if key not in base:
            mism.append(f"{key}: NEW RUN")
        elif key not in snapshot:
            mism.append(f"{key}: MISSING RUN")
        else:
            _diff(base[key], snapshot[key], key, mism)

    if not mism:
        print(f"[PASS] {n_runs} runs byte-identical to baseline ({Path(args.check).name}).")
        sys.exit(0)
    print(f"[FAIL] {len(mism)} mismatches vs baseline:")
    for m in mism[:200]:
        print("  " + m)
    if len(mism) > 200:
        print(f"  ... and {len(mism) - 200} more")
    sys.exit(1)


if __name__ == "__main__":
    main()
