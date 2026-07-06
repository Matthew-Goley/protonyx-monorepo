from __future__ import annotations

import json
import logging
import os
from concurrent.futures import ThreadPoolExecutor
from copy import deepcopy
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

import yfinance as yf

from .yfinance_counter import yf_count
from .constants import (
    APP_STATE_FILE,
    DATA_DIR,
    DEFAULT_APP_STATE,
    DEFAULT_POSITIONS,
    DEFAULT_SETTINGS,
    INDEX_ETFS,
    MARKET_DATA_FILE,
    POSITIONS_FILE,
    LAYOUT_FILE,
    REFRESH_INTERVAL_MINUTES,
    SETTINGS_FILE,
    TTL_DIVIDENDS_MINUTES,
    TTL_EARNINGS_MINUTES,
    TTL_HISTORY_DAILY_MINUTES,
    TTL_META_MINUTES,
    VOLATILITY_LOOKBACK_PERIODS,
)

_log = logging.getLogger(__name__)


class DataStore:
    """
    Single source of truth for all Vector application data.

    Manages four JSON files in ~/Vector/data/:
      positions.json    — user holdings (ticker + shares + cost_basis + added_at)
      settings.json     — app preferences
      app_state.json    — onboarding flag, first launch date
      market_data.json  — rich per-ticker market data with smart TTL caching:
          quote         price, OHLC, volume, market_cap, pe/pb/ps/peg, beta,
                        dividend_yield, eps_ttm, 52w high/low, forward_pe
          meta          name, sector, industry, exchange, currency, country,
                        employees, description, website
          history       close-price lists for 1d/5d/1mo/3mo/6mo/1y/2y/5y
          history_ohlcv full OHLCV dicts for the same periods
          dividends     historical dividend payments
          earnings      upcoming earnings dates + estimates from calendar

    TTLs:
      quote / 1d-5d history  — follows refresh_interval setting
      meta                   — 24 h
      1mo+ history (daily)   — 60 min
      dividends / earnings   — 24 h
    """

    ALL_HISTORY_PERIODS = ('1d', '5d', '1mo', '3mo', '6mo', '1y', '2y', '5y')

    def __init__(self) -> None:
        self._market_cache: dict[str, Any] | None = None
        DATA_DIR.mkdir(parents=True, exist_ok=True)

    # ------------------------------------------------------------------
    # Low-level JSON I/O — atomic write via .tmp + os.replace
    # ------------------------------------------------------------------

    def _read_json(self, path: Path, default: Any) -> Any:
        DATA_DIR.mkdir(parents=True, exist_ok=True)
        if not path.exists():
            self._write_json(path, default)
            return deepcopy(default)
        try:
            return json.loads(path.read_text(encoding='utf-8'))
        except (json.JSONDecodeError, OSError):
            self._write_json(path, default)
            return deepcopy(default)

    def _write_json(self, path: Path, payload: Any) -> None:
        DATA_DIR.mkdir(parents=True, exist_ok=True)
        tmp = path.with_suffix(path.suffix + '.tmp')
        tmp.write_text(json.dumps(payload, indent=2), encoding='utf-8')
        os.replace(str(tmp), str(path))  # atomic on same drive (Windows + POSIX)

    # ------------------------------------------------------------------
    # Positions
    # ------------------------------------------------------------------

    def load_positions(self) -> list[dict[str, Any]]:
        return self._read_json(POSITIONS_FILE, DEFAULT_POSITIONS)

    def save_positions(self, positions: list[dict[str, Any]]) -> None:
        self._write_json(POSITIONS_FILE, positions)

    # ------------------------------------------------------------------
    # Settings
    # ------------------------------------------------------------------

    def load_settings(self) -> dict[str, Any]:
        raw = self._read_json(SETTINGS_FILE, DEFAULT_SETTINGS)
        merged = deepcopy(DEFAULT_SETTINGS)
        merged.update(raw)
        merged['direction_thresholds'].update(raw.get('direction_thresholds', {}))
        merged['volatility'].update(raw.get('volatility', {}))
        return merged

    def save_settings(self, settings: dict[str, Any]) -> None:
        self._write_json(SETTINGS_FILE, settings)

    # ------------------------------------------------------------------
    # App state
    # ------------------------------------------------------------------

    def load_app_state(self) -> dict[str, Any]:
        state = self._read_json(APP_STATE_FILE, DEFAULT_APP_STATE)
        merged = deepcopy(DEFAULT_APP_STATE)
        merged.update(state)
        if not merged.get('first_launch_date'):
            merged['first_launch_date'] = datetime.now(timezone.utc).date().isoformat()
            self.save_app_state(merged)
        return merged

    def save_app_state(self, state: dict[str, Any]) -> None:
        self._write_json(APP_STATE_FILE, state)

    # ------------------------------------------------------------------
    # Market data file — in-memory cache + atomic disk writes
    # ------------------------------------------------------------------

    def _load_market_data(self) -> dict[str, Any]:
        """Return in-memory cache; reads disk only once per session (or after invalidation)."""
        if self._market_cache is None:
            self._market_cache = self._read_json(MARKET_DATA_FILE, {})
        return self._market_cache

    def _save_market_data(self, data: dict[str, Any]) -> None:
        """Write to disk atomically and keep in-memory cache in sync."""
        self._write_json(MARKET_DATA_FILE, data)
        self._market_cache = data

    def clear_market_cache(self) -> None:
        """Wipe all cached market data from disk and memory."""
        self._market_cache = {}
        self._write_json(MARKET_DATA_FILE, {})

    # ------------------------------------------------------------------
    # TTL helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _now() -> datetime:
        return datetime.now(timezone.utc)

    @staticmethod
    def _is_fresh(timestamp: str | None, ttl_minutes: int) -> bool:
        if not timestamp:
            return False
        try:
            cached_at = datetime.fromisoformat(timestamp)
            if cached_at.tzinfo is None:
                cached_at = cached_at.replace(tzinfo=timezone.utc)
            return (DataStore._now() - cached_at) < timedelta(minutes=ttl_minutes)
        except ValueError:
            return False

    def _is_quote_fresh(self, timestamp: str | None, refresh_interval: str) -> bool:
        if refresh_interval == 'Manual only':
            return bool(timestamp)  # once fetched, never auto-expires
        ttl = REFRESH_INTERVAL_MINUTES.get(refresh_interval)
        if ttl is None:
            return False
        return self._is_fresh(timestamp, ttl)

    # ------------------------------------------------------------------
    # validate_ticker — always live, used during onboarding only
    # ------------------------------------------------------------------

    def validate_ticker(self, ticker: str) -> dict[str, Any]:
        """
        Validate a ticker via yfinance and return basic info.
        Always fetches live — does not use or write cache.
        Raises ValueError if the ticker cannot be resolved.
        """
        clean = ticker.strip().upper()
        if not clean:
            raise ValueError('Ticker symbol is required.')

        instrument = yf.Ticker(clean)
        price = _get_price(instrument)
        if not price:
            raise ValueError(f'Unable to validate ticker "{clean}" with Yahoo Finance.')

        info: dict[str, Any] = {}
        try:
            yf_count()
            info = instrument.info or {}
        except Exception:  # noqa: BLE001
            pass

        return {
            'ticker': clean,
            'price': price,
            'name': info.get('shortName') or clean,
            'sector': _resolve_sector(info),
        }

    # ------------------------------------------------------------------
    # get_snapshot — quote data with TTL (compatibility with analytics flow)
    # ------------------------------------------------------------------

    def _fetch_quote_and_meta(
        self, ticker: str,
    ) -> tuple[dict[str, Any] | None, dict[str, Any] | None]:
        """Pure network fetch of the rich quote + meta dicts for one ticker.

        Returns ``(quote, meta)``, or ``(None, None)`` when no price could be
        resolved. **Does not read or write the cache**, so it is safe to call
        from worker threads (used by ``prefetch_for_analysis``). Cache freshness
        and persistence are the caller's job.
        """
        instrument = yf.Ticker(ticker)
        price = _get_price(instrument)
        if not price:
            return None, None

        info: dict[str, Any] = {}
        try:
            yf_count()
            info = instrument.info or {}
        except Exception:  # noqa: BLE001
            pass

        fi: dict[str, Any] = {}
        try:
            yf_count()
            fi = {k: instrument.fast_info[k] for k in instrument.fast_info}
        except Exception:  # noqa: BLE001
            pass

        prev_close = _sf(fi.get('regularMarketPreviousClose')) or _sf(info.get('regularMarketPreviousClose')) or price

        quote = {
            'price':          price,
            'open':           _sf(fi.get('open')) or _sf(info.get('open')),
            'day_high':       _sf(fi.get('dayHigh')) or _sf(info.get('dayHigh')),
            'day_low':        _sf(fi.get('dayLow')) or _sf(info.get('dayLow')),
            'prev_close':     prev_close,
            'change':         price - prev_close,
            'change_pct':     ((price - prev_close) / prev_close * 100) if prev_close else 0.0,
            'volume':         _si(fi.get('lastVolume')) or _si(info.get('volume')),
            'avg_volume':     _si(fi.get('threeMonthAverageVolume')) or _si(info.get('averageVolume')),
            'market_cap':     _sf(fi.get('marketCap')) or _sf(info.get('marketCap')),
            '52w_high':       _sf(fi.get('yearHigh')) or _sf(info.get('fiftyTwoWeekHigh')),
            '52w_low':        _sf(fi.get('yearLow')) or _sf(info.get('fiftyTwoWeekLow')),
            'pe_ratio':       _sf(info.get('trailingPE')),
            'forward_pe':     _sf(info.get('forwardPE')),
            'pb_ratio':       _sf(info.get('priceToBook')),
            'ps_ratio':       _sf(info.get('priceToSalesTrailing12Months')),
            'peg_ratio':      _sf(info.get('pegRatio')) or _sf(info.get('trailingPegRatio')),
            'beta':           _sf(info.get('beta')),
            'dividend_yield': _sf(info.get('dividendYield')),  # already in % (e.g. 0.42 = 0.42%)
            'eps_ttm':        _sf(info.get('trailingEps')),
        }
        meta = {
            'name':        info.get('shortName') or ticker,
            'long_name':   info.get('longName') or info.get('shortName') or ticker,
            'sector':      _resolve_sector(info),
            'industry':    info.get('industry') or info.get('industryDisp'),
            'exchange':    info.get('exchange') or _ss(fi.get('exchange')),
            'currency':    info.get('currency') or _ss(fi.get('currency')),
            'country':     info.get('country'),
            'employees':   _si(info.get('fullTimeEmployees')),
            'description': info.get('longBusinessSummary'),
            'website':     info.get('website'),
            'market_cap':  _sf(fi.get('marketCap')) or _sf(info.get('marketCap')),
        }
        return quote, meta

    def get_snapshot(self, ticker: str, refresh_interval: str) -> dict[str, Any]:
        """
        Return a snapshot of {ticker, price, sector, name} with TTL caching.
        On cache miss or stale, fetches from yfinance and stores rich quote + meta.
        """
        mdata = self._load_market_data()
        entry = mdata.setdefault(ticker, {})

        if self._is_quote_fresh(entry.get('quote_updated_at'), refresh_interval):
            quote = entry.get('quote', {})
            meta = entry.get('meta', {})
            return {
                'ticker': ticker,
                'price': quote.get('price', 0.0),
                'sector': meta.get('sector', 'Unknown'),
                'name': meta.get('name', ticker),
            }

        quote, meta = self._fetch_quote_and_meta(ticker)
        if quote is None:
            raise ValueError(f'Could not fetch price for {ticker}.')

        now_iso = self._now().isoformat()
        entry['quote'] = quote
        entry['quote_updated_at'] = now_iso

        # Update meta if stale or missing
        if not self._is_fresh(entry.get('meta_updated_at'), TTL_META_MINUTES):
            entry['meta'] = meta
            entry['meta_updated_at'] = now_iso

        self._save_market_data(mdata)

        meta = entry.get('meta', {})
        return {
            'ticker': ticker,
            'price': quote['price'],
            'sector': meta.get('sector', 'Unknown'),
            'name': meta.get('name', ticker),
        }

    # ------------------------------------------------------------------
    # History — close-price lists (analytics compatibility)
    # ------------------------------------------------------------------

    def get_history(self, ticker: str, period: str, refresh_interval: str) -> list[float]:
        """Return list of close prices for the given period, with smart TTL caching."""
        mdata = self._load_market_data()
        entry = mdata.setdefault(ticker, {})
        histories = entry.get('history', {})
        history_ts = entry.get('history_updated_at', {})

        # intraday-relevant periods use quote TTL; daily+ use 60-min TTL
        if period in ('1d', '5d'):
            is_fresh = self._is_quote_fresh(history_ts.get(period), refresh_interval)
        else:
            is_fresh = self._is_fresh(history_ts.get(period), TTL_HISTORY_DAILY_MINUTES)

        if period in histories and is_fresh:
            return histories[period]

        yf_count()
        frame = yf.Ticker(ticker).history(period=period, interval='1d', auto_adjust=False)
        closes = [float(v) for v in frame['Close'].dropna().tolist()] if not frame.empty else []

        entry.setdefault('history', {})[period] = closes
        entry.setdefault('history_updated_at', {})[period] = self._now().isoformat()
        self._save_market_data(mdata)
        return closes

    def get_closes(self, ticker: str, period: str, interval: str,
                   refresh_interval: str) -> list[float]:
        """
        Return close prices for any period+interval combination with TTL caching.
        Cache key is '<period>_<interval>' stored under 'history_intraday'.
        Intraday intervals ('1m','2m','5m','15m','30m','60m','1h') use quote TTL;
        daily intervals use TTL_HISTORY_DAILY_MINUTES.
        """
        mdata = self._load_market_data()
        entry = mdata.setdefault(ticker, {})
        cache = entry.setdefault('history_intraday', {})
        ts_cache = entry.setdefault('history_intraday_updated_at', {})
        key = f'{period}_{interval}'

        intraday_intervals = {'1m', '2m', '5m', '15m', '30m', '60m', '1h', '90m'}
        if interval in intraday_intervals:
            is_fresh = self._is_quote_fresh(ts_cache.get(key), refresh_interval)
        else:
            is_fresh = self._is_fresh(ts_cache.get(key), TTL_HISTORY_DAILY_MINUTES)

        if key in cache and is_fresh:
            return cache[key]

        yf_count()
        frame = yf.Ticker(ticker).history(period=period, interval=interval, auto_adjust=False)
        closes = [float(v) for v in frame['Close'].dropna().tolist()] if not frame.empty else []

        cache[key] = closes
        ts_cache[key] = self._now().isoformat()
        self._save_market_data(mdata)
        return closes

    # ------------------------------------------------------------------
    # Full OHLCV history — for charting widgets
    # ------------------------------------------------------------------

    def get_ohlcv(self, ticker: str, period: str, refresh_interval: str) -> dict[str, Any]:
        """
        Return full OHLCV history for the given period as parallel lists.
        Keys: dates, opens, highs, lows, closes, volumes
        """
        mdata = self._load_market_data()
        entry = mdata.setdefault(ticker, {})
        ohlcv_store = entry.get('history_ohlcv', {})
        ohlcv_ts = entry.get('history_ohlcv_updated_at', {})

        if period in ('1d', '5d'):
            is_fresh = self._is_quote_fresh(ohlcv_ts.get(period), refresh_interval)
        else:
            is_fresh = self._is_fresh(ohlcv_ts.get(period), TTL_HISTORY_DAILY_MINUTES)

        if period in ohlcv_store and is_fresh:
            return ohlcv_store[period]

        yf_count()
        frame = yf.Ticker(ticker).history(period=period, interval='1d', auto_adjust=False)
        if frame.empty:
            result: dict[str, Any] = {
                'dates': [], 'opens': [], 'highs': [],
                'lows': [], 'closes': [], 'volumes': [],
            }
        else:
            result = {
                'dates':   [str(d.date()) for d in frame.index],
                'opens':   [_sf(v) for v in frame['Open'].tolist()],
                'highs':   [_sf(v) for v in frame['High'].tolist()],
                'lows':    [_sf(v) for v in frame['Low'].tolist()],
                'closes':  [float(v) for v in frame['Close'].dropna().tolist()],
                'volumes': [_si(v) for v in frame['Volume'].tolist()],
            }

        entry.setdefault('history_ohlcv', {})[period] = result
        entry.setdefault('history_ohlcv_updated_at', {})[period] = self._now().isoformat()
        self._save_market_data(mdata)
        return result

    # ------------------------------------------------------------------
    # Dividends — with 24h TTL
    # ------------------------------------------------------------------

    @staticmethod
    def _fetch_dividends_list(ticker: str) -> list[dict[str, Any]]:
        """Pure network fetch of historical dividends. No cache access — safe in threads."""
        divs: list[dict[str, Any]] = []
        try:
            yf_count()
            series = yf.Ticker(ticker).dividends
            if not series.empty:
                divs = [
                    {'date': str(idx.date()), 'amount': float(val)}
                    for idx, val in zip(series.index, series.values, strict=False)
                ]
        except Exception:  # noqa: BLE001
            pass
        return divs

    def get_dividends(self, ticker: str) -> list[dict[str, Any]]:
        """Return list of {date, amount} dicts for all historical dividends."""
        mdata = self._load_market_data()
        entry = mdata.setdefault(ticker, {})

        if entry.get('dividends') is not None and self._is_fresh(entry.get('dividends_updated_at'), TTL_DIVIDENDS_MINUTES):
            return entry['dividends']

        divs = self._fetch_dividends_list(ticker)

        entry['dividends'] = divs
        entry['dividends_updated_at'] = self._now().isoformat()
        self._save_market_data(mdata)
        return divs

    # ------------------------------------------------------------------
    # Earnings — calendar + history, with 24h TTL
    # ------------------------------------------------------------------

    @staticmethod
    def _fetch_earnings_list(ticker: str) -> list[dict[str, Any]]:
        """Pure network fetch of upcoming earnings from the yfinance calendar.

        In yfinance 1.2.0, t.earnings is None — use t.calendar dict instead.
        No cache access — safe to call from worker threads.
        """
        earnings: list[dict[str, Any]] = []
        try:
            yf_count()
            cal = yf.Ticker(ticker).calendar or {}
            for d in cal.get('Earnings Date', []):
                earnings.append({
                    'date':              str(d),
                    'eps_estimate_avg':  _sf(cal.get('Earnings Average')),
                    'eps_estimate_low':  _sf(cal.get('Earnings Low')),
                    'eps_estimate_high': _sf(cal.get('Earnings High')),
                    'revenue_avg':       _sf(cal.get('Revenue Average')),
                    'revenue_low':       _sf(cal.get('Revenue Low')),
                    'revenue_high':      _sf(cal.get('Revenue High')),
                })
        except Exception:  # noqa: BLE001
            pass
        return earnings

    def get_earnings(self, ticker: str) -> list[dict[str, Any]]:
        """
        Return upcoming earnings dates + estimates from yfinance calendar.
        In yfinance 1.2.0, t.earnings is None — use t.calendar dict instead.
        """
        mdata = self._load_market_data()
        entry = mdata.setdefault(ticker, {})

        if entry.get('earnings') is not None and self._is_fresh(entry.get('earnings_updated_at'), TTL_EARNINGS_MINUTES):
            return entry['earnings']

        earnings = self._fetch_earnings_list(ticker)

        entry['earnings'] = earnings
        entry['earnings_updated_at'] = self._now().isoformat()
        self._save_market_data(mdata)
        return earnings

    # ------------------------------------------------------------------
    # Accessors — typed getters for widget consumption
    # ------------------------------------------------------------------

    def get_quote(self, ticker: str) -> dict[str, Any]:
        """Return the stored quote dict for a ticker, or {} if not yet fetched."""
        return self._load_market_data().get(ticker, {}).get('quote', {})

    def get_meta(self, ticker: str) -> dict[str, Any]:
        """Return the stored meta dict for a ticker, or {} if not yet fetched."""
        return self._load_market_data().get(ticker, {}).get('meta', {})

    def get_all_ticker_data(self, ticker: str) -> dict[str, Any]:
        """Return the complete stored data blob for a ticker."""
        return self._load_market_data().get(ticker, {})

    # ------------------------------------------------------------------
    # build_histories — analytics compatibility shim
    # ------------------------------------------------------------------

    def build_histories(
        self,
        tickers: list[str],
        refresh_interval: str,
        lookback: str,
    ) -> dict[str, dict[str, list[float]]]:
        """
        Build the history_map expected by compute_portfolio_analytics:
            { ticker: { '6mo': [...], '1mo': [...], <lookback_period>: [...] } }
        """
        period_key = VOLATILITY_LOOKBACK_PERIODS.get(lookback, '6mo')
        result: dict[str, dict[str, list[float]]] = {}
        for ticker in tickers:
            periods_needed = {'6mo', '1mo', period_key}
            result[ticker] = {
                period: self.get_history(ticker, period, refresh_interval)
                for period in periods_needed
            }
        return result

    def build_history_map(
        self,
        tickers: list[str],
        periods: list[str],
        refresh_interval: str,
    ) -> dict[str, dict[str, list[float]]]:
        """
        General-purpose close-price map for any set of periods.
        Use this when building custom charting widgets.
        """
        return {
            ticker: {
                period: self.get_history(ticker, period, refresh_interval)
                for period in periods
            }
            for ticker in tickers
        }

    # ------------------------------------------------------------------
    # Prefetch for /analyze — batched history + parallel per-ticker fetches
    # ------------------------------------------------------------------

    @staticmethod
    def _batch_history_closes(syms: list[str], period: str) -> dict[str, list[float]]:
        """Fetch daily closes for many tickers in a SINGLE yf.download() call.

        Replaces N serial ``yf.Ticker(t).history()`` round trips with one batched
        request (yfinance parallelises the download internally). Returns
        ``{ticker: [closes]}``; tickers with no data are simply absent. Never
        raises — on failure returns ``{}`` and the caller falls back to the lazy
        per-ticker path. ``auto_adjust=False`` matches ``get_history`` so cached
        closes are identical whether warmed here or fetched lazily.
        """
        if not syms:
            return {}
        try:
            yf_count()
            raw = yf.download(
                syms, period=period, interval='1d',
                progress=False, auto_adjust=False, actions=False,
                group_by='column', threads=True,
            )
        except Exception:  # noqa: BLE001
            _log.debug('batch history download failed for %s (%s)', syms, period, exc_info=True)
            return {}
        if raw is None or raw.empty:
            return {}

        try:
            close = raw['Close']
        except Exception:  # noqa: BLE001
            return {}

        result: dict[str, list[float]] = {}
        if hasattr(close, 'columns'):  # multi-ticker → DataFrame of ticker columns
            for t in syms:
                if t in close.columns:
                    series = close[t].dropna()
                    if not series.empty:
                        result[t] = [float(v) for v in series.tolist()]
        else:  # single ticker → plain Series
            series = close.dropna()
            if not series.empty:
                result[syms[0]] = [float(v) for v in series.tolist()]
        return result

    def prefetch_for_analysis(self, tickers: list[str], settings: dict[str, Any]) -> None:
        """Warm the market-data cache for a full /analyze run concurrently.

        The analyzers each loop over positions calling ``get_history`` /
        ``get_snapshot`` / ``get_dividends`` / ``get_earnings`` serially, so a
        cold N-ticker portfolio makes ~6-7N blocking yfinance round trips. This
        method front-loads all of that work in parallel so the analyzers then hit
        the warm in-memory cache:

          * history (6mo for slope, 1y for volatility/beta, + SPY 1y) is pulled
            with one batched ``yf.download`` per period (#2);
          * the per-ticker calls that cannot be batched (``.info`` snapshot,
            dividends, earnings) run across a thread pool (#1).

        Existing TTLs are respected: anything already fresh is skipped, so a warm
        cache makes this a near no-op. Worker threads only do *pure network*
        fetches (``_fetch_*`` helpers); every cache mutation and the single disk
        write happen serially on this thread, so there is no shared-state race.
        Best-effort: any failure is swallowed and the analyzers fall back to their
        existing lazy per-ticker fetch.
        """
        refresh = settings.get('refresh_interval', '5 min')
        syms = list(dict.fromkeys(
            s for s in (str(t).strip().upper() for t in tickers) if s
        ))
        if not syms:
            return

        mdata = self._load_market_data()

        def _hist_stale(t: str, period: str) -> bool:
            ts = mdata.get(t, {}).get('history_updated_at', {}).get(period)
            return not self._is_fresh(ts, TTL_HISTORY_DAILY_MINUTES)

        def _quote_stale(t: str) -> bool:
            return not self._is_quote_fresh(mdata.get(t, {}).get('quote_updated_at'), refresh)

        def _div_stale(t: str) -> bool:
            e = mdata.get(t, {})
            return e.get('dividends') is None or not self._is_fresh(
                e.get('dividends_updated_at'), TTL_DIVIDENDS_MINUTES)

        def _earn_stale(t: str) -> bool:
            e = mdata.get(t, {})
            return e.get('earnings') is None or not self._is_fresh(
                e.get('earnings_updated_at'), TTL_EARNINGS_MINUTES)

        need_6mo = [t for t in syms if _hist_stale(t, '6mo')]
        # beta compares every holding against SPY over 1y, so SPY needs a 1y series too.
        one_year_syms = list(dict.fromkeys(syms + ['SPY']))
        need_1y = [t for t in one_year_syms if _hist_stale(t, '1y')]
        need_quote = [t for t in syms if _quote_stale(t)]
        need_div = [t for t in syms if _div_stale(t)]
        # earnings analyzer skips index ETFs, so don't burn a call warming them.
        need_earn = [t for t in syms if _earn_stale(t) and t not in INDEX_ETFS]

        if not any((need_6mo, need_1y, need_quote, need_div, need_earn)):
            return  # cache already warm

        # --- Batched history (one HTTP request per period) ---
        hist_6mo = self._batch_history_closes(need_6mo, '6mo')
        hist_1y = self._batch_history_closes(need_1y, '1y')

        # --- Parallel per-ticker fetches that cannot be batched ---
        quotes: dict[str, tuple[dict | None, dict | None]] = {}
        divs: dict[str, list] = {}
        earns: dict[str, list] = {}
        max_workers = min(8, max(1, len(need_quote) + len(need_div) + len(need_earn)))
        with ThreadPoolExecutor(max_workers=max_workers) as ex:
            quote_futs = {t: ex.submit(self._fetch_quote_and_meta, t) for t in need_quote}
            div_futs = {t: ex.submit(self._fetch_dividends_list, t) for t in need_div}
            earn_futs = {t: ex.submit(self._fetch_earnings_list, t) for t in need_earn}
            for t, f in quote_futs.items():
                try:
                    quotes[t] = f.result()
                except Exception:  # noqa: BLE001
                    quotes[t] = (None, None)
            for t, f in div_futs.items():
                try:
                    divs[t] = f.result()
                except Exception:  # noqa: BLE001
                    divs[t] = []
            for t, f in earn_futs.items():
                try:
                    earns[t] = f.result()
                except Exception:  # noqa: BLE001
                    earns[t] = []

        # --- Merge into cache serially, then a single disk write ---
        now_iso = self._now().isoformat()

        for t, closes in {**hist_6mo}.items():
            e = mdata.setdefault(t, {})
            e.setdefault('history', {})['6mo'] = closes
            e.setdefault('history_updated_at', {})['6mo'] = now_iso
        for t, closes in {**hist_1y}.items():
            e = mdata.setdefault(t, {})
            e.setdefault('history', {})['1y'] = closes
            e.setdefault('history_updated_at', {})['1y'] = now_iso

        for t, (quote, meta) in quotes.items():
            if quote is None:
                continue
            e = mdata.setdefault(t, {})
            e['quote'] = quote
            e['quote_updated_at'] = now_iso
            if not self._is_fresh(e.get('meta_updated_at'), TTL_META_MINUTES):
                e['meta'] = meta
                e['meta_updated_at'] = now_iso

        for t, d in divs.items():
            e = mdata.setdefault(t, {})
            e['dividends'] = d
            e['dividends_updated_at'] = now_iso

        for t, en in earns.items():
            e = mdata.setdefault(t, {})
            e['earnings'] = en
            e['earnings_updated_at'] = now_iso

        self._save_market_data(mdata)

    # ------------------------------------------------------------------
    # Dashboard layout persistence
    # ------------------------------------------------------------------

    def load_layout(self) -> list[dict]:
        """Return saved dashboard layout, or [] if none saved yet."""
        if not LAYOUT_FILE.exists():
            return []
        try:
            with LAYOUT_FILE.open('r', encoding='utf-8') as f:
                data = json.load(f)
            return data if isinstance(data, list) else []
        except Exception:  # noqa: BLE001
            return []

    def save_layout(self, layout: list[dict]) -> None:
        """Persist dashboard layout to disk."""
        self._write_json(LAYOUT_FILE, layout)

    # ------------------------------------------------------------------
    # Prefetch — batch price load for common tickers (background startup)
    # ------------------------------------------------------------------

    def prefetch_common_prices(self, tickers: list[str]) -> None:
        """
        Batch-fetch last close prices for a list of tickers and write them into
        the market data cache.  Skips tickers whose quote is already fresh (< 60 min old).
        Called from a daemon thread at startup so onboarding can show instant equity estimates.
        """
        mdata = self._load_market_data()
        to_fetch = [
            t for t in tickers
            if not self._is_fresh(mdata.get(t, {}).get('quote_updated_at'), 60)
        ]
        if not to_fetch:
            return
        try:
            yf_count()
            raw = yf.download(
                to_fetch, period='5d', interval='1d',
                progress=False, auto_adjust=False, actions=False,
            )
        except Exception:  # noqa: BLE001
            return
        if raw.empty:
            return
        now_iso = self._now().isoformat()
        try:
            close = raw['Close']
            # Multi-ticker download → DataFrame with ticker columns
            # Single-ticker download → plain Series
            if hasattr(close, 'columns'):
                last = close.iloc[-1]
                for t in to_fetch:
                    if t not in last.index:
                        continue
                    try:
                        val = float(last[t])
                        if val and val == val:  # reject NaN
                            entry = mdata.setdefault(t, {})
                            entry.setdefault('quote', {})['price'] = val
                            entry['quote_updated_at'] = now_iso
                    except (TypeError, ValueError):
                        pass
            else:
                clean = close.dropna()
                if not clean.empty and to_fetch:
                    val = float(clean.iloc[-1])
                    if val:
                        entry = mdata.setdefault(to_fetch[0], {})
                        entry.setdefault('quote', {})['price'] = val
                        entry['quote_updated_at'] = now_iso
        except Exception:  # noqa: BLE001
            return
        self._save_market_data(mdata)

    # ------------------------------------------------------------------
    # Reset
    # ------------------------------------------------------------------

    def reset_all_data(self) -> None:
        """Wipe all data files back to defaults, including market data."""
        for file_path, default in (
            (POSITIONS_FILE,   DEFAULT_POSITIONS),
            (SETTINGS_FILE,    DEFAULT_SETTINGS),
            (APP_STATE_FILE,   DEFAULT_APP_STATE),
            (MARKET_DATA_FILE, {}),
        ):
            self._write_json(file_path, default)
        self._market_cache = {}


# ------------------------------------------------------------------
# Module-level helpers
# ------------------------------------------------------------------

def _resolve_sector(info: dict[str, Any]) -> str:
    """
    Return a human-readable sector string from a yfinance info dict.
    ETFs don't have a sector field — detect them via quoteType and label them 'ETF'.
    """
    if (info.get('quoteType') or '').upper() == 'ETF':
        return 'ETF'
    return info.get('sector') or info.get('industryDisp') or 'Unknown'


def _get_price(instrument: yf.Ticker) -> float | None:
    """Try multiple yfinance price sources. Returns None if all fail."""
    # fast_info bracket access — raises KeyError on invalid ticker
    try:
        yf_count()
        raw = instrument.fast_info['lastPrice']
        if raw:
            return float(raw)
    except (KeyError, TypeError):
        pass

    # fall through to info dict
    try:
        yf_count()
        info = instrument.info or {}
        price = info.get('currentPrice') or info.get('regularMarketPrice')
        if price:
            return float(price)
    except Exception:  # noqa: BLE001
        pass

    # last resort: recent history
    try:
        yf_count()
        hist = instrument.history(period='5d', interval='1d', auto_adjust=False)
        if not hist.empty:
            return float(hist['Close'].dropna().iloc[-1])
    except Exception:  # noqa: BLE001
        pass

    return None


def _sf(value: Any) -> float | None:
    """Safe float cast — returns None on failure."""
    try:
        return float(value) if value is not None else None
    except (TypeError, ValueError):
        return None


def _si(value: Any) -> int | None:
    """Safe int cast — returns None on failure."""
    try:
        return int(value) if value is not None else None
    except (TypeError, ValueError):
        return None


def _ss(value: Any) -> str | None:
    """Safe str cast — returns None on failure."""
    try:
        return str(value) if value is not None else None
    except (TypeError, ValueError):
        return None
