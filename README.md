# RoastMyCode

A multi-agent code review platform. Paste code, upload a file, or link a GitHub URL — five AI agents, each embodying a distinct senior engineer persona, independently tear your code apart and stream their verdicts live. A Synthesis Agent reconciles their findings into a severity-ranked verdict with a 0–100 roast score.

**Contents**

- [Overview](#overview)
- [How It Works](#how-it-works)
- [Agent Personas](#agent-personas)
- [Architecture](#architecture)
- [Architectural Decisions](#architectural-decisions)
- [Tech Stack](#tech-stack)
- [Features](#features)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [API Reference](#api-reference)
- [Project Structure](#project-structure)
- [Development Notes](#development-notes)
- [Deployment](#deployment-railway)
- [Known Limitations](#known-limitations)
- [License](#license)

## Overview

RoastMyCode treats a code review as a structured debate between five opinionated engineers who never met. Each agent works from the same code independently, reports their findings without influence from the others, and streams results the moment they finish. The Synthesis Agent then steps in as a tech lead — identifying where multiple agents agree (high signal), where only one flags something (worth considering), and where they explicitly contradict each other (interesting conflict worth understanding).

The result is a 0–100 roast score, a severity-ranked issue list, a downloadable PDF report, and a permanent shareable link — all without requiring an account.

## How It Works

1. **Submit** — paste code, upload a file (up to 100KB), or provide a GitHub URL (single file or best file auto-selected from a repo)
2. **Watch** — five agents run sequentially and stream their verdicts live over WebSocket as each one finishes
3. **Read** — the Synthesis Agent merges findings, marks issues agreed on by 2+ agents as Critical, and surfaces explicit conflicts
4. **Export** — download a PDF report or copy a permanent public share link

## Agent Personas

| Agent | Persona | What They Look For |
|---|---|---|
| **Pragmatist** | Staff Backend Engineer | Scalability, production readiness, architecture smells |
| **Paranoid** | Penetration Tester | Injection, hardcoded secrets, auth flaws, info leakage |
| **Minimalist** | Clean Code Evangelist | Dead code, SRP violations, complexity, poor naming |
| **Optimizer** | Performance Engineer | N+1 queries, O(n²) loops, missing indexes, memory leaks |
| **Mentor** | Senior Onboarding Engineer | Teachable anti-patterns, unclear intent, missing tests |
| **Synthesis** | Tech Lead | Cross-agent reconciliation, severity ranking, overall score |

## Architecture

### System Overview

```
Browser
  │
  ├── HTTP (REST)  ──► Django / DRF  ──► PostgreSQL
  │                        │
  │                    Celery Task (Redis broker)
  │                        │
  │                   LangGraph Graph
  │              (sequential — one agent at a time)
  │    Pragmatist → Paranoid → Minimalist → Optimizer → Mentor
  │                        │
  │                   Synthesis Agent
  │                        │
  └── WebSocket ◄── Django Channels (Redis channel layer)
```

Each agent broadcasts its verdict the moment it finishes. The frontend renders each agent card as it arrives — one by one in real time. Synthesis runs after all five and sends the final verdict.

### Request Lifecycle

```
POST /api/reviews/
  → Input handler (paste / file / GitHub)
  → Review row created (status: pending)
  → Celery task dispatched
  → 201 {"review_id": "..."}

WebSocket ws/reviews/{id}/
  → Consumer subscribes to group review_{id}
  → Replays event_log for late connections

Celery worker
  → status: running
  → LangGraph graph.invoke()
  → 5 agents run sequentially
  → Each agent: calls Groq, parses JSON, broadcasts agent_done
  → Synthesis: merges results, broadcasts synthesis_done + done
  → status: done, completed_at set
```

### Data Flow

```
raw_code + language + filename
      │
      ▼
ReviewState (TypedDict)
      │
   pragmatist → paranoid → minimalist → optimizer → mentor
                                                       │
                                                  synthesis
                          │
                    Review.synthesis (JSONB)
                    Review.agent_results (JSONB)
                    Review.event_log (JSONB list)
```

### Component Responsibilities

| Component | Responsibility |
|---|---|
| `apps/input_handler/` | Sanitize input, enforce line limits, detect language, fetch GitHub files |
| `pipeline/graph.py` | Build and compile the LangGraph state machine |
| `pipeline/agents/` | Per-agent LLM invocation, result parsing, WebSocket broadcast, DB write |
| `worker/tasks.py` | Celery entry point; owns review lifecycle (status transitions, error handling) |
| `ws/consumers.py` | WebSocket lifecycle; event replay for late-connecting clients |
| `ws/middleware.py` | JWT authentication for WebSocket connections (reads `?token=` query param) |
| `apps/export/pdf.py` | Render PDF from Django template using WeasyPrint |
| `apps/reviews/views.py` | DRF views for submit, detail, share, history, PDF download |

## Architectural Decisions

### Why LangGraph for the agent pipeline?

The five-agent pipeline is a directed acyclic graph: five sequential nodes feeding into one aggregation node. LangGraph's `StateGraph` expresses this directly — a chain of `add_edge` calls, compiled once at startup and reused for every review. Alternatives (raw loops, Celery chains, custom orchestration) require manual state passing and error propagation that LangGraph handles structurally.

The pipeline runs sequentially (not in parallel) to stay within Groq's free-tier TPM limits and to give the frontend a live one-card-at-a-time update experience. If billing is enabled, switching back to parallel fan-out is a one-line change in `graph.py`.

### Agent Execution Model: Parallel → Sequential

The pipeline was initially designed to run all five agents in parallel — each agent fires simultaneously and the synthesis node waits for all five to complete before running. This is the natural topology for independent reviewers.

In practice it immediately hit Groq's 12,000 TPM limit. Five agents firing at the same time consumed roughly 4,000–5,000 tokens in the same second, exhausting the per-minute bucket instantly and causing the 4th and 5th agents to 429 on every run.

Switching to sequential execution (`pragmatist → paranoid → minimalist → optimizer → mentor → synthesis`) spaces requests across 30–60 seconds, well within the TPM window. There is a side benefit: the frontend renders agent cards one at a time as each agent finishes, which gives the impression of a live debate rather than a simultaneous data dump. If the project moves to a paid Groq tier (or a different provider), reverting to parallel is a single topological change in `pipeline/graph.py`.

### Rate Limit Resilience: SDK-Level Retry

Even with sequential execution, the Groq free tier (5 RPM / 12,000 TPM) can still be exceeded — particularly by the synthesis node, which receives all five agent results as input and can request up to 4,096 output tokens in a single call.

Measured token usage for a typical review (verified from Groq console logs):

| Call | Input tokens | Output tokens |
|---|---|---|
| Agent 1 (pragmatist) | ~798 | ~673 |
| Agent 2 (paranoid)   | ~830 | ~650 |
| Agent 3 (minimalist) | ~835 | ~622 |
| Agent 4 (optimizer)  | ~853 | ~494 |
| Agent 5 (mentor)     | ~871 | ~796 |
| Synthesis            | ~3,550 | ~1,405 |
| **Total**            | **~7,737** | **~4,640** |

At ~13,300 tokens per review, a single submission is already above the 12,000 TPM ceiling if all calls fall within the same minute. The Groq Python SDK handles this transparently: on a 429 response it reads the `retry-after` header (typically 1–23 seconds) and re-issues the request automatically, without surfacing an exception to application code. In practice, agents 4 and 5 and synthesis each get one automatic retry per run, adding 5–25 seconds of total latency but completing successfully. The Celery task retry (`max_retries=2`) acts as a final safety net for cases where the SDK exhausts its own retries.

### LLM Provider: Gemini → Groq (and why)

The pipeline was originally written against the Google Gemini API (`gemini-1.5-flash`). In production, every call returned a `limit: 0` error — the API key did not have access to that model variant. Upgrading to `gemini-2.0-flash` hit a different wall: Google deprecated `2.0-flash` effective June 1 2026, right as the project was being deployed. Both issues are free-tier access restrictions, not model quality problems.

Groq was chosen as the replacement for two reasons: its free tier is the most generous available for production use (14,400 RPD, no waitlist), and `llama-3.3-70b-versatile` reliably produces structured JSON outputs, which is the primary requirement for a pipeline where every agent must return a parseable schema. The tradeoff is lower reasoning depth than Gemini 2.5 Pro or GPT-4o — acceptable here because the agent personas constrain output structure tightly via system prompts.

Switching required replacing `google-genai` with `groq==0.13.1`, rewriting the LLM call in `base.py` and `synthesis.py` to use `client.chat.completions.create`, and renaming `GEMINI_API_KEY`/`GEMINI_MODEL` to `GROQ_API_KEY`/`GROQ_MODEL` in settings.

### Why Celery for async task execution, not Django's async views?

The pipeline takes 10–30 seconds to complete (five sequential Gemini calls per parallel branch, then synthesis). Holding an HTTP connection open for this duration is wasteful and hits proxy timeouts. Celery decouples submission (fast 201 response) from execution (background worker), allows retries, and separates the ASGI web process from CPU/IO-bound LLM work. The frontend connects via WebSocket for live updates, not long-polling.

### Why Redis as both channel layer and Celery broker (not RabbitMQ)?

Railway — the deployment target — provides Redis as a managed plugin. RabbitMQ is not a built-in Railway plugin and requires a third-party CloudAMQP add-on. For this workload (task fan-out with no complex routing, no dead-letter queues, no priority lanes), Redis is fully sufficient as a Celery broker. Eliminating RabbitMQ reduces the service count from six to five and removes a significant operational dependency.

### Why Django Channels for WebSocket, not a dedicated service?

Django Channels integrates with the existing Django ORM, authentication, and session stack in the same process. The WebSocket consumers can call `database_sync_to_async`-wrapped ORM queries directly. A separate Node.js or Go WebSocket server would require a cross-service message bus for replaying review history and an independent auth layer. The Redis channel layer already provides the pub/sub backbone that Channels needs.

### Why per-agent WebSocket broadcasts from within the agent nodes?

Each agent node writes to the channel layer immediately after getting its LLM response, before other agents finish. This gives the browser a card to render as soon as any agent completes — typically within 3–5 seconds of pipeline start. If all results were held until synthesis, the user would stare at a loading screen for 15–30 seconds. The tradeoff is that agents now have a side effect (channel layer write) inside what should be pure state transformation nodes. This is accepted: the alternative (polling from synthesis) delays feedback.

### Why WeasyPrint for PDF generation?

WeasyPrint renders HTML/CSS to PDF, which allows the same Django template system used for the web view to produce the PDF. The alternative (ReportLab, fpdf2) requires constructing documents programmatically with a separate layout model — twice the maintenance surface. The tradeoff is that WeasyPrint requires system-level libraries (`libcairo2`, `libpango*`) in the Docker image.

### Why anonymous reviews are allowed without login?

Requiring login before showing any value creates a conversion funnel with a large drop-off. The anonymous flow (5 reviews/day, 200-line limit) lets a user experience the full product immediately. Google OAuth is positioned as an upgrade path: history, higher limits, saved annotations. Rate limiting by IP prevents abuse.

### Why `share_slug` is 8 hex characters instead of a sequential ID?

Sequential IDs expose the total review count and allow enumeration of all reviews. An 8-character hex slug (4 billion combinations) is not guessable by enumeration. UUIDs are long for URLs; 8 characters is a reasonable tradeoff between collision probability and URL aesthetics at expected scale. A `unique=True` constraint plus a retry loop on `IntegrityError` handles the rare collision case.

### Why `event_log` is stored on the `Review` model?

WebSocket clients that connect after the pipeline has already emitted events (page refresh, late load) need to catch up. Storing the event log in the database — rather than relying on Redis pub/sub history, which is ephemeral — means a client that connects five minutes after the review finishes still gets the full playback. The tradeoff is that the log grows per review and must be read in full on reconnect.

## Tech Stack

| Layer | Technology |
|---|---|
| Agent Pipeline | LangGraph 0.2+ (sequential chain) |
| LLM | Groq — llama-3.3-70b-versatile (`groq` SDK) |
| Backend | Django 5.0 + Django REST Framework |
| WebSockets | Django Channels 4 + Redis channel layer |
| Task Queue | Celery 5 (Redis broker) |
| Database | PostgreSQL 16 |
| Cache / Broker | Redis 7 |
| GitHub Integration | PyGithub |
| Language Detection | pygments |
| PDF Generation | WeasyPrint |
| Auth | django-allauth (Google OAuth) + simplejwt |
| Frontend | Next.js 14, TypeScript, TailwindCSS, shadcn/ui |
| Containerization | Docker Compose |
| Deployment | Railway |

## Features

- **Three input modes** — paste, file upload, GitHub URL
- **Live streaming** — agent verdicts appear as they complete via WebSocket
- **Severity ranking** — issues flagged by 2+ agents are marked Critical; agent conflicts are surfaced explicitly
- **0–100 roast score** — 0 is clean code, 100 is a full rewrite candidate
- **PDF export** — downloadable report with all findings
- **Shareable links** — every review gets a permanent public URL (`/r/{slug}`)
- **Review history** — Google OAuth unlocks a dashboard of past reviews
- **Rate limiting** — 5 reviews/day anonymous, 20/day authenticated
- **Language detection** — automatic via pygments; all mainstream languages supported

## Getting Started

### Prerequisites

- Docker and Docker Compose
- A [Groq API key](https://console.groq.com/keys) (free tier works)
- Optionally: Google OAuth credentials and a GitHub personal access token

### 1. Clone and configure

```bash
git clone https://github.com/yourusername/roastmycode.git
cd roastmycode
cp .env.example .env
```

Edit `.env` and set at minimum:

```bash
SECRET_KEY=<generate with: python -c "import secrets; print(secrets.token_urlsafe(50))">
GROQ_API_KEY=<your-groq-api-key>
```

### 2. Start services

```bash
docker compose up --build
```

This starts:

- `db` — PostgreSQL 16 on port 5432
- `redis` — Redis 7 on port 6379
- `web` — Django + Daphne (ASGI) on port 8000
- `worker` — Celery worker (4 concurrent)
- `frontend` — Next.js dev server on port 3000

### 3. Run migrations

```bash
docker compose exec web python manage.py migrate
docker compose exec web python manage.py createsuperuser
```

### 4. Open

Navigate to [http://localhost:3000](http://localhost:3000).

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `SECRET_KEY` | Yes | Django secret key |
| `DEBUG` | No | `True` for local dev |
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `REDIS_URL` | Yes | Redis for channel layer |
| `REDIS_CELERY_BROKER` | Yes | Redis for Celery broker |
| `REDIS_CELERY_BACKEND` | Yes | Redis for Celery results |
| `REDIS_CACHE_URL` | Yes | Redis for Django cache |
| `GROQ_API_KEY` | Yes | Groq Console key |
| `GROQ_MODEL` | No | Default: `llama-3.3-70b-versatile` |
| `GITHUB_TOKEN` | No | Raises GitHub API limit from 60 to 5000 req/hr |
| `GOOGLE_CLIENT_ID` | No | Required for Google OAuth login |
| `GOOGLE_CLIENT_SECRET` | No | Required for Google OAuth login |
| `ANONYMOUS_DAILY_LIMIT` | No | Default: 5 reviews/day |
| `AUTHENTICATED_DAILY_LIMIT` | No | Default: 20 reviews/day |
| `ANONYMOUS_MAX_LINES` | No | Default: 200 lines |
| `AUTHENTICATED_MAX_LINES` | No | Default: 500 lines |
| `NEXT_PUBLIC_API_URL` | Yes | Backend URL for the frontend build |
| `NEXT_PUBLIC_WS_URL` | Yes | WebSocket URL for the frontend build |

See [`.env.example`](.env.example) for all variables.

## API Reference

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `POST` | `/api/reviews/` | Optional | Submit code for review |
| `GET` | `/api/reviews/{id}/` | Optional | Poll review status and results |
| `GET` | `/api/reviews/{id}/pdf/` | Optional | Download PDF report |
| `GET` | `/api/r/{slug}/` | None | Public share page data |
| `GET` | `/api/history/` | Required | Authenticated user's review history |
| `POST` | `/api/auth/token/` | None | Issue JWT (email + password) |
| `POST` | `/api/auth/social/google/` | None | Google OAuth code → JWT exchange |
| `WS` | `ws://.../ws/reviews/{id}/` | Optional | Live review stream |

### Submit a review (paste)

```bash
curl -X POST http://localhost:8000/api/reviews/ \
  -H "Content-Type: application/json" \
  -d '{
    "input_mode": "paste",
    "code": "def foo():\n    x = [i for i in range(1000000)]\n    return x"
  }'
# → {"review_id": "550e8400-e29b-41d4-a716-446655440000"}
```

### Submit a review (GitHub URL)

```bash
curl -X POST http://localhost:8000/api/reviews/ \
  -H "Content-Type: application/json" \
  -d '{
    "input_mode": "github",
    "github_url": "https://github.com/owner/repo/blob/main/app.py"
  }'
```

### WebSocket event stream

```typescript
const ws = new WebSocket(`ws://localhost:8000/ws/reviews/${reviewId}/`);

ws.onmessage = (e) => {
  const event = JSON.parse(e.data);
  switch (event.event) {
    case 'pipeline_start':   // pipeline dispatched to worker
    case 'agent_done':       // event.agent, event.result
    case 'synthesis_done':   // event.verdict (final ranked output)
    case 'done':             // all complete
    case 'error':            // event.message
  }
};
```

**Agent verdict shape:**

```typescript
interface AgentVerdict {
  issues: Array<{
    title: string;
    description: string;
    severity: 'critical' | 'warning' | 'suggestion';
    line_hint: string;
  }>;
  summary: string;
  overall_severity: 'critical' | 'warning' | 'suggestion';
}
```

**Synthesis verdict shape:**

```typescript
interface SynthesisVerdict {
  critical:    Array<{ title: string; description: string; agents: string[] }>;
  warnings:    Array<{ title: string; description: string; agents: string[] }>;
  suggestions: Array<{ title: string; description: string; agents: string[] }>;
  conflicts:   Array<{ topic: string; positions: Record<string, string> }>;
  overall_score: number;   // 0–100
  summary: string;
}
```

## Project Structure

```
roastmycode/
├── backend/
│   ├── config/
│   │   ├── celery.py         # Celery app definition
│   │   ├── asgi.py           # ASGI router (HTTP + WebSocket)
│   │   ├── urls.py           # Root URL conf
│   │   └── settings/
│   │       ├── base.py       # Shared settings
│   │       ├── local.py      # Dev overrides
│   │       └── production.py # Prod overrides (HTTPS, no DEBUG)
│   ├── apps/
│   │   ├── reviews/          # Review model, serializers, views, admin
│   │   ├── users/            # Custom User model, JWT + OAuth endpoints
│   │   ├── input_handler/    # Paste, file upload, GitHub fetch
│   │   └── export/           # PDF generation (WeasyPrint)
│   ├── pipeline/
│   │   ├── graph.py          # LangGraph sequential chain (5 agents → synthesis)
│   │   ├── state.py          # ReviewState TypedDict
│   │   └── agents/           # pragmatist, paranoid, minimalist, optimizer, mentor, synthesis
│   ├── ws/                   # Django Channels consumers, routing, JWT middleware
│   └── worker/
│       └── tasks.py          # Celery task: pipeline dispatch + lifecycle management
└── frontend/
    └── app/
        ├── page.tsx           # Input page (3 tabs: paste / file / GitHub URL)
        ├── review/[id]/       # Live streaming results via WebSocket
        ├── r/[slug]/          # Public share page (static render)
        ├── dashboard/         # Auth-gated review history
        └── components/        # AgentCard, SynthesisPanel, ShareButton, etc.
```

## Development Notes

### Running just the backend

```bash
cd backend
pip install -r requirements.txt
DJANGO_SETTINGS_MODULE=config.settings.local python manage.py runserver
```

Requires a running PostgreSQL and Redis instance (or `docker compose up db redis`).

### Running the Celery worker

```bash
cd backend
celery -A config.celery worker --loglevel=info --concurrency=4
```

### Running just the frontend

```bash
cd frontend
npm install
npm run dev
```

## Deployment (Railway)

1. Push to GitHub
2. Create a new Railway project and connect the repo
3. Add Railway plugins: **PostgreSQL** and **Redis**
4. Set all environment variables from `.env.example` in the Railway dashboard
5. Set `DJANGO_SETTINGS_MODULE=config.settings.production`
6. Set `NEXT_PUBLIC_API_URL` and `NEXT_PUBLIC_WS_URL` to your Railway domains **before the first build** — Next.js bakes these into the JS bundle at build time
7. The `Procfile` in `backend/` defines process separation:
   ```
   web: daphne config.asgi:application --port $PORT --bind 0.0.0.0
   worker: celery -A config.celery worker --loglevel=info
   ```
8. After first deploy, run migrations:
   ```bash
   railway run python manage.py migrate
   ```

## Known Limitations

- **GitHub API rate limit** — without `GITHUB_TOKEN`, GitHub input is limited to 60 requests/hour across all users. Set a token to raise this to 5000/hr.
- **Code size** — anonymous users are limited to 200 lines; authenticated users to 500 lines. File uploads are capped at 100KB.
- **Language support** — all languages supported by pygments are detected, but agent prompts are English-only and perform best on mainstream languages (Python, TypeScript, Go, Java, Rust, C/C++).
- **Groq rate limits** — the free tier allows 14,400 RPD and 12,000 TPM for `llama-3.3-70b-versatile`. The sequential pipeline and SDK retry logic handle occasional bursts, but very large code files submitted in rapid succession may hit TPM limits briefly. The SDK retries automatically.
- **PDF emoji rendering** — WeasyPrint does not support color emoji fonts on Linux. The PDF report uses text labels in place of emoji.

## License

MIT
