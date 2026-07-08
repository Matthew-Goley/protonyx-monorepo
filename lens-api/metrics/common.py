"""Shared offline bootstrap + as-of-T store for the caution-score calibration study.

Mirrors the discipline of ``tests/parity`` / ``tests/edge``: the engine runs against
a FROZEN copy of ``market_data.json`` with the DataStore forced offline (network
blocked). On top of that, ``AsOfStore`` serves only data available up to a chosen
trading-day index ``T`` (``closes[:T]``), so an "as of T" score can never see the
future. Earnings/dividends are neutralized (served empty) to avoid a look-ahead leak.

READ-ONLY on engine/. Nothing here imports-and-mutates engine internals.
"""

from __future__ import annotations

import json
import math
import os
import shutil
import sys
import tempfile
from pathlib import Path
from typing import Any

SELF_DIR = Path(__file__).resolve().parent
LENS_API_DIR = SELF_DIR.parent                    # metrics -> lens-api
FROZEN_MARKET_DATA = LENS_API_DIR / "tests" / "parity" / "frozen_market_data.json"
CORPUS_PATH = SELF_DIR / "corpus.json"
OUTPUT_DIR = SELF_DIR / "output"

# ── Study parameters (fixed up front, not tuned to the result) ──────────────
# The frozen 1y series is 252 trading days (indices 0..251). A 40-day forward
# window at T = 124/164/204 partitions [124,244) into three DISJOINT windows:
#   [124,164)   [164,204)   [204,244)
# so the three as-of dates are genuinely independent time-points, not overlapping.
AS_OF_DATES: tuple[int, ...] = (124, 164, 204)
FORWARD_H = 40            # forward window length in trading days
LOOKBACK_6MO = 124        # trading days the '6mo' analyzers expect
LOOKBACK_1MO = 20
MASTER_PERIOD = "1y"      # the frozen array we treat as the single master series

# Five equal caution-score bands across 1..99.
BANDS: tuple[tuple[int, int], ...] = ((1, 20), (21, 40), (41, 60), (61, 80), (81, 99))

TIERS = ("low", "regular", "high")

# Explicit, self-contained sector map for the usable universe. ``sector_for``
# trusts a valid live sector, so these win uniformly (independent of engine
# drift). Index ETFs (SPY/SCHD/VXUS/VYM) are handled by the index_fund analyzer;
# their sector here is only a label and is excluded from sector-weight math.
SECTOR_MAP: dict[str, str] = {
    "AAPL": "Technology", "MSFT": "Technology", "GOOG": "Communication Services",
    "JPM": "Financial Services", "UNH": "Healthcare", "PG": "Consumer Defensive",
    "XOM": "Energy", "EOG": "Energy", "SLB": "Energy", "UEC": "Energy",
    "CDE": "Basic Materials", "HL": "Basic Materials",
    "F": "Consumer Cyclical", "RIVN": "Consumer Cyclical", "LCID": "Consumer Cyclical",
    "GME": "Consumer Cyclical", "OPEN": "Real Estate",
    "AMC": "Communication Services", "DJT": "Communication Services",
    "FUBO": "Communication Services",
    "COIN": "Financial Services", "HOOD": "Financial Services", "SOFI": "Financial Services",
    "MARA": "Financial Services", "RIOT": "Financial Services", "CLSK": "Financial Services",
    "MSTR": "Technology", "PLTR": "Technology", "BBAI": "Technology", "SOUN": "Technology",
    "IONQ": "Technology", "RGTI": "Technology", "QUBT": "Technology",
    "CHPT": "Industrials", "PLUG": "Industrials", "FCEL": "Industrials",
    "RUN": "Industrials", "SPCE": "Industrials",
    # Non-index leveraged/thematic ETFs get a plain sector label.
    "SOXL": "Technology", "TQQQ": "Technology",
    # Index ETFs (label only; excluded from sector-weight math by index_fund).
    "SPY": "Diversified", "SCHD": "Diversified", "VXUS": "Diversified", "VYM": "Diversified",
}

# SPY is the beta benchmark; keep it out of holdings so it is unambiguous.
BENCHMARK = "SPY"

_READY = False


def setup_offline() -> None:
    """Point the engine at a throwaway copy of the frozen cache and block network.

    Idempotent. Must run before importing engine pipeline modules.
    """
    global _READY
    if _READY:
        return
    tmp = tempfile.mkdtemp(prefix="lens_metrics_")
    shutil.copy(FROZEN_MARKET_DATA, Path(tmp) / "market_data.json")
    os.environ["LENS_DATA_DIR"] = tmp
    if str(LENS_API_DIR) not in sys.path:
        sys.path.insert(0, str(LENS_API_DIR))

    from engine import store as store_mod

    store_mod.DataStore._is_fresh = staticmethod(lambda ts, ttl: bool(ts))  # type: ignore[assignment]
    store_mod.DataStore._is_quote_fresh = lambda self, ts, ri: bool(ts)  # type: ignore[assignment]

    class _Blocked(Exception):
        pass

    def _no_network(*a: Any, **k: Any):
        raise _Blocked("network blocked in metrics harness")

    store_mod.yf.Ticker = _no_network  # type: ignore[assignment]
    store_mod.yf.download = _no_network  # type: ignore[assignment]

    _READY = True


_MASTER: dict[str, list[float]] | None = None


def master_series() -> dict[str, list[float]]:
    """ticker -> full 252-close master series (the frozen '1y' array).

    Only tickers with a full-length series are returned; these are the usable
    universe (holdings are drawn from here, benchmark SPY included).
    """
    global _MASTER
    if _MASTER is None:
        with open(FROZEN_MARKET_DATA, encoding="utf-8") as f:
            data = json.load(f)
        out: dict[str, list[float]] = {}
        for t, entry in data.items():
            series = (entry.get("history", {}) or {}).get(MASTER_PERIOD) or []
            closes = [float(v) for v in series if v is not None and math.isfinite(float(v)) and float(v) > 0]
            if len(closes) == 252:
                out[t] = closes
        _MASTER = out
    return _MASTER


def universe() -> list[str]:
    """Usable holding tickers (full history), excluding the SPY benchmark."""
    return sorted(t for t in master_series() if t != BENCHMARK)


class AsOfStore:
    """Serves the engine only data available up to trading-day index ``T``.

    - ``get_history(t,'1y')``   -> master[:T]
    - ``get_history(t,'6mo')``  -> master[T-124:T]
    - ``get_history(t,'1mo')``  -> master[T-20:T]
    - ``get_snapshot`` price    -> master[T-1]  (as-of-T price for weights/equity)
    - ``get_earnings`` / ``get_dividends`` -> []  (neutralized; no look-ahead)
    - ``get_quote`` / ``get_meta`` -> {}  (only feed market-cap gating; absent in
      the frozen cache anyway, same as the parity/edge harnesses)

    The engine calls these with the same signatures the real DataStore exposes.
    """

    def __init__(self, master: dict[str, list[float]], t: int) -> None:
        self._m = master
        self.t = t

    def _slice(self, ticker: str, start: int, end: int) -> list[float]:
        s = self._m.get(ticker.upper())
        if not s:
            return []
        return list(s[max(0, start):end])

    def get_history(self, ticker: str, period: str, refresh_interval: str) -> list[float]:
        t = self.t
        if period == "6mo":
            return self._slice(ticker, t - LOOKBACK_6MO, t)
        if period == "1mo":
            return self._slice(ticker, t - LOOKBACK_1MO, t)
        # '1y' and anything else: full available lookback ending at T.
        return self._slice(ticker, 0, t)

    def get_snapshot(self, ticker: str, refresh_interval: str) -> dict[str, Any]:
        price = self.asof_price(ticker)
        return {
            "ticker": ticker,
            "price": price if price is not None else 0.0,
            "sector": SECTOR_MAP.get(ticker.upper(), "Unknown"),
            "name": ticker,
        }

    def asof_price(self, ticker: str) -> float | None:
        s = self._m.get(ticker.upper())
        if not s or self.t < 1:
            return None
        return s[self.t - 1]

    def get_earnings(self, ticker: str) -> list[dict[str, Any]]:
        return []

    def get_dividends(self, ticker: str) -> list[dict[str, Any]]:
        return []

    def get_quote(self, ticker: str) -> dict[str, Any]:
        return {}

    def get_meta(self, ticker: str) -> dict[str, Any]:
        return {}


def band_for(score: int) -> str:
    """Return the '1-20'-style band label for a caution score."""
    for lo, hi in BANDS:
        if lo <= score <= hi:
            return f"{lo}-{hi}"
    # Scores are clamped to [1,99] by the engine, so this should not happen.
    return "out-of-range"


def band_labels() -> list[str]:
    return [f"{lo}-{hi}" for lo, hi in BANDS]


def realized_forward(shares: dict[str, float], master: dict[str, list[float]],
                     t: int, h: int = FORWARD_H) -> dict[str, float]:
    """Buy-and-hold realized outcome over ``master[t : t+h]`` (strictly after T).

    Returns realized forward volatility (annualized %, from daily log returns of
    the portfolio value series) and realized max drawdown (%, worst peak-to-trough
    of that value series). Independent of the caution score.
    """
    import numpy as np

    end = t + h
    values: list[float] = []
    for day in range(t, end):
        v = 0.0
        ok = False
        for tk, sh in shares.items():
            s = master.get(tk.upper())
            if s and day < len(s):
                v += sh * s[day]
                ok = True
        if ok:
            values.append(v)
    if len(values) < 3:
        return {"realized_vol": float("nan"), "realized_max_drawdown": float("nan")}

    arr = np.array(values, dtype=float)
    log_ret = np.diff(np.log(arr))
    vol = float(np.std(log_ret) * math.sqrt(252) * 100) if len(log_ret) else float("nan")

    running_peak = np.maximum.accumulate(arr)
    drawdowns = (arr - running_peak) / running_peak
    max_dd = float(-np.min(drawdowns) * 100)  # positive % magnitude

    return {"realized_vol": vol, "realized_max_drawdown": max_dd}
