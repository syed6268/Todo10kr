"""Centralised configuration via pydantic-settings.

All runtime knobs live here so the rest of the codebase imports `settings`
and never reads `os.environ` directly. Override any value via .env or by
exporting an env var with the same name (case-insensitive).
"""

from __future__ import annotations

from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=str(PROJECT_ROOT / ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    # --- Ollama / local LLM ---------------------------------------------------
    ollama_base_url: str = "http://localhost:11434"
    ollama_model: str = "qwen2.5:7b-instruct"
    ollama_embed_model: str = "nomic-embed-text"
    ollama_temperature: float = 0.2

    # --- Vector store ---------------------------------------------------------
    chroma_path: str = str(PROJECT_ROOT / "chroma_db")
    chroma_collection: str = "milestone_kb"

    # --- Web search -----------------------------------------------------------
    use_live_search: bool = False
    brave_api_key: str = ""

    # --- Agent loop -----------------------------------------------------------
    max_agent_steps: int = 8

    # --- fetch_url safety -----------------------------------------------------
    max_fetch_bytes: int = 200_000
    fetch_timeout_seconds: float = 10.0

    # --- HTTP server ----------------------------------------------------------
    api_host: str = "0.0.0.0"
    api_port: int = 8001

    # --- Data paths -----------------------------------------------------------
    @property
    def data_dir(self) -> Path:
        return PROJECT_ROOT / "data"

    @property
    def goals_dir(self) -> Path:
        return self.data_dir / "goals"

    @property
    def resources_dir(self) -> Path:
        return self.data_dir / "resources"

    @property
    def fixtures_path(self) -> Path:
        return self.data_dir / "fixtures" / "web_search_fixtures.json"


settings = Settings()
