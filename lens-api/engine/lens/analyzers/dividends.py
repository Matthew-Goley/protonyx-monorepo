"""Upcoming ex-dividend dates and yield analyzer."""

from __future__ import annotations

import logging
from datetime import date, datetime, timedelta
from typing import Any

_log = logging.getLogger(__name__)


def _parse_date(d: Any) -> date | None:
    if isinstance(d, date):
        return d
    if isinstance(d, datetime):
        return d.date()
    if isinstance(d, str):
        for fmt in ('%Y-%m-%d', '%Y-%m-%dT%H:%M:%S'):
            try:
                return datetime.strptime(d, fmt).date()
            except ValueError:
                continue
    return None


def _severity_from_days(days: int | None) -> str:
    if days is None:
        return 'none'
    if days <= 7:
        return 'high'
    if days <= 14:
        return 'moderate'
    if days <= 30:
        return 'low'
    return 'none'


def _frequency_label(interval_days: float) -> str:
    """Classify a dividend cadence (median days between ex-dates) into a label."""
    if interval_days <= 45:
        return 'Monthly'
    if interval_days <= 135:
        return 'Quarterly'
    if interval_days <= 225:
        return 'Semi-Annual'
    return 'Annual'


def _estimate_next_ex(
    past_dates: list[date], today: date,
) -> tuple[date | None, int | None, str | None]:
    """Project the next ex-dividend date forward from historical cadence.

    yfinance only exposes *historical* ex-dates, so a dividend payer's "next"
    date is never in the raw data. We infer the typical interval from the most
    recent ex-dates and step forward from the latest one until we land on or
    after today. Returns (estimated_date, days_until, frequency_label).

    Best-effort and clearly an estimate: the Dividend Calendar surfaces it as
    such. Returns (None, None, None) when there is no usable history.
    """
    if not past_dates:
        return None, None, None

    ordered = sorted(set(past_dates))
    last = ordered[-1]

    if len(ordered) >= 2:
        # Median gap across the most recent (up to) 8 intervals.
        recent = ordered[-9:]
        gaps = [(recent[i] - recent[i - 1]).days for i in range(1, len(recent))]
        gaps = [g for g in gaps if g > 0]
        if gaps:
            gaps.sort()
            interval = gaps[len(gaps) // 2]
        else:
            interval = 91
    else:
        # Only one historical dividend: assume a quarterly cadence.
        interval = 91

    interval = max(7, interval)
    nxt = last
    # Step forward until the projected date is in the future. Cap iterations so a
    # very stale series can never spin (covers >50 years of quarterly steps).
    for _ in range(250):
        nxt = nxt + timedelta(days=interval)
        if nxt >= today:
            break
    if nxt < today:
        return None, None, None

    return nxt, (nxt - today).days, _frequency_label(interval)


def analyze(
    positions: list[dict], store: Any, settings: dict, risk_profile: dict,
) -> dict:
    today = date.today()
    one_year_ago = today - timedelta(days=365)
    def _cv(p: dict) -> float:
        cv = p.get('_current_value')
        if cv is not None:
            return float(cv)
        shares = float(p.get('shares', 0) or 0)
        price = float(p.get('price', 0) or 0)
        return shares * price if shares > 0 and price > 0 else float(p.get('equity', 0.0) or 0.0)

    total_equity = sum(_cv(p) for p in positions) or 1.0

    ticker_results: dict[str, dict] = {}
    nearest_ticker = ''
    nearest_days: int | None = None
    tickers_with_upcoming: list[str] = []
    weighted_yield = 0.0

    for pos in positions:
        t = pos['ticker']
        weight = _cv(pos) / total_equity
        current_price = pos.get('price', 0.0)

        next_ex_date: date | None = None
        days_until: int | None = None
        next_amount: float | None = None
        annual_div_total = 0.0
        past_dates: list[date] = []
        last_amount: float | None = None

        try:
            divs = store.get_dividends(t) or []
            for d in divs:
                dd = _parse_date(d.get('date'))
                amt = d.get('amount', 0.0)
                if dd:
                    if dd < today:
                        past_dates.append(dd)
                        if amt:
                            last_amount = amt
                    # Trailing 12-month dividends
                    if one_year_ago <= dd <= today and amt:
                        annual_div_total += amt
                    # Next upcoming (a genuinely future-dated ex-date, rare in yfinance)
                    if dd >= today and next_ex_date is None:
                        next_ex_date = dd
                        days_until = (dd - today).days
                        next_amount = amt
        except Exception:
            pass

        # yfinance ex-dates are historical, so a real future date almost never
        # exists. Estimate the next one from the payment cadence so the Dividend
        # Calendar has something to show. estimated=True flags it as a projection.
        estimated = False
        frequency: str | None = None
        if next_ex_date is None and past_dates:
            est_date, est_days, frequency = _estimate_next_ex(past_dates, today)
            if est_date is not None:
                next_ex_date = est_date
                days_until = est_days
                next_amount = last_amount
                estimated = True

        annual_yield_pct = (
            (annual_div_total / current_price * 100)
            if current_price > 0 and annual_div_total > 0 else 0.0
        )
        weighted_yield += annual_yield_pct * weight

        # Severity / flag / portfolio aggregate are driven by *real* upcoming
        # dividends only (estimates must not perturb the brief or CTA logic).
        sev = 'none' if estimated else _severity_from_days(days_until)
        flag = sev != 'none'

        if flag:
            tickers_with_upcoming.append(t)

        if flag and days_until is not None and (nearest_days is None or days_until < nearest_days):
            nearest_days = days_until
            nearest_ticker = t

        ticker_results[t] = {
            'value': float(days_until) if (days_until is not None and not estimated) else 999.0,
            'severity': sev,
            'flag': flag,
            'weight': weight,
            'details': {
                'next_ex_date': next_ex_date.isoformat() if next_ex_date else None,
                'days_until': days_until,
                'amount': next_amount,
                'annual_yield_pct': annual_yield_pct,
                'frequency': frequency,
                'estimated': estimated,
            },
        }

    port_sev = _severity_from_days(nearest_days)

    return {
        'ticker_results': ticker_results,
        'portfolio_result': {
            'value': float(nearest_days) if nearest_days is not None else 999.0,
            'severity': port_sev,
            'flag': port_sev != 'none',
            'details': {
                'nearest_ticker': nearest_ticker,
                'nearest_days': nearest_days,
                'portfolio_yield_pct': weighted_yield,
                'tickers_with_upcoming': tickers_with_upcoming,
            },
        },
    }
