"""LangGraph state graph for the ReAct loop.

Topology::

    START -> agent --(tool_calls?)--> tools -> agent
                  \\---------- no -----------> END

`agent` is the LLM bound to all tools. `tools` is LangGraph's prebuilt
``ToolNode`` which dispatches each `AIMessage.tool_calls` entry to the
matching tool callable and appends a `ToolMessage` per result.

A step counter on the state caps runaway loops; when exceeded we inject a
synthetic "produce final JSON now" instruction and route straight to END.
"""

from __future__ import annotations

from typing import Annotated, Sequence, TypedDict

from langchain_core.messages import AIMessage, BaseMessage, HumanMessage
from langgraph.graph import END, START, StateGraph
from langgraph.graph.message import add_messages
from langgraph.prebuilt import ToolNode

from ..config import settings
from ..llm import get_chat_model
from ..tools import ALL_TOOLS


class AgentState(TypedDict):
    messages: Annotated[Sequence[BaseMessage], add_messages]
    steps: int
    max_steps: int


def _agent_node(state: AgentState) -> dict:
    """One LLM turn. Either emits tool_calls or the final assistant message."""
    if state["steps"] >= state["max_steps"]:
        nudge = HumanMessage(
            content=(
                "STEP_LIMIT_REACHED. Stop calling tools. Respond NOW with the "
                "final JSON object in the schema you were given. No prose."
            )
        )
        llm = get_chat_model()  # no tools bound on the forced-final turn
        forced = llm.invoke(list(state["messages"]) + [nudge])
        return {"messages": [nudge, forced], "steps": state["steps"] + 1}

    llm_with_tools = get_chat_model().bind_tools(ALL_TOOLS)
    response = llm_with_tools.invoke(state["messages"])
    return {"messages": [response], "steps": state["steps"] + 1}


def _should_continue(state: AgentState) -> str:
    last = state["messages"][-1]
    if isinstance(last, AIMessage) and getattr(last, "tool_calls", None):
        return "tools"
    return END


def build_graph(max_steps: int | None = None):
    """Compile the ReAct graph. Caller passes `max_steps` per request if desired."""
    _ = max_steps  # accepted for API symmetry; the cap lives on AgentState

    tool_node = ToolNode(ALL_TOOLS)

    graph = StateGraph(AgentState)
    graph.add_node("agent", _agent_node)
    graph.add_node("tools", tool_node)

    graph.add_edge(START, "agent")
    graph.add_conditional_edges("agent", _should_continue, {"tools": "tools", END: END})
    graph.add_edge("tools", "agent")

    return graph.compile()


# Reasonable default re-used by the CLI smoke test.
DEFAULT_MAX_STEPS = settings.max_agent_steps
