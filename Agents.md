# PullQuest — Agents.md

> Every agent MUST read this file at session start. Defines roles, voice, and workflow.
> Cursor project rules live in `.cursor/rules/pullquest.mdc` (always applied).

---

## 1. Agent Roles

| Agent | Domain | Responsibilities |
|---|---|---|
| **Architect** | System design | Schema changes, service boundaries, infra decisions, cross-cutting concerns, KG maintenance |
| **Frontend** | Next.js app | Pages, components, layouts, Tailwind styling, client-side state, Supabase SSR |
| **Backend** | Express API | Routes, controllers, services, middleware, webhook handlers, Supabase admin ops |
| **Worker** | BullMQ jobs | Job processors, queue definitions, cron schedules, retry logic |
| **DevOps** | Infrastructure | Docker, Prometheus, Grafana, CI/CD, deployment configs, Neo4j |
| **Database** | Data layer | Supabase schema, migrations, RLS policies, generated types, seed data |
| **QA** | Quality | Unit tests (Vitest), integration tests, E2E, build verification, error reproduction |
| **Research** | Exploration | Codebase analysis, dependency audits, PRD cross-referencing, KG queries |

### Role Selection
- Agent identifies own role based on task scope
- Cross-domain tasks → primary role leads, consults secondary
- Ambiguous scope → default to **Architect** for triage

---

## 2. Voice & Style — How Every Agent Must Code

### Communication (Caveman Mode)
```
Drop articles, filler, pleasantries, hedging.
Fragments OK. Abbreviate: DB/auth/config/req/res/fn/impl/pkg/dir/env/dep.
Use arrows: X → Y. One word when one word enough.
Pattern: [thing] [action] [reason]. [next step].
Technical terms exact. Code blocks unchanged.
```

### TypeScript Rules
```typescript
// ✅ DO
import { TierName, Difficulty } from '@pullquest/shared';  // workspace first
import { createClient } from '@supabase/supabase-js';       // external second
import { validateStake } from '../services/stake.service';   // relative last

// ✅ Explicit error handling
const { data, error } = await supabase.from('users').select();
if (error) throw new StakeError(`User fetch failed: ${error.message}`);

// ✅ Comments explain WHY
// Trust multiplier uses highest applicable bracket — PRD §2.4
const multiplier = getHighestTrustMultiplier(repoStats);

// ❌ DON'T
// Get the user data from the database  ← states the obvious
const data = await getUser(); // ← no error handling
```

### Naming Conventions
| Element | Convention | Example |
|---|---|---|
| Files (TS) | kebab-case | `stake-service.ts` |
| Classes | PascalCase | `StakeService` |
| Functions | camelCase | `calculateXP()` |
| Constants | UPPER_SNAKE | `MAX_DEBT_CEILING` |
| Types/Interfaces | PascalCase | `StakeInput`, `PROutcome` |
| Env vars | UPPER_SNAKE | `REDIS_URL` |
| DB columns | snake_case | `trust_multiplier` |

### Code Patterns
- **API:** route → controller (thin) → service (logic) → Supabase/Redis
- **Frontend:** server component (default) → client component (only for interactivity)
- **Worker:** queue definition → job processor → service call
- **Shared:** pure functions, zero runtime deps on Supabase/Redis/Express

---

## 3. How We Work

### Pre-Work (Every Task)
```
1. Read Agents.md (this file) — know your role
2. Cursor rules auto-loaded from .cursor/rules/pullquest.mdc
3. Read Skills.md — know the workflow
4. Read Context.md of target directory — know the landscape
5. Read Memory.md of target directory — know the preferences
6. Query Knowledge Graph — know what's built vs pending
   → pnpm kg:query status
   → pnpm kg:query skills "<FeatureName>"
7. Read relevant PRD section — know the requirements
```

### During Work
```
1. Implement in small, testable chunks
2. Follow established patterns from Memory.md
3. Import from workspace packages (@pullquest/shared, @pullquest/database)
4. Handle errors explicitly — never swallow
5. Add comments for non-obvious logic (explain WHY)
6. Test before committing
```

### Loop engineering (every feature)
```
After implementation, do not move to the next PRD feature until this loop closes:
1. Start infra (docker compose: redis, prometheus, grafana, neo4j) + pnpm dev
2. Open the relevant UI in the browser (gstack browse)
3. Exercise the user path; if data is blocking, fix it in Supabase
4. If the path fails, patch code and re-verify — repeat until the feature works
5. Only then update KG status to done and proceed
```

### Post-Work
```
1. Update Memory.md with new decisions/patterns/gotchas
2. Update Knowledge Graph node status if feature completed
3. Commit with conventional message:
   feat: add stake validation to API
   fix: correct XP calculation trust multiplier
   chore: update Docker config for Neo4j
   docs: add Context.md for worker directory
4. Verify build passes: pnpm build
```

### Commit Convention
```
feat(scope): description     # New feature
fix(scope): description      # Bug fix
chore(scope): description    # Maintenance
docs(scope): description     # Documentation
refactor(scope): description # Code restructure
test(scope): description     # Tests

Scopes: web, api, worker, shared, database, infra, scripts, docs
```

### Conflict Resolution
- PRD is source of truth for requirements
- Memory.md is source of truth for preferences
- Context.md is source of truth for directory purpose
- Knowledge Graph is source of truth for completion status
- When docs conflict → PRD wins
