"""Ingest pipeline: directory of .md/.pdf → chunks → embeddings → Chroma.

Kept deliberately small: word-window chunking is sufficient for short
reference docs and milestone notes. For larger corpora, swap in
`langchain_text_splitters.RecursiveCharacterTextSplitter`.
"""

from __future__ import annotations

import hashlib
from pathlib import Path

from .store import add_chunks


SUPPORTED_SUFFIXES = {".md", ".markdown", ".txt", ".pdf"}


def _hash_id(*parts: str) -> str:
    return hashlib.sha256("::".join(parts).encode("utf-8")).hexdigest()[:16]


def chunk_text(text: str, target_words: int = 220, overlap: int = 40) -> list[str]:
    """Naive word-window chunker with overlap.

    ~220 words ≈ ~300 tokens — comfortable for `nomic-embed-text` and gives
    the LLM clean, well-bounded snippets to reason over.
    """
    words = text.split()
    if not words:
        return []
    chunks: list[str] = []
    step = max(1, target_words - overlap)
    for start in range(0, len(words), step):
        chunk = " ".join(words[start : start + target_words]).strip()
        if chunk:
            chunks.append(chunk)
        if start + target_words >= len(words):
            break
    return chunks


def load_text(path: Path) -> str:
    """Read a file into plain text. Supports md/txt/pdf."""
    suffix = path.suffix.lower()
    if suffix == ".pdf":
        from pypdf import PdfReader

        reader = PdfReader(str(path))
        pages = [page.extract_text() or "" for page in reader.pages]
        return "\n\n".join(pages)
    return path.read_text(encoding="utf-8", errors="ignore")


def ingest_directory(directory: Path, kind: str) -> int:
    """Walk `directory` recursively, chunk supported files, upsert into Chroma.

    Parameters
    ----------
    directory : Path
        Folder to scan. Created on the fly if missing (returns 0 then).
    kind : str
        Metadata tag. Use ``"goal_context"`` for milestone docs and
        ``"resource"`` for reference material (templates, guides, PDFs).
    """
    if not directory.exists():
        return 0

    all_chunks: list[str] = []
    all_meta: list[dict] = []
    all_ids: list[str] = []

    for fp in sorted(directory.rglob("*")):
        if not fp.is_file() or fp.suffix.lower() not in SUPPORTED_SUFFIXES:
            continue
        try:
            text = load_text(fp)
        except Exception as exc:  # noqa: BLE001
            print(f"  ! skip {fp.name}: {exc}")
            continue

        for idx, chunk in enumerate(chunk_text(text)):
            all_chunks.append(chunk)
            all_meta.append(
                {
                    "kind": kind,
                    "doc_name": fp.stem,
                    "source_path": str(fp.relative_to(directory.parent)),
                    "chunk_index": idx,
                }
            )
            all_ids.append(_hash_id(kind, str(fp), str(idx)))

    return add_chunks(all_chunks, all_meta, all_ids)
