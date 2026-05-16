"""FastAPI app: tiny HTTP surface so the Node backend can proxy AI Suggest here.

Endpoints:
    GET  /health                 -- liveness probe
    POST /research               -- run the agent on a GoalContext
    POST /admin/reset-kb         -- drop the vector store (gated)
    POST /admin/ingest           -- rebuild from data/  (gated)

The admin endpoints are guarded by `?token=...` matching the optional
``ADMIN_TOKEN`` environment variable. Convenient for local dev; gate
properly in production.
"""

from __future__ import annotations

import os

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

from ..config import settings
from ..schemas import ResearchRequest, ResearchResponse


app = FastAPI(
    title="Milestone Research Agent",
    version="0.1.0",
    description="Local LLM ReAct agent for goal-aligned research and drafting.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health() -> dict:
    return {
        "ok": True,
        "model": settings.ollama_model,
        "live_search": settings.use_live_search,
    }


@app.post("/research", response_model=ResearchResponse)
def research(request: ResearchRequest) -> ResearchResponse:
    """Run the agent end-to-end and return a typed ResearchResponse."""
    from ..graph.runner import run_research

    try:
        return run_research(request)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(exc)) from exc


def _check_admin(token: str) -> None:
    expected = os.environ.get("ADMIN_TOKEN")
    if not expected:
        return  # no token configured = open in local dev
    if token != expected:
        raise HTTPException(status_code=401, detail="invalid admin token")


@app.post("/admin/reset-kb")
def admin_reset_kb(token: str = Query("")) -> dict:
    _check_admin(token)
    from ..rag.store import reset

    reset()
    return {"reset": True, "collection": settings.chroma_collection}


@app.post("/admin/ingest")
def admin_ingest(token: str = Query("")) -> dict:
    _check_admin(token)
    from ..rag.ingest import ingest_directory

    n_goals = ingest_directory(settings.goals_dir, kind="goal_context")
    n_res = ingest_directory(settings.resources_dir, kind="resource")
    return {"goal_chunks": n_goals, "resource_chunks": n_res}
