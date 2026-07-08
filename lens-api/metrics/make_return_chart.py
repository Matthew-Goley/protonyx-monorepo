"""Render the companion RETURN chart for the walk-forward simulation.

Same visual language as walkforward.png (thin gray individual managed paths, bold
managed median in teal -> sky gradient, bold random-trim median in slate, dashed
zero line), but the y-axis is "cumulative return given up vs the do-nothing twin"
(simple %, positive = return forfeited by de-risking into cash) instead of
volatility avoided. This is the COST-side companion to the vol chart. It shows only
what return was forfeited; it does NOT establish any net risk-adjusted benefit.

INTERNAL ENGINEERING EVALUATION ONLY. Return figures must not be used in
public-facing materials without separate review.

Usage:  python metrics/make_return_chart.py   (run after run_walkforward.py)
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))  # lens-api on path

import numpy as np

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.collections import LineCollection
from matplotlib.colors import LinearSegmentedColormap

from metrics.common import OUTPUT_DIR

# Same palette as walkforward.png.
TEAL = "#14b8a6"
SKY = "#38bdf8"
GRAD = LinearSegmentedColormap.from_list("teal_sky", [TEAL, SKY])
SLATE = "#64748b"
INK = "#0f2130"
MUTED = "#5b6b78"
SURFACE = "#fcfcfb"
GRID = "#e3e6e6"
PATH = "#9fb2bf"


def _gradient_line(ax, x, y, lw, cmap, zorder):
    pts = np.array([x, y]).T.reshape(-1, 1, 2)
    segs = np.concatenate([pts[:-1], pts[1:]], axis=1)
    lc = LineCollection(segs, cmap=cmap, linewidth=lw, zorder=zorder,
                        capstyle="round", joinstyle="round")
    lc.set_array(np.linspace(0, 1, len(segs)))
    ax.add_collection(lc)
    return lc


def main() -> None:
    summary_path = OUTPUT_DIR / "walkforward_summary.json"
    if not summary_path.exists():
        print("Run metrics/run_walkforward.py first (walkforward_summary.json missing).")
        sys.exit(1)
    payload = json.loads(summary_path.read_text(encoding="utf-8"))
    summary = payload["summary"]
    paths = payload["paths"]

    managed_curves = np.array([p["managed_giveup_curve"] for p in paths], dtype=float)
    random_curves = np.array([p["random_giveup_curve"] for p in paths], dtype=float)
    n_pts = managed_curves.shape[1]
    x = np.arange(n_pts)
    managed_median = np.median(managed_curves, axis=0)
    random_median = np.median(random_curves, axis=0)

    fig, ax = plt.subplots(figsize=(9.6, 6.4), dpi=150)
    fig.patch.set_facecolor(SURFACE)
    ax.set_facecolor(SURFACE)

    for row in managed_curves:
        ax.plot(x, row, color=PATH, linewidth=0.6, alpha=0.10, zorder=2,
                solid_capstyle="round")

    ax.axhline(0.0, color=MUTED, linewidth=1.1, linestyle=(0, (5, 4)), zorder=3)

    ax.plot(x, random_median, color=SLATE, linewidth=3.0, zorder=4,
            solid_capstyle="round")
    _gradient_line(ax, x, managed_median, lw=3.6, cmap=GRAD, zorder=5)

    _sep = max(0.6, (managed_median[-1] - random_median[-1]))
    ax.text(x[-1] + 0.08, managed_median[-1] + (0.6 if managed_median[-1] >= random_median[-1] else -0.6),
            f"Lens median {managed_median[-1]:+.1f}%",
            color=TEAL, fontsize=10.5, fontweight="bold", va="center")
    ax.text(x[-1] + 0.08, random_median[-1] - (0.6 if managed_median[-1] >= random_median[-1] else -0.6),
            f"random-trim median {random_median[-1]:+.1f}%",
            color=SLATE, fontsize=9.5, va="center")

    ax.set_xticks(x)
    ax.set_xticklabels([str(i) for i in x], fontsize=11, color=INK)
    ax.set_xlim(-0.15, n_pts - 1 + 1.5)

    # Clip the y-axis to a readable band (individual paths span far wider); the
    # median lines sit near zero, so anchor around it. Extreme paths are clipped
    # by the axis, not dropped from the data.
    ylo = float(np.percentile(managed_curves, 5))
    yhi = float(np.percentile(managed_curves, 90))
    pad = max(2.0, 0.12 * (yhi - ylo))
    ax.set_ylim(min(ylo - pad, -3.0), max(yhi + pad, 6.0))

    ax.set_xlabel("Leg number  (0 = start, 5 = end of walk-forward)",
                  fontsize=10.5, color=MUTED)
    ax.set_ylabel("Cumulative return given up vs twin\n(simple %, positive = return forfeited)",
                  fontsize=9.5, color=MUTED)

    ax.set_title("The return forfeited to de-risk was near zero at the median",
                 fontsize=14.0, color=INK, fontweight="bold", pad=40, loc="left")
    sub = ("Cost-side companion to the volatility chart. Positive = the path earned less than staying fully invested;\n"
           "negative = de-risking into cash improved return. Both arms bank the same dollars into cash.")
    ax.text(0.0, 1.01, sub, transform=ax.transAxes, fontsize=9.2,
            color=MUTED, ha="left", va="bottom")

    ax.yaxis.grid(True, color=GRID, linewidth=1, zorder=0)
    ax.set_axisbelow(True)
    for spine in ("top", "right", "left"):
        ax.spines[spine].set_visible(False)
    ax.spines["bottom"].set_color(GRID)
    ax.tick_params(length=0, colors=MUTED)

    mg_med = summary["median_managed_return_given_up_pct"]
    mg_mean = summary["mean_managed_return_given_up_pct"]
    vol_med = summary["median_final_managed_vol_avoided"]
    vol_mean = summary["mean_final_managed_vol_avoided"]
    cap = (f"At the median, the managed path gave up {mg_med:+.1f}% return (essentially none) for {vol_med:+.1f} volatility "
           f"points avoided; on the mean it gave up {mg_mean:+.1f}% for {vol_mean:+.1f} points, driven by a right-skewed tail "
           f"of books whose trimmed names later rose. So the return forfeited was small at the median and material only in the "
           f"tail. This chart shows the COST side only and does NOT establish any net risk-adjusted benefit, which this test is "
           f"not built to support. Internal engineering evaluation only, not for public-facing use without separate review. "
           f"Return = cumulative simple % over the ridden horizon, not annualized. 44-ticker universe, single year of history.")
    fig.text(0.5, 0.005, cap, ha="center", va="bottom", fontsize=6.8, color=MUTED, wrap=True)

    fig.tight_layout(rect=(0, 0.08, 1, 0.86))
    out_png = OUTPUT_DIR / "walkforward_return.png"
    fig.savefig(out_png, facecolor=SURFACE, bbox_inches="tight")
    print(f"wrote {out_png}")
    print(f"  managed given-up median {mg_med:+.2f}% mean {mg_mean:+.2f}%   "
          f"random given-up median {summary['median_random_return_given_up_pct']:+.2f}% "
          f"mean {summary['mean_random_return_given_up_pct']:+.2f}%")


if __name__ == "__main__":
    main()
