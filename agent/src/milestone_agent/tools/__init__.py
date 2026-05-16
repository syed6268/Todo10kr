"""Tool registry.

Each tool is a `@tool`-decorated callable from `langchain_core.tools`.
The model picks them by name; we expose the list to LangGraph via
`bind_tools()` and `ToolNode`.

Tools are intentionally narrow and composable. Heavy logic
(prompts, post-processing) lives elsewhere.
"""

from .draft_email import draft_email
from .fetch_url import fetch_url
from .search_goal_context import search_goal_context
from .search_resource import search_resource
from .web_search import web_search

ALL_TOOLS = [
    search_goal_context,
    search_resource,
    web_search,
    fetch_url,
    draft_email,
]

TOOLS_BY_NAME = {t.name: t for t in ALL_TOOLS}

__all__ = [
    "ALL_TOOLS",
    "TOOLS_BY_NAME",
    "draft_email",
    "fetch_url",
    "search_goal_context",
    "search_resource",
    "web_search",
]
