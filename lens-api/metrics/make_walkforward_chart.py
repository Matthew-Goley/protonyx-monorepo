"""Render the walk-forward line chart with the random-trim baseline arm.

X: leg number (0..5). Y: cumulative volatility avoided, a CONSTRUCTED risk-avoided
measure (running sum of twin_realized_vol - path_realized_vol across legs), in
annualized volatility points. This is NOT a return, NOT a dollar figure, and must
never be read as an equity / performance curve.

Three elements plotted:
  - thin low-opacity gray lines: every portfolio's managed path
  - bold MANAGED median (brand teal -> sky gradient) = follow Lens's chosen trim
  - bold RANDOM-TRIM median (neutral slate, deliberately NOT a brand color) =
    same-size trim of a randomly chosen held name
plus a flat zero reference line. The gap between the two bold lines is Lens's
edge from choosing WHAT to cut, above the mechanical de-risking-into-cash effect.

Usage:  python metrics/make_walkforward_chart.py   (run after run_walkforward.py)
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

# Brand gradient (managed = the product's choice): teal -> sky.
TEAL = "#14b8a6"
SKY = "#38bdf8"
GRAD = LinearSegmentedColormap.from_list("teal_sky", [TEAL, SKY])
# Random baseline: neutral slate, intentionally OUTSIDE the brand palette so it
# does not read as "good / product".
SLATE = "#64748b"
INK = "#0f2130"
MUTED = "#5b6b78"
SURFACE = "#fcfcfb"
GRID = "#e3e6e6"
PATH = "#9fb2bf"   # individual managed path lines (neutral, low opacity)


def _gradient_line(ax, x, y, lw, cmap, zorder):
    """Draw one line whose color ramps along its length via a LineCollection."""
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

    managed_curves = np.array([p["managed_cumulative_curve"] for p in paths], dtype=float)
    random_curves = np.array([p["random_cumulative_curve"] for p in paths], dtype=float)
    n_pts = managed_curves.shape[1]
    x = np.arange(n_pts)                     # 0..5
    managed_median = np.median(managed_curves, axis=0)
    random_median = np.median(random_curves, axis=0)

    fig, ax = plt.subplots(figsize=(9.6, 6.4), dpi=150)
    fig.patch.set_facecolor(SURFACE)
    ax.set_facecolor(SURFACE)

    # Individual managed paths: thin, low opacity.
    for row in managed_curves:
        ax.plot(x, row, color=PATH, linewidth=0.6, alpha=0.10, zorder=2,
                solid_capstyle="round")

    # Flat zero reference line.
    ax.axhline(0.0, color=MUTED, linewidth=1.1, linestyle=(0, (5, 4)), zorder=3)

    # Bold random-trim median (neutral slate), then managed median (brand gradient)
    # on top so the product line reads as primary.
    ax.plot(x, random_median, color=SLATE, linewidth=3.0, zorder=4,
            solid_capstyle="round")
    _gradient_line(ax, x, managed_median, lw=3.6, cmap=GRAD, zorder=5)

    # Nudge the two end labels apart: the lines are close (that is the finding),
    # so anchor Lens above and random-trim below to keep both legible.
    _sep = 9.0
    ax.text(x[-1] + 0.08, managed_median[-1] + _sep, f"Lens median {managed_median[-1]:+.1f}",
            color=TEAL, fontsize=10.5, fontweight="bold", va="center")
    ax.text(x[-1] + 0.08, random_median[-1] - _sep, f"random-trim median {random_median[-1]:+.1f}",
            color=SLATE, fontsize=9.5, va="center")

    ax.set_xticks(x)
    ax.set_xticklabels([str(i) for i in x], fontsize=11, color=INK)
    ax.set_xlim(-0.15, n_pts - 1 + 1.5)

    ymax = float(np.percentile(managed_curves, 99)) * 1.05
    ax.set_ylim(min(0.0, float(np.min(random_curves))) * 1.05 - 1.0,
                max(ymax, managed_median[-1] * 1.3))

    ax.set_xlabel("Leg number  (0 = start, 5 = end of walk-forward)",
                  fontsize=10.5, color=MUTED)
    ax.set_ylabel("Cumulative volatility avoided\n(annualized vol points, constructed measure)",
                  fontsize=9.5, color=MUTED)

    ax.set_title("Lens's choice of what to cut adds only a modest edge over a random trim",
                 fontsize=13.8, color=INK, fontweight="bold", pad=40, loc="left")
    sub = (f"{summary['total_paths']} portfolio paths, 5 legs of 25 trading days, point-in-time "
           f"(no look-ahead). Both lines bank the same dollars into a\nzero-volatility cash sleeve; "
           f"only the choice of WHICH name to trim differs. Gap between the lines = Lens's selection edge.")
    ax.text(0.0, 1.01, sub, transform=ax.transAxes, fontsize=9.2,
            color=MUTED, ha="left", va="bottom")

    ax.yaxis.grid(True, color=GRID, linewidth=1, zorder=0)
    ax.set_axisbelow(True)
    for spine in ("top", "right", "left"):
        ax.spines[spine].set_visible(False)
    ax.spines["bottom"].set_color(GRID)
    ax.tick_params(length=0, colors=MUTED)

    gap_med = summary["managed_minus_random_median"]
    gap_mean = summary["managed_minus_random_mean"]
    win = summary["win_rate_managed_beats_random"]
    denom = summary["diverging_denominator"]
    beats = summary["managed_beats_random_count"]
    cap = (f"Lens beats a random same-size trim on {win:.0%} of the {denom} portfolios where it trimmed "
           f"({beats}/{denom}); median edge {gap_med:+.1f} vol points, mean {gap_mean:+.1f} (right-skewed, "
           f"driven by concentrated books). Random trimming alone reaches median {summary['median_final_random_vol_avoided']:+.1f} "
           f"of Lens's {summary['median_final_managed_vol_avoided']:+.1f}, so most of the reduction is the mechanical cash sleeve, "
           f"not Lens's diagnosis. The y-axis is a constructed risk-avoided measure, not a return, price, or dollar amount, and is "
           f"not an equity curve. 44-ticker universe, single year of history; limits in metrics/README_walkforward.md.")
    fig.text(0.5, 0.005, cap, ha="center", va="bottom", fontsize=6.8, color=MUTED, wrap=True)

    fig.tight_layout(rect=(0, 0.08, 1, 0.86))
    out_png = OUTPUT_DIR / "walkforward.png"
    fig.savefig(out_png, facecolor=SURFACE, bbox_inches="tight")
    print(f"wrote {out_png}")
    print(f"  managed median {managed_median[-1]:+.2f}   random median {random_median[-1]:+.2f}   "
          f"managed beats random {win:.1%} ({beats}/{denom})   median gap {gap_med:+.2f}")


if __name__ == "__main__":
    main()
