# Lens engine parity harness

**One-line rule:** after any Vector-Main sync, any change to `engine/tuning.py`,
or any refactor of the analyzers / CTA engine / analysis pool that is meant to
preserve behavior, run `python tests/parity/parity_harness.py` from `lens-api/`
and it **must print `[PASS]`**. If it prints `[FAIL]`, engine output changed and
you either introduced a bug or made a change you did not mean to make.

## What it proves

The harness runs the full Lens pipeline (`generate_lens_full`) over **50
portfolios x 3 risk tiers = 150 runs** and compares every field of every result
(brief, caution score, action type, the whole `ctas` list, `net_cta_delta`,
`projected_positions`, and all `pool_results`) against a frozen baseline,
byte-for-byte.

It is **deterministic**: it runs fully offline against a frozen copy of
`market_data.json`, with the `DataStore` monkeypatched so every cached entry is
treated as fresh and every yfinance network call raises. That means live price
drift can never masquerade as a code regression, and two runs minutes or days
apart produce identical output. Do not remove the offline/network-blocked design
in `_force_offline()` — it is what makes this a stable ground truth.

## Files (all self-contained, no network / Vector-Main / LOCALAPPDATA needed)

| File | What it is |
|---|---|
| `parity_harness.py` | The runner. Offline, deterministic. |
| `frozen_market_data.json` | Frozen market cache covering all 77 tickers used by the 50 portfolios (SPY 1y history included). This is the warmed, complete cache — do not replace it with a partial one. |
| `debug_test.json` | The 50 test portfolios (copied from Vector-Main so this suite needs nothing outside the repo). |
| `parity_baseline.json` | The captured ground-truth output for all 150 runs. This is what every check compares against. |

## How to run

From `lens-api/` (with deps installed: `pip install -r requirements.txt -r requirements-dev.txt`):

```bash
# Check current engine output against the saved baseline (the normal use).
python tests/parity/parity_harness.py
# -> [PASS] 150 runs byte-identical to baseline (parity_baseline.json).
```

A `[FAIL]` prints up to 200 field-level diffs (`portfolio::tier.path: old -> new`)
so you can see exactly what moved.

## When to re-capture the baseline

**Almost never during a behavior-preserving change.** The whole point is that the
baseline does not move unless you *intend* to change engine output.

Re-capture ONLY when you have deliberately and knowingly changed what the engine
should produce (a real logic/threshold change, reviewed and expected):

```bash
python tests/parity/parity_harness.py --out tests/parity/parity_baseline.json
```

Then eyeball the diff (`git diff tests/parity/parity_baseline.json`) to confirm
the change matches your intent, and commit the new baseline alongside the code
change that caused it. If you recapture to make a red check go green without
understanding the diff, you have defeated the safety net.

## Regenerating the frozen cache (rare)

Only needed if the portfolio set in `debug_test.json` gains tickers not present
in `frozen_market_data.json`. Warm the missing tickers online once (see the
engine `DataStore` getters: `get_snapshot`, `get_history` for `6mo`/`1y`,
`get_dividends`, `get_earnings`, plus `SPY` `1y`), merge them into a copy of this
file, and re-capture the baseline. Keep the already-present tickers untouched so
their frozen values stay stable.
