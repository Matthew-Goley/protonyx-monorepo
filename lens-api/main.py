"""Lens API — FastAPI service wrapping the Lens computation engine."""

from __future__ import annotations

import json
import logging
import os
from typing import Any

from dotenv import load_dotenv

load_dotenv()

from fastapi import FastAPI, HTTPException, Security
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.security.api_key import APIKeyHeader
from pydantic import BaseModel
from starlette.concurrency import run_in_threadpool

from engine.constants import DEFAULT_SETTINGS
from engine.lens_engine import generate_lens_full
from engine.store import DataStore

logging.basicConfig(level=logging.INFO)
_log = logging.getLogger(__name__)

app = FastAPI(title="Lens API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "https://app.use-lens.com"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ------------------------------------------------------------------
# Auth: shared-secret API key
# ------------------------------------------------------------------

_API_KEY = os.environ.get("LENS_API_KEY", "")
_api_key_header = APIKeyHeader(name="X-API-Key", auto_error=False)


def _require_api_key(key: str | None = Security(_api_key_header)) -> None:
    if not _API_KEY:
        raise HTTPException(status_code=500, detail="LENS_API_KEY not configured on server")
    if key != _API_KEY:
        raise HTTPException(status_code=401, detail="Invalid or missing API key")


# ------------------------------------------------------------------
# Singleton DataStore (one in-process market-data cache per worker)
# ------------------------------------------------------------------

_store = DataStore()

# ------------------------------------------------------------------
# Request / response models
# ------------------------------------------------------------------


class AnalyzeRequest(BaseModel):
    positions: list[dict[str, Any]]
    settings: dict[str, Any] | None = None


# ------------------------------------------------------------------
# Endpoints
# ------------------------------------------------------------------


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/analyze")
async def analyze(
    request: AnalyzeRequest,
    _: None = Security(_require_api_key),
) -> JSONResponse:
    """Run the full Lens pipeline on the supplied portfolio.

    Request body:
      positions  — list of position dicts (ticker, shares, equity, price, sector, name, added_at)
      settings   — optional settings dict; missing keys fall back to defaults

    Returns the full Lens result dict (brief, caution_score, ctas, full_report, etc.).
    """
    merged_settings = {**DEFAULT_SETTINGS, **(request.settings or {})}

    try:
        result = await run_in_threadpool(
            generate_lens_full,
            request.positions,
            _store,
            merged_settings,
        )
    except Exception as exc:
        _log.exception("Lens pipeline failed")
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    # Pydantic cannot serialize engine-internal types (e.g. DataStore) that may
    # appear in pool_results. Serialise via stdlib json with a str fallback so
    # unknown types become their repr rather than blowing up the response.
    return JSONResponse(content=json.loads(json.dumps(result, default=str)))
