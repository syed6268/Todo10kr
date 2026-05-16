"""Chroma persistent store wrapper.

One collection (`milestone_kb`) holds both private goal-context chunks and
shared resource-document chunks. They are kept apart via the `kind`
metadata field (`"goal_context"` vs `"resource"`), which the tools filter
on at query time.
"""

from __future__ import annotations

from typing import Any, Optional

import chromadb

from ..config import settings
from .embeddings import embed_query, embed_texts

_client: Optional[chromadb.api.ClientAPI] = None
_collection = None


def get_collection():
    """Return the persistent Chroma collection, creating it if needed."""
    global _client, _collection
    if _collection is not None:
        return _collection
    _client = chromadb.PersistentClient(path=settings.chroma_path)
    _collection = _client.get_or_create_collection(
        name=settings.chroma_collection,
        metadata={"hnsw:space": "cosine"},
    )
    return _collection


def add_chunks(
    chunks: list[str],
    metadatas: list[dict[str, Any]],
    ids: list[str],
) -> int:
    """Embed + upsert a batch. Returns number added."""
    if not chunks:
        return 0
    embeddings = embed_texts(chunks)
    get_collection().upsert(
        documents=chunks,
        embeddings=embeddings,
        metadatas=metadatas,
        ids=ids,
    )
    return len(chunks)


def query(
    text: str,
    k: int = 4,
    where: Optional[dict] = None,
) -> dict:
    """Semantic similarity query. `where` is a Chroma metadata filter."""
    vec = embed_query(text)
    return get_collection().query(
        query_embeddings=[vec],
        n_results=k,
        where=where,
    )


def reset() -> None:
    """Drop the collection. Use only from scripts/tests."""
    global _client, _collection
    if _client is None:
        _client = chromadb.PersistentClient(path=settings.chroma_path)
    try:
        _client.delete_collection(settings.chroma_collection)
    except Exception:
        pass
    _collection = None
