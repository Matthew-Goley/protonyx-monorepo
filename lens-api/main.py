"""Lens API — FastAPI service wrapping the Lens computation engine."""

from __future__ import annotations

import asyncio
import json
import logging
import math
import os
from typing import Any

import pandas as pd
import yfinance as yf
from dotenv import load_dotenv

load_dotenv()

from fastapi import FastAPI, HTTPException, Query, Security
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.security.api_key import APIKeyHeader
from pydantic import BaseModel
from starlette.concurrency import run_in_threadpool

from engine.constants import DEFAULT_SETTINGS
from engine.lens_engine import generate_lens_full
from engine.store import DataStore

logging.basicConfig(level=logging.INFO)
_log = logging.getLogger(__name__)

_VALID_PERIODS = {"1mo", "3mo", "6mo", "1y", "2y", "5y"}

app = FastAPI(title="Lens API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "https://app.use-lens.com"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ------------------------------------------------------------------
# Auth: shared-secret API key
# ------------------------------------------------------------------

_API_KEY = os.environ.get("LENS_API_KEY", "")
_api_key_header = APIKeyHeader(name="X-API-Key", auto_error=False)


def _require_api_key(key: str | None = Security(_api_key_header)) -> None:
    if not _API_KEY:
        raise HTTPException(status_code=500, detail="LENS_API_KEY not configured on server")
    if key != _API_KEY:
        raise HTTPException(status_code=401, detail="Invalid or missing API key")


# ------------------------------------------------------------------
# Singleton DataStore (one in-process market-data cache per worker)
# ------------------------------------------------------------------

_store = DataStore()

# ------------------------------------------------------------------
# Request / response models
# ------------------------------------------------------------------


class AnalyzeRequest(BaseModel):
    positions: list[dict[str, Any]]
    settings: dict[str, Any] | None = None


# ------------------------------------------------------------------
# Helpers
# ------------------------------------------------------------------


def _finitize(value: Any) -> Any:
    """Recursively replace non-finite floats (NaN, +/-inf) with None.

    Starlette's JSONResponse serializes with allow_nan=False, so any NaN/inf
    reaching the response crashes the render with an unhandled 500. Engine
    output and yfinance-derived numbers can both contain NaN, so every response
    body is passed through this first.
    """
    if isinstance(value, float):
        return value if math.isfinite(value) else None
    if isinstance(value, dict):
        return {k: _finitize(v) for k, v in value.items()}
    if isinstance(value, (list, tuple)):
        return [_finitize(v) for v in value]
    return value


# ------------------------------------------------------------------
# Endpoints
# ------------------------------------------------------------------


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/analyze")
async def analyze(
    request: AnalyzeRequest,
    _: None = Security(_require_api_key),
) -> JSONResponse:
    """Run the full Lens pipeline on the supplied portfolio.

    Request body:
      positions  — list of position dicts (ticker, shares, equity, price, sector, name, added_at)
      settings   — optional settings dict; missing keys fall back to defaults

    Returns the full Lens result dict (brief, caution_score, ctas, full_report, etc.).
    """
    merged_settings = {**DEFAULT_SETTINGS, **(request.settings or {})}

    def _run() -> Any:
        # Warm the market-data cache concurrently (batched history + parallel
        # per-ticker fetches) before the analyzers run their serial loops. This
        # turns ~6-7N cold blocking yfinance round trips into a handful of
        # parallel waves. Best-effort: on failure the analyzers fall back to the
        # existing lazy per-ticker fetch, so analysis still succeeds.
        try:
            tickers = [p["ticker"] for p in request.positions if p.get("ticker")]
            _store.prefetch_for_analysis(tickers, merged_settings)
        except Exception:
            _log.exception("prefetch_for_analysis failed; continuing with lazy fetch")
        return generate_lens_full(request.positions, _store, merged_settings)

    try:
        result = await run_in_threadpool(_run)
    except Exception as exc:
        _log.exception("Lens pipeline failed")
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    # Pydantic cannot serialize engine-internal types (e.g. DataStore) that may
    # appear in pool_results. Serialise via stdlib json with a str fallback so
    # unknown types become their repr rather than blowing up the response, then
    # strip any NaN/inf (allow_nan=False in the final render would otherwise 500).
    return JSONResponse(content=_finitize(json.loads(json.dumps(result, default=str))))


@app.get("/ticker/{symbol}/history")
async def ticker_history(
    symbol: str,
    period: str = Query(default="1y"),
    _: None = Security(_require_api_key),
) -> JSONResponse:
    """OHLCV price history for a single ticker.

    period — one of: 1mo, 3mo, 6mo, 1y, 2y, 5y (default: 1y)
    """
    if period not in _VALID_PERIODS:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid period '{period}'. Must be one of: {', '.join(sorted(_VALID_PERIODS))}",
        )

    sym = symbol.upper()

    try:
        df: pd.DataFrame = await run_in_threadpool(
            lambda: yf.Ticker(sym).history(period=period, interval="1d", auto_adjust=False)
        )
    except Exception as exc:
        _log.exception("yfinance history failed for %s", sym)
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    if df.empty:
        raise HTTPException(status_code=404, detail=f"No data found for ticker '{sym}'")

    # Build rows defensively. yfinance can return NaN cells (e.g. the in-progress
    # trading day, split/halt rows). Starlette's JSONResponse serializes with
    # allow_nan=False, so a single NaN reaching the response raises mid-render
    # (an unhandled 500). Skip rows with no usable close and coerce NaN volume to 0.
    try:
        rows = []
        for idx, row in df.iterrows():
            close = row.get("Close")
            if close is None or pd.isna(close):
                continue  # a day with no close is not a usable point

            def _f(col: str, fallback: float) -> float:
                v = row.get(col)
                return round(float(v), 4) if v is not None and not pd.isna(v) else fallback

            close_f = round(float(close), 4)
            vol = row.get("Volume")
            rows.append(
                {
                    "date": pd.Timestamp(idx).strftime("%Y-%m-%d"),
                    "open": _f("Open", close_f),
                    "high": _f("High", close_f),
                    "low": _f("Low", close_f),
                    "close": close_f,
                    "volume": int(vol) if vol is not None and not pd.isna(vol) else 0,
                }
            )
    except Exception as exc:
        _log.exception("history row build failed for %s", sym)
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    if not rows:
        raise HTTPException(status_code=404, detail=f"No data found for ticker '{sym}'")

    # Sanitize before the response is constructed. JSONResponse renders eagerly in
    # its constructor with allow_nan=False, so any non-finite float reaching it
    # raises *during render* — an unhandled, generic 500 that the try/except above
    # cannot catch. The per-row guards use pd.isna(), which catches NaN but NOT
    # +/-inf, so an inf close/open/high/low (seen in production from yfinance) slips
    # through to the render and crashes it. _finitize() (used by /analyze) strips
    # NaN and inf to None; the json round-trip with default=str also defuses any
    # stray non-serializable type. Mirror /analyze exactly.
    return JSONResponse(content=_finitize(json.loads(json.dumps(rows, default=str))))


@app.get("/tickers/history")
async def tickers_history(
    symbols: str = Query(default=""),
    period: str = Query(default="6mo"),
    _: None = Security(_require_api_key),
) -> JSONResponse:
    """Daily closes for MANY tickers in a single batched request.

    symbols — comma-separated list, e.g. AAPL,MSFT,KO
    period  — one of: 1mo, 3mo, 6mo, 1y, 2y, 5y (default: 6mo)

    Returns { "AAPL": [{date, close}, ...], ... }. Backs the lens-app portfolio
    equity curve (usePortfolioHistory): one round trip + one yfinance download
    instead of N separate /ticker/{symbol}/history calls. Missing/unknown symbols
    are simply absent from the map. NaN/inf closes are dropped (finitize + skip).
    """
    if period not in _VALID_PERIODS:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid period '{period}'. Must be one of: {', '.join(sorted(_VALID_PERIODS))}",
        )

    syms = list(dict.fromkeys(s.strip().upper() for s in symbols.split(",") if s.strip()))
    if not syms:
        raise HTTPException(status_code=400, detail="No symbols provided")

    try:
        raw = await run_in_threadpool(
            lambda: yf.download(
                syms, period=period, interval="1d",
                auto_adjust=False, actions=False,
                progress=False, group_by="column", threads=True,
            )
        )
    except Exception as exc:
        _log.exception("yfinance batch download failed for %s", syms)
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    if raw is None or raw.empty:
        return JSONResponse(content={})

    try:
        close = raw["Close"]
    except Exception:  # noqa: BLE001
        return JSONResponse(content={})

    def _series_rows(series: pd.Series) -> list[dict[str, Any]]:
        rows: list[dict[str, Any]] = []
        for idx, val in series.dropna().items():
            try:
                f = float(val)
            except (TypeError, ValueError):
                continue
            if not math.isfinite(f):
                continue
            rows.append({"date": pd.Timestamp(idx).strftime("%Y-%m-%d"), "close": round(f, 4)})
        return rows

    result: dict[str, list[dict[str, Any]]] = {}
    if hasattr(close, "columns"):  # multi-ticker → DataFrame of ticker columns
        for t in syms:
            if t in close.columns:
                rows = _series_rows(close[t])
                if rows:
                    result[t] = rows
    else:  # single ticker → plain Series
        rows = _series_rows(close)
        if rows:
            result[syms[0]] = rows

    return JSONResponse(content=_finitize(result))


@app.get("/ticker/{symbol}/info")
async def ticker_info(
    symbol: str,
    _: None = Security(_require_api_key),
) -> JSONResponse:
    """Company snapshot: name, sector, market cap, valuation, price range."""
    sym = symbol.upper()

    try:
        info: dict = await run_in_threadpool(lambda: yf.Ticker(sym).info)
    except Exception as exc:
        _log.exception("yfinance info failed for %s", sym)
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    # yfinance returns a minimal stub dict for unknown tickers; treat as 404
    # when no recognisable market price field is present.
    if not info or (info.get("currentPrice") is None and info.get("regularMarketPrice") is None):
        raise HTTPException(status_code=404, detail=f"No data found for ticker '{sym}'")

    # NaN-safe: JSONResponse serializes with allow_nan=False, so any NaN numeric
    # field (e.g. trailingPE / dividendYield for non-dividend or unprofitable
    # names) would crash the render. Coerce NaN/inf to None.
    def _num(v: Any) -> float | None:
        try:
            f = float(v)
        except (TypeError, ValueError):
            return None
        return f if math.isfinite(f) else None

    return JSONResponse(
        content={
            "name": info.get("longName") or info.get("shortName"),
            "sector": info.get("sector"),
            "market_cap": _num(info.get("marketCap")),
            "pe_ratio": _num(info.get("trailingPE")),
            "dividend_yield": _num(info.get("dividendYield")),
            "52_week_high": _num(info.get("fiftyTwoWeekHigh")),
            "52_week_low": _num(info.get("fiftyTwoWeekLow")),
            "current_price": _num(info.get("currentPrice")) or _num(info.get("regularMarketPrice")),
        }
    )


@app.get("/ticker/{symbol}/compare")
async def ticker_compare(
    symbol: str,
    symbols: str = Query(default=""),
    period: str = Query(default="1y"),
    _: None = Security(_require_api_key),
) -> JSONResponse:
    """Normalized price history for {symbol} plus comparison tickers.

    symbols — comma-separated list of additional tickers, e.g. NVDA,SPY
    period  — same options as /history (default: 1y)

    Each series is normalized to 100 at its first trading day so all tickers
    are directly comparable on a single chart.
    Returns a list of {date, TICKER: value, ...} objects.
    """
    if period not in _VALID_PERIODS:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid period '{period}'. Must be one of: {', '.join(sorted(_VALID_PERIODS))}",
        )

    sym = symbol.upper()
    comparison = [s.strip().upper() for s in symbols.split(",") if s.strip()] if symbols else []
    all_syms = [sym] + comparison

    async def _fetch_close(ticker: str) -> tuple[str, pd.Series | None]:
        try:
            df: pd.DataFrame = await run_in_threadpool(
                lambda t=ticker: yf.Ticker(t).history(period=period)
            )
            if df.empty:
                return ticker, None
            return ticker, df["Close"]
        except Exception:
            _log.warning("yfinance history failed for %s (compare)", ticker)
            return ticker, None

    fetched = await asyncio.gather(*[_fetch_close(t) for t in all_syms])
    series_map: dict[str, pd.Series] = {t: s for t, s in fetched if s is not None}

    if sym not in series_map:
        raise HTTPException(status_code=404, detail=f"No data found for ticker '{sym}'")

    # Align on a shared date index, forward-fill gaps (e.g. different holidays),
    # then normalize each series to 100 at its own first valid price.
    combined = pd.DataFrame(series_map)
    combined.index = combined.index.tz_localize(None) if combined.index.tz is not None else combined.index
    combined = combined.sort_index()
    combined = combined.ffill()

    for col in combined.columns:
        first_idx = combined[col].first_valid_index()
        if first_idx is not None:
            base = combined.loc[first_idx, col]
            if base and base != 0:
                combined[col] = (combined[col] / base * 100).round(4)

    result = []
    for date, row in combined.iterrows():
        entry: dict[str, Any] = {"date": pd.Timestamp(date).strftime("%Y-%m-%d")}
        for col in combined.columns:
            entry[col] = None if pd.isna(row[col]) else float(row[col])
        result.append(entry)

    return JSONResponse(content=result)
