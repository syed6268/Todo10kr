"""Canned demo runs.

Executes two scenarios end-to-end and saves the typed JSON response (with
full ReAct trace) into ``demos/<name>.json``. The combined output is what
you submit as the demo log for the take-home.

Usage::

    python scripts/run_demo.py            # run all demos
    python scripts/run_demo.py yc         # run only the yc_outreach demo
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

# Allow running as a plain script.
ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "src"))

from milestone_agent.graph.runner import run_research  # noqa: E402
from milestone_agent.schemas import GoalContext, ResearchRequest  # noqa: E402


DEMOS = [
    {
        "name": "yc_outreach",
        "title": "Demo 1 — RAG (goal + cold-email guide) + web_search + draft_email",
        "request": ResearchRequest(
            goal=GoalContext(
                title="Get into Y Combinator W26",
                description=(
                    "Apply to YC W26. Need refined pitch, 5-10 user testimonials, "
                    "and warm investor intros documented in the application."
                ),
                horizon="6months",
                priority=1,
                category="career",
                recent_notes=[
                    {"text": "Built v0 prototype; need user interviews"},
                    {"text": "Pitch deck v1 drafted; one-liner too long"},
                ],
                recent_completions=[
                    {"title": "Drafted pitch deck v1"},
                    {"title": "Set up landing page with waitlist signup"},
                ],
            ),
            query=(
                "I want to cold reach out to 2 seed-stage AI investors this week. "
                "Plan it for me and draft the first email."
            ),
        ),
    },
    {
        "name": "spanish_inactive",
        "title": "Demo 2 — RAG (goal) + web_search for fresh resources",
        "request": ResearchRequest(
            goal=GoalContext(
                title="Learn Spanish",
                description="Reach B2 conversational by year-end.",
                horizon="1year",
                priority=3,
                category="learning",
                days_since_last_activity=10,
                recent_notes=[{"text": "Stuck on subjunctive"}],
            ),
            query="I haven't practiced in 10 days. What should I do today?",
        ),
    },
]


def run_one(demo: dict) -> Path:
    name = demo["name"]
    print(f"\n=== {demo['title']} ===")
    print(f"  goal:  {demo['request'].goal.title}")
    if demo["request"].query:
        print(f"  query: {demo['request'].query}")

    response = run_research(demo["request"])

    out_dir = ROOT / "demos"
    out_dir.mkdir(exist_ok=True)
    path = out_dir / f"{name}.json"
    payload = response.model_dump(mode="json")
    path.write_text(json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8")

    print(f"  summary: {response.summary[:140]}")
    print(f"  actions: {len(response.proposed_actions)}")
    print(f"  trace steps: {len(response.trace)}")
    print(f"  saved → {path.relative_to(ROOT)}")
    return path


def main() -> None:
    selected = sys.argv[1:]
    demos = [d for d in DEMOS if not selected or any(s in d["name"] for s in selected)]
    if not demos:
        print(f"No demo matched: {selected}. Available: {[d['name'] for d in DEMOS]}")
        sys.exit(1)
    for demo in demos:
        run_one(demo)


if __name__ == "__main__":
    main()
