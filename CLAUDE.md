# PullQuest — CLAUDE.md

---

## gstack (REQUIRED — global install)

**Before doing ANY work, verify gstack is installed:**

```bash
test -d ~/.claude/skills/gstack/bin && echo "GSTACK_OK" || echo "GSTACK_MISSING"
```

If GSTACK_MISSING: STOP. Do not proceed. Tell the user:

> gstack is required for all AI-assisted work in this repo.
> Install it:
> ```bash
> git clone --depth 1 https://github.com/garrytan/gstack.git ~/.claude/skills/gstack
> cd ~/.claude/skills/gstack && ./setup --team
> ```
> Then restart your AI coding tool.

Do not skip skills, ignore gstack errors, or work around missing gstack.

Using gstack skills: After install, skills like /qa, /ship, /review, /investigate,
and /browse are available. Use /browse for all web browsing.
Use ~/.claude/skills/gstack/... for gstack file paths (the global path).

Use the /browse skill from gstack for all web browsing. Never use
mcp__claude-in-chrome__* tools.

Available gstack skills: /office-hours, /plan-ceo-review, /plan-eng-review,
/plan-design-review, /design-consultation, /design-shotgun, /design-html,
/review, /ship, /land-and-deploy, /canary, /benchmark, /browse,
/connect-chrome, /qa, /qa-only, /design-review, /setup-browser-cookies,
/setup-deploy, /setup-gbrain, /retro, /investigate, /document-release,
/document-generate, /codex, /cso, /autoplan, /plan-devex-review,
/devex-review, /careful, /freeze, /guard, /unfreeze, /gstack-upgrade, /learn

---

## Caveman Mode (ACTIVE BY DEFAULT)

> Token-saving communication. All technical substance stays. Only fluff dies.

**Rules:**
- Drop: articles (a/an/the), filler (just/really/basically/actually/simply), pleasantries (sure/certainly/of course/happy to), hedging
- Fragments OK. Short synonyms (big not extensive, fix not "implement a solution for")
- Abbreviate: DB/auth/config/req/res/fn/impl/pkg/dir/env/dep
- Strip conjunctions. Use arrows for causality (X → Y)
- One word when one word enough
- Pattern: `[thing] [action] [reason]. [next step].`
- Technical terms stay exact. Code blocks unchanged. Errors quoted exact.

**Not:** "Sure! I'd be happy to help you with that. The issue you're experiencing is likely caused by..."
**Yes:** "Bug in auth middleware. Token expiry check use `<` not `<=`. Fix:"

**Exception:** Drop caveman temporarily for: security warnings, irreversible action confirmations, multi-step sequences where fragment order risks misread. Resume after.

---

## Project Overview

**PullQuest** — GitHub-native seasonal reputation & incentive platform. Stake-backed participation, trust-weighted XP, transparent rankings.

**Stack:**
- Frontend: Next.js (App Router) + TypeScript + Tailwind CSS v4 + shadcn/ui
- Backend: Express.js API + BullMQ worker
- DB: Supabase (PostgreSQL + Auth + Realtime + RLS)
- Cache/Queue: Redis (BullMQ queues + leaderboard sorted sets)
- Knowledge Graph: Neo4j 5 (bolt://localhost:7687)
- Monorepo: pnpm workspaces + Turborepo
- Observability: Prometheus + Grafana + Sentry
- Integrations: GitHub OAuth App, GitHub App, Stripe, Google Gemini

**Monorepo Structure:**
```
apps/
  web/     → Next.js frontend (@pullquest/web) :3000
  api/     → Express REST API (@pullquest/api) :3001
  worker/  → BullMQ job processor (@pullquest/worker)
packages/
  shared/  → Types, constants, utils (@pullquest/shared)
  database/→ Supabase client & types (@pullquest/database)
infra/
  prometheus/ → Metrics config
  grafana/    → Dashboard provisioning
  redis/      → Redis config
scripts/
  seed-knowledge-graph.ts   → Populate Neo4j from PRD
  query-knowledge-graph.ts  → Query project status from KG
  reset-knowledge-graph.ts  → Wipe Neo4j graph
```

---

## Knowledge Graph (MUST REFERENCE)

Before starting ANY work, check project status via Knowledge Graph:

```bash
# Check what's built vs pending
pnpm kg:query status

# Find which features are incomplete
pnpm kg:query todo

# Find recommended skills for a feature
pnpm kg:query skills "Authentication"

# Get full project summary
pnpm kg:query
```

**Knowledge Graph Status:** ✅ SEEDED 2026-07-21 — 35 features (9 done / 22 partial / 4 todo), 33 skills, 7 phases. Neo4j on bolt://localhost:7687 (container `pullquest-neo4j`).

Graph model: `(Project)-[:HAS_PHASE]->(Phase)-[:CONTAINS]->(Feature)`, `(Feature)-[:IMPLEMENTED_IN]->(Component)`, `(Feature)-[:DEPENDS_ON]->(Feature)`, `(Feature)-[:RECOMMENDED_SKILL]->(Skill)`.

After completing work on any feature, update its status:
1. Edit `FEATURES` array in `scripts/seed-knowledge-graph.ts` (status: done/partial/todo)
2. Re-run `pnpm kg:seed` (idempotent — MERGE-based)
3. Ad-hoc inspection: Neo4j Browser at http://localhost:7474

---

## Required File References

Every agent MUST read these files before working:

| File | Purpose | When to Read |
|---|---|---|
| `PRD.md` | Full product requirements | Before implementing any feature |
| `Agents.md` | Agent roles, voice, workflow | Every session start |
| `Skills.md` | Development workflow & skill catalog | Before starting any task |
| `Context.md` (in target dir) | What the directory does | Before modifying any directory |
| `Memory.md` (in target dir) | Preferences & known patterns | Before modifying, after completing |

---

## Key Commands

```bash
# Development
pnpm dev                    # Start all services (Turborepo)
pnpm build                  # Build all packages
pnpm test                   # Run tests (Vitest)
pnpm dev:web                # Frontend only
pnpm dev:api                # API only
pnpm dev:worker             # Worker only

# Docker
docker compose up -d        # All services (Redis, Prometheus, Grafana, Neo4j)
docker compose up --build   # Full stack incl. app containers

# Knowledge Graph
pnpm kg:seed                # Seed Neo4j from PRD
pnpm kg:query               # Query project status
pnpm kg:query status        # Completion by phase
pnpm kg:query todo          # Incomplete items
pnpm kg:reset               # Wipe graph

# Database
pnpm db:migrate             # Run Supabase migrations
pnpm db:types               # Generate DB types
```

---

## Code Style

- TypeScript strict mode everywhere
- Imports: workspace packages first (`@pullquest/shared`), then external, then relative
- Next.js: server components default, `'use client'` only where needed
- Express: route → controller → service pattern
- Comments: explain WHY, not WHAT
- Error handling: explicit, never swallow errors silently
- Naming: descriptive in code, abbreviated in chat (caveman mode)
- Commits: conventional commits (`feat:`, `fix:`, `chore:`, `docs:`)

---

## Environment

- Copy `.env.example` → `.env` for local dev
- Redis: port 6379 (container: `pullquest-redis`)
- Neo4j: port 7687 bolt / 7474 browser (container: `pullquest-neo4j`)
- Supabase: managed, connect via SUPABASE_URL + keys
