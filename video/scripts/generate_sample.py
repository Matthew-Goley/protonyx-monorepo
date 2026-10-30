"""Run the real Lens engine once on the fixed sample portfolio and write
video/data/sample.json, the only data source the video reads.

Usage (from video/, with lens-api's Python deps installed):
  python scripts/generate_sample.py           # offline, deterministic (default)
  python scripts/generate_sample.py --live    # live yfinance prices instead

Offline mode reuses the lens-api parity harness approach: the engine reads a
frozen copy of market_data.json with the DataStore forced fresh and every
yfinance call blocked. The earnings and dividends analyzers also call
date.today(), so offline mode pins that clock to AS_OF (the day the frozen
snapshot was captured); otherwise "upcoming" events would drift out of the
snapshot as real time passes. Together this makes the output byte-identical
on every run.
Nothing here re-implements engine logic; it only calls generate_lens_full and
reshapes the result.

The engine's own brief is kept verbatim under brief.raw. brief.display is an
excerpt for on-screen use: the brief is split into clauses at its em dashes,
and only clauses with no predictive wording are kept (the video's copy rules
forbid both em dashes and predictive language). No words are rewritten.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import shutil
import sys
import tempfile
from datetime import date
from pathlib import Path
from typing import Any

VIDEO_DIR = Path(__file__).resolve().parent.parent
LENS_API_DIR = VIDEO_DIR.parent / "lens-api"
FROZEN_MARKET_DATA = LENS_API_DIR / "tests" / "parity" / "frozen_market_data.json"
PORTFOLIO_FILE = VIDEO_DIR / "data" / "portfolio.json"
OUT_FILE = VIDEO_DIR / "data" / "sample.json"

# Clauses containing any of these are dropped from brief.display.
PREDICTIVE = re.compile(
    r"\b(will|would|could|might|may|should|suggests?|likely|expect\w*|"
    r"forecast\w*|project\w*|outlook|heading into|setup|path back|poised)\b",
    re.IGNORECASE,
)

# Capture date of frozen_market_data.json (see parity_baseline.json _meta).
AS_OF = date(2026, 7, 7)

SEVERITY_LEVEL = {"none": 0, "low": 1, "moderate": 2, "high": 3, "critical": 4}


def setup_offline() -> None:
    tmp = tempfile.mkdtemp(prefix="lens_video_")
    shutil.copy(FROZEN_MARKET_DATA, Path(tmp) / "market_data.json")
    os.environ["LENS_DATA_DIR"] = tmp


def force_offline() -> None:
    from engine import store as store_mod

    store_mod.DataStore._is_fresh = staticmethod(lambda ts, ttl: bool(ts))  # type: ignore[assignment]
    store_mod.DataStore._is_quote_fresh = lambda self, ts, ri: bool(ts)  # type: ignore[assignment]

    def _no_network(*a: Any, **k: Any):
        raise RuntimeError("network blocked (offline sample generation)")

    store_mod.yf.Ticker = _no_network  # type: ignore[assignment]
    store_mod.yf.download = _no_network  # type: ignore[assignment]

    from engine.lens.analyzers import dividends, earnings

    class _PinnedDate(date):
        @classmethod
        def today(cls) -> date:  # type: ignore[override]
            return AS_OF

    dividends.date = _PinnedDate  # type: ignore[assignment]
    earnings.date = _PinnedDate  # type: ignore[assignment]


def build_positions(raw_positions: list[dict], store: Any) -> list[dict]:
    positions = []
    for raw in raw_positions:
        ticker = raw["ticker"].upper().strip()
        snap = store.get_snapshot(ticker, "5 min")
        if not snap or not snap.get("price"):
            sys.exit(f"No market data for {ticker}. In offline mode every ticker must be in {FROZEN_MARKET_DATA.name}.")
        price = float(snap["price"])
        shares = float(raw["shares"])
        entry = float(raw.get("entry_price", 0))
        positions.append({
            "ticker": ticker,
            "shares": shares,
            "equity": shares * (entry if entry > 0 else price),
            "price": price,
            "sector": snap.get("sector", "Unknown"),
            "name": snap.get("name", ticker),
            "added_at": "2024-01-01T00:00:00",
        })
    return positions


def display_brief(raw: str) -> list[str]:
    """Factual clauses of the brief, one entry per engine sentence."""
    out = []
    for sentence in re.split(r"(?<=[.])\s+", raw.strip()):
        clauses = [c.strip(" .") for c in re.split(r"\s*—\s*", sentence)]
        kept = [c for c in clauses if c and not PREDICTIVE.search(c)]
        if kept:
            text = ", ".join(kept)
            out.append(text[0].upper() + text[1:] + ".")
    return out


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--live", action="store_true", help="use live yfinance data instead of the frozen snapshot")
    args = parser.parse_args()

    if not args.live:
        setup_offline()
    sys.path.insert(0, str(LENS_API_DIR))
    if not args.live:
        force_offline()

    from engine.constants import DEFAULT_SETTINGS, sector_for
    from engine.lens.registry import REGISTRY
    from engine.lens_engine import generate_lens_full
    from engine.store import DataStore

    portfolio = json.loads(PORTFOLIO_FILE.read_text(encoding="utf-8"))
    store = DataStore()
    positions = build_positions(portfolio["positions"], store)
    settings = {**DEFAULT_SETTINGS, "risk_tier": portfolio["risk_tier"]}
    result = generate_lens_full([dict(p) for p in positions], store, settings)

    pool = result["pool_results"]
    summary = pool.get("_positions_summary", {})
    weights = summary.get("ticker_weights", {})
    values = summary.get("ticker_current_values", {})

    analyzers = []
    for spec in REGISTRY:
        pr = pool.get(spec.name, {}).get("portfolio_result", {})
        sev = pr.get("severity", "none")
        analyzers.append({
            "key": spec.name,
            "severity": sev,
            "level": SEVERITY_LEVEL.get(sev, 0),
            "flag": bool(pr.get("flag", False)),
            "value": pr.get("value"),
        })

    actions = [
        {
            "rank": i + 1,
            "action": c["action"],
            "ticker": c.get("ticker", ""),
            "dollars": c.get("dollars", 0.0),
            "severity": c.get("severity", "none"),
            "reason": c.get("reason", ""),
            "priority": c.get("priority"),
        }
        for i, c in enumerate(result["ctas"])
    ]

    sample = {
        "meta": {
            "label": portfolio["label"],
            "risk_tier": portfolio["risk_tier"],
            "market_data": "live yfinance" if args.live else "frozen snapshot (lens-api/tests/parity/frozen_market_data.json)",
            "as_of": date.today().isoformat() if args.live else AS_OF.isoformat(),
            "engine": "lens-api/engine generate_lens_full",
        },
        "portfolio": {
            "total_equity": summary.get("total_equity"),
            "positions": [
                {
                    "ticker": p["ticker"],
                    "name": p["name"],
                    "sector": sector_for(p["ticker"], p["sector"] if p["sector"] != "Unknown" else None),
                    "shares": p["shares"],
                    "value": values.get(p["ticker"]),
                    "weight_pct": round(100 * weights.get(p["ticker"], 0.0), 1),
                }
                for p in sorted(positions, key=lambda p: -weights.get(p["ticker"], 0.0))
            ],
        },
        "analyzers": analyzers,
        "caution_score": result["caution_score"],
        "action_type": result["action_type"],
        "brief": {"raw": result["brief"], "display": display_brief(result["brief"])},
        "actions": actions,
        "net_cta_delta": result["net_cta_delta"],
    }

    OUT_FILE.write_text(json.dumps(sample, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"Wrote {OUT_FILE.relative_to(VIDEO_DIR)}: caution {sample['caution_score']}, "
          f"{len(analyzers)} analyzers, {len(actions)} actions, {len(sample['brief']['display'])} brief lines")


if __name__ == "__main__":
    main()
