# metrics/ - caution-score calibration study (TEMPORARY, exploratory)

This folder is **not** part of the test suite and is **not** wired into pytest or CI.
It is a one-off, read-only analysis that asks a single empirical question:

> Do portfolios the Lens engine assigns a **higher caution score** go on to
> experience **more realized risk** in the period immediately after scoring?

Read-only on `engine/` and `engine/tuning.py`. Nothing here changes engine behavior.

## What makes it honest (no look-ahead)

- **Data.** `tests/parity/frozen_market_data.json` gives 44 tickers with a real
  252-trading-day daily-close series (all ending the same captured day). We use
  the `1y` array as the single master price series per ticker and **slice it** for
  every period the analyzers request, so an "as of day T" score sees only
  `closes[:T]`.
- **Point-in-time scoring.** `AsOfStore` (in `common.py`) serves the engine
  `closes[:T]` for `1y`, `closes[T-124:T]` for `6mo`, and `closes[T-1]` as the
  as-of price. Earnings and dividends are **neutralized** (served empty) because a
  single future earnings date / projected next-dividend cannot be made as-of-T
  from this snapshot; feeding them would be a look-ahead leak. Cost basis is set
  to the as-of-T value, so the performance analyzer is neutral (no fabricated
  entry price). The study therefore tests the **price/structure-driven** part of
  the caution score, not catalyst timing.
- **Realized outcome (strictly after T).** For each portfolio we buy-and-hold and
  build its value series over `closes[T:T+40]`, then compute realized forward
  volatility (annualized stdev of daily log returns) and realized max drawdown.
  Neither metric touches the caution score, so there is no circularity.

## As-of dates: three fully independent time-points

`T = 124, 164, 204` with a **40-trading-day** forward window partition
`[124,164) [164,204) [204,244)` into three **disjoint** forward windows with zero
overlap. They are reported as three independent time-points, not a blended N.
Each portfolio's tier is fixed as part of its identity; portfolios are the main
source of variation. The two headline counts (portfolio count, as-of-date count)
are reported **separately**, never multiplied into one N.

## Files

- `common.py` - offline bootstrap, master price series, `AsOfStore`, universe +
  sector map, as-of dates / forward window / score bands.
- `generate_corpus.py` - fixed-seed portfolio corpus -> `corpus.json` (committed,
  regenerates byte-identical).
- `run_calibration.py` - scores every portfolio at every as-of date, computes
  forward outcomes, buckets, and writes raw + summary to `output/`.
- `make_chart.py` - renders the bar chart PNG and prints the console summary
  (monotonicity + Pearson correlation).

## Run

```bash
python metrics/generate_corpus.py      # writes metrics/corpus.json
python metrics/run_calibration.py      # writes metrics/output/{raw,summary}.{csv,json}
python metrics/make_chart.py           # writes metrics/output/calibration.png + prints summary
```

## Guardrail

Whatever the bands come out as is what gets reported. The corpus, the dates, the
bands, and the windows are fixed up front and are **not** tuned to make the trend
look cleaner. If a band is thin or the trend is not monotonic, that is reported
as-is.
