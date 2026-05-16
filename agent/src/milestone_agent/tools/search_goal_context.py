"""Tool: search the user's private milestone context (RAG).

Hits chunks tagged ``kind="goal_context"`` — milestone descriptions, notes,
and recent completions. Use this FIRST so the agent doesn't propose work
the user already did.
"""

from __future__ import annotations

import json

from langchain_core.tools import tool

from ..rag.store import query as rag_query


@tool
def search_goal_context(query: str, k: int = 4) -> str:
    """Search the user's private goal data (notes, recent completions, milestone profile).

    Use this FIRST to understand what's already been done and avoid suggesting repeats.

    Args:
        query: A short natural-language description of what context you need.
        k: Number of chunks to return (default 4, max 10).

    Returns:
        JSON list: [{"text", "doc_name", "chunk_index", "score"}].
    """
    k = max(1, min(int(k), 10))
    try:
        res = rag_query(query, k=k, where={"kind": "goal_context"})
    except Exception as exc:  # noqa: BLE001
        return json.dumps({"error": f"search_goal_context failed: {exc}"})

    docs = (res.get("documents") or [[]])[0]
    metas = (res.get("metadatas") or [[]])[0]
    dists = (res.get("distances") or [[]])[0]

    out = []
    for doc, meta, dist in zip(docs, metas, dists):
        out.append(
            {
                "text": (doc or "")[:600],
                "doc_name": (meta or {}).get("doc_name"),
                "chunk_index": (meta or {}).get("chunk_index"),
                "score": round(1.0 - float(dist), 3),
            }
        )
    return json.dumps(out, ensure_ascii=False)
