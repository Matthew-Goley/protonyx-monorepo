# Lens edge-case failure-detection harness

A mechanical detector for the ~10% of portfolios where the Lens engine emits a
questionable recommendation. It does **not** fix the engine and does **not**
touch anything under `engine/`. A violated invariant is a *finding*, reported
for later triage, never patched here.

Three pieces:

| File | Role |
|---|---|
| `generate_corpus.py` -> `edge_corpus.json` | Deterministic torture corpus (fixed seed). |
| `invariants.py` | Pure predicate checks - one property each, HARD vs SOFT. |
| `run_edge_report.py` -> `edge_report.json` | Runs the corpus offline, applies every invariant to every portfolio, prints a summary, exits non-zero on any HARD failure. |
| `edge_common.py` | Offline bootstrap (frozen cache, network blocked) + engine runner. |
| `test_edge_smoke.py` | pytest: proves the detector fires on broken output and that a full build has 0 HARD violations. |

## Run

```bash
# from lens-api/
python tests/edge/generate_corpus.py     # (re)build the corpus (only if you change it)
python tests/edge/run_edge_report.py      # run the report; exit != 0 iff a HARD invariant fails
python -m pytest tests/edge -q            # smoke-test the detector itself
```

## How it stays deterministic (offline)

Same discipline as `tests/parity/parity_harness.py`: the frozen
`tests/parity/frozen_market_data.json` is copied into a throwaway `LENS_DATA_DIR`,
the `DataStore` is patched so every cached entry is "fresh" and every yfinance
call raises, and **each portfolio runs on a freshly rebuilt store** so nothing
leaks between runs. No network, no `Vector-Main`, no `LOCALAPPDATA`.

Because current portfolio value is read from the frozen snapshot price, the
corpus solves share counts from those prices to hit exact target weights/values.
Concentration and performance severity bands are therefore *exact*; slope /
volatility / beta bands use the nearest real full-history ticker (only 41 of the
142 frozen tickers carry >= 30 daily closes - see `edge_corpus.json` -> `data_notes`).

## Corpus categories

`structural` (empty / single / two / one-sector / all-index / diversified),
`numeric_boundary` (positions sitting exactly on tier thresholds, penny/fractional
lots, ~100% single position, dead-weight $25 edge), `data_quality` (unknown /
malformed / missing sector, insufficient history, zero/negative/huge shares,
NaN/inf bait), `settings` (missing / unknown / each explicit risk tier),
`severity_driver` (each concentration + performance severity band, forced
sells / buys / dead-weight pruning, conservative suppression, leveraged-ETF fire),
`adversarial` (tier-ordering under per-tier sell scaling, Unknown-sector
concentration buys, small trims, dominant-trim-vs-sell, two share classes).

## Invariants

**HARD** (structural guarantees the engine's own code enforces; a violation
gates CI):

- `no_contradictory_ctas` - never buy and sell the same ticker.
- `budget_caps` - total buys within the per-tier max-buy fraction; no buy over the per-CTA cap.
- `no_concentration_increasing_buy` - concentration buys avoid the heavy ticker and heavy sector.
- `caution_in_range` - `caution_score` int in [1,99] (0 for empty); `threat_level == score/100`.
- `finite_outputs` - no NaN/inf anywhere in the result (asserted, not repaired).
- `result_well_formed` - documented keys present; CTAs valid; color matches action.
- `sell_not_exceed_holding` - a sell/rebalance never exceeds the held value.
- `deadweight_value_cutoff` - dead-weight sells respect the $25 floor.
- `net_delta_matches_flows` - `net_cta_delta == buys - sells`.
- `projected_value_conservation` - projected equity == current value + `net_cta_delta`.
- `dominant_position_addressed` - a >50% non-index position is always trimmed.
- `output_fields_consistent` - `deposit_amount` / `action_type` / `recommended_tickers` match the top CTA.

**SOFT** (judgment calls; reported, never gate; thresholds are named constants at
the top of `invariants.py`):

- `tier_monotonicity` - caution non-increasing across low >= regular >= high.
- `clean_is_quiet` - a portfolio tagged clean emits no CTA >= `QUIET_MAX_SEVERITY`.
- `min_sell_floor` - non-dead-weight sells clear the min-sell / min-position floors.
- `weight_sum` - ticker weights sum to ~1.0.
- `concentration_flag_actionable` - a high/critical concentration flag draws an
  actionable response (trim or diversify) **only when an action was genuinely
  available**: more than two *effective* holdings (dual-class share pairs collapsed
  to one issuer) and an under-weight sector to redirect into. See the tightening
  note below.
- `same_issuer_aggregation` - two+ share classes of one issuer (e.g. GOOG + GOOGL)
  summing to > 50% of the book are not left as a bare hold.

### Tightening note: `concentration_flag_actionable` (2026-07-07 triage)

The first version of this check fired on any high/critical per-ticker concentration
flag that got only hold CTAs. Triage showed that was a **false positive** on
two-holding books: in a genuine 50/50 (or 45/45/10) portfolio, ~50% per name is the
FLOOR - you cannot be less concentrated with two names - so the engine correctly
flags "high concentration" AND correctly holds, because there is no useful trim
(selling one name just to fund the other is pointless). **That flag-then-hold is
correct engine behaviour and is NOT a finding.** The engine was not changed.

The check now excludes that case: it fires only when the response is pure-hold AND
there are **more than two effective holdings** (dual-class pairs collapsed via a
small static `SAME_ISSUER_GROUPS` map) AND a **dilution target exists** (a
`SECTOR_SUGGESTIONS` sector the book does not already hold). The ~90%-single-issuer
case (`adv-two-share-classes`) is a *different* pathology - the two share classes
land in different sectors so the portfolio-level flag understates the real exposure
- and was moved OUT of this check into the separate `same_issuer_aggregation` check
so the two problems are not conflated (chose option (b): a distinct pathology gets a
distinct check).

## Current result (2026-07-07, post-tightening)

63 portfolios, **0 HARD violations**, **1 SOFT** finding.

| check | hits | portfolios |
|---|---|---|
| `same_issuer_aggregation` | 1 | `adv-two-share-classes` (GOOG+GOOGL == 90% one issuer, pure hold) |
| `concentration_flag_actionable` | 0 | (the ~10 two-holding-floor books no longer fire) |
| all others | 0 | - |

The single remaining finding is surfaced for the right reason: ~90% of the book is
one issuer masked as two positions, yet the response is only informational holds.
Nothing here has been "fixed" - triage before deciding if it is an engine bug.
Parity (`tests/parity/parity_harness.py`) stays `[PASS] 150/150`, confirming the
engine is byte-for-byte untouched.
