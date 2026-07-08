"""Walk-forward simulation: does following Lens's single top-priority CTA, round
after round, realize LESS risk than doing nothing, AND does Lens's specific choice
of what to cut beat a random trim of the same size (isolating skill from the
mechanical de-risking-into-cash effect)?

LOCKED METHODOLOGY (see metrics/README_walkforward.md):
  - 5 legs of 25 trading days. As-of dates T = 124, 149, 174, 199, 224.
  - Lookback L = 124 fixed every round (well above the 30-close slope/vol floor).
  - Reuse the existing 250-portfolio calibration corpus exactly. No regeneration.
  - THREE parallel timelines per portfolio, from the SAME holdings at T=124:
      * do-nothing twin: never touched, rides real closes the whole way.
      * managed path: at each as-of date, score point-in-time (AsOfStore), take the
        single top-priority CTA, apply ONLY that one action, then ride forward.
      * random-trim baseline: on every leg where the managed path executes a real
        trim, trim the SAME dollar amount from a UNIFORM-RANDOM (fixed-seed) name
        the baseline currently holds. When Lens does nothing, the baseline does
        nothing. So managed and baseline differ ONLY in which position gets cut,
        never in how much or in cash handling.
  - Point-in-time discipline identical to the calibration study; the random pick
    needs only what the baseline currently holds, never any future information.

CTA / trim execution (implemented explicitly here, NOT via the engine's
_apply_all_ctas / projected_positions path):
  - sell / rebalance on a HELD ticker: shares -= dollars / asof_price, floored at
    zero (position removed if fully exited); proceeds move to a cash scalar.
    Proceeds clamp to the position's actual value so a trim never banks more cash
    than it liquidated (normal case dollars <= value => cash += dollars exactly).
    The random baseline uses the identical primitive on its randomly chosen name.
  - hold / buy_new: no mutation this leg on either path.
  - Cash is a scalar OUTSIDE the positions list, so the engine never scores it.
  - Cost-basis-neutral; earnings/dividends neutralized via AsOfStore.

Read-only on engine/. Nothing here mutates engine internals.

Usage:  python metrics/run_walkforward.py
"""

from __future__ import annotations

import csv
import json
import math
import random
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))  # lens-api on path

import numpy as np

from metrics.common import (
    CORPUS_PATH,
    OUTPUT_DIR,
    SECTOR_MAP,
    AsOfStore,
    master_series,
    setup_offline,
)

# ── Locked walk-forward parameters ──────────────────────────────────────────
AS_OF_DATES: tuple[int, ...] = (124, 149, 174, 199, 224)
LEG_LEN = 25                 # trading days each leg rides forward
N_LEGS = len(AS_OF_DATES)    # 5
BOOK = 100_000.0             # starting portfolio value at T=124
RANDOM_TRIM_SEED = 20260707  # fixed seed: reproducible random-pick baseline


def _leg_realized(shares: dict[str, float], cash: float,
                  master: dict[str, list[float]], t0: int, h: int = LEG_LEN) -> dict:
    """Realized annualized vol + max drawdown + realized log return over
    master[t0 : t0+h], INCLUDING a constant cash balance. Same value series for
    all three metrics.

    Value_day = cash + sum(shares_i * price_i(day)). Cash is constant, so it
    dampens realized vol, drawdown, AND return by the same proportion (equity /
    (equity + cash)). A fully-cash portfolio has zero vol, zero drawdown, and zero
    return. The realized log return is ``ln(V_end / V_start)`` over this leg's
    window, i.e. the SUM of the same daily log returns whose stdev gives the vol,
    so cash dilutes return exactly as it dilutes volatility (no separate handling).
    """
    values: list[float] = []
    for day in range(t0, t0 + h):
        v = float(cash)
        for tk, sh in shares.items():
            s = master.get(tk.upper())
            if s and day < len(s):
                v += sh * s[day]
        values.append(v)

    if len(values) < 3 or any(v <= 0 for v in values):
        return {"vol": float("nan"), "max_dd": float("nan"), "logret": float("nan")}

    arr = np.array(values, dtype=float)
    log_ret = np.diff(np.log(arr))
    vol = float(np.std(log_ret) * math.sqrt(252) * 100) if len(log_ret) else float("nan")

    running_peak = np.maximum.accumulate(arr)
    drawdowns = (arr - running_peak) / running_peak
    max_dd = float(-np.min(drawdowns) * 100)  # positive % magnitude

    # Realized log return over the leg = ln(V_end / V_start) = sum of the daily
    # log returns above. NOT annualized (per spec: 25-day annualization is noisy).
    leg_logret = float(math.log(arr[-1] / arr[0]))
    return {"vol": vol, "max_dd": max_dd, "logret": leg_logret}


def _starting_holdings(weights: dict[str, float], store: AsOfStore) -> dict[str, float]:
    """Share map at T=124: shares_i = weight_i * BOOK / price_i(T). Tickers with no
    as-of price are dropped (should not happen for the frozen corpus universe)."""
    shares: dict[str, float] = {}
    for tk, w in weights.items():
        price = store.asof_price(tk)
        if not price or price <= 0:
            continue
        shares[tk] = (w * BOOK) / price
    return shares


def _positions_from_shares(shares: dict[str, float], store: AsOfStore) -> list[dict]:
    """Build engine positions from the current share map at this store's as-of date.
    Cost-basis-neutral: equity = current value, so the performance analyzer is
    neutral. Cash is intentionally NOT represented here."""
    positions: list[dict] = []
    for tk, sh in shares.items():
        price = store.asof_price(tk)
        if not price or price <= 0 or sh <= 0:
            continue
        positions.append({
            "ticker": tk,
            "shares": sh,
            "equity": sh * price,
            "price": price,
            "sector": SECTOR_MAP.get(tk, "Unknown"),
            "name": tk,
            "added_at": "2024-01-01T00:00:00",
        })
    return positions


def _execute_trim(shares: dict[str, float], cash: float, ticker: str,
                  dollars: float, store: AsOfStore) -> tuple[dict[str, float], float, float, bool]:
    """Trim ``dollars`` of ``ticker`` at its as-of price. Shared primitive used by
    BOTH the managed path (ticker = Lens's flagged name) and the random baseline
    (ticker = a random held name), so the ONLY thing that differs between them is
    which ticker is passed in. Returns (new_shares, new_cash, proceeds, clamped)."""
    price = store.asof_price(ticker)
    if not price or price <= 0 or ticker not in shares or dollars <= 0:
        return shares, cash, 0.0, False
    held_shares = shares[ticker]
    held_value = held_shares * price
    shares_sold = min(dollars / price, held_shares)
    proceeds = shares_sold * price
    new_shares = dict(shares)
    remaining = held_shares - shares_sold
    if remaining <= 1e-9:
        del new_shares[ticker]
    else:
        new_shares[ticker] = remaining
    return new_shares, cash + proceeds, proceeds, dollars > held_value + 1e-6


def run() -> dict:
    setup_offline()
    from engine.constants import DEFAULT_SETTINGS
    from engine.lens.lens_output import build_lens_output

    m = master_series()
    corpus = json.loads(Path(CORPUS_PATH).read_text(encoding="utf-8"))
    portfolios = corpus["portfolios"]

    # One RNG for the whole run, consumed in deterministic (portfolio, leg) order.
    rng = random.Random(RANDOM_TRIM_SEED)

    rows: list[dict] = []
    paths: list[dict] = []   # one summary record per portfolio path

    for p in portfolios:
        pid = p["id"]
        tier = p["tier"]
        archetype = p["archetype"]
        weights = p["weights"]

        # Starting holdings at T=124, shared by all three timelines.
        start_store = AsOfStore(m, AS_OF_DATES[0])
        start_shares = _starting_holdings(weights, start_store)
        if not start_shares:
            continue

        twin_shares = dict(start_shares)     # never mutated
        managed_shares = dict(start_shares)  # mutated by Lens's top CTA
        managed_cash = 0.0
        random_shares = dict(start_shares)   # mutated by same-size random trims
        random_cash = 0.0

        cum_managed = 0.0
        cum_random = 0.0
        # Cumulative log returns per arm (sum of per-leg ln(V_end/V_start)).
        cum_twin_lr = 0.0
        cum_managed_lr = 0.0
        cum_random_lr = 0.0
        any_cta = False
        path_rows: list[dict] = []

        for leg_idx, T in enumerate(AS_OF_DATES, start=1):
            store = AsOfStore(m, T)

            # 1) Score current MANAGED holdings point-in-time, take top CTA, apply it.
            managed_action, managed_ticker, managed_reason, managed_dollars = (
                "none", "", "", 0.0
            )
            managed_executed = False
            positions = _positions_from_shares(managed_shares, store)
            if positions:
                settings = {**DEFAULT_SETTINGS, "risk_tier": tier}
                result = build_lens_output(
                    [dict(pos) for pos in positions], store, settings, save_history=False
                )
                ctas = result.get("ctas") or []
                if ctas:
                    top = min(ctas, key=lambda c: c.get("priority", 99))
                    managed_action = top.get("action", "hold")
                    managed_ticker = top.get("ticker", "")
                    managed_reason = top.get("reason", "")
                    managed_dollars = float(top.get("dollars", 0.0) or 0.0)
                    if (managed_action in ("sell", "rebalance")
                            and managed_ticker in managed_shares
                            and managed_dollars > 0):
                        managed_shares, managed_cash, _pm, _cm = _execute_trim(
                            managed_shares, managed_cash, managed_ticker,
                            managed_dollars, store
                        )
                        managed_executed = True
                        any_cta = True

            # 2) RANDOM baseline: only when the managed path actually trimmed this
            #    leg, trim the SAME dollar amount from a uniform-random held name.
            random_ticker = ""
            random_executed = False
            if managed_executed:
                candidates = sorted(t for t, sh in random_shares.items() if sh > 0)
                if candidates:
                    random_ticker = rng.choice(candidates)
                    random_shares, random_cash, _pr, _cr = _execute_trim(
                        random_shares, random_cash, random_ticker,
                        managed_dollars, store
                    )
                    random_executed = True

            # 3) Ride ALL THREE timelines forward over this leg's real closes.
            twin_out = _leg_realized(twin_shares, 0.0, m, T)
            managed_out = _leg_realized(managed_shares, managed_cash, m, T)
            random_out = _leg_realized(random_shares, random_cash, m, T)

            twin_vol = twin_out["vol"]
            managed_vol = managed_out["vol"]
            random_vol = random_out["vol"]

            def _avoided(pvol: float) -> float:
                return (twin_vol - pvol) if (
                    math.isfinite(twin_vol) and math.isfinite(pvol)
                ) else float("nan")

            leg_managed_av = _avoided(managed_vol)
            leg_random_av = _avoided(random_vol)
            if math.isfinite(leg_managed_av):
                cum_managed += leg_managed_av
            if math.isfinite(leg_random_av):
                cum_random += leg_random_av

            # Per-leg log returns (same value series as the vol above).
            twin_lr = twin_out["logret"]
            managed_lr = managed_out["logret"]
            random_lr = random_out["logret"]
            if math.isfinite(twin_lr):
                cum_twin_lr += twin_lr
            if math.isfinite(managed_lr):
                cum_managed_lr += managed_lr
            if math.isfinite(random_lr):
                cum_random_lr += random_lr
            # Cumulative simple-% equivalents (display figure) and return given up
            # vs twin (twin return minus path return; positive = path forfeited
            # return, negative = path gained return by de-risking into cash).
            twin_ret_pct = (math.exp(cum_twin_lr) - 1.0) * 100
            managed_ret_pct = (math.exp(cum_managed_lr) - 1.0) * 100
            random_ret_pct = (math.exp(cum_random_lr) - 1.0) * 100
            managed_given_up = twin_ret_pct - managed_ret_pct
            random_given_up = twin_ret_pct - random_ret_pct

            row = {
                "portfolio_id": pid,
                "archetype": archetype,
                "tier": tier,
                "leg": leg_idx,
                "as_of": T,
                "cta_action": managed_action,
                "cta_ticker": managed_ticker,
                "cta_reason": managed_reason,
                "cta_dollars": round(managed_dollars, 2),
                "cta_executed": managed_executed,
                "random_ticker": random_ticker,
                "random_executed": random_executed,
                "twin_vol": round(twin_vol, 4) if math.isfinite(twin_vol) else None,
                "managed_vol": round(managed_vol, 4) if math.isfinite(managed_vol) else None,
                "random_vol": round(random_vol, 4) if math.isfinite(random_vol) else None,
                "leg_managed_vol_avoided": round(leg_managed_av, 4) if math.isfinite(leg_managed_av) else None,
                "leg_random_vol_avoided": round(leg_random_av, 4) if math.isfinite(leg_random_av) else None,
                "cumulative_managed_vol_avoided": round(cum_managed, 4),
                "cumulative_random_vol_avoided": round(cum_random, 4),
                "twin_maxDD": round(twin_out["max_dd"], 4) if math.isfinite(twin_out["max_dd"]) else None,
                "managed_maxDD": round(managed_out["max_dd"], 4) if math.isfinite(managed_out["max_dd"]) else None,
                "random_maxDD": round(random_out["max_dd"], 4) if math.isfinite(random_out["max_dd"]) else None,
                "managed_cash": round(managed_cash, 2),
                "random_cash": round(random_cash, 2),
                # Return dimension (log return per leg; cumulative log + simple %).
                "twin_logret": round(twin_lr, 6) if math.isfinite(twin_lr) else None,
                "managed_logret": round(managed_lr, 6) if math.isfinite(managed_lr) else None,
                "random_logret": round(random_lr, 6) if math.isfinite(random_lr) else None,
                "cum_twin_logret": round(cum_twin_lr, 6),
                "cum_managed_logret": round(cum_managed_lr, 6),
                "cum_random_logret": round(cum_random_lr, 6),
                "cum_twin_ret_pct": round(twin_ret_pct, 4),
                "cum_managed_ret_pct": round(managed_ret_pct, 4),
                "cum_random_ret_pct": round(random_ret_pct, 4),
                "managed_return_given_up_pct": round(managed_given_up, 4),
                "random_return_given_up_pct": round(random_given_up, 4),
            }
            rows.append(row)
            path_rows.append(row)

        # Cumulative vol-avoided curves: leg 0 = 0.0, then running sum after each leg.
        managed_curve = [0.0]
        random_curve = [0.0]
        # Cumulative "return given up vs twin" curves (simple %), leg 0 = 0.0.
        managed_giveup_curve = [0.0]
        random_giveup_curve = [0.0]
        rm = rr = 0.0
        for r in path_rows:
            lm = r["leg_managed_vol_avoided"]
            lr = r["leg_random_vol_avoided"]
            rm += lm if lm is not None else 0.0
            rr += lr if lr is not None else 0.0
            managed_curve.append(round(rm, 4))
            random_curve.append(round(rr, 4))
            # Given-up is already a cumulative simple-% figure per row.
            managed_giveup_curve.append(r["managed_return_given_up_pct"])
            random_giveup_curve.append(r["random_return_given_up_pct"])

        gap_final = round(managed_curve[-1] - random_curve[-1], 4)
        last = path_rows[-1]
        paths.append({
            "portfolio_id": pid,
            "archetype": archetype,
            "tier": tier,
            "lens_ever_trimmed": any_cta,
            "final_cumulative_managed_vol_avoided": managed_curve[-1],
            "final_cumulative_random_vol_avoided": random_curve[-1],
            "managed_minus_random_final": gap_final,
            "managed_cumulative_curve": managed_curve,
            "random_cumulative_curve": random_curve,
            "total_maxDD_avoided_managed": round(sum(
                (r["twin_maxDD"] or 0.0) - (r["managed_maxDD"] or 0.0) for r in path_rows
            ), 4),
            "total_maxDD_avoided_random": round(sum(
                (r["twin_maxDD"] or 0.0) - (r["random_maxDD"] or 0.0) for r in path_rows
            ), 4),
            # Return dimension (final cumulative figures + given-up curves).
            "final_twin_ret_pct": last["cum_twin_ret_pct"],
            "final_managed_ret_pct": last["cum_managed_ret_pct"],
            "final_random_ret_pct": last["cum_random_ret_pct"],
            "final_managed_return_given_up_pct": last["managed_return_given_up_pct"],
            "final_random_return_given_up_pct": last["random_return_given_up_pct"],
            "managed_giveup_curve": managed_giveup_curve,
            "random_giveup_curve": random_giveup_curve,
        })

    return {"rows": rows, "paths": paths, "n_portfolios": len(portfolios)}


def summarize(paths: list[dict]) -> dict:
    n = len(paths)
    managed_finals = [p["final_cumulative_managed_vol_avoided"] for p in paths]
    random_finals = [p["final_cumulative_random_vol_avoided"] for p in paths]

    ever = [p for p in paths if p["lens_ever_trimmed"]]
    never = [p for p in paths if not p["lens_ever_trimmed"]]

    def _med(xs: list[float]) -> float:
        s = sorted(xs)
        return s[len(s) // 2] if s else float("nan")

    def _mean(xs: list[float]) -> float:
        return sum(xs) / len(xs) if xs else float("nan")

    # Managed vs do-nothing twin (unchanged headline from before).
    managed_wins_vs_twin = sum(1 for f in managed_finals if f > 0)

    # Managed vs random-trim: the real skill test. Denominator = diverging paths.
    gaps = [p["managed_minus_random_final"] for p in ever]
    managed_beats_random = sum(1 for g in gaps if g > 0)
    ties = sum(1 for g in gaps if g == 0)
    random_beats_managed = sum(1 for g in gaps if g < 0)

    # Return dimension: cumulative return given up vs twin (simple %), all paths.
    managed_giveup = [p["final_managed_return_given_up_pct"] for p in paths]
    random_giveup = [p["final_random_return_given_up_pct"] for p in paths]

    return {
        "total_paths": n,
        "lens_ever_trimmed_paths": len(ever),
        "flat_paths_lens_never_trimmed": len(never),

        # Managed vs twin (context; the confounded headline from the prior report).
        "median_final_managed_vol_avoided": round(_med(managed_finals), 4),
        "mean_final_managed_vol_avoided": round(_mean(managed_finals), 4),
        "win_rate_managed_vs_twin": round(managed_wins_vs_twin / n, 4) if n else None,

        # Random-trim baseline vs twin (how much of the effect is pure cash drag).
        "median_final_random_vol_avoided": round(_med(random_finals), 4),
        "mean_final_random_vol_avoided": round(_mean(random_finals), 4),

        # THE comparison this arm exists to answer: managed minus random.
        "managed_minus_random_median": round(_med(gaps), 4) if gaps else None,
        "managed_minus_random_mean": round(_mean(gaps), 4) if gaps else None,
        "win_rate_managed_beats_random": round(managed_beats_random / len(ever), 4) if ever else None,
        "managed_beats_random_count": managed_beats_random,
        "random_beats_managed_count": random_beats_managed,
        "ties_count": ties,
        "diverging_denominator": len(ever),

        # Return dimension: cumulative return given up vs twin (simple %). Positive
        # = the path forfeited return vs staying fully invested; negative = the
        # path's de-risking into cash actually improved return over the twin.
        "median_managed_return_given_up_pct": round(_med(managed_giveup), 4),
        "mean_managed_return_given_up_pct": round(_mean(managed_giveup), 4),
        "median_random_return_given_up_pct": round(_med(random_giveup), 4),
        "mean_random_return_given_up_pct": round(_mean(random_giveup), 4),

        # One-look tradeoff table (medians): vol avoided vs return given up.
        "tradeoff_table": {
            "managed": {
                "median_cum_vol_avoided": round(_med(managed_finals), 4),
                "median_cum_return_given_up_pct": round(_med(managed_giveup), 4),
            },
            "random_trim": {
                "median_cum_vol_avoided": round(_med(random_finals), 4),
                "median_cum_return_given_up_pct": round(_med(random_giveup), 4),
            },
        },
    }


def main() -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    out = run()
    rows = out["rows"]
    paths = out["paths"]
    summary = summarize(paths)

    payload = {
        "_meta": {
            "n_portfolios": out["n_portfolios"],
            "as_of_dates": list(AS_OF_DATES),
            "leg_len_days": LEG_LEN,
            "n_legs": N_LEGS,
            "lookback_days": 124,
            "random_trim_seed": RANDOM_TRIM_SEED,
            "headline_metric": "cumulative_vol_avoided = running sum of "
                               "(twin_realized_vol - path_realized_vol) per leg; "
                               "a CONSTRUCTED risk-avoided measure in annualized vol "
                               "points, NOT a return or dollar figure.",
            "skill_metric": "managed_minus_random_final = managed cumulative vol "
                            "avoided minus random-trim cumulative vol avoided, per "
                            "portfolio at the final leg. Isolates Lens's choice of "
                            "WHICH position to cut from the mechanical cash-drag "
                            "effect (both paths bank the same dollars into cash).",
            "return_metric": "Per-leg realized log return ln(V_end/V_start) on the "
                             "SAME cash-inclusive value series as the vol, summed to a "
                             "cumulative log return, shown as simple % = exp(sum)-1 (NOT "
                             "annualized). 'return given up vs twin' = twin simple % "
                             "minus path simple %; positive = return forfeited, negative "
                             "= de-risking into cash improved return.",
            "return_disclaimer": "Return figures are for internal engineering "
                                 "evaluation only and must not be used in public-facing "
                                 "materials without separate review.",
            "note": "Point-in-time, no look-ahead. Managed applies only the single "
                    "top-priority CTA per leg; random baseline trims the same dollars "
                    "from a uniform-random held name on exactly those legs. "
                    "Earnings/dividends neutralized.",
        },
        "summary": summary,
        "paths": paths,
    }

    # Raw per-portfolio per-leg CSV + JSON (now includes the random-trim arm).
    raw_csv = OUTPUT_DIR / "walkforward_raw.csv"
    with open(raw_csv, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
        w.writeheader()
        w.writerows(rows)
    (OUTPUT_DIR / "walkforward_raw.json").write_text(
        json.dumps(rows, indent=2), encoding="utf-8"
    )
    (OUTPUT_DIR / "walkforward_summary.json").write_text(
        json.dumps(payload, indent=2), encoding="utf-8"
    )

    s = summary
    print("=" * 68)
    print("WALK-FORWARD SIMULATION - SUMMARY (with random-trim baseline)")
    print("=" * 68)
    print(f"paths (portfolios): {s['total_paths']}   legs: {N_LEGS} x {LEG_LEN}d   "
          f"lookback: 124d   random seed: {RANDOM_TRIM_SEED}")
    print(f"Lens ever trimmed: {s['lens_ever_trimmed_paths']}   "
          f"flat (never trimmed, no signal): {s['flat_paths_lens_never_trimmed']}")
    print("-" * 68)
    print("Managed vs do-nothing twin (confounded by cash drag):")
    print(f"  median vol avoided {s['median_final_managed_vol_avoided']:+.2f}   "
          f"win rate {s['win_rate_managed_vs_twin']:.1%}")
    print("Random-trim vs do-nothing twin (pure cash-drag reference):")
    print(f"  median vol avoided {s['median_final_random_vol_avoided']:+.2f}")
    print("-" * 68)
    print("MANAGED minus RANDOM (the skill test, over diverging paths only):")
    print(f"  median gap {s['managed_minus_random_median']:+.3f}   "
          f"mean gap {s['managed_minus_random_mean']:+.3f}")
    print(f"  managed beats random: {s['win_rate_managed_beats_random']:.1%} "
          f"({s['managed_beats_random_count']}/{s['diverging_denominator']})   "
          f"random wins {s['random_beats_managed_count']}   ties {s['ties_count']}")
    print("-" * 68)
    print("RETURN DIMENSION - tradeoff (medians, all paths):")
    print(f"  {'arm':<12} {'cum vol avoided':>16} {'cum return given up %':>22}")
    tt = s["tradeoff_table"]
    print(f"  {'managed':<12} {tt['managed']['median_cum_vol_avoided']:>+16.2f} "
          f"{tt['managed']['median_cum_return_given_up_pct']:>+22.2f}")
    print(f"  {'random-trim':<12} {tt['random_trim']['median_cum_vol_avoided']:>+16.2f} "
          f"{tt['random_trim']['median_cum_return_given_up_pct']:>+22.2f}")
    print(f"  (mean return given up: managed {s['mean_managed_return_given_up_pct']:+.2f}%, "
          f"random {s['mean_random_return_given_up_pct']:+.2f}%)")
    print("  positive given-up = forfeited return vs staying invested; negative = "
          "de-risking into cash improved return.")
    print("-" * 68)
    print("units: vol = annualized volatility points (constructed); return = cumulative "
          "simple % over the ridden horizon, not annualized.")
    print(f"wrote walkforward_raw.csv/json + walkforward_summary.json to {OUTPUT_DIR}")


if __name__ == "__main__":
    main()
