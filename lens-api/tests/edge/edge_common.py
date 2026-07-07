"""Shared offline bootstrap + engine runner for the edge-case failure harness.

This mirrors the discipline of ``tests/parity/parity_harness.py``: the engine is
run against a FROZEN copy of ``market_data.json`` with the ``DataStore`` forced
offline (every cached entry treated as fresh, every yfinance entry point raises),
so results are deterministic and no live network call can ever happen.

Nothing here touches ``engine/`` — it only imports and drives it.

Import order matters: call ``setup_offline()`` (which sets ``LENS_DATA_DIR`` and
patches the store) BEFORE importing any engine pipeline module. ``run`` /
``run_all_tiers`` do this lazily on first use.
"""

from __future__ import annotations

import json
import os
import shutil
import sys
import tempfile
from copy import deepcopy
from pathlib import Path
from typing import Any

SELF_DIR = Path(__file__).resolve().parent
LENS_API_DIR = SELF_DIR.parent.parent          # tests/edge -> tests -> lens-api
PARITY_DIR = SELF_DIR.parent / "parity"
FROZEN_MARKET_DATA = PARITY_DIR / "frozen_market_data.json"
CORPUS_PATH = SELF_DIR / "edge_corpus.json"
REPORT_PATH = SELF_DIR / "edge_report.json"

TIERS = ("low", "regular", "high")

# Make ``engine`` importable as soon as this module is imported, so sibling
# modules (invariants.py) can ``from engine... import`` at their own module load.
# The offline PATCHING still only happens in setup_offline().
if str(LENS_API_DIR) not in sys.path:
    sys.path.insert(0, str(LENS_API_DIR))

_READY = False


def setup_offline() -> None:
    """Point the engine at a throwaway copy of the frozen cache and block network.

    Idempotent: safe to call more than once. Must run before importing engine
    pipeline modules.
    """
    global _READY
    if _READY:
        return

    tmp = tempfile.mkdtemp(prefix="lens_edge_")
    shutil.copy(FROZEN_MARKET_DATA, Path(tmp) / "market_data.json")
    os.environ["LENS_DATA_DIR"] = tmp
    if str(LENS_API_DIR) not in sys.path:
        sys.path.insert(0, str(LENS_API_DIR))

    from engine import store as store_mod

    # Any cached entry is "fresh" (use the frozen values verbatim); any cache
    # miss raises, so a missing ticker degrades identically every run.
    store_mod.DataStore._is_fresh = staticmethod(lambda ts, ttl: bool(ts))  # type: ignore[assignment]
    store_mod.DataStore._is_quote_fresh = lambda self, ts, ri: bool(ts)  # type: ignore[assignment]

    class _Blocked(Exception):
        pass

    def _no_network(*a: Any, **k: Any):
        raise _Blocked("network blocked in edge harness")

    store_mod.yf.Ticker = _no_network  # type: ignore[assignment]
    store_mod.yf.download = _no_network  # type: ignore[assignment]

    _READY = True


_STORE: Any = None
_FROZEN: dict[str, Any] | None = None


def get_store() -> Any:
    """Return a shared, offline DataStore singleton."""
    global _STORE
    setup_offline()
    if _STORE is None:
        from engine.store import DataStore
        _STORE = DataStore()
    return _STORE


def fresh_store() -> Any:
    """Discard the shared DataStore and build a new one with a clean in-memory
    cache (reloaded from the pristine frozen file).

    Each corpus portfolio is evaluated on a FRESH store so nothing leaks between
    runs: a prior portfolio's buy_new metadata fetch can ``setdefault`` empty
    entries into the in-memory cache, which is enough to flip a later portfolio's
    result. A failure detector must judge each portfolio in isolation, so we
    rebuild the store rather than share one across all 53 runs.
    """
    global _STORE
    setup_offline()
    from engine.store import DataStore
    _STORE = DataStore()
    return _STORE


def frozen_market_data() -> dict[str, Any]:
    global _FROZEN
    if _FROZEN is None:
        with open(FROZEN_MARKET_DATA, encoding="utf-8") as f:
            _FROZEN = json.load(f)
    return _FROZEN


def frozen_prices() -> dict[str, float]:
    """Ticker -> frozen snapshot price. This is the price the engine's
    ``_build_positions_summary`` will use (via ``get_snapshot``), so the corpus
    derives share counts from it to hit precise target weights/values."""
    out: dict[str, float] = {}
    for t, entry in frozen_market_data().items():
        price = (entry.get("quote") or {}).get("price")
        if price and price > 0:
            out[t] = float(price)
    return out


def frozen_tickers() -> list[str]:
    return sorted(frozen_prices().keys())


def strip_store(obj: Any) -> Any:
    """Drop the non-serializable DataStore under pool_results['_store'] and any
    other engine-internal object so the result is JSON-clean for the report."""
    if isinstance(obj, dict):
        return {k: strip_store(v) for k, v in obj.items() if k != "_store"}
    if isinstance(obj, list):
        return [strip_store(v) for v in obj]
    return obj


def run(positions: list[dict], settings: dict | None = None) -> dict:
    """Run the full Lens pipeline offline for one (positions, settings) pair.

    ``settings`` is merged over ``DEFAULT_SETTINGS`` exactly like ``POST /analyze``
    does. Positions are deep-copied first because the pool mutates them
    (``_current_value``). History saving is disabled so runs never touch disk.
    """
    setup_offline()
    from engine.constants import DEFAULT_SETTINGS
    from engine.lens.lens_output import build_lens_output

    # Fresh store per invocation: total isolation, no cross-portfolio leakage
    # (see fresh_store). Reloads from the pristine frozen file, so it is
    # deterministic and independent of run order.
    store = fresh_store()
    merged = {**DEFAULT_SETTINGS, **(settings or {})}
    pos_copy = [deepcopy(p) for p in positions]
    if not pos_copy:
        # build_lens_output short-circuits on empty; call it directly so the
        # documented empty-result shape is what the checker sees.
        return build_lens_output(pos_copy, store, merged, save_history=False)
    return build_lens_output(pos_copy, store, merged, save_history=False)


def run_all_tiers(positions: list[dict]) -> dict[str, dict]:
    """Run the same positions under each risk tier. Used by the tier-monotonicity
    invariant. Returns {tier: result}."""
    return {tier: run(positions, {"risk_tier": tier}) for tier in TIERS}
