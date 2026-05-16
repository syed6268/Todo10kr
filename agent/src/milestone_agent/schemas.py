"""Typed contract for everything that crosses the agent boundary.

These models are the public surface area:
    - `ResearchRequest`  : input from the Node app / CLI / API
    - `ResearchResponse` : output the frontend can render directly
    - `ProposedAction`   : one renderable artifact (task | draft_email | note)
    - `TraceStep`        : one entry in the audit/demo log
"""

from __future__ import annotations

from typing import Any, Literal, Optional

from pydantic import BaseModel, Field


# --- Input ------------------------------------------------------------------

class GoalContext(BaseModel):
    """Snapshot of a single milestone, as the agent sees it."""

    id: Optional[str] = None
    title: str
    description: str = ""
    horizon: str = ""  # 1week | 1month | 3months | 6months | 1year | 5years
    priority: int = 3  # 1 = highest
    category: str = ""

    days_since_last_activity: Optional[int] = None
    recent_completions: list[dict] = Field(default_factory=list)
    recent_notes: list[dict] = Field(default_factory=list)
    custom_instructions: str = ""


class ResearchRequest(BaseModel):
    goal: GoalContext
    query: Optional[str] = None
    attached_doc_ids: list[str] = Field(default_factory=list)
    max_steps: Optional[int] = None


# --- Output -----------------------------------------------------------------

class Source(BaseModel):
    title: str
    url: Optional[str] = None
    page: Optional[int] = None
    doc_id: Optional[str] = None


ActionType = Literal["task", "draft_email", "research_note"]
EnergyCost = Literal["low", "medium", "high"]
Urgency = Literal["low", "medium", "high"]


class ProposedAction(BaseModel):
    """One concrete thing the user can do or review."""

    type: ActionType
    title: str
    rationale: str = ""

    estimated_minutes: Optional[int] = None
    energy_cost: Optional[EnergyCost] = None
    urgency: Optional[Urgency] = None

    # Fields for type="draft_email"
    subject: Optional[str] = None
    to: Optional[str] = None
    body: Optional[str] = None
    template_used: Optional[str] = None

    review_required: bool = True
    sources: list[Source] = Field(default_factory=list)


TraceType = Literal["thought", "tool_call", "tool_result", "final", "error"]


class TraceStep(BaseModel):
    step: int
    type: TraceType
    name: Optional[str] = None
    input: Optional[Any] = None
    output: Optional[Any] = None
    error: Optional[str] = None
    timestamp: str


class ResearchResponse(BaseModel):
    goal_id: Optional[str] = None
    summary: str = ""
    proposed_actions: list[ProposedAction] = Field(default_factory=list)
    questions_for_user: list[str] = Field(default_factory=list)
    trace: list[TraceStep] = Field(default_factory=list)
    generated_at: str
