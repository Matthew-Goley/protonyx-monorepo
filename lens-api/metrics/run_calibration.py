"""Score every corpus portfolio at every as-of date, measure the realized forward
outcome, bucket by caution band, and write raw + summary to metrics/output/.

Point-in-time: the engine sees only data up to T via AsOfStore; the realized
outcome uses strictly-after-T closes. No look-ahead, no circularity.

Usage:  python metrics/run_calibration.py
"""

from __future__ import annotations

import csv
import json
import math
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))  # lens-api on path

from metrics.common import (
    AS_OF_DATES,
    BANDS,
    CORPUS_PATH,
    FORWARD_H,
    OUTPUT_DIR,
    AsOfStore,
    band_for,
    band_labels,
    master_series,
    realized_forward,
    setup_offline,
)


def _positions_for(weights: dict, tier: str, store: AsOfStore, book: float = 100_000.0):
    """Build engine positions + a share map at this store's as-of date.

    shares_i = weight_i * book / price_i(T), so as-of-T weights are exact and the
    outcome buy-and-hold uses those same shares.
    """
    from metrics.common import SECTOR_MAP

    positions = []
    shares: dict[str, float] = {}
    for tk, w in weights.items():
        price = store.asof_price(tk)
        if not price or price <= 0:
            continue
        sh = (w * book) / price
        shares[tk] = sh
        positions.append({
            "ticker": tk,
            "shares": sh,
            "equity": sh * price,          # cost basis = as-of-T value (performance neutral)
            "price": price,
            "sector": SECTOR_MAP.get(tk, "Unknown"),
            "name": tk,
            "added_at": "2024-01-01T00:00:00",
        })
    return positions, shares


def run() -> dict:
    setup_offline()
    from engine.constants import DEFAULT_SETTINGS
    from engine.lens.lens_output import build_lens_output

    m = master_series()
    corpus = json.loads(Path(CORPUS_PATH).read_text(encoding="utf-8"))
    portfolios = corpus["portfolios"]

    rows: list[dict] = []
    skipped = 0
    for p in portfolios:
        weights = p["weights"]
        tier = p["tier"]
        for T in AS_OF_DATES:
            store = AsOfStore(m, T)
            positions, shares = _positions_for(weights, tier, store)
            if not positions:
                skipped += 1
                continue
            settings = {**DEFAULT_SETTINGS, "risk_tier": tier}
            result = build_lens_output(
                [dict(pos) for pos in positions], store, settings, save_history=False
            )
            caution = int(result.get("caution_score", 0))
            fwd = realized_forward(shares, m, T, FORWARD_H)
            if not math.isfinite(fwd["realized_vol"]):
                skipped += 1
                continue
            rows.append({
                "portfolio_id": p["id"],
                "archetype": p["archetype"],
                "tier": tier,
                "as_of": T,
                "n_holdings": len(positions),
                "caution_score": caution,
                "band": band_for(caution),
                "realized_vol": round(fwd["realized_vol"], 4),
                "realized_max_drawdown": round(fwd["realized_max_drawdown"], 4),
            })
    return {"rows": rows, "skipped": skipped, "n_portfolios": len(portfolios)}


def aggregate(rows: list[dict]) -> list[dict]:
    """Mean realized vol + drawdown and observation count per caution band."""
    summary = []
    for label in band_labels():
        band_rows = [r for r in rows if r["band"] == label]
        n = len(band_rows)
        if n == 0:
            summary.append({
                "band": label, "count": 0,
                "mean_realized_vol": None, "mean_realized_max_drawdown": None,
                "median_realized_vol": None,
            })
            continue
        vols = sorted(r["realized_vol"] for r in band_rows)
        dds = [r["realized_max_drawdown"] for r in band_rows]
        summary.append({
            "band": label,
            "count": n,
            "mean_realized_vol": round(sum(vols) / n, 4),
            "median_realized_vol": round(vols[n // 2], 4),
            "mean_realized_max_drawdown": round(sum(dds) / n, 4),
        })
    return summary


def _pearson(xs: list[float], ys: list[float]) -> float:
    n = len(xs)
    if n < 2:
        return float("nan")
    mx = sum(xs) / n
    my = sum(ys) / n
    cov = sum((x - mx) * (y - my) for x, y in zip(xs, ys))
    vx = sum((x - mx) ** 2 for x in xs)
    vy = sum((y - my) ** 2 for y in ys)
    if vx <= 0 or vy <= 0:
        return float("nan")
    return cov / math.sqrt(vx * vy)


def main() -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    out = run()
    rows = out["rows"]
    summary = aggregate(rows)

    corr_all = _pearson(
        [r["caution_score"] for r in rows], [r["realized_vol"] for r in rows]
    )
    corr_dd = _pearson(
        [r["caution_score"] for r in rows], [r["realized_max_drawdown"] for r in rows]
    )

    # Per-as-of-date band summary too (so the disjoint dates are visible separately).
    per_date = {}
    for T in AS_OF_DATES:
        per_date[str(T)] = aggregate([r for r in rows if r["as_of"] == T])

    payload = {
        "_meta": {
            "n_portfolios": out["n_portfolios"],
            "as_of_dates": list(AS_OF_DATES),
            "forward_window_days": FORWARD_H,
            "observations": len(rows),
            "skipped": out["skipped"],
            "bands": [f"{lo}-{hi}" for lo, hi in BANDS],
            "pearson_score_vs_realized_vol": None if math.isnan(corr_all) else round(corr_all, 4),
            "pearson_score_vs_max_drawdown": None if math.isnan(corr_dd) else round(corr_dd, 4),
            "note": "portfolio count and as-of-date count are separate; observations "
                    "= portfolios x dates but the 3 dates are disjoint time-points.",
        },
        "summary_pooled": summary,
        "summary_per_as_of_date": per_date,
    }

    # Write raw per-observation CSV + JSON.
    raw_csv = OUTPUT_DIR / "raw.csv"
    with open(raw_csv, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
        w.writeheader()
        w.writerows(rows)
    (OUTPUT_DIR / "raw.json").write_text(
        json.dumps(rows, indent=2), encoding="utf-8"
    )

    # Write bucketed summary CSV + JSON.
    sum_csv = OUTPUT_DIR / "summary.csv"
    with open(sum_csv, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=list(summary[0].keys()))
        w.writeheader()
        w.writerows(summary)
    (OUTPUT_DIR / "summary.json").write_text(
        json.dumps(payload, indent=2), encoding="utf-8"
    )

    print(f"[calibration] {out['n_portfolios']} portfolios x {len(AS_OF_DATES)} dates "
          f"= {len(rows)} observations ({out['skipped']} skipped)")
    print(f"  Pearson(caution, realized_vol) = {payload['_meta']['pearson_score_vs_realized_vol']}")
    print("  band            n   mean_vol  median_vol  mean_maxDD")
    for s in summary:
        if s["count"] == 0:
            print(f"  {s['band']:<12} {s['count']:>4}   (empty)")
        else:
            print(f"  {s['band']:<12} {s['count']:>4}   {s['mean_realized_vol']:>7.2f}  "
                  f"{s['median_realized_vol']:>9.2f}  {s['mean_realized_max_drawdown']:>9.2f}")
    print(f"  wrote raw.csv/json + summary.csv/json to {OUTPUT_DIR}")


if __name__ == "__main__":
    main()
