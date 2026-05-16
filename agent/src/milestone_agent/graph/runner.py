"""Public `run_research(request)` — the agent's only entry point.

Responsibilities:
    1. Build the graph (per-request so step limits and configs are clean).
    2. Seed messages with the system + user prompts.
    3. Invoke the graph.
    4. Extract the final JSON from the last AIMessage.
    5. Convert the full message history into a TraceStep[] for the audit log.
    6. Return a typed `ResearchResponse`.
"""

from __future__ import annotations

import json
import re
from datetime import datetime, timezone
from typing import Any

from langchain_core.messages import AIMessage, HumanMessage, SystemMessage, ToolMessage

from ..config import settings
from ..schemas import ProposedAction, ResearchRequest, ResearchResponse, TraceStep
from .builder import build_graph
from .prompts import SYSTEM_PROMPT, user_prompt_for_goal


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _strip_code_fences(text: str) -> str:
    text = (text or "").strip()
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?\s*", "", text)
        text = re.sub(r"\s*```$", "", text)
    return text.strip()


def _extract_json_object(text: str) -> dict[str, Any]:
    """Find and parse the first balanced JSON object in `text`. Returns {} on failure."""
    text = _strip_code_fences(text)
    if not text:
        return {}
    # Fast path: whole string is JSON.
    try:
        obj = json.loads(text)
        if isinstance(obj, dict):
            return obj
    except Exception:
        pass

    # Slow path: scan for balanced braces.
    start = text.find("{")
    while start != -1:
        depth = 0
        for i in range(start, len(text)):
            c = text[i]
            if c == "{":
                depth += 1
            elif c == "}":
                depth -= 1
                if depth == 0:
                    candidate = text[start : i + 1]
                    try:
                        obj = json.loads(candidate)
                        if isinstance(obj, dict):
                            return obj
                    except Exception:
                        break
        start = text.find("{", start + 1)
    return {}


def _truncate(value: Any, limit: int = 800) -> Any:
    if isinstance(value, str) and len(value) > limit:
        return value[:limit] + f"... [+{len(value) - limit} chars]"
    return value


def _messages_to_trace(messages: list) -> list[TraceStep]:
    """Convert the LangGraph message history into auditable trace entries."""
    trace: list[TraceStep] = []
    step_idx = 0
    for msg in messages:
        if isinstance(msg, (SystemMessage, HumanMessage)):
            continue  # never log raw user/system text
        step_idx += 1

        if isinstance(msg, AIMessage):
            tool_calls = getattr(msg, "tool_calls", None) or []
            if tool_calls:
                for call in tool_calls:
                    trace.append(
                        TraceStep(
                            step=step_idx,
                            type="tool_call",
                            name=call.get("name"),
                            input=call.get("args"),
                            timestamp=_now_iso(),
                        )
                    )
            else:
                trace.append(
                    TraceStep(
                        step=step_idx,
                        type="thought",
                        output=_truncate(msg.content or "", 1000),
                        timestamp=_now_iso(),
                    )
                )

        elif isinstance(msg, ToolMessage):
            trace.append(
                TraceStep(
                    step=step_idx,
                    type="tool_result",
                    name=getattr(msg, "name", None),
                    output=_truncate(msg.content or "", 800),
                    timestamp=_now_iso(),
                )
            )

    return trace


def _parse_actions(raw: list[Any]) -> list[ProposedAction]:
    actions: list[ProposedAction] = []
    for item in raw or []:
        if not isinstance(item, dict):
            continue
        try:
            actions.append(ProposedAction.model_validate(item))
        except Exception:
            # Tolerate one bad action; don't fail the whole response.
            continue
    return actions


def run_research(request: ResearchRequest) -> ResearchResponse:
    """Run the ReAct agent end-to-end. Always returns a typed response."""
    max_steps = request.max_steps or settings.max_agent_steps
    graph = build_graph()

    initial_messages = [
        SystemMessage(content=SYSTEM_PROMPT),
        HumanMessage(content=user_prompt_for_goal(request)),
    ]

    try:
        final_state = graph.invoke(
            {"messages": initial_messages, "steps": 0, "max_steps": max_steps},
            config={"recursion_limit": max(50, max_steps * 4)},
        )
    except Exception as exc:  # noqa: BLE001
        return ResearchResponse(
            goal_id=request.goal.id,
            summary=f"Agent failed: {exc}",
            proposed_actions=[],
            questions_for_user=[],
            trace=[
                TraceStep(
                    step=1,
                    type="error",
                    error=str(exc),
                    timestamp=_now_iso(),
                )
            ],
            generated_at=_now_iso(),
        )

    messages = list(final_state["messages"])

    last_ai = next(
        (
            m
            for m in reversed(messages)
            if isinstance(m, AIMessage) and not getattr(m, "tool_calls", None)
        ),
        None,
    )
    parsed: dict[str, Any] = _extract_json_object(last_ai.content if last_ai else "")

    actions = _parse_actions(parsed.get("proposed_actions", []))
    trace = _messages_to_trace(messages)
    trace.append(
        TraceStep(
            step=len(trace) + 1,
            type="final",
            output=parsed or {"warning": "no parseable JSON in final message"},
            timestamp=_now_iso(),
        )
    )

    questions = parsed.get("questions_for_user") or []
    if not isinstance(questions, list):
        questions = [str(questions)]

    return ResearchResponse(
        goal_id=request.goal.id,
        summary=str(parsed.get("summary", "")),
        proposed_actions=actions,
        questions_for_user=[str(q) for q in questions],
        trace=trace,
        generated_at=_now_iso(),
    )
