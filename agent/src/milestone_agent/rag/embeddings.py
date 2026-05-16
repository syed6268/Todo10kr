"""Embeddings via Ollama (`nomic-embed-text` by default).

Wrapped as a module-level singleton so we don't re-open the HTTP client
on every chunk during ingestion.
"""

from __future__ import annotations

from functools import lru_cache

from langchain_ollama import OllamaEmbeddings

from ..config import settings


@lru_cache(maxsize=1)
def get_embedder() -> OllamaEmbeddings:
    return OllamaEmbeddings(
        base_url=settings.ollama_base_url,
        model=settings.ollama_embed_model,
    )


def embed_texts(texts: list[str]) -> list[list[float]]:
    """Embed a batch of documents."""
    if not texts:
        return []
    return get_embedder().embed_documents(texts)


def embed_query(text: str) -> list[float]:
    """Embed a single query string."""
    return get_embedder().embed_query(text)
