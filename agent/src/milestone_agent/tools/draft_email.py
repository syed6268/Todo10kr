"""Tool: draft_email.

Composes a cold-outreach email by:

1. Pulling the requested template's guidance from the resource RAG.
2. Asking a second LLM call (low-stakes, structured JSON) to fill it in
   using the recipient and context provided by the agent.

Returning structured JSON lets the orchestrating ReAct agent fold the
draft straight into its final `proposed_actions` array without a second
parse.
"""

from __future__ import annotations

import json
import re

from langchain_core.messages import HumanMessage, SystemMessage
from langchain_core.tools import tool

from ..llm import get_chat_model
from ..rag.store import query as rag_query


_DRAFT_SYSTEM = (
    "You are an email-drafting assistant. Produce a single JSON object: "
    '{"subject": "...", "body": "..."}. No prose, no markdown. '
    "Keep subject under 50 characters. Keep body under 120 words. "
    "Stay faithful to the supplied template structure. "
    "Do not invent statistics, names, or company facts that aren't in the context. "
    "If a field is unknown, leave a clearly bracketed placeholder like [pitch]."
)


def _extract_json(text: str) -> dict:
    if not text:
        return {}
    text = text.strip()
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?\s*|\s*```$", "", text, flags=re.MULTILINE)
    match = re.search(r"\{[\s\S]*\}", text)
    if not match:
        return {}
    try:
        return json.loads(match.group(0))
    except Exception:
        return {}


@tool
def draft_email(template_name: str, recipient: str, context: str) -> str:
    """Draft a cold-outreach email using a named template + RAG-retrieved guidance.

    Args:
        template_name: Name of the template to follow, e.g. "Quick Question",
                       "Third-Party Connection", "PAS", "AIDA", "Value Proposition".
        recipient: Short description of the recipient
                   (e.g. "Garry Tan — YC President").
        context: 2-4 sentences of user/product context the email should reference.

    Returns:
        JSON: {"subject", "body", "template_used", "sources"}.
    """
    try:
        res = rag_query(
            f"{template_name} cold email template",
            k=3,
            where={"kind": "resource"},
        )
    except Exception as exc:  # noqa: BLE001
        return json.dumps({"error": f"draft_email: RAG lookup failed: {exc}"})

    docs = (res.get("documents") or [[]])[0]
    metas = (res.get("metadatas") or [[]])[0]

    snippets = []
    for doc, meta in zip(docs, metas):
        snippets.append(
            {
                "text": (doc or "")[:600],
                "doc_name": (meta or {}).get("doc_name"),
                "chunk_index": (meta or {}).get("chunk_index"),
            }
        )
    template_text = "\n\n---\n\n".join(s["text"] for s in snippets) or (
        "No template found in knowledge base — write a concise, courteous cold email "
        "with subject under 50 chars and body under 120 words."
    )

    user = (
        f"TEMPLATE NAME: {template_name}\n\n"
        f"TEMPLATE GUIDANCE (from knowledge base):\n{template_text}\n\n"
        f"RECIPIENT:\n{recipient or '(unspecified — use a placeholder)'}\n\n"
        f"CONTEXT:\n{context or '(none provided)'}\n\n"
        'Return only: {"subject": "...", "body": "..."}'
    )

    try:
        llm = get_chat_model(temperature=0.4)
        resp = llm.invoke(
            [SystemMessage(content=_DRAFT_SYSTEM), HumanMessage(content=user)]
        )
        parsed = _extract_json(resp.content or "")
    except Exception as exc:  # noqa: BLE001
        return json.dumps({"error": f"draft_email: LLM call failed: {exc}"})

    return json.dumps(
        {
            "subject": parsed.get("subject", "").strip(),
            "body": parsed.get("body", "").strip(),
            "template_used": template_name,
            "sources": [
                {"title": s["doc_name"], "chunk": s["chunk_index"]} for s in snippets
            ],
        },
        ensure_ascii=False,
    )
