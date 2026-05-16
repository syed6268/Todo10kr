"""Local LLM factory.

We use `langchain_ollama.ChatOllama` because it (a) speaks the Ollama HTTP
API, (b) supports `bind_tools()` for native function-calling on capable
models (qwen2.5, llama3.1, mistral-small), and (c) integrates directly into
LangGraph's message-state graph.
"""

from __future__ import annotations

from langchain_ollama import ChatOllama

from .config import settings


def get_chat_model(temperature: float | None = None) -> ChatOllama:
    """Return a fresh ChatOllama configured from settings.

    A fresh instance per request keeps streaming/cancellation behaviour
    predictable. The underlying HTTP client is shared by Ollama itself.
    """
    return ChatOllama(
        base_url=settings.ollama_base_url,
        model=settings.ollama_model,
        temperature=settings.ollama_temperature if temperature is None else temperature,
    )
