# CLAUDE.md — lens-api

This file is the complete context document for the `lens-api` service. A new session should be able to read this and immediately understand what exists, what it does, and what work is still ahead.

**Update this file whenever you change the service in a way that contradicts what is written here.** Stale docs are worse than no docs.

---

## 1. Why This Service Exists

The product is **Protonyx** — a fintech platform with a proprietary portfolio analytics engine called **Lens**. Lens produces a 1-sentence "brief," a 1–99 caution score, a prioritized list of trade actions (CTAs), and Monte Carlo projections for a user's stock portfolio.

Lens was originally built inside **Vector**, a PyQt6 Windows desktop app (`Vector-Main/` in the workspace root, one level above `_monorepo/`). The goal is to migrate Vector's analytics to the web. This service is **phase 1**: extract the Lens computation engine from Vector, deploy it as a standalone Python FastAPI microservice on Railway, and wire the existing Fastify backend (or the future web frontend) up to it.

**lens-api does exactly one thing:** accept a portfolio over HTTP, run the Lens engine, and return the result. Nothing else.

---

## 2. Where Things Live (Full Workspace Layout)

The workspace root is one level above `_monorepo/`. From there:

```
<workspace root>/
├── _monorepo/
│   ├── backend/        LIVE production Fastify/TypeScript backend (auth, users, legal, EULA).
│   │                   This is NOT Python. The name FastAPI is a common mix-up with Fastify.
│   │                   Do not add Python code here.
│   ├── lens-api/       THIS SERVICE — standalone Python FastAPI analytics microservice.
│   ├── frontend/       Static HTML/CSS/JS web frontend. Dev-only, not deployed yet.
│   └── app/            Stale, rarely-synced copy of the desktop app. Do not use as source of truth.
│
└── Vector-Main/        THE REAL, CURRENT, MOST-DEVELOPED desktop app (PyQt6).
                        This is the canonical source of truth for all Lens logic.
                        When you need to understand or update Lens behavior, read Vector-Main/.
```

**Critical:** `_monorepo/backend/` is Fastify/Node, not Python. A future session must not confuse Fastify and FastAPI. The Fastify backend handles auth/users/EULA. This service (`lens-api`) handles analytics only.

---

## 3. What Was Extracted and How

### Source of truth

`Vector-Main/vector/` contains the original desktop app. The computation layer inside it was **already fully decoupled from PyQt6** — zero UI imports anywhere in the analytics code. The split was clean from the start.

### What was extracted

These modules were copied from `Vector-Main/vector/` into `lens-api/engine/`:

| Original (`vector/`) | New (`engine/`) | Change |
|---|---|---|
| `lens_engine.py` | `engine/lens_engine.py` | import fix |
| `analytics.py` | `engine/analytics.py` | none |
| `monte_carlo.py` | `engine/monte_carlo.py` | none (TYPE_CHECKING only) |
| `constants.py` | `engine/constants.py` | none (uses relative `.paths`) |
| `store.py` | `engine/store.py` | none (uses relative imports) |
| `yfinance_counter.py` | `engine/yfinance_counter.py` | none |
| `paths.py` | `engine/paths.py` | **MODIFIED** — see section 4 |
| `lens/__init__.py` | `engine/lens/__init__.py` | none |
| `lens/_templates.py` | `engine/lens/_templates.py` | import fix |
| `lens/analysis_pool.py` | `engine/lens/analysis_pool.py` | import fix |
| `lens/cta_engine.py` | `engine/lens/cta_engine.py` | import fix |
| `lens/debug_runner.py` | `engine/lens/debug_runner.py` | import fix |
| `lens/lens_output.py` | `engine/lens/lens_output.py` | import fix |
| `lens/risk_profile.py` | `engine/lens/risk_profile.py` | import fix |
| `lens/sentence1.py` | `engine/lens/sentence1.py` | import fix |
| `lens/sentence2.py` | `engine/lens/sentence2.py` | import fix |
| `lens/sentence3.py` | `engine/lens/sentence3.py` | import fix |
| `lens/analyzers/__init__.py` | `engine/lens/analyzers/__init__.py` | none |
| `lens/analyzers/beta.py` | `engine/lens/analyzers/beta.py` | import fix |
| `lens/analyzers/concentration.py` | `engine/lens/analyzers/concentration.py` | import fix |
| `lens/analyzers/dividends.py` | `engine/lens/analyzers/dividends.py` | **DIVERGED** (next-ex-date estimation, see §6) |
| `lens/analyzers/earnings.py` | `engine/lens/analyzers/earnings.py` | import fix |
| `lens/analyzers/index_fund.py` | `engine/lens/analyzers/index_fund.py` | import fix |
| `lens/analyzers/performance.py` | `engine/lens/analyzers/performance.py` | none |
| `lens/analyzers/slope.py` | `engine/lens/analyzers/slope.py` | import fix |
| `lens/analyzers/volatility.py` | `engine/lens/analyzers/volatility.py` | none |
| `lens/templates/sentences.json` | `engine/lens/templates/sentences.json` | none |

### What "import fix" means

The original code uses absolute imports like `from vector.analytics import ...`. Since the package was renamed from `vector` to `engine`, every such import was rewritten: `from vector.X import Y` → `from engine.X import Y`. This was applied with `sed 's/from vector\./from engine./g'` at copy time.

Relative imports within the package (e.g. `from .risk_profile import load_risk_profile`, `from ..constants import INDEX_ETFS`) were not changed and still work correctly.

The one exception: `engine/monte_carlo.py` still contains `from vector.store import DataStore` but it is inside `if TYPE_CHECKING:` — this block never runs at runtime and was left as-is intentionally.

### What was left behind

All PyQt6 UI code: `vector/app.py`, `vector/pages/`, `vector/widget_types/`, `vector/widgets.py`, `vector/scale.py`, `vector/widget_base.py`, `vector/widget_registry.py`, `vector/notifications.py`, `vector/eula_gate.py`, `auth/login_window.py`, `auth/auth.py`. None of this is relevant to the web service.

---

## 4. The One Modified File: `engine/paths.py`

The original `vector/paths.py` resolved the writable data directory as `%LOCALAPPDATA%/Protonyx/Vector` on Windows, falling back to `~/Vector/data`. This is correct for the desktop app but wrong for a Railway container (Railway runs Linux, `LOCALAPPDATA` doesn't exist, and `/home/...` may not be writable).

`engine/paths.py` adds a first-priority check for a `LENS_DATA_DIR` environment variable:

```python
def user_data_dir() -> Path:
    env_override = os.environ.get("LENS_DATA_DIR")
    if env_override:
        path = Path(env_override)
    else:
        # original fallback chain unchanged below
        ...
```

**Set `LENS_DATA_DIR=/tmp/lens_data` (or a Railway-mounted volume) on the server.** Without it, the server uses `~/Vector/data` which works but is ephemeral and less intentional.

Everything else in `paths.py` is identical to the original: `resource_path()` resolves relative to the `lens-api/` directory (since `engine/paths.py` is two levels deep), which is the correct root for the `engine/lens/templates/sentences.json` path.

---

## 5. File Tree

```
lens-api/
├── main.py                    FastAPI application
├── requirements.txt           Python dependencies
├── Procfile                   Railway startup command
├── .env.example               Required env vars with descriptions
├── parity_check.py            Verification script (see section 8)
└── engine/                    The Lens computation package
    ├── __init__.py
    ├── analytics.py           Portfolio math primitives (slope, vol, Sharpe, beta)
    ├── constants.py           App-wide constants, risk profiles, sector maps, DEFAULT_SETTINGS
    ├── lens_engine.py         Entry point: generate_lens() and generate_lens_full()
    ├── monte_carlo.py         GBM Monte Carlo projection engine
    ├── paths.py               Path utilities — MODIFIED for LENS_DATA_DIR env var
    ├── store.py               DataStore — yfinance wrapper with JSON caching
    ├── yfinance_counter.py    yfinance call counter (dev utility, silent in production)
    └── lens/
        ├── __init__.py
        ├── _templates.py      Loads sentences.json; package-local path takes priority
        ├── analysis_pool.py   Orchestrates all 8 analyzers in dependency order
        ├── cta_engine.py      Builds prioritized CTA list with dollar amounts
        ├── debug_runner.py    Offline test harness (used by parity_check.py)
        ├── lens_output.py     Top-level assembler: caution score, sentences, result dict
        ├── risk_profile.py    Loads risk tier and threshold overrides
        ├── sentence1.py       Portfolio state sentence (slope + vol)
        ├── sentence2.py       Timing/catalyst sentence (earnings + dividends)
        ├── sentence3.py       CTA sentence (top action)
        └── analyzers/
            ├── __init__.py
            ├── beta.py
            ├── concentration.py
            ├── dividends.py
            ├── earnings.py
            ├── index_fund.py
            ├── performance.py
            ├── slope.py
            └── volatility.py
        └── templates/
            └── sentences.json
```

---

## 6. The API

### Authentication

Every protected endpoint requires the header `X-API-Key: <secret>`. The secret is set server-side via the `LENS_API_KEY` environment variable. If the env var is not set, the server returns 500 (misconfigured). If the key is wrong or missing, it returns 401.

The Fastify backend (or any other caller) must have `LENS_API_KEY` in its env and include it on every request to this service.

### Endpoints

#### `GET /health`
No auth required. Returns `{"status": "ok"}`. Use this for Railway health checks and uptime monitoring.

#### `POST /analyze`
Requires `X-API-Key` header.

**Request body:**
```json
{
  "positions": [
    {
      "ticker": "AAPL",
      "shares": 10.0,
      "equity": 1950.0,
      "price": 195.0,
      "sector": "Technology",
      "name": "Apple Inc.",
      "added_at": "2024-01-15T00:00:00"
    }
  ],
  "settings": {
    "risk_tier": "regular"
  }
}
```

`positions` is the required field. Each position dict must have at minimum `ticker`, `shares`, `equity`, `price`. `sector`, `name`, `added_at` are used if present. `_current_value` can be injected by the caller if available (the analysis pool will compute it otherwise).

`settings` is optional. Any key not provided falls back to `DEFAULT_SETTINGS` from `engine/constants.py`. The most commonly set key is `risk_tier` (`"low"` / `"regular"` / `"high"`, corresponding to Conservative / Moderate / Aggressive). Other settings keys: `refresh_interval`, `direction_thresholds`, `volatility`, `lens_signals`, `monte_carlo`.

**Response:**
The full Lens result dict:
```json
{
  "brief": "...",                     // 3-sentence natural language brief
  "color": "#38bdf8",                 // hex color for primary CTA action
  "caution_score": 42,                // 1-99 integer
  "threat_level": 0.42,               // caution_score / 100.0
  "action_type": "buy_new",           // sell | rebalance | buy_new | buy_more | hold
  "recommended_tickers": ["PG"],      // tickers in top buy CTA
  "deposit_amount": 620.0,            // dollar amount of top buy CTA
  "underweight_sector": "Consumer Defensive",
  "ctas": [...],                      // raw CTA list (see below)
  "full_report": [...],               // rendered CTA report cards for UI
  "pool_results": {...},              // full analyzer output for each of the 8 analyzers
  "projected_positions": [...],       // portfolio after all CTAs applied
  "net_cta_delta": 620.0             // net cash flow: buys minus sells
}
```

Each CTA in `ctas`:
```json
{
  "action": "buy_new",                // sell | rebalance | buy_new | buy_more | hold
  "ticker": "PG",
  "dollars": 620.0,
  "reason": "reduce_concentration",  // machine-readable reason code
  "severity": "moderate",            // none | low | moderate | high | critical
  "sector": "Consumer Defensive"
}
```

**Dividend details (in `pool_results.dividends.ticker_results[TICKER].details`).** yfinance only exposes *historical* ex-dividend dates, so a genuine future date is almost never present. To drive the web app's Dividend Calendar, the dividends analyzer **estimates** the next ex-date by projecting forward from the historical payment cadence. Each per-ticker `details` carries `next_ex_date`, `days_until`, `amount` (last paid), `annual_yield_pct`, `frequency` (`Monthly`/`Quarterly`/`Semi-Annual`/`Annual`), and `estimated` (`true` when projected). **Estimated dates do not affect `severity`/`flag` or the portfolio aggregate** (`nearest_days`, `tickers_with_upcoming`) — those stay driven by genuinely future-dated ex-dates only, so the brief and CTA logic are unchanged. The lens-app reads these via `dividendRows()` in `src/lib/lensData.ts`.

#### `GET /ticker/{symbol}/info`
Requires `X-API-Key`. Company snapshot from yfinance `.info`: `{ name, sector, market_cap, pe_ratio, dividend_yield, "52_week_high", "52_week_low", current_price }`. Unknown tickers (no `currentPrice`/`regularMarketPrice`) → 404. Numeric fields are NaN-sanitized to `null` (see NaN note below). Used by the lens-app `AddPositionModal` to validate a ticker and pull live price/sector/name.

#### `GET /ticker/{symbol}/history`
Requires `X-API-Key`. `?period=` one of `1mo|3mo|6mo|1y|2y|5y` (default `1y`); anything else → 400. Returns a JSON array of `{ date, open, high, low, close, volume }` daily bars (`yf.history(interval="1d", auto_adjust=False)`). Empty/no usable rows → 404. **No longer called by the lens-app** (the equity curve now uses the batched `/tickers/history` below); the single-ticker `getTickerHistory` client wrapper still exists but is unused. Rows are built defensively: any bar with no `close` is skipped and NaN `volume` is coerced to `0`. The assembled rows are then passed through `_finitize()` (same as `/analyze`) right before the `JSONResponse` is constructed (see NaN note) — the per-row `pd.isna()` guards catch `NaN` but **not** `±inf`, and an inf OHLC value slipping through to the eager render was the cause of every history call 500ing in production while `/compare` (default `auto_adjust`) kept working.

#### `GET /tickers/history`
Requires `X-API-Key`. `?symbols=AAPL,MSFT,KO&period=6mo` (period same options as `/history`, default `6mo`; bad period or empty `symbols` → 400). Returns daily closes for **all requested tickers in one batched `yf.download([...])`** as `{ "AAPL": [{ date, close }, ...], ... }`. Handles both the multi-ticker (`Close` is a DataFrame of ticker columns) and single-ticker (`Close` is a Series) shapes yfinance returns. Symbols with no data are simply absent from the map (no 404). Closes are `_finitize()`d and NaN/inf points dropped. **This backs the lens-app `usePortfolioHistory` equity curve** (Total Equity sparkline + Monte Carlo historical lead-in): one round trip + one download instead of N separate `/ticker/{symbol}/history` calls. Like `/analyze`, this download bypasses the DataStore cache (goes straight to `yf.download`).

#### `GET /ticker/{symbol}/compare`
Requires `X-API-Key`. `?symbols=NVDA,SPY&period=1y`. Returns each series normalized to 100 at its first trading day for overlay charts. Not currently called by the lens-app.

> **NaN-safety (all endpoints).** Starlette's `JSONResponse` serializes with `allow_nan=False`, so a single `NaN`/`inf` reaching the response (common from yfinance: in-progress trading day, non-dividend payer's `trailingPE`, split rows) raises *during render* — an unhandled, generic `500 Internal Server Error` that the route's try/except cannot catch. Every response body is therefore sanitized: `/analyze` and `/history` run their assembled content through `_finitize()` (recursively replaces non-finite floats — both `NaN` and `±inf` — with `null`) just before the response is built, and `/info` coerces each numeric field. Note `pd.isna()` alone is **not** sufficient: it returns `False` for `±inf`, so the per-row skip/repair guards in `/history` do not stop an inf value; only `_finitize()` (or `math.isfinite`) does. A stale deploy missing this `_finitize()` step was the cause of `/ticker/{symbol}/history` returning a generic 500 on every call in production (while `/info` and `/compare` happened to work), which fell the lens-app Total Equity / Monte Carlo surfaces back to their synthesized straight-line estimates. Keep new endpoints NaN-safe and finitize right before `JSONResponse`.

### How the pipeline works (inside `/analyze`)

1. `DEFAULT_SETTINGS` is merged with any caller-provided `settings` (caller overrides win).
2. A local `_run()` closure is dispatched via `run_in_threadpool` (the pipeline is synchronous and makes network calls to yfinance; running it in a thread keeps the async event loop free). Inside it:
   1. **`_store.prefetch_for_analysis(tickers, merged_settings)` warms the cache concurrently first** (see §7). Wrapped in try/except — a prefetch failure is logged and the analyzers fall back to their lazy per-ticker fetch, so analysis still succeeds.
   2. `generate_lens_full(positions, store, merged_settings)` then runs the pipeline against the now-warm cache.
3. `generate_lens_full` calls `build_lens_output` in `engine/lens/lens_output.py`, which runs the full pipeline: analyzers → CTA engine → sentence composers → caution score → result dict. The analyzers still loop over positions serially, but every `store.get_*` call is now an in-memory cache hit because the prefetch already fetched everything.
4. The DataStore (`_store`) is a module-level singleton — one instance per worker process. It maintains an in-memory market data cache (`_market_cache`) backed by `market_data.json` on disk. This means repeated calls for the same tickers will hit the in-memory cache after the first fetch.
5. The result is serialized via `json.dumps(result, default=str)`, passed through `_finitize()` (to strip any NaN/inf — see the NaN-safety note in §6), and returned as a `JSONResponse`, bypassing Pydantic. This is necessary because `pool_results` contains engine-internal types (specifically `DataStore`) that Pydantic cannot serialize — it would throw `PydanticSerializationError` and cause a 500 before the response is sent. The `default=str` fallback converts any non-serializable object to its repr string. If a future refactor cleans those types out of the result dict, the `JSONResponse` approach can stay (it is not harmful) or be replaced with a typed Pydantic response model.

---

## 7. DataStore and Market Data Caching

`engine/store.py` is close to the original Vector desktop code (see the prefetch note below for the one addition). It:
- Wraps all yfinance calls with TTL-based JSON caching
- Writes cache to `LENS_DATA_DIR/market_data.json`
- Holds an in-memory `_market_cache` dict that persists across requests within a single worker

**Concurrent prefetch (`prefetch_for_analysis`) — the /analyze speedup.** A cold N-ticker portfolio otherwise makes ~6-7N *serial* blocking yfinance round trips (each analyzer loops over positions calling `get_history`/`get_snapshot`/`get_dividends`/`get_earnings` one ticker at a time). `prefetch_for_analysis(tickers, settings)` front-loads all of that concurrently before the analyzers run, so their `store.get_*` calls become in-memory cache hits:
- **Batched history (#2):** `_batch_history_closes()` pulls the periods the analyzers need (`6mo` for slope, `1y` for volatility/beta, plus `SPY` `1y` for beta) with **one `yf.download([...])` per period** instead of N serial `.history()` calls. `auto_adjust=False` matches `get_history`, so warmed closes are byte-identical to lazily-fetched ones.
- **Parallel per-ticker (#1):** the calls that can't be batched (`.info` snapshot, dividends, earnings) run across a `ThreadPoolExecutor` (max 8 workers). To keep this thread-safe, the network fetch is split from cache mutation: the pure `_fetch_quote_and_meta` / `_fetch_dividends_list` / `_fetch_earnings_list` helpers touch **no shared state**, and all cache writes + the single disk write happen serially on the calling thread after the pool joins. `get_snapshot`/`get_dividends`/`get_earnings` were refactored to reuse these same pure helpers.
- **TTL-respecting + best-effort:** anything already fresh is skipped (a warm cache makes it a near no-op); index ETFs are skipped for earnings (the earnings analyzer ignores them). Any failure is swallowed and the analyzers fall back to the lazy path. Measured: ~3.9x faster on a cold 10-ticker portfolio (14.8s → 3.8s), with identical caution score / CTAs. Speedup grows with ticker count.

**TTLs:**
| Data | TTL |
|---|---|
| Quote + intraday history | Matches `refresh_interval` setting (default: 5 min) |
| Daily history (1mo+) | 60 min |
| Meta (name, sector, etc.) | 24 h |
| Dividends | 24 h |
| Earnings calendar | 24 h |

**On Railway:** `market_data.json` is ephemeral (resets on deploy/restart) unless a volume is mounted. This is acceptable — the cache just repopulates from yfinance on the first request after restart. Under concurrent load, multiple workers may each have their own in-memory caches and may make duplicate yfinance calls for a brief window; this is fine at current scale.

**On Railway with a volume:** set `LENS_DATA_DIR` to the mount point (e.g. `/data`) and the cache will survive restarts.

---

## 8. Parity Verification

`parity_check.py` is the regression/parity tool. It verifies that the `engine` package produces identical output to the original `vector` package for the same inputs.

### Rigorous parity check (in-process comparison)

The most reliable method: run both packages in the same Python process, feeding them identical positions from the same frozen `market_data.json`. This is what was used to verify the extraction:

```python
# From workspace root:
cd C:/Users/Matthew/Documents/_Dev_ALL/lens
python -W ignore::DeprecationWarning -c "
import sys, json, os
from datetime import datetime

sys.path.insert(0, 'Vector-Main')
sys.path.insert(0, '_monorepo/lens-api')

DATA_DIR = os.path.expandvars(r'%LOCALAPPDATA%\Protonyx\Vector')
os.environ['LENS_DATA_DIR'] = DATA_DIR

from vector.store import DataStore as VectorStore
from vector.constants import DEFAULT_SETTINGS as VS
from vector.lens.lens_output import build_lens_output as vector_build

from engine.store import DataStore as EngineStore
from engine.constants import DEFAULT_SETTINGS as ES
from engine.lens.lens_output import build_lens_output as engine_build

debug_test = json.loads(open('Vector-Main/debug_test.json').read())
portfolios = debug_test['portfolios']
v_store = VectorStore()
e_store = EngineStore()

# ... build positions, run both, compare fields ...
"
```

**Initial result:** 150 runs (50 portfolios x 3 risk tiers), zero mismatches.

### `parity_check.py` script (standalone)

For standalone use against a deployed or locally running engine:

```bash
# From lens-api/ directory
LENS_DATA_DIR=C:/Users/Matthew/AppData/Local/Protonyx/Vector \
python parity_check.py \
  --debug-test C:/Users/Matthew/Documents/_Dev_ALL/lens/Vector-Main/debug_test.json \
  --ref-output C:/Users/Matthew/Documents/_Dev_ALL/lens/Vector-Main/output.md
```

This runs the engine against the frozen market data cache and compares caution scores, net CTA deltas, and CTA structure against the Vector-Main reference output.

**Important gotcha:** `engine/lens/debug_runner.py` resolves `debug_test.json` with a priority chain: user data dir first, then the dev repo root. The Vector-Main version has the same priority chain. If the user data dir has a `debug_test.json` (e.g. `%LOCALAPPDATA%/Protonyx/Vector/debug_test.json`), it will be used instead of `Vector-Main/debug_test.json`. The `parity_check.py` script accepts an explicit `--debug-test` path to bypass this. Always use `--debug-test` to be explicit.

---

## 9. Local Development

### Installing dependencies

```bash
cd _monorepo/lens-api
python -m venv .venv
.venv/Scripts/activate        # Windows
# or: source .venv/bin/activate  (Linux/macOS)
pip install -r requirements.txt
```

### Running the server

```bash
# Set required env vars first
set LENS_API_KEY=dev-secret-key
set LENS_DATA_DIR=C:/Users/Matthew/AppData/Local/Protonyx/Vector

uvicorn main:app --reload
# Server at http://localhost:8000
# Docs at http://localhost:8000/docs
```

### Quick smoke test

```bash
curl -X POST http://localhost:8000/analyze \
  -H "X-API-Key: dev-secret-key" \
  -H "Content-Type: application/json" \
  -d '{
    "positions": [
      {"ticker":"AAPL","shares":10,"equity":1950,"price":195,"sector":"Technology","name":"Apple Inc.","added_at":"2024-01-01T00:00:00"},
      {"ticker":"JNJ","shares":8,"equity":1120,"price":140,"sector":"Healthcare","name":"Johnson & Johnson","added_at":"2024-01-01T00:00:00"},
      {"ticker":"JPM","shares":5,"equity":1050,"price":210,"sector":"Financial Services","name":"JPMorgan Chase","added_at":"2024-01-01T00:00:00"}
    ],
    "settings": {"risk_tier": "regular"}
  }'
```

**Note:** The first request after startup will be slow (yfinance calls for each ticker). Subsequent requests for the same tickers will be fast (in-memory cache, or disk cache if within TTL).

---

## 10. Railway Deployment

This service is **deployed and live** at `https://lens-api-production-b0ab.up.railway.app`. The service was set up as:

1. Railway service pointing at the `_monorepo/lens-api/` directory (not the repo root).
2. Environment variables set in the Railway dashboard:
   - `LENS_API_KEY` — shared secret used by all callers (`X-API-Key` header). The Fastify backend will need this same value when it starts proxying requests.
   - `LENS_DATA_DIR` — `/tmp/lens_data` (ephemeral; resets on deploy/restart).
   - `PORT` — set automatically by Railway; the `Procfile` reads it.
3. The `Procfile` starts the server: `uvicorn main:app --host 0.0.0.0 --port $PORT`
4. Health check endpoint: `GET /health` → `{"status": "ok"}`

To redeploy after a code change: commit the change, then run `railway up` from `lens-api/`.

**CORS:** `main.py` uses `CORSMiddleware` allowing origins `http://localhost:5173` (Lens App dev server) and `https://app.use-lens.com` (production). This is a temporary accommodation while the browser calls lens-api directly during development. Once Fastify proxies all `/analyze` calls server-to-server, the CORS origins can be removed. If you add another dev origin, edit the `allow_origins` list in `main.py`.

**Rate limiting:** Not yet implemented. If the service is exposed publicly (even with API key auth), add `slowapi` or similar. For server-to-server use it is less critical.

---

## 11. The Lens Engine — What It Does (reference for future work)

The engine's pipeline, in order:

1. **Risk profile** (`engine/lens/risk_profile.py`): reads `settings['risk_tier']` (`low`/`regular`/`high`) and returns per-metric severity thresholds.

2. **Analysis pool** (`engine/lens/analysis_pool.py`): runs all 8 analyzers. Phase 1: `slope` + `volatility` (earnings needs slope/vol output). Phase 2: `earnings` (uses phase 1 results), then `concentration`, `dividends`, `beta`, `performance`, `index_fund` in parallel.

3. **8 Analyzers** (all in `engine/lens/analyzers/`): each exposes `analyze(positions, store, settings, risk_profile) → dict`. Returns `ticker_results` (per-ticker) and `portfolio_result` (aggregate), each with `value`, `severity` (none/low/moderate/high/critical), `flag`, `weight`, `details`.

4. **CTA engine** (`engine/lens/cta_engine.py`): reads all analyzer results and emits a prioritized list of CTAs (11 priority levels, 1=highest). Runs dedup, tiny-buy pruning, budget caps, loss/danger gates.

5. **Sentence composers** (`sentence1.py`, `sentence2.py`, `sentence3.py`): build the 3-sentence natural language brief. Templates in `engine/lens/templates/sentences.json`. Selection is deterministic (SHA-256 of portfolio state).

6. **Assembler** (`engine/lens/lens_output.py` → `build_lens_output`): computes caution score (1–99), joins sentences, applies all CTAs to build projected positions, saves history snapshot, returns the full result dict.

7. **Entry point** (`engine/lens_engine.py` → `generate_lens_full`): thin wrapper that calls `build_lens_output`. This is what `main.py` calls.

**The caution score** is the greater of (a) trade-flow score (CTA dollars / equity × 100) and (b) an exposure-weighted risk floor. See `engine/lens/lens_output.py :: _compute_caution_score` and `_risk_floor` for the full formula. Do not simplify it.

**For deep Lens logic documentation** (CTA pipeline invariants, caution score formula details, tier-specific behavior, all the "don't regress" notes): read `Vector-Main/CLAUDE.md`. That file is the authoritative reference for how the Lens engine is supposed to behave. This `CLAUDE.md` only documents the extraction and the service wrapper — it does not re-document the engine logic.

---

## 12. Syncing Future Lens Changes from Vector-Main

When the Lens engine is updated in `Vector-Main/` (new analyzer behavior, CTA logic changes, new sentence templates, caution score tweaks), those changes need to be propagated to `lens-api/engine/`. The process:

1. Identify which files changed in `Vector-Main/vector/`.
2. For each changed file, apply the same change to the corresponding `engine/` file — OR re-run the sed copy:
   ```bash
   sed 's/from vector\./from engine./g' Vector-Main/vector/lens/cta_engine.py > _monorepo/lens-api/engine/lens/cta_engine.py
   ```
3. If `constants.py` changed (risk profiles, sector maps, thresholds), copy it without modification (it uses relative imports only).
4. If `paths.py` changed in Vector-Main, apply the same change to `engine/paths.py` but **preserve the `LENS_DATA_DIR` env-var block** — that addition must not be lost.
5. Run parity check (section 8) to confirm output is still identical.

**Watch out for `engine/lens/analyzers/dividends.py` — it has DIVERGED from Vector-Main.** It was given next-ex-date estimation (§6) so the web Dividend Calendar works; Vector-Main's copy still only reports genuinely future-dated (i.e. effectively never) ex-dates. Do **not** blind-copy Vector-Main's `dividends.py` over this one; re-apply the estimation, or port the estimation back into Vector-Main first so they converge again. The estimation is deliberately severity/flag-neutral, so parity of the brief/CTAs is unaffected.

**The engine package is intentionally a copy, not a symlink.** This is deliberate: the web service and the desktop app may diverge in configuration (retry logic, caching layers, auth) so keeping them as independent copies is safer than sharing code between two very different runtime environments.

---

## 13. What Is Not Yet Done

The following work is still ahead:

- **Fastify integration:** the Fastify backend (`_monorepo/backend/`) does not yet call this service. Currently `lens-app` calls `POST /analyze` directly from the browser using a hardcoded API key (DEV ONLY — see `lens-app/src/api/lens.ts`). Before launch, Fastify must proxy all analyze calls server-to-server so the key is never exposed in client code.
- **Portfolio storage:** the Fastify backend **does** now store positions - a per-user `positions` table with `/positions` CRUD endpoints (`_monorepo/backend/src/routes/positions.ts`), which `lens-app` reads/writes via `usePositions` / `usePositionsManager`. **However, analyze is still NOT proxied:** `lens-app` continues to call `POST /analyze` on this service directly from the browser, assembling the positions payload on the client from that server-stored data. So Fastify holds the holdings, but does not yet pass them to this service on the user's behalf - that server-to-server proxying is still the pre-launch work in the Fastify-integration item above.
- **Rate limiting / per-user throttling:** not implemented. yfinance has rate limits; concurrent requests for different portfolios will all hit yfinance. Consider a request queue or per-user rate limit before high traffic.
- **Monte Carlo in the response:** `build_lens_output` does not include Monte Carlo projections in its return value (it produces `projected_positions` which is the CTAs-applied portfolio, not GBM projections). The Monte Carlo graphs in the desktop app are generated separately by `engine/monte_carlo.py`. If the web frontend needs Monte Carlo charts, a second endpoint `POST /project` would call `run_projection` and `build_historical_curve` directly.
- **`lens_history.json` saving:** `build_lens_output` by default writes a snapshot to `LENS_DATA_DIR/lens_history.json` (rolling 50 entries). On the server this is ephemeral and per-worker (so history is fragmented across workers). If history should be persistent and unified, either use a database or disable it (`save_history=False` in the call).
