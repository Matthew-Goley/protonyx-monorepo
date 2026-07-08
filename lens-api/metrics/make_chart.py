"""Render the calibration bar chart and print the console summary.

One bar per caution-score band; bar height = mean realized forward volatility;
each bar labeled with its mean value and its sample count (n). Sequential
teal -> deep-sky ramp (light -> dark) reinforces the band ordering; bar height is
the primary encoding and every bar is directly labeled.

Usage:  python metrics/make_chart.py   (run after run_calibration.py)
"""

from __future__ import annotations

import json
import math
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))  # lens-api on path

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

from metrics.common import OUTPUT_DIR

# Teal -> deep-sky sequential ramp (Lens Arc family), verified monotonic light->dark.
RAMP = ["#8fe3d8", "#45c9c6", "#22b6cf", "#1f93d1", "#1668c4"]
INK = "#0f2130"
MUTED = "#5b6b78"
SURFACE = "#fcfcfb"
GRID = "#e3e6e6"


def main() -> None:
    summary_path = OUTPUT_DIR / "summary.json"
    if not summary_path.exists():
        print("Run metrics/run_calibration.py first (summary.json missing).")
        sys.exit(1)
    payload = json.loads(summary_path.read_text(encoding="utf-8"))
    meta = payload["_meta"]
    summary = payload["summary_pooled"]

    labels = [s["band"] for s in summary]
    vols = [s["mean_realized_vol"] or 0.0 for s in summary]
    counts = [s["count"] for s in summary]

    # ── Console summary ──
    present = [(s["band"], s["mean_realized_vol"]) for s in summary if s["count"] > 0]
    means = [v for _, v in present]
    strictly_mono = all(means[i] < means[i + 1] for i in range(len(means) - 1))
    corr = meta.get("pearson_score_vs_realized_vol")
    print("=" * 60)
    print("CAUTION SCORE CALIBRATION - SUMMARY")
    print("=" * 60)
    print(f"portfolios: {meta['n_portfolios']}   as-of dates: {len(meta['as_of_dates'])} "
          f"{tuple(meta['as_of_dates'])}   forward window: {meta['forward_window_days']}d")
    print(f"observations: {meta['observations']}  (portfolios x dates; the 3 dates are disjoint)")
    print(f"Pearson(caution score, realized forward vol) across ALL portfolios: {corr}")
    print(f"band means strictly increasing across populated bands: {strictly_mono}")
    for s in summary:
        n = s["count"]
        mv = s["mean_realized_vol"]
        print(f"  {s['band']:<8} n={n:<4} mean_realized_vol="
              f"{'  (empty)' if mv is None else f'{mv:6.2f}'}")
    if not strictly_mono:
        print("NOTE: not strictly monotonic across all bands - reported as-is, not adjusted.")
    print("=" * 60)

    # ── Chart ──
    fig, ax = plt.subplots(figsize=(9.0, 5.6), dpi=150)
    fig.patch.set_facecolor(SURFACE)
    ax.set_facecolor(SURFACE)

    x = list(range(len(labels)))
    bw = 0.62
    ymax = max(vols) * 1.18 if vols else 1.0
    ax.bar(x, vols, width=bw, color=RAMP, edgecolor="none", zorder=3)

    # Value label above each bar + sample count inside/near the base.
    for xi, h, n in zip(x, vols, counts):
        if n == 0:
            ax.text(xi, ymax * 0.03, "no data", ha="center", va="bottom",
                    color=MUTED, fontsize=10)
            continue
        ax.text(xi, h + ymax * 0.02, f"{h:.1f}", ha="center", va="bottom",
                color=INK, fontsize=13, fontweight="bold")
        ax.text(xi, h + ymax * 0.075, "avg realized vol", ha="center", va="bottom",
                color=MUTED, fontsize=8)
        # count label: white on the dark bar if the bar is tall enough, else above
        if h > ymax * 0.14:
            ax.text(xi, ymax * 0.03, f"n = {n}", ha="center", va="bottom",
                    color="#ffffff", fontsize=10.5, fontweight="bold", zorder=5)
        else:
            ax.text(xi, h + ymax * 0.135, f"n = {n}", ha="center", va="bottom",
                    color=MUTED, fontsize=10.5)

    ax.set_xticks(x)
    ax.set_xticklabels(labels, fontsize=11, color=INK)
    ax.set_ylim(0, ymax)
    ax.set_xlim(-0.6, len(labels) - 0.4)
    ax.set_ylabel("Realized forward volatility (annualized %, next 40 trading days)",
                  fontsize=10.5, color=MUTED)
    ax.set_xlabel("Lens caution score band  (1 = calm, 99 = high caution)",
                  fontsize=10.5, color=MUTED)

    ax.set_title("Higher Lens caution scores precede higher realized risk",
                 fontsize=15.5, color=INK, fontweight="bold", pad=16, loc="left")
    sub = (f"Point-in-time, no look-ahead. {meta['n_portfolios']} portfolios scored at "
           f"{len(meta['as_of_dates'])} disjoint dates. "
           f"Correlation of score to realized vol: {corr}.")
    ax.text(0.0, 1.015, sub, transform=ax.transAxes, fontsize=9.5,
            color=MUTED, ha="left", va="bottom")

    ax.yaxis.grid(True, color=GRID, linewidth=1, zorder=0)
    ax.set_axisbelow(True)
    for spine in ("top", "right", "left"):
        ax.spines[spine].set_visible(False)
    ax.spines["bottom"].set_color(GRID)
    ax.tick_params(length=0, colors=MUTED)

    cap = ("Realized vol is measured on data strictly after each scoring date and never feeds the score. "
           "Earnings and dividends neutralized. 44-ticker universe, single year of history; disclosed limits in metrics/README.md.")
    fig.text(0.5, 0.005, cap, ha="center", va="bottom", fontsize=7.3, color=MUTED, wrap=True)

    fig.tight_layout(rect=(0, 0.045, 1, 0.98))
    out_png = OUTPUT_DIR / "calibration.png"
    fig.savefig(out_png, facecolor=SURFACE, bbox_inches="tight")
    print(f"wrote {out_png}")


if __name__ == "__main__":
    main()
