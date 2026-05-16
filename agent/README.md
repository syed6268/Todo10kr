# Milestone Research Agent

A fully-local, tool-using AI agent that helps users advance long-term goals by
combining private milestone context (RAG) with live web research and document
retrieval (tools), then producing concrete proposed actions — including
draft cold-outreach emails — that the user can review and act on.

This package is the **local-LLM research layer** that powers (or will power)
the "AI Suggest" button on the DayOS/Todo10kr Milestones page. It is
**completely independent** of the Node backend and frontend: nothing in
`backend/` or `frontend/` is touched. The two systems are integrated via a
single HTTP call (see [Wiring into DayOS](#wiring-into-dayos) below).

---

## Why this stack

| Layer | Choice | Why |
|---|---|---|
| **LLM runtime** | [Ollama](https://ollama.com) (`qwen2.5:7b-instruct` default) | Runs locally, mature tool/function-calling, no API cost. |
| **Agent framework** | [LangGraph](https://langchain-ai.github.io/langgraph/) | Explicit state graph for ReAct loops; cleanly separates reasoning vs. tool execution; easy to cap steps, recover from tool failures, and produce a structured trace for the demo. |
| **Vector store** | [Chroma](https://www.trychroma.com/) (persistent, embedded) | No server required, file-backed, simple metadata filters. |
| **Embeddings** | Ollama (`nomic-embed-text`) | Local, free, decent semantic recall for short chunks. |
| **HTTP API** | FastAPI + Uvicorn | Tiny surface (`POST /research`), easy to call from Node. |
| **CLI** | Typer | One command per task (`ingest`, `run`, `serve`). |
| **Config** | `pydantic-settings` + `.env` | Type-safe, env-overridable, no surprises. |
| **PDF/HTML extraction** | `pypdf`, `trafilatura` | Battle-tested, no heavy browser dependency. |

**Why not** vanilla `requests` + a hand-rolled ReAct parser? LangGraph buys
us message-history management, tool-node retries, and a clean place to inject
step limits and timeouts — for ~30 extra lines of code vs. a raw loop. Worth
it for a system that will grow.

**Why not** Playwright? Almost all useful pages are reachable with a plain
HTTPS GET + readability extraction. Playwright adds 300 MB and 5 s of cold
start for marginal wins.

**Why not** LangChain agents (`AgentExecutor`)? LangGraph supersedes them; the
graph model is what the LangChain team itself now recommends.

---

## What it does

When invoked on a goal (e.g. `"Get into Y Combinator W26"` with a query like
`"I want to cold reach out to 2 investors this week"`), the agent
autonomously:

1. Pulls private context (milestone notes, recent completions) via
   `search_goal_context` — a RAG tool over your own goal data.
2. Searches the web for current deadlines / opportunities via `web_search`
   (live or fixture mode).
3. Optionally `fetch_url`s a top result to ground its claims.
4. Pulls outreach templates from an uploaded document via `search_resource`
   (RAG over the cold-email PDF).
5. Calls `draft_email` to compose a personalized draft from a chosen template
   and the retrieved context.
6. Returns a typed JSON object:

```json
{
  "summary": "Two action items + 1 outreach draft using Quick Question template.",
  "proposed_actions": [
    { "type": "task", "title": "Identify 5 target investors", ... },
    { "type": "draft_email",
      "subject": "Quick question for {{first_name}}",
      "body": "...",
      "template_used": "Quick Question",
      "review_required": true,
      "sources": [{ "title": "Cold Email Guide", "page": 9 }] }
  ],
  "questions_for_user": ["What's your one-line pitch?"],
  "trace": [ /* full step-by-step ReAct trace for audit + demo */ ]
}
```

All output is **draft-only**. The agent never sends mail, writes to your
calendar, or calls external write APIs.

---

## Folder layout

```
agent/
├── README.md                   <- you are here
├── pyproject.toml              <- package metadata + entry point
├── requirements.txt            <- pinned-ish deps for `pip install -r`
├── .env.example
├── .gitignore
│
├── data/
│   ├── goals/                  <- private milestone markdown → RAG (kind=goal_context)
│   ├── resources/              <- uploaded reference docs   → RAG (kind=resource)
│   └── fixtures/               <- offline web_search results for demos
│
├── demos/                      <- saved JSON traces of canned runs
│
├── scripts/
│   └── run_demo.py             <- runs canned queries, saves to demos/
│
├── src/
│   └── milestone_agent/
│       ├── __init__.py
│       ├── cli.py              <- typer CLI: ingest | run | serve
│       ├── config.py           <- pydantic-settings
│       ├── schemas.py          <- request/response Pydantic models
│       ├── llm.py              <- ChatOllama factory
│       │
│       ├── rag/
│       │   ├── embeddings.py   <- OllamaEmbeddings wrapper
│       │   ├── store.py        <- Chroma persistent client
│       │   └── ingest.py       <- markdown/pdf → chunk → embed → store
│       │
│       ├── tools/              <- one file per tool
│       │   ├── search_goal_context.py
│       │   ├── search_resource.py
│       │   ├── web_search.py
│       │   ├── fetch_url.py
│       │   └── draft_email.py
│       │
│       ├── graph/
│       │   ├── prompts.py      <- system prompt + per-goal user prompt
│       │   ├── builder.py      <- LangGraph StateGraph wiring
│       │   └── runner.py       <- public `run_research(request)` entry point
│       │
│       └── api/
│           └── server.py       <- FastAPI POST /research
│
└── tests/
    └── test_smoke.py
```

---

## Setup

### Prerequisites

- Python 3.10+
- [Ollama](https://ollama.com/download) running locally
- (Optional) Brave Search API key for live web search

### 1. Install Ollama models

```bash
ollama pull qwen2.5:7b-instruct
ollama pull nomic-embed-text
```

`llama3.1:8b-instruct` or `mistral-small` also work — change `OLLAMA_MODEL`
in `.env` to pick.

### 2. Python deps

From the `agent/` folder:

```bash
python -m venv .venv
# Windows:
.venv\Scripts\activate
# macOS/Linux:
source .venv/bin/activate

pip install -e .
# or:
pip install -r requirements.txt
```

### 3. Environment

```bash
cp .env.example .env
# Edit .env if you want live web search:
#   USE_LIVE_SEARCH=true
#   BRAVE_API_KEY=...
```

### 4. Ingest seed data (build the vector store)

```bash
milestone-agent ingest
```

This reads `data/goals/*.md` (tagged `kind=goal_context`) and
`data/resources/*` (tagged `kind=resource`) and writes embeddings into
`./chroma_db/`.

---

## Run

### CLI — one-shot

```bash
milestone-agent run \
  --title "Get into Y Combinator W26" \
  --desc  "Apply to YC W26; need refined pitch and 5-10 user testimonials." \
  --horizon 6months --priority 1 \
  --query "I want to cold reach out to 2 investors this week. Help me plan it." \
  --save demos/yc_outreach.json
```

The terminal prints the structured response (summary, proposed actions,
questions, full trace). `--save` writes the same JSON to a file — this is the
demo deliverable.

### API server

```bash
milestone-agent serve
# → http://localhost:8001
```

Then:

```bash
curl -X POST http://localhost:8001/research \
  -H "Content-Type: application/json" \
  -d '{
    "goal": {
      "title": "Learn Spanish",
      "description": "Reach B2 conversational by year-end.",
      "horizon": "1year",
      "priority": 3,
      "days_since_last_activity": 10
    },
    "query": "I have not practiced in 10 days. What should I do today?"
  }'
```

### Canned demo

```bash
python scripts/run_demo.py
```

Runs both demo queries (YC outreach + Spanish inactivity) and writes
`demos/yc_outreach.json` and `demos/spanish_inactive.json`. Submit these as
the demo logs.

---

## Wiring into DayOS (optional, later)

The Node backend in this monorepo is **untouched**. To wire AI Suggest
through the local agent without breaking the existing OpenAI path, add a
proxy block to `backend/src/routes/goals.routes.js` (left to do separately):

```js
// pseudo-code, not added in this scaffold
router.post("/:id/propose", async (req, res) => {
  const goal = await Goal.findById(req.params.id);

  if (process.env.RESEARCH_AGENT_URL) {
    const r = await fetch(`${process.env.RESEARCH_AGENT_URL}/research`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ goal: toContext(goal), query: req.body?.query }),
    });
    return res.json({ proposal: await r.json() });
  }

  // existing path
  const proposal = await runGoalAgent(goal, { today: new Date() });
  res.json({ proposal });
});
```

When `RESEARCH_AGENT_URL=http://localhost:8001` is set, AI Suggest uses the
local agent. When unset, it falls back to the original one-shot OpenAI call.
This is the only change required outside `agent/`.

---

## Design rules

- **Drafts only.** No tool has side effects (no mail send, no GCal write).
- **No fabricated links.** System prompt forbids any URL not returned by
  `web_search` / `fetch_url`.
- **Bounded steps.** `MAX_AGENT_STEPS` caps the loop; on overrun the model is
  forced to emit its best final JSON.
- **Bounded fetch.** `fetch_url` allows only `https`, blocks
  loopback/private IPs, caps response size and timeout.
- **Typed contract.** Every input/output goes through Pydantic. The
  frontend can always assume the shape in `schemas.ResearchResponse`.
- **Trace-first.** Every step (thought, tool call, tool result) is recorded
  for the audit log and the demo deliverable.

---

## Evaluation-criteria mapping

| 10kr criterion | Where it lives |
|---|---|
| Architectural choice | This README + `graph/builder.py` |
| Agent autonomy | `graph/builder.py` + `graph/prompts.py` (no `if "spanish" in query` triggers) |
| Prompt robustness | `graph/prompts.py` (citation/no-side-effect/JSON rules) |
| Engineering quality | Typed schemas, tool error handling, step caps, SSRF guards in `tools/fetch_url.py` |
| RAG + tool in one query | Demo: `scripts/run_demo.py` → `demos/yc_outreach.json` |
