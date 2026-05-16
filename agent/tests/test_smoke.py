"""Offline smoke tests — no Ollama required.

These verify the wiring (imports, schemas, fixture-mode tools, JSON
extraction). The full LLM/graph round-trip is left to `scripts/run_demo.py`,
which requires Ollama running locally.
"""

from __future__ import annotations

import json
import os

# Force fixture mode for the web_search tool before any imports that
# read settings.
os.environ.setdefault("USE_LIVE_SEARCH", "false")


def test_schemas_roundtrip():
    from milestone_agent.schemas import (
        GoalContext,
        ProposedAction,
        ResearchRequest,
        ResearchResponse,
        TraceStep,
    )

    req = ResearchRequest(goal=GoalContext(title="Test", horizon="1month"))
    assert req.goal.title == "Test"
    assert req.goal.priority == 3  # default

    action = ProposedAction(type="task", title="Do thing")
    resp = ResearchResponse(
        summary="Hi",
        proposed_actions=[action],
        trace=[TraceStep(step=1, type="thought", output="ok", timestamp="now")],
        generated_at="now",
    )
    payload = resp.model_dump(mode="json")
    assert payload["summary"] == "Hi"
    assert payload["proposed_actions"][0]["type"] == "task"


def test_web_search_fixture_mode():
    from milestone_agent.tools.web_search import web_search

    raw = web_search.invoke({"query": "YC W26 deadline", "max_results": 3})
    results = json.loads(raw)
    assert isinstance(results, list)
    assert results, "fixture should return at least one match for 'YC'"
    assert any("ycombinator" in (r.get("url") or "") for r in results)


def test_web_search_no_match_returns_placeholder():
    from milestone_agent.tools.web_search import web_search

    raw = web_search.invoke({"query": "zzz-no-fixture-match-zzz", "max_results": 2})
    results = json.loads(raw)
    assert isinstance(results, list)
    assert results[0]["title"] == "No matches in fixtures"


def test_fetch_url_blocks_loopback():
    from milestone_agent.tools.fetch_url import fetch_url

    raw = fetch_url.invoke({"url": "https://localhost/secret"})
    parsed = json.loads(raw)
    assert "error" in parsed


def test_fetch_url_rejects_http():
    from milestone_agent.tools.fetch_url import fetch_url

    raw = fetch_url.invoke({"url": "http://example.com"})
    parsed = json.loads(raw)
    assert "error" in parsed
    assert "https" in parsed["error"].lower()


def test_chunker_handles_short_and_long():
    from milestone_agent.rag.ingest import chunk_text

    assert chunk_text("") == []
    short = chunk_text("hello world")
    assert short == ["hello world"]
    long_text = " ".join(["word"] * 600)
    chunks = chunk_text(long_text, target_words=200, overlap=20)
    assert len(chunks) >= 3
    # overlap should keep adjacent chunks non-disjoint
    assert chunks[0].split()[-1] == "word"


def test_runner_extracts_balanced_json():
    from milestone_agent.graph.runner import _extract_json_object

    text = 'prefix garbage {"summary": "ok", "proposed_actions": []} trailing'
    obj = _extract_json_object(text)
    assert obj["summary"] == "ok"
    assert obj["proposed_actions"] == []


def test_runner_handles_code_fenced_json():
    from milestone_agent.graph.runner import _extract_json_object

    text = '```json\n{"summary": "fenced", "proposed_actions": [{"type": "task", "title": "t"}]}\n```'
    obj = _extract_json_object(text)
    assert obj["summary"] == "fenced"


def test_all_tools_have_names():
    from milestone_agent.tools import ALL_TOOLS

    names = {t.name for t in ALL_TOOLS}
    assert names == {
        "search_goal_context",
        "search_resource",
        "web_search",
        "fetch_url",
        "draft_email",
    }
