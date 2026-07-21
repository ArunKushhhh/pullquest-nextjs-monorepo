# PullQuest — Skills.md

> Complete development workflow + skill catalog. Follow every time work is required.
> Skills invoked via Skill tool. KG maps features to skills: `pnpm kg:query skills "<Feature>"`.

---

## 1. The Workflow (Every Task)

```
┌─────────────────────────────────────────────────────┐
│ 0. ORIENT                                           │
│    Read Agents.md → role, voice                     │
│    Read Context.md + Memory.md of target dirs       │
│    pnpm kg:query status / todo — where we stand     │
│    Read relevant PRD.md section                     │
├─────────────────────────────────────────────────────┤
│ 1. PLAN                                             │
│    pnpm kg:query skills "<Feature>" — pick skills   │
│    pnpm kg:query deps "<Feature>" — check blockers  │
│    Complex/multi-file → plan mode first             │
├─────────────────────────────────────────────────────┤
│ 2. IMPLEMENT                                        │
│    Small testable chunks, workspace imports first   │
│    Patterns from Memory.md. Explicit error handling │
├─────────────────────────────────────────────────────┤
│ 3. VERIFY                                           │
│    pnpm test → pnpm build                           │
│    /verify skill for end-to-end behavior            │
│    Web changes → gstack /qa (browser QA)            │
├─────────────────────────────────────────────────────┤
│ 4. REVIEW                                           │
│    /code-review on diff (correctness)               │
│    Security-adjacent → security-review              │
├─────────────────────────────────────────────────────┤
│ 5. RECORD                                           │
│    Update Memory.md of touched dirs                 │
│    Update KG status: edit scripts/seed script,      │
│    re-run pnpm kg:seed (idempotent MERGE)           │
│    Conventional commit                              │
├─────────────────────────────────────────────────────┤
│ 6. SHIP                                             │
│    gstack /ship — tests, review, version, PR        │
└─────────────────────────────────────────────────────┘
```

---

## 2. Skill Catalog by Domain

### Database & Supabase
| Skill | When |
|---|---|
| `supabase:supabase` | Any Supabase task: Auth, RLS, Realtime, migrations, supabase-js |
| `supabase:supabase-postgres-best-practices` | Writing/optimizing Postgres queries, schema design |
| Supabase MCP (`mcp__supabase__*`) | Apply migrations, execute SQL, check advisors/logs, gen types |

### Frontend (Next.js)
| Skill | When |
|---|---|
| `vercel:nextjs` | App Router patterns, caching, data fetching |
| `vercel:react-best-practices` | Server/client component decisions, hooks |
| `vercel:shadcn` | shadcn/ui components |
| `frontend-design:frontend-design` | New pages/views needing design quality |
| `dataviz` | ANY chart, dashboard, stat tile (leaderboards, org dashboard) |
| `vercel:routing-middleware` | Routing, proxy.ts (Next.js 16 convention) |

### Backend (Express/Worker)
| Skill | When |
|---|---|
| `engineering-skills:senior-backend` | Service-layer design, API architecture |
| `engineering-advanced-skills:api-design-reviewer` | New/changed REST endpoints |
| `engineering-advanced-skills:database-designer` | Schema changes, migration design |
| `engineering-skills:stripe-integration-expert` | Stripe checkout, webhooks, subscriptions |
| `claude-api` | LLM integration work (Gemini AI layer) — read BEFORE touching AI code |

### Testing & QA
| Skill | When |
|---|---|
| `engineering-skills:tdd-guide` | New business logic (XP formula, resolution logic, Act reset) |
| `pw:generate` / `pw:fix` | Playwright E2E creation / flaky test diagnosis |
| gstack `/qa` | Browser QA of web app + fix found bugs |
| gstack `/qa-only` | Report-only QA pass |
| `verify` | End-to-end verification before committing nontrivial changes |

### Review & Security
| Skill | When |
|---|---|
| `code-review:code-review` | Every nontrivial diff |
| gstack `/review` | Pre-ship production-bug review |
| `security-review` | Auth, webhooks, payments, RLS changes |
| `engineering-skills:security-pen-testing` | Webhook signature verification, OAuth flows |
| gstack `/cso` | Full OWASP/STRIDE audit |

### Observability
| Skill | When |
|---|---|
| `sentry:sentry-instrument` | Adding Sentry SDK instrumentation |
| `sentry:sentry-debug-issue` | Debugging production Sentry issues |
| `grafana-mcp:grafana-mcp-tools` | Grafana dashboard management |
| `engineering-advanced-skills:observability-designer` | Metrics/alerting design |

### Debugging & Investigation
| Skill | When |
|---|---|
| gstack `/investigate` | Systematic root-cause debugging |
| `superpowers:systematic-debugging` | Scientific-method bug hunts |
| `engineering-advanced-skills:performance-profiler` | Perf issues (leaderboard latency etc.) |

### Workflow & Shipping
| Skill | When |
|---|---|
| gstack `/ship` | Full ship workflow: test, review, version, changelog, PR |
| gstack `/browse` | ALL web browsing (never mcp__claude-in-chrome__*) |
| `caveman:caveman` | Communication compression — active by default |
| `simplify` | Post-implementation cleanup pass |

---

## 3. Task-Type Playbooks

### New API endpoint
1. `kg:query skills` + `deps` → 2. PRD section → 3. route → controller → service pattern → 4. `engineering-advanced-skills:api-design-reviewer` → 5. Vitest unit tests → 6. update Memory.md + KG

### New frontend page
1. `frontend-design:frontend-design` (before writing UI) → 2. server components default → 3. shadcn/ui via `vercel:shadcn` → 4. charts → `dataviz` first → 5. gstack `/qa` in browser

### Schema change
1. `engineering-advanced-skills:database-designer` → 2. migration in `packages/database/supabase/migrations/` → 3. Supabase MCP `apply_migration` → 4. `get_advisors` security check → 5. `pnpm db:types` → 6. RLS policy update

### Worker job
1. Queue def in `apps/worker/src/queues/` → 2. processor in `jobs/` → 3. queue name must match `apps/api/src/config/queues.ts` → 4. TDD for job logic → 5. Prometheus metrics emit

### Bug fix
1. gstack `/investigate` or `superpowers:systematic-debugging` → 2. reproduce first → 3. fix → 4. regression test → 5. `/verify`

### Payment work
1. `engineering-skills:stripe-integration-expert` → 2. webhook signature verification mandatory → 3. `security-review` before merge

---

## 4. Rules

- KG is source of truth for build status. Query before work, update after.
- Never skip VERIFY step. Build + test must pass before commit.
- Security-touching diffs (auth/webhooks/payments/RLS) always get `security-review`.
- All web browsing through gstack `/browse`.
- Update Memory.md same commit as the change it documents.
