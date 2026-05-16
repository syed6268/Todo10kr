"""Tool: search uploaded reference documents (RAG).

Hits chunks tagged ``kind="resource"`` — guides, templates, handbooks the
user dropped into ``data/resources/``. Optionally filter by `doc_name`
(the stem of the source file, e.g. ``"cold_email_guide"``).
"""

from __future__ import annotations

import json

from langchain_core.tools import tool

from ..rag.store import query as rag_query


@tool
def search_resource(query: str, doc_name: str = "", k: int = 4) -> str:
    """Search uploaded reference documents (e.g. cold-email guides, handbooks).

    Args:
        query: Natural-language description of what you're looking for
               (e.g. "Quick Question cold email template").
        doc_name: Optional file stem to restrict the search to one document
                  (e.g. "cold_email_guide"). Empty means all resources.
        k: Number of chunks to return (default 4, max 10).

    Returns:
        JSON list: [{"text", "doc_name", "chunk_index", "score"}].
    """
    k = max(1, min(int(k), 10))

    if doc_name:
        where: dict = {"$and": [{"kind": "resource"}, {"doc_name": doc_name}]}
    else:
        where = {"kind": "resource"}

    try:
        res = rag_query(query, k=k, where=where)
    except Exception as exc:  # noqa: BLE001
        return json.dumps({"error": f"search_resource failed: {exc}"})

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
