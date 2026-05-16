"""Tool: web_search.

Two modes:

1. **Fixture mode** (``USE_LIVE_SEARCH=false``, default): matches the query
   against ``data/fixtures/web_search_fixtures.json`` so demos run fully
   offline. This is the take-home-friendly default — graders without a
   Brave key still get a complete trace.

2. **Live mode** (``USE_LIVE_SEARCH=true``): calls the Brave Search API
   (free tier). Brave was picked over Tavily/Serper because it returns a
   clean JSON shape and the free tier is generous enough for testing.
"""

from __future__ import annotations

import json
from pathlib import Path

import httpx
from langchain_core.tools import tool

from ..config import settings


_FIXTURE_CACHE: list[dict] | None = None


def _load_fixtures() -> list[dict]:
    global _FIXTURE_CACHE
    if _FIXTURE_CACHE is not None:
        return _FIXTURE_CACHE
    path: Path = settings.fixtures_path
    if not path.exists():
        _FIXTURE_CACHE = []
        return _FIXTURE_CACHE
    try:
        _FIXTURE_CACHE = json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        _FIXTURE_CACHE = []
    return _FIXTURE_CACHE


def _fixture_search(query: str, max_results: int) -> list[dict]:
    q = (query or "").lower()
    results: list[dict] = []
    seen_urls: set[str] = set()
    for entry in _load_fixtures():
        triggers = [t.lower() for t in entry.get("triggers", [])]
        if any(t in q for t in triggers):
            for r in entry.get("results", []):
                url = r.get("url") or r.get("title")
                if url and url not in seen_urls:
                    seen_urls.add(url)
                    results.append(r)
                    if len(results) >= max_results:
                        return results
    return results


def _brave_search(query: str, max_results: int) -> list[dict]:
    if not settings.brave_api_key:
        return [{"error": "BRAVE_API_KEY missing; cannot run live search"}]
    headers = {
        "X-Subscription-Token": settings.brave_api_key,
        "Accept": "application/json",
    }
    try:
        r = httpx.get(
            "https://api.search.brave.com/res/v1/web/search",
            params={"q": query, "count": max_results},
            headers=headers,
            timeout=15,
        )
        r.raise_for_status()
    except Exception as exc:  # noqa: BLE001
        return [{"error": f"brave_search failed: {exc}"}]

    web = (r.json().get("web") or {}).get("results") or []
    return [
        {
            "title": x.get("title"),
            "url": x.get("url"),
            "snippet": x.get("description"),
        }
        for x in web[:max_results]
    ]


@tool
def web_search(query: str, max_results: int = 5) -> str:
    """Search the public web for fresh information (deadlines, articles, profiles).

    Use for anything time-sensitive that the user's private docs won't have.

    Args:
        query: A focused search query (don't paste a whole sentence).
        max_results: Number of hits to return (default 5, max 10).

    Returns:
        JSON list: [{"title", "url", "snippet"}]. May include {"error": "..."}
        if live search fails.
    """
    max_results = max(1, min(int(max_results), 10))
    if settings.use_live_search:
        results = _brave_search(query, max_results)
    else:
        results = _fixture_search(query, max_results)
        if not results:
            results = [
                {
                    "title": "No matches in fixtures",
                    "url": "",
                    "snippet": f"No fixture entry matched '{query}'. "
                    "Set USE_LIVE_SEARCH=true with BRAVE_API_KEY for live results.",
                }
            ]
    return json.dumps(results, ensure_ascii=False)
