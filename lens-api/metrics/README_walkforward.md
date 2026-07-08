# metrics/ - walk-forward simulation (TEMPORARY, exploratory)

A follow-on to the caution-score calibration study in this same folder. Same
read-only, no-look-ahead discipline; a different question:

> If you actually FOLLOW the Lens engine's single top-priority action, round after
> round, does the resulting portfolio realize LESS risk than doing nothing, on real
> forward prices the engine never saw at decision time? AND does Lens's specific
> choice of WHAT to cut beat a random trim of the same size (i.e. is there skill
> beyond the mechanical effect of de-risking into a zero-volatility cash sleeve)?

Read-only on `engine/` and `engine/tuning.py`. Nothing here changes engine behavior.

## Locked methodology

- **Legs.** 5 legs of 25 trading days. As-of dates `T = 124, 149, 174, 199, 224`;
  each leg rides `[T, T+25)`. Lookback `L = 124` fixed at every round (well above
  the 30-close floor slope and volatility need internally).
- **Corpus.** The existing 250-portfolio calibration corpus (`corpus.json`), reused
  exactly, no regeneration.
- **Three timelines per portfolio, same holdings at T=124:**
  - *Do-nothing twin*: never touched, rides the real closes the whole way,
    re-measured at each leg boundary as a pure reference.
  - *Managed path*: at each as-of date, score the current holdings point-in-time
    (`AsOfStore`, `closes[:T]` only), take the single top-priority CTA, apply ONLY
    that one action, then ride forward to the next as-of date.
  - *Random-trim baseline*: on every leg where the managed path executes a real
    trim, trim the SAME dollar amount from a uniform-random (fixed-seed
    `RANDOM_TRIM_SEED = 20260707`) name the baseline currently holds. When Lens does
    nothing, the baseline does nothing. So managed and baseline differ ONLY in which
    position is cut, never in how much or in cash handling. This isolates Lens's
    selection skill from the mechanical cash-drag effect.
- **CTA execution (top CTA only, implemented in the harness):**
  - `sell` / `rebalance` on a HELD ticker: `shares -= dollars / asof_price`, floored
    at zero (position removed if fully exited); proceeds move to a cash scalar.
    Proceeds are clamped to the position's actual value so an oversized trim can
    never bank more cash than it liquidated (in the normal case `dollars <= value`,
    this equals `cash += dollars` exactly).
  - `hold` / `buy_new`: no mutation. The portfolio rides forward unchanged. It is
    NOT excluded, just untouched that round. (`buy_new` names a ticker the book
    never held, mostly with no leak-free forward price path, so it is not
    executable without inventing data. See Part 1 Finding 1.)
  - The engine's own `_apply_all_ctas` / `projected_positions` path is deliberately
    NOT used: it applies every CTA at once and fetches buy prices via
    `get_snapshot`, which is wrong for this test.
  - Cash is a scalar OUTSIDE the positions list, so the engine never scores it.
    Cash earns zero return and zero volatility; it is added back only when computing
    realized portfolio value.
  - Cost-basis-neutral (equity reset to current value each leg); earnings and
    dividends stay neutralized via `AsOfStore`.

## Per-leg measurement

For all three timelines, realized annualized volatility over the leg's real forward
closes (same method as the calibration study: stdev of daily log returns x sqrt(252)
x 100). Realized max drawdown is also computed per leg but treated only as a
secondary end-of-path aggregate (it is unreliable at 25-day windows).

**Return dimension (added alongside volatility, not replacing it).** From the SAME
cash-inclusive value series the volatility already reads (`V_day = cash + sum(shares
x price)`), the per-leg realized log return is `R_leg = ln(V_end / V_start)`, i.e.
the sum of the same daily log returns whose stdev gives the vol. Because cash is
already in that value series, it dilutes return by the same proportion it dilutes
vol (a book that is x% cash has both scaled by `equity / (equity + cash)`); cash
contributes zero return and zero vol by the same construction, no separate handling.
Per-leg log returns are summed to a **cumulative log return** per path, displayed as
a **simple percent** (`exp(cumulative_log) - 1`). **Not annualized** (annualizing a
25-day figure by ~10x is high variance and misleading). Both the log and simple-%
forms are stored; simple % is the display figure.

**Return given up vs twin (the cost-side companion to "vol avoided").** Per path,
`twin_cumulative_simple_% - path_cumulative_simple_%`, for both the managed and
random arms. **Positive = the path forfeited return** by de-risking into cash;
**negative = de-risking into cash improved return** over staying fully invested.
This is the direct counterpart to "cumulative volatility avoided."

## Headline metrics

**Cumulative volatility avoided** (per path): a running sum of
`(twin_realized_vol - path_realized_vol)` across legs, one line per portfolio, 6
points (leg 0 = 0 through leg 5). Computed for both the managed path and the
random-trim baseline. A **constructed risk-avoided measure in annualized volatility
points** - NOT a return, price, or dollar figure; the chart is NOT an equity curve.

**Managed minus random (the skill test):** managed cumulative vol avoided minus
random cumulative vol avoided, per portfolio at the final leg. This is the number
that says whether Lens's CHOICE of what to cut adds value beyond banking cash.

## Results (as produced, not tuned)

Managed vs do-nothing twin (the confounded headline):
- 250 paths. 243 trimmed at least once; 7 never trimmed (flat at 0, no signal).
- Managed final cumulative vol avoided: **median +18.7**, mean +55.7 (right-skewed).
- Win rate vs twin (final > 0): **97.2% (243/250)**, zero strict losers.

Random-trim baseline vs twin (the pure cash-drag reference):
- Random final cumulative vol avoided: **median +15.3**. So a random same-size trim
  captures roughly **82% (15.3 / 18.7)** of the managed path's reduction. Most of
  the 97% headline is mechanical de-risking into cash, not Lens's diagnosis.

Managed minus random (the skill test, over the 243 diverging paths):
- **Median gap +0.5 vol points, mean gap +11.1** (heavily right-skewed).
- **Lens beats random on 61.7% (150/243)**; random wins 72 (29.6%); 21 ties (8.6%).
- The edge is CONCENTRATED, not broad: the large positive gaps are almost all
  `concentrated` books where cutting the dominant risky name is clearly right and a
  random pick misses it (best gaps +180 to +209). At the median portfolio, choosing
  with Lens beats a coin-flip trim by only about half a vol point.

## Plain reading

Lens does add value beyond generic de-risking, but modestly: it beats a random
same-size trim about 62% of the time (better than the 50% coin flip), yet the
typical (median) edge is roughly +0.5 vol points out of an ~18.7-point total
reduction. The mean edge (+11.1) is real but comes almost entirely from a
right-skewed tail of concentrated portfolios where the correct trim is obvious. Put
bluntly: most of the walk-forward's risk reduction is the mechanical cash sleeve
(random trimming gets +15.3 of +18.7), and Lens's selection skill is a small,
tail-driven increment on top of that, not a broad, per-portfolio advantage.

Other disclosed limits: 44-ticker universe, a single year of frozen history, five
chained legs per path (so the ~250 paths are the independent sample, not 1,250
legs). Earnings and dividends are neutralized, so this tests the price/structure
part of the engine, not catalyst timing.

## Return dimension results (as produced, not tuned)

Tradeoff at the median (all 250 paths):

| Arm | Median cum vol avoided | Median cum return given up |
|---|---|---|
| Managed | +18.7 vol pts | **-0.2%** (essentially none) |
| Random-trim | +15.3 vol pts | **+0.0%** |

Means: managed gave up **+2.7%** return, random **+2.6%**. So at the median the risk
reduction cost effectively no return (the managed median is slightly negative, i.e.
de-risking these speculative-heavy books marginally helped), and even on the mean the
return forfeited was small relative to the volatility avoided. It is **material only
in a right-skewed tail** (individual paths range from about -39% to +247% given up),
the books whose trimmed names later rose. Managed and random give up nearly identical
return, as expected: both bank the same dollars into cash, so the choice of which name
to cut barely moves aggregate return.

**This is the cost side only. It does NOT establish any net risk-adjusted benefit;
this test is not built to support that claim.** Return figures here are for internal
engineering evaluation and **must not be used in public-facing materials without
separate review.**

## Supplementary: buy-side arms (report only, N too small to chart)

Two arms were investigated and deliberately **not built as simulation arms or chart
lines** because the real data is too thin to produce a meaningful 250-path line. The
tables below are included for **engineering reference only** and are **not evidence
of anything at corpus scale.**

**Buy-only arm** (would act only on `buy_new` tops). An executable `buy_new`
(suggested ticker present in the frozen 44-ticker universe) is the top CTA on only
**32 legs across 11 of 250 portfolios**, and the suggestions collapse to **just 3
tickers: UNH (21), AAPL (9), JPM (2)**. On the other 239 portfolios this arm would be
identical to the do-nothing twin. It also has **no internal funding source** (it never
trims), so it cannot act without an external-capital mechanism, which is out of scope.

| Portfolio | Leg(s) | Suggested ticker | Reason |
|---|---|---|---|
| 4 | 1, 2 | UNH | sector_underweight |
| 11 | 1, 2, 5 | UNH | sector_underweight |
| 15 | 1, 2, 3, 4, 5 | UNH | reduce_concentration |
| 18 | 1, 5 | UNH | sector_underweight |
| 31 | 2, 5 | JPM | reduce_concentration |
| 38 | 3 | UNH | sector_underweight |
| 42 | 1, 2, 5 | UNH | reduce_concentration |
| 156 | 1, 2, 3, 4, 5 | AAPL | reduce_concentration |
| 162 | 1, 2, 3, 4 | AAPL | reduce_concentration |
| 168 | 4 | UNH | reduce_concentration |
| 204 | 1, 3, 4, 5 | UNH | reduce_concentration |

**Full-advice arm** (managed, plus spend accumulated cash on a later executable buy).
The trigger condition (prior cash on hand AND a later executable `buy_new` top)
actually occurs on only **7 of 250 portfolios, 9 legs total**. Structural reason: books
that bank cash are the risky ones that keep getting trimmed and almost never surface a
buy as top; books whose top is a buy are the healthy ones that rarely trim. The two
populations barely overlap.

| Portfolio | Cash banked on leg(s) | Buy fired on leg(s) | Ticker |
|---|---|---|---|
| 10 | 3 | 4 | PG |
| 11 | 3, 4 | 5 | UNH |
| 18 | 3, 4 | 5 | UNH |
| 31 | 3 | 4, 5 | JPM |
| 42 | 3, 4 | 5 | UNH |
| 150 | 1 | 2, 3 | UNH |
| 168 | 1, 2, 3, 4 | 5 | UNH |

## Files

- `run_walkforward.py` - runs the simulation (3 arms, vol + return), writes
  `walkforward_raw.{csv,json}` and `walkforward_summary.json` to `output/`.
- `make_walkforward_chart.py` - renders `output/walkforward.png` (volatility avoided).
- `make_return_chart.py` - renders `output/walkforward_return.png` (return given up
  vs twin, the cost-side companion).

## Run

```bash
python metrics/run_walkforward.py         # writes walkforward_raw.* + walkforward_summary.json
python metrics/make_walkforward_chart.py  # writes output/walkforward.png
python metrics/make_return_chart.py       # writes output/walkforward_return.png
```

## Guardrail

Whatever the paths and win rate come out as is what gets reported. The corpus, the
CTA rules, the leg structure, and the dates are fixed up front and are not tuned to
make the result look cleaner. The cash-drag caveat above is reported precisely
because the raw number looks better than the underlying evidence warrants.
