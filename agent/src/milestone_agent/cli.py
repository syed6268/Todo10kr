"""Typer CLI: `milestone-agent <command>`.

Commands:
    ingest   -- build the vector store from data/goals + data/resources
    run      -- one-shot agent invocation; prints + optionally saves JSON
    serve    -- start the FastAPI server
    reset-kb -- drop the Chroma collection (then re-run ingest)
"""

from __future__ import annotations

import json
from pathlib import Path

import typer

from .config import settings
from .schemas import GoalContext, ResearchRequest

app = typer.Typer(
    add_completion=False,
    help="Milestone Research Agent — local LLM ReAct agent for long-term goals.",
)


@app.command()
def ingest() -> None:
    """Ingest data/goals/ (kind=goal_context) and data/resources/ (kind=resource)."""
    from .rag.ingest import ingest_directory

    typer.echo(f"Vector store: {settings.chroma_path}")
    typer.echo(f"Embedding model: {settings.ollama_embed_model}\n")

    n_goals = ingest_directory(settings.goals_dir, kind="goal_context")
    typer.echo(f"  goal chunks ingested:     {n_goals}  (from {settings.goals_dir})")

    n_resources = ingest_directory(settings.resources_dir, kind="resource")
    typer.echo(f"  resource chunks ingested: {n_resources}  (from {settings.resources_dir})")

    typer.echo("\nDone. Run `milestone-agent run --title '...'` to test the agent.")


@app.command("reset-kb")
def reset_kb() -> None:
    """Drop the Chroma collection. Re-run `ingest` afterwards."""
    from .rag.store import reset

    reset()
    typer.echo(f"Collection '{settings.chroma_collection}' dropped.")


@app.command()
def run(
    title: str = typer.Option(..., "--title", help="Goal title."),
    desc: str = typer.Option("", "--desc", help="Goal description."),
    horizon: str = typer.Option(
        "1month", "--horizon", help="1week | 1month | 3months | 6months | 1year | 5years"
    ),
    priority: int = typer.Option(3, "--priority", min=1, max=5),
    category: str = typer.Option("", "--category"),
    days_since: int = typer.Option(
        -1, "--days-since", help="Days since last activity (-1 = unknown)"
    ),
    query: str = typer.Option("", "--query", help="Optional free-text user query."),
    max_steps: int = typer.Option(settings.max_agent_steps, "--max-steps"),
    save: str = typer.Option("", "--save", help="Path to save the JSON response."),
) -> None:
    """Run the agent on a single goal and print the JSON response + trace."""
    from .graph.runner import run_research

    goal = GoalContext(
        title=title,
        description=desc,
        horizon=horizon,
        priority=priority,
        category=category,
        days_since_last_activity=days_since if days_since >= 0 else None,
    )
    request = ResearchRequest(
        goal=goal,
        query=query or None,
        max_steps=max_steps,
    )

    typer.echo(f"Running agent on '{title}' (model={settings.ollama_model})...\n")
    response = run_research(request)

    payload = response.model_dump(mode="json")
    text = json.dumps(payload, indent=2, ensure_ascii=False)
    typer.echo(text)

    if save:
        out = Path(save)
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(text, encoding="utf-8")
        typer.echo(f"\nSaved → {out}")


@app.command()
def serve() -> None:
    """Start the FastAPI server (POST /research)."""
    import uvicorn

    typer.echo(f"Serving on http://{settings.api_host}:{settings.api_port}")
    uvicorn.run(
        "milestone_agent.api.server:app",
        host=settings.api_host,
        port=settings.api_port,
        reload=False,
    )


if __name__ == "__main__":
    app()
