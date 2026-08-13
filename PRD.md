# PullQuest – Updated Product Requirements Document (PRD)

> [!NOTE]
> Updated PRD incorporating: **Supabase** (retained for DB + Auth + Realtime), **GitHub App** (Vercel-style repo access), **Docker**, **Redis**, **Sentry**, **Prometheus**, **Grafana**, and **monorepo architecture**. MVP phasing removed — full platform built in one pass.

---

## Project Overview

**Project Name:** PullQuest

**What it is:** PullQuest is a GitHub-native seasonal reputation and incentive platform that measures and rewards high-quality open-source contributions through stake-backed participation, trust-weighted XP scoring, and transparent competitive rankings.

**Objective:** To build a credible, transparent, and merit-based ranking system for open-source development. To incentivize consistent, high-quality contributions through economic commitment and seasonal competition.

**Target Users:** Open-source contributors, maintainers, and organizations seeking structured credibility tracking and contributor evaluation. Also relevant for hiring-focused tech communities and developer clubs.

**Website Type:** SaaS-based web application built on top of GitHub.

**Platform:** Web application (responsive across devices).

---

## 1. User Roles and Permissions

| Role | Permissions / Capabilities |
|---|---|
| **Contributor** | Create/update profile, stake coins on issues, submit PRs, earn XP and tier rankings, view global & org leaderboards, purchase coin packs, track contribution history, view AI-generated summaries. |
| **Maintainer** | Create GitHub issues with mandatory stake label, define difficulty band (Easy/Medium/Hard), manually review PRs, complete structured evaluation questionnaire upon merge (mandatory), approve/reject PRs, respond to AI-generated summaries to correct inaccuracies, manage repository-level staking via issue labeling only. |
| **Organization** | Access org dashboard, view contributor rankings within org, monitor treasury balance and credibility score, manage subscription, analyze contributor metrics, oversee repository-level performance insights. |
| **Platform Admin** | Enforce one GitHub account per user, manage compliance and moderation, monitor economic stability (coin supply, treasury health, debt limits), execute Act resets (tier drop & coin reset), oversee trust multiplier calculations and system integrity. |

**Additional Rules:**
- GitHub OAuth is mandatory for all users.
- Stake label (`Stake-X`) is mandatory for issue participation.
- One GitHub account can be linked to only one PullQuest account.
- XP is system-calculated and cannot be overridden.
- Purchased coins are not diluted.
- All contribution history (stakes, PR outcomes, XP earned) is publicly visible for transparency.
- Org treasury cannot exceed the debt ceiling of −2000 coins.

---

## 2. Features & User Stories

### 2.1 Authentication & Identity

**Feature:**
- Mandatory GitHub OAuth login (via Supabase Auth).
- One GitHub account linked to one PullQuest account.
- **GitHub App installation** for repository access (Vercel-style):
  - Personal account: User installs PullQuest GitHub App and selects repos.
  - Organization: Org admin installs PullQuest GitHub App and selects repos.
  - No personal access tokens required.
- Roles inferred from GitHub App installation permissions.
- Public contributor profile showing full contribution history.

**User Stories:**
- As a user, I want to log in via GitHub so my identity is verified.
- As a contributor, I want my history publicly visible to build credibility.
- As a user, I want to grant repo access by installing a GitHub App (like Vercel) — not by pasting tokens.
- As an org admin, I want to control which org repos PullQuest can access.

---

### 2.2 Issue Staking System

**Feature:**
- Maintainer must add mandatory `Stake-X` label (defines exact coin requirement).
- Maintainer must assign difficulty (Easy / Medium / Hard).
- Stake must fall within allowed difficulty range.
- Contributor must stake exact amount before PR eligibility.
- Staked coins deducted immediately.
- Coins remain locked until PR resolution.
- Multiple contributors allowed per issue.

**User Stories:**
- As a maintainer, I want to define stake and difficulty to set participation rules.
- As a contributor, I want to commit coins before contributing to signal seriousness.
- As a contributor, I want locked coins to ensure fairness in competition.

---

### 2.3 PR Lifecycle & Resolution

**Feature:**
- Five possible PR outcomes: Unreviewed, Merged, Rejected, Multiple PRs Accepted, Closed without Merge.
- Resolution logic:
  - **Merged** → Stake returned + Bonus coins + XP awarded.
  - **Rejected** → 50% deduction → treasury (org). Triggered when a PR is closed unmerged and the latest review submitted is `changes_requested`.
  - **Multiple Accepted** → Equal reward & XP distribution.
  - **Closed without Merge** → Full refund + 30% treasury compensation (org). Triggered when a PR is closed unmerged without any `changes_requested` reviews.
  - **Unreviewed** → Full refund.

**User Stories:**
- As a contributor, I want clear financial outcomes for each PR result.
- As an organization, I want deductions to strengthen treasury balance.

---

### 2.4 XP Scoring Engine

**Feature:**
- Difficulty XP caps:
  - Easy → 40
  - Medium → 70
  - Hard → 100
- Trust multiplier applied (highest applicable):
  - 1–5 members → 0.5×
  - 5–20 members → 0.8×
  - 100+ stars → 1×
  - 1k+ stars → 1.5×
- **XP Formula:** `Final XP = Cap × (Evaluation Score / 5) × Trust Multiplier`
  - Maintainer evaluation mandatory (MCQ + sliders).
  - XP calculation automated.
  - No manual override.
  - No negative XP.

**User Stories:**
- As a contributor, I want scoring to be formula-based and tamper-proof.
- As a maintainer, I want structured evaluation to reduce bias.

---

### 2.5 Seasonal System (Acts)

**Feature:**
- 45-day cycle (Act).
- All users start Act as Unranked.
- At least one merged PR required to activate tier.
- Act end rules:
  - Drop exactly one tier.
  - XP resets to midpoint of lower tier.
  - Initiator resets to 50% of their XP.
  - Earned/minted coins reset to base tier coins.
  - Purchased coins unaffected.

**User Stories:**
- As a contributor, I want seasonal resets to keep rankings competitive.
- As a contributor, I want to re-earn my tier each Act.

---

### 2.6 Tiers & Leaderboards

**Feature:**

| Tier | XP Range |
|---|---|
| Initiator | 0–100 |
| Commiter | 100–500 |
| Contributor | 500–1500 |
| Merge Master | 1500–3000 |
| Architect | 3000–5000 |
| Open Source Legend | 5000+ |

- Tier progression is automatic when XP crosses thresholds.
- **Global leaderboard** ranks users based on total global XP.
- **Organization leaderboard** ranks users based on XP earned within that organization.
- Users remain Unranked at the start of every Act and become visible only after at least one merged PR in that Act.
- **Redis-backed leaderboards** using sorted sets for real-time ranking with O(log N) updates.
- Leaderboard caching with configurable TTL for high-traffic reads.

**User Stories:**
- As a contributor, I want to see my global and org ranking.
- As an organization, I want to identify top contributors.

---

### 2.7 Coin Economy

**Feature:**
- 150 coins at signup.
- 100 coins monthly.
- Coin bundles purchasable once per Act.
- Purchased coins never diluted.
- Coins do not affect XP.
- Coins are not ranked publicly.
- **Organization Treasury:**
  - Receives rejected stake deductions.
  - Pays 30% compensation on closed issues.
  - Debt ceiling: −2000.
  - Staking disabled beyond debt limit.

**User Stories:**
- As a contributor, I want to buy coins if I need more participation.
- As an organization, I want treasury health to impact credibility.

---

### 2.8 Organization Dashboard

**Feature:**
- View contributor rankings within organization.
- Monitor treasury balance (internal).
- View credibility score (public).
- Manage subscription.

**User Stories:**
- As an org admin, I want performance visibility across contributors.
- As an org admin, I want treasury monitoring for sustainability.

---

### 2.9 Credibility Score

**Feature:**
- Score range: 0–100.
- Based on:
  - Treasury health
  - Contributor count
  - Repository count
  - Activity consistency
- Raw treasury not publicly visible.

**User Stories:**
- As a contributor, I want to evaluate org credibility before contributing.

---

### 2.10 AI Assistance Layer

**Feature:**
- AI-generated issue summary.
- AI-generated PR structural summary.
- Public AI comment under `pullquestai`.
- Maintainer correction loop.
- AI does not assign XP.

**User Stories:**
- As a contributor, I want faster repo understanding.
- As a maintainer, I want reduced review workload.

---

## 3. GitHub Integration Architecture

PullQuest requires **two separate GitHub integrations** working together:

### 3.1 GitHub OAuth App (Authentication Only)

**Purpose:** User login and signup via Supabase Auth.

| Property | Value |
|---|---|
| **Managed by** | Supabase Auth (built-in GitHub provider) |
| **OAuth Scopes** | `read:user`, `user:email` |
| **What it provides** | User identity: GitHub ID, username, email, avatar |
| **What it does NOT provide** | Repository access, org access, webhook events |

### 3.2 GitHub App (Repository & Webhook Access)

**Purpose:** Access repositories, receive webhook events, post comments — installed per-user or per-org (Vercel-style).

| Property | Value |
|---|---|
| **App Name** | PullQuest |
| **Permissions (Repository)** | `issues: read+write`, `pull_requests: read+write`, `contents: read`, `metadata: read` |
| **Permissions (Organization)** | `members: read` |
| **Webhook Events** | `issues`, `issue_comment`, `pull_request`, `pull_request_review`, `installation`, `installation_repositories` |
| **Setup URL** | Redirects to PullQuest dashboard after installation |
| **Installation Flow** | User/Org admin selects "All repositories" or specific repos |

### 3.3 How They Work Together

```
┌─────────────────────────────────────────────────────────────┐
│                     USER JOURNEY                            │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  1. SIGN UP / LOGIN                                         │
│     └─► GitHub OAuth App (via Supabase Auth)                │
│         • User clicks "Sign in with GitHub"                 │
│         • Supabase handles OAuth flow                       │
│         • PullQuest receives: github_id, username,          │
│           email, avatar                                     │
│         • User row created in Supabase `users` table        │
│         • 150 signup coins credited                         │
│                                                             │
│  2. CONNECT REPOSITORIES                                    │
│     └─► GitHub App Installation                             │
│         • User clicks "Connect Repositories" on dashboard   │
│         • Redirected to:                                    │
│           github.com/apps/pullquest/installations/new       │
│         • User selects account (personal or org)            │
│         • User selects repos: "All" or specific             │
│         • GitHub sends `installation` webhook to PullQuest  │
│         • PullQuest stores installation_id + repos          │
│         • Webhooks now flow for installed repos             │
│                                                             │
│  3. ORGANIZATION ACCESS                                     │
│     └─► GitHub App Installation (org-level)                 │
│         • User switches to an org in PullQuest sidebar      │
│         • If GitHub App not installed on org:               │
│           "PullQuest is not installed on <OrgName>"         │
│           [Request Installation] button                     │
│         • Org admin approves installation                   │
│         • Org repos + webhooks now accessible               │
│                                                             │
│  4. ONGOING WEBHOOK FLOW                                    │
│     └─► Automatic via GitHub App                            │
│         • Issue created with Stake-X label → webhook fires  │
│         • PR opened/merged/closed → webhook fires           │
│         • PullQuest processes events in real-time           │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 3.4 Data Stored Per Installation

| Field | Description |
|---|---|
| `installation_id` | GitHub App installation ID |
| `account_type` | `User` or `Organization` |
| `account_id` | GitHub account ID |
| `account_login` | GitHub username or org name |
| `repositories` | List of repo IDs and names granted |
| `permissions` | Granted permission set |
| `installed_by` | PullQuest user ID who triggered installation |
| `installed_at` | Timestamp |

---

## 4. Workflows

### 4.1 Contributor Workflow

1. **Authentication** — Log in via GitHub OAuth (Supabase Auth). Account initialized with 150 coins.
2. **Connect Repos** — Install PullQuest GitHub App on personal account. Select repositories to grant access.
3. **Discover Issues** — Browse Home (staked issues) and Feed (stakable issues across organizations). Each issue displays: stake amount, difficulty band, org credibility score, trust multiplier.
4. **Stake on Issue** — Select issue. System validates: valid `Stake-X` label, stake within difficulty band, sufficient coins. Exact stake deducted immediately. Coins marked as locked. Contributor registered as participant.
5. **Work & Submit PR** — Work on repository via GitHub. Submit PR through GitHub. PullQuest links PR to staked issue automatically via webhook.
6. **PR Review Phase** — Maintainer reviews PR manually. AI generates PR summary. Maintainer may respond to AI correction thread.
7. **Resolution** — System detects PR outcome via webhook (Merged / Rejected / Multiple PRs Accepted / Closed without Merge / Unreviewed). Financial + XP logic applied automatically.
8. **XP Assignment (if merged)** — Maintainer completes structured evaluation (mandatory). XP calculated: `Cap × Evaluation × Trust Multiplier`. XP added to global score. Leaderboard updated in Redis.
9. **Tier Activation** — If first merged PR of Act → Tier activated. Contributor appears on leaderboard.

### 4.2 Maintainer Workflow

1. **Issue Creation** — Create GitHub issue. Add `Stake-X` label and difficulty band. GitHub App webhook detects and registers issue in PullQuest.
2. **AI Issue Summary** — AI generates repo structure overview, impacted modules, conventions summary. Comment posted under `pullquestai` bot account. Maintainer verifies or corrects.
3. **PR Review** — Reviews PR manually. AI generates structural summary. Maintainer approves or rejects.
4. **Merge Evaluation** — Completes structured questionnaire. Cannot merge without evaluation submission. XP computed automatically.

### 4.3 Organization Workflow

1. **Onboarding** — Org admin installs PullQuest GitHub App on org. Selects repos. 10-day free trial. Subscription required post-trial.
2. **Treasury Management** — Treasury receives stake deductions. Treasury pays 30% compensation on closed issues. Debt ceiling monitored (−2000). Staking disabled if breached.
3. **Dashboard Monitoring** — Contributor rankings within org. Credibility score. Treasury health (internal). Participation metrics.

### 4.4 Seasonal Workflow (Act Lifecycle)

**Act Start:**
- All users marked Unranked.
- XP retained (compressed).
- Coins reset to base tier coins.
- Purchased coins unaffected.

**During Act:**
- Contributors stake, submit PRs.
- First merged PR activates tier.
- Rankings dynamic (Redis sorted sets updated in real-time).

**Act End (BullMQ scheduled job executes automatically):**
- Drop exactly one tier.
- XP reset to midpoint of lower tier.
- Initiator → 50% XP.
- Earned coins reset to base tier amount.
- Purchased coins remain unchanged.
- Leaderboards archived.
- Metrics emitted to Prometheus for Act summary.
- Sentry breadcrumb logged for audit trail.

### 4.5 Economic Flow Summary

```
Contributor → Stakes coins
Rejected stake → Org treasury
Closed issue → Treasury compensation paid
Merged PR → Bonus coins minted
Monthly → 100 coins minted (BullMQ cron job)
Act reset → Earned coins compressed (BullMQ scheduled job)
```

---

## 5. Tech Stack

### Frontend
- **Next.js** (React framework with SSR/SSG)
- **TypeScript**
- **Tailwind CSS v4**
- **shadcn/ui** (component library)
- **Sentry Browser SDK** (client-side error tracking)

### Backend — Supabase (Managed)
- **PostgreSQL** — Primary database (hosted by Supabase)
- **Supabase Auth** — GitHub OAuth login, session management, JWT tokens
- **Supabase Realtime** — Live leaderboard updates, stake notifications
- **Row Level Security (RLS)** — Database-level access control policies

### Backend — Custom API Server
- **Node.js** with **Express.js** (REST API)
- **TypeScript**
- **Supabase JS Client** (`@supabase/supabase-js`) — Connects to Supabase from server with service role key
- **Redis** — Caching, leaderboard sorted sets, rate limiting, session augmentation
- **BullMQ** — Job queues powered by Redis (Act resets, coin minting, webhook processing, AI summaries)
- **Sentry Node SDK** — Error tracking, performance monitoring, distributed tracing
- **prom-client** — Prometheus metrics collection

### Infrastructure & DevOps
- **Docker** + **Docker Compose** — Containerization of custom services (API, Worker, Redis, Prometheus, Grafana)
- **Prometheus** — Metrics scraping
- **Grafana** — Dashboards and alerting

### Integrations
- **GitHub OAuth App** — Authentication (via Supabase Auth)
- **GitHub App** — Repository access, webhooks, bot comments (Vercel-style installation)
- **Stripe** — Payments (coin purchases, org subscriptions)
- **Google Gemini** — AI layer (issue/PR summaries)

### Monorepo Tooling
- **pnpm workspaces** — Dependency management
- **Turborepo** — Build orchestration, caching

---

## 6. Backend Architecture

### 6.1 System Architecture Overview

```
┌──────────────────────────────────────────────────────────────────────┐
│                          EXTERNAL SERVICES                           │
│   ┌───────────┐    ┌───────────┐    ┌───────────┐    ┌───────────┐  │
│   │  GitHub    │    │  Stripe   │    │  Gemini   │    │  Sentry   │  │
│   │  (App +   │    │ (Payments)│    │  (AI)     │    │ (Errors)  │  │
│   │   OAuth)  │    │           │    │           │    │           │  │
│   └─────┬─────┘    └─────┬─────┘    └─────┬─────┘    └─────┬─────┘  │
└─────────┼────────────────┼────────────────┼────────────────┼─────────┘
          │                │                │                │
          ▼                ▼                ▼                ▼
┌──────────────────────────────────────────────────────────────────────┐
│                        PULLQUEST BACKEND                             │
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────────┐ │
│  │                    EXPRESS.JS API SERVER                         │ │
│  │                                                                 │ │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌───────────────┐  │ │
│  │  │ Auth     │  │ Webhook  │  │ REST API │  │ Metrics       │  │ │
│  │  │ Middlware│  │ Handlers │  │ Routes   │  │ /metrics      │  │ │
│  │  └────┬─────┘  └────┬─────┘  └────┬─────┘  └───────┬───────┘  │ │
│  │       │              │             │                │          │ │
│  │       ▼              ▼             ▼                ▼          │ │
│  │  ┌─────────────────────────────────────────────────────────┐   │ │
│  │  │                   SERVICE LAYER                         │   │ │
│  │  │                                                         │   │ │
│  │  │  AuthService  StakeService  XPService  TreasuryService  │   │ │
│  │  │  PRService    LeaderboardService    CoinService         │   │ │
│  │  │  ActService   OrgService    AIService    WebhookService │   │ │
│  │  └───────┬──────────────┬──────────────┬───────────────────┘   │ │
│  │          │              │              │                       │ │
│  └──────────┼──────────────┼──────────────┼───────────────────────┘ │
│             │              │              │                         │
│             ▼              ▼              ▼                         │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────┐              │
│  │  Supabase   │  │    Redis     │  │   BullMQ     │              │
│  │  (Postgres  │  │  (Cache +   │  │  (Job Queue) │              │
│  │   + Auth +  │  │  Leaderboard │  │              │              │
│  │   Realtime) │  │  + Rate Lim) │  │              │              │
│  └─────────────┘  └──────────────┘  └──────┬───────┘              │
│                                            │                       │
│  ┌─────────────────────────────────────────┼───────────────────┐   │
│  │                   WORKER SERVICE        │                   │   │
│  │                                         ▼                   │   │
│  │  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌──────────┐│   │
│  │  │ Act Reset  │ │ Monthly    │ │ Webhook    │ │ AI       ││   │
│  │  │ Job        │ │ Coin Mint  │ │ Processor  │ │ Summary  ││   │
│  │  └────────────┘ └────────────┘ └────────────┘ └──────────┘│   │
│  └────────────────────────────────────────────────────────────┘   │
│                                                                    │
│  ┌───────────┐  ┌───────────┐                                     │
│  │Prometheus │  │  Grafana  │                                     │
│  │  :9090    │  │  :3002    │                                     │
│  └───────────┘  └───────────┘                                     │
└──────────────────────────────────────────────────────────────────────┘
```

### 6.2 Supabase Layer (Managed)

Supabase is the managed data layer. The custom API server connects to it using the **service role key** for admin operations and the **anon key** for client-validated operations.

| Responsibility | How |
|---|---|
| **User authentication** | Supabase Auth with GitHub OAuth provider. Issues JWTs. Frontend uses `@supabase/ssr` for session handling. |
| **Database** | PostgreSQL with tables for: users, installations, repositories, issues, stakes, pull_requests, evaluations, xp_logs, coins, transactions, organizations, treasuries, acts, leaderboard_archives. |
| **Row Level Security** | RLS policies enforce: users can only read/write own data, public profiles readable by all, org data readable by org members, treasury balance readable by org admins only. |
| **Realtime** | Supabase Realtime channels for: leaderboard position changes, stake notifications, PR status updates. |

### 6.3 Express.js API Server

The custom API server handles all business logic that is too complex for Supabase Edge Functions:

#### Route Structure

| Route Group | Endpoints | Purpose |
|---|---|---|
| `POST /api/webhooks/github` | — | GitHub App webhook receiver (issues, PRs, installations) |
| `POST /api/webhooks/stripe` | — | Stripe webhook receiver (payments, subscriptions) |
| `GET /api/auth/me` | — | Get current user profile (validates Supabase JWT) |
| `GET /api/issues` | `?org=&difficulty=&status=` | List stakable issues (with filters) |
| `POST /api/issues/:id/stake` | `{ amount }` | Stake coins on an issue |
| `GET /api/stakes/mine` | — | List user's active stakes |
| `POST /api/prs/:id/evaluate` | `{ evaluation }` | Submit maintainer evaluation |
| `GET /api/leaderboard/global` | `?page=&limit=` | Global leaderboard (Redis-backed) |
| `GET /api/leaderboard/org/:orgId` | `?page=&limit=` | Org leaderboard (Redis-backed) |
| `GET /api/users/:userId/profile` | — | Public contributor profile |
| `GET /api/users/:userId/history` | `?page=&limit=` | Contribution/PR history |
| `GET /api/users/:userId/stakes` | `?page=&limit=` | User's personal stakes history (auth-protected) |
| `POST /api/coins/create-checkout-session` | `{ bundleId }` | Initiate real Stripe Checkout Session for purchasing coins |
| `GET /api/coins/purchase-history` | — | Get coin purchase transaction history |
| `GET /api/orgs/:orgId/dashboard` | — | Org dashboard data |
| `GET /api/orgs/:orgId/treasury` | — | Treasury balance (org admins only) |
| `POST /api/orgs/:orgId/subscribe` | `{ planId }` | Initiate Stripe org subscription |
| `GET /api/installations/status` | — | GitHub App installation status for current user |
| `GET /api/acts/current` | — | Current Act info (start date, days remaining) |
| `GET /api/metrics` | — | Prometheus metrics endpoint |
| `GET /api/health` | — | Health check (used by Docker, Prometheus) |

#### Middleware Stack

```
Request
  │
  ├─► Sentry request handler (tracing)
  ├─► CORS
  ├─► Rate limiter (Redis-backed sliding window)
  ├─► JSON body parser
  ├─► Prometheus request counter + histogram
  ├─► Auth middleware (validates Supabase JWT, attaches user)
  ├─► Route handler
  ├─► Sentry error handler
  └─► Global error handler (formats error, logs to Sentry)
```

### 6.4 Service Layer

Each service encapsulates a domain of business logic:

| Service | Responsibilities |
|---|---|
| **AuthService** | Validate Supabase JWTs, resolve GitHub user to PullQuest user, check one-account-per-GitHub enforcement. |
| **WebhookService** | Verify GitHub webhook signatures, parse events, dispatch to appropriate handlers. Route `installation` events to InstallationService, `issues` to IssueService, `pull_request` to PRService. |
| **InstallationService** | Handle GitHub App install/uninstall events. Store installation_id, repos, permissions. Sync repo list on `installation_repositories` events. |
| **IssueService** | Detect `Stake-X` label on issues. Parse difficulty band. Register stakable issues. Validate stake parameters. |
| **StakeService** | Validate coin balance, lock coins, record stake, register contributor as participant. Handle multi-contributor stakes per issue. |
| **PRService** | Link PRs to staked issues. Detect PR outcome (merge/reject/close). Execute resolution logic (refunds, deductions, bonus). Enqueue XP calculation on merge. |
| **XPService** | Calculate XP: `Cap × (Evaluation / 5) × Trust Multiplier`. Fetch repo stats for trust multiplier. Record XP log. Update Redis leaderboard sorted set. Trigger tier recalculation. |
| **EvaluationService** | Serve structured questionnaire. Validate maintainer responses. Calculate evaluation score (0–5). Block merge without evaluation. |
| **LeaderboardService** | Redis sorted set operations: `ZADD`, `ZREVRANGE`, `ZRANK`, `ZSCORE`. Maintain global and per-org sets. Cache paginated results with TTL. Publish Realtime updates via Supabase. |
| **CoinService** | Credit signup coins, monthly minting, merge bonuses. Deduct stakes. Handle Stripe purchase flows. Track purchased vs earned coins separately. |
| **TreasuryService** | Credit rejected stake deductions. Debit closed-issue compensation. Monitor debt ceiling (−2000). Disable staking when breached. Calculate treasury health for credibility. |
| **ActService** | Track current Act (start/end dates). Execute Act reset: tier drop, XP compression, coin reset. Archive leaderboards. Enqueued as BullMQ scheduled job. |
| **OrgService** | Manage org onboarding, trial tracking, subscription status. Calculate credibility score (0–100). Aggregate org metrics. |
| **AIService** | Generate issue/PR summaries via Gemini. Post comments via GitHub App as `pullquestai`. Handle maintainer correction loop. AI never assigns XP. |
| **CredibilityService** | Calculate org credibility score (0–100) based on: treasury health, contributor count, repository count, activity consistency. Cache in Redis with TTL. |

### 6.5 Redis Usage

| Use Case | Redis Data Structure | Key Pattern | Details |
|---|---|---|---|
| **Global Leaderboard** | Sorted Set | `leaderboard:global:act:{actId}` | Score = XP. Members = user IDs. `ZADD`, `ZREVRANGE`, `ZRANK`. |
| **Org Leaderboard** | Sorted Set | `leaderboard:org:{orgId}:act:{actId}` | Score = org-specific XP. |
| **User Profile Cache** | Hash | `cache:user:{userId}` | Cached user profile data. TTL: 5 min. |
| **Org Credibility Cache** | String | `cache:credibility:{orgId}` | Cached score (0–100). TTL: 15 min. |
| **Issue Metadata Cache** | Hash | `cache:issue:{issueId}` | Stake amount, difficulty, participants. TTL: 2 min. |
| **Rate Limiting** | String (counter) | `ratelimit:{ip}:{window}` | Sliding window counter. 100 req/min default. |
| **Session Augmentation** | Hash | `session:{userId}` | Additional session data beyond Supabase JWT (active stakes, current tier). TTL: 30 min. |
| **BullMQ Queues** | Lists + Sets (BullMQ internal) | `bull:{queueName}:*` | Job queues for async processing. |

### 6.6 BullMQ Worker Architecture

The worker service processes background jobs from Redis-backed queues:

| Queue | Job Type | Trigger | Logic |
|---|---|---|---|
| `webhook-processing` | `process-github-event` | GitHub webhook received by API | Parse event, execute business logic (issue registration, PR resolution, installation sync). Decouples webhook response from processing. |
| `xp-calculation` | `calculate-xp` | Maintainer submits evaluation | Compute XP, update user, update Redis leaderboard, emit Supabase Realtime event. |
| `coin-minting` | `monthly-mint` | BullMQ cron: `0 0 1 * *` | Credit 100 coins to all active users. |
| `act-management` | `act-reset` | BullMQ cron: every 45 days | Execute full Act reset: tier drop, XP compression, coin reset, leaderboard archive. |
| `ai-summary` | `generate-issue-summary` | New stakable issue detected | Call Gemini API, generate summary, post comment via GitHub App. |
| `ai-summary` | `generate-pr-summary` | PR opened on staked issue | Call Gemini API, generate structural review, post comment. |
| `treasury-audit` | `check-debt-ceiling` | After each treasury transaction | Check if org has breached −2000 ceiling, disable staking if so. |

---

## 7. Detailed Application Flows

### 7.1 Authentication Flow

```
┌──────────┐       ┌──────────────┐       ┌──────────┐       ┌──────────┐
│  Browser │       │  Next.js App │       │ Supabase │       │  GitHub  │
│          │       │  (Frontend)  │       │   Auth   │       │  OAuth   │
└────┬─────┘       └──────┬───────┘       └────┬─────┘       └────┬─────┘
     │   Click "Sign in    │                    │                   │
     │   with GitHub"      │                    │                   │
     ├────────────────────►│                    │                   │
     │                     │  signInWithOAuth   │                   │
     │                     │  (provider:github) │                   │
     │                     ├───────────────────►│                   │
     │                     │                    │  Redirect to      │
     │◄─────────────────── │◄───────────────────┤  github.com/     │
     │  302 Redirect       │                    │  login/oauth/    │
     │                     │                    │  authorize       │
     ├─────────────────────────────────────────────────────────────►│
     │                     │                    │                   │
     │     User authorizes PullQuest app        │                   │
     │◄────────────────────────────────────────────────────────────┤
     │  302 Redirect with code                  │                   │
     ├────────────────────►│                    │                   │
     │                     ├───────────────────►│                   │
     │                     │  Exchange code     │                   │
     │                     │  for session       │                   │
     │                     │◄───────────────────┤                   │
     │                     │  JWT + user data   │                   │
     │                     │                    │                   │
     │                     │ ┌────────────────────────────────────┐ │
     │                     │ │ POST /api/auth/callback            │ │
     │                     │ │ • Check if PullQuest user exists   │ │
     │                     │ │ • If new: create user, credit 150  │ │
     │                     │ │   coins, assign to current Act     │ │
     │                     │ │ • If existing: update last_login   │ │
     │                     │ └────────────────────────────────────┘ │
     │                     │                    │                   │
     │  Dashboard loaded   │                    │                   │
     │◄────────────────────┤                    │                   │
     │                     │                    │                   │
```

### 7.2 GitHub App Installation Flow

```
┌──────────┐    ┌──────────────┐    ┌──────────┐    ┌────────────┐
│  Browser │    │  Next.js App │    │  GitHub  │    │ Express API│
└────┬─────┘    └──────┬───────┘    └────┬─────┘    └─────┬──────┘
     │                 │                  │                 │
     │  Click "Connect │                  │                 │
     │  Repositories"  │                  │                 │
     ├────────────────►│                  │                 │
     │                 │                  │                 │
     │  Redirect to    │                  │                 │
     │◄────────────────┤                  │                 │
     │  github.com/apps/pullquest/        │                 │
     │  installations/new                 │                 │
     ├───────────────────────────────────►│                 │
     │                 │                  │                 │
     │  User selects account              │                 │
     │  User selects repos                │                 │
     │  User clicks "Install"            │                 │
     │◄──────────────────────────────────┤                 │
     │  Redirect to Setup URL            │                 │
     │  (PullQuest dashboard)            │                 │
     │                 │                  │                 │
     │                 │                  │  Webhook:       │
     │                 │                  │  installation   │
     │                 │                  │  (created)      │
     │                 │                  ├────────────────►│
     │                 │                  │                 │
     │                 │                  │  ┌─────────────────────────┐
     │                 │                  │  │ WebhookService:         │
     │                 │                  │  │ • Verify signature      │
     │                 │                  │  │ • Store installation_id │
     │                 │                  │  │ • Store granted repos   │
     │                 │                  │  │ • Link to PullQuest     │
     │                 │                  │  │   user account          │
     │                 │                  │  │ • Fetch repo metadata   │
     │                 │                  │  │   (stars, members) for  │
     │                 │                  │  │   trust multiplier      │
     │                 │                  │  └─────────────────────────┘
     │                 │                  │                 │
     │  Dashboard shows│                  │                 │
     │  connected repos│                  │                 │
     │◄────────────────┤                  │                 │
```

### 7.3 Issue Staking Flow

```
┌──────────┐    ┌──────────────┐    ┌────────────┐    ┌────────┐    ┌──────────┐
│Maintainer│    │    GitHub    │    │ Express API│    │ Redis  │    │ Supabase │
└────┬─────┘    └──────┬───────┘    └─────┬──────┘    └───┬────┘    └────┬─────┘
     │                 │                   │               │              │
     │  Create issue   │                   │               │              │
     │  + Stake-50     │                   │               │              │
     │  + Difficulty:  │                   │               │              │
     │    Medium       │                   │               │              │
     ├────────────────►│                   │               │              │
     │                 │                   │               │              │
     │                 │  Webhook: issues  │               │              │
     │                 │  (labeled)        │               │              │
     │                 ├──────────────────►│               │              │
     │                 │                   │               │              │
     │                 │    ┌──────────────────────────────────────────┐  │
     │                 │    │ IssueService:                            │  │
     │                 │    │ 1. Parse Stake-X label → amount = 50    │  │
     │                 │    │ 2. Parse difficulty → Medium             │  │
     │                 │    │ 3. Validate: 30 ≤ 50 ≤ 80 (Medium band)│  │
     │                 │    │ 4. Fetch repo stats (stars, members)     │  │
     │                 │    │    → trust_multiplier = 0.8              │  │
     │                 │    │ 5. Insert issue record in Supabase      │  │
     │                 │    │ 6. Cache issue metadata in Redis        │  │
     │                 │    │ 7. Enqueue AI summary job               │  │
     │                 │    └──────────────────────────────────────────┘  │
     │                 │                   │               │              │
     │                 │                   │  Cache issue   │              │
     │                 │                   ├──────────────►│              │
     │                 │                   │               │              │
     │                 │                   │  Insert issue  │              │
     │                 │                   ├──────────────────────────────►│
     │                 │                   │               │              │

--- CONTRIBUTOR STAKES ---

┌────────────┐    ┌──────────────┐    ┌────────────┐    ┌────────┐    ┌──────────┐
│Contributor │    │  Next.js App │    │ Express API│    │ Redis  │    │ Supabase │
└─────┬──────┘    └──────┬───────┘    └─────┬──────┘    └───┬────┘    └────┬─────┘
      │                  │                   │               │              │
      │  Click "Stake"   │                   │               │              │
      │  on issue        │                   │               │              │
      ├─────────────────►│                   │               │              │
      │                  │ POST /api/issues  │               │              │
      │                  │ /:id/stake        │               │              │
      │                  │ { amount: 50 }    │               │              │
      │                  ├──────────────────►│               │              │
      │                  │                   │               │              │
      │                  │    ┌──────────────────────────────────────────┐  │
      │                  │    │ StakeService:                            │  │
      │                  │    │ 1. Validate issue exists + stakable     │  │
      │                  │    │ 2. Validate amount matches Stake-X      │  │
      │                  │    │ 3. Check user coin balance ≥ 50        │  │
      │                  │    │ 4. BEGIN TRANSACTION:                    │  │
      │                  │    │    a. Deduct 50 coins from user         │  │
      │                  │    │    b. Create locked_stake record        │  │
      │                  │    │    c. Add user as issue participant     │  │
      │                  │    │    d. Log transaction                   │  │
      │                  │    │ 5. COMMIT                               │  │
      │                  │    │ 6. Update session cache in Redis        │  │
      │                  │    │ 7. Emit Prometheus: stakes_total++     │  │
      │                  │    └──────────────────────────────────────────┘  │
      │                  │                   │               │              │
      │  "Staked          │                   │               │              │
      │  successfully"   │                   │               │              │
      │◄─────────────────┤                   │               │              │
```

### 7.4 PR Lifecycle & Resolution Flow

```
┌────────────┐    ┌──────────┐    ┌────────────┐    ┌────────┐    ┌──────────┐
│Contributor │    │  GitHub  │    │ Express API│    │ Redis  │    │ Supabase │
└─────┬──────┘    └────┬─────┘    └─────┬──────┘    └───┬────┘    └────┬─────┘
      │                │                 │               │              │
      │  Open PR       │                 │               │              │
      │  (linked to    │                 │               │              │
      │   staked issue)│                 │               │              │
      ├───────────────►│                 │               │              │
      │                │  Webhook:       │               │              │
      │                │  pull_request   │               │              │
      │                │  (opened)       │               │              │
      │                ├────────────────►│               │              │
      │                │                 │               │              │
      │                │   ┌─────────────────────────────────────────┐  │
      │                │   │ PRService:                              │  │
      │                │   │ 1. Match PR to staked issue via refs   │  │
      │                │   │ 2. Verify contributor has active stake │  │
      │                │   │ 3. Create PR record, status=OPEN      │  │
      │                │   │ 4. Enqueue AI PR summary job           │  │
      │                │   └─────────────────────────────────────────┘  │

--- ON MERGE ---

      │                │  Webhook:       │               │              │
      │                │  pull_request   │               │              │
      │                │  (closed,       │               │              │
      │                │   merged=true)  │               │              │
      │                ├────────────────►│               │              │
      │                │                 │               │              │
      │                │   ┌─────────────────────────────────────────┐  │
      │                │   │ PRService (merged):                     │  │
      │                │   │ 1. Update PR status → MERGED            │  │
      │                │   │ 2. Return staked coins to contributor   │  │
      │                │   │ 3. Mint bonus coins to contributor      │  │
      │                │   │ 4. Mark: AWAITING_EVALUATION            │  │
      │                │   │ 5. Notify maintainer: evaluation needed │  │
      │                │   │ 6. Emit Prometheus: pr_outcomes_total   │  │
      │                │   │    {type="merged"}++                    │  │
      │                │   └─────────────────────────────────────────┘  │

--- MAINTAINER EVALUATES ---

┌──────────┐    ┌──────────────┐    ┌────────────┐    ┌────────┐    ┌──────────┐
│Maintainer│    │  Next.js App │    │ Express API│    │ Redis  │    │ Supabase │
└────┬─────┘    └──────┬───────┘    └─────┬──────┘    └───┬────┘    └────┬─────┘
     │                 │                   │               │              │
     │  Submit         │                   │               │              │
     │  evaluation     │                   │               │              │
     │  (MCQ+sliders)  │                   │               │              │
     ├────────────────►│                   │               │              │
     │                 │ POST /api/prs/    │               │              │
     │                 │ :id/evaluate      │               │              │
     │                 ├──────────────────►│               │              │
     │                 │                   │               │              │
     │                 │   ┌──────────────────────────────────────────┐  │
     │                 │   │ XPService:                               │  │
     │                 │   │ 1. Evaluation score = 4.2 / 5           │  │
     │                 │   │ 2. Difficulty = Medium → Cap = 70       │  │
     │                 │   │ 3. Trust multiplier = 0.8               │  │
     │                 │   │ 4. Final XP = 70 × (4.2/5) × 0.8       │  │
     │                 │   │            = 70 × 0.84 × 0.8            │  │
     │                 │   │            = 47.04 → 47 XP              │  │
     │                 │   │ 5. Update user.global_xp += 47          │  │
     │                 │   │ 6. ZADD leaderboard:global 47 user_id   │  │
     │                 │   │ 7. ZADD leaderboard:org:{orgId} 47 uid  │  │
     │                 │   │ 8. Check tier threshold crossing         │  │
     │                 │   │ 9. If first merged PR of Act →           │  │
     │                 │   │    activate tier, show on leaderboard    │  │
     │                 │   │ 10. Emit Prometheus: xp_awarded_total   │  │
     │                 │   │ 11. Supabase Realtime: leaderboard      │  │
     │                 │   │     position change event                │  │
     │                 │   └──────────────────────────────────────────┘  │

--- ON REJECT ---

     │                 │   ┌──────────────────────────────────────────┐  │
     │                 │   │ PRService (rejected):                    │  │
     │                 │   │ 1. Update PR status → REJECTED           │  │
     │                 │   │ 2. Deduct 50% of stake (25 coins)       │  │
     │                 │   │ 3. Credit 25 coins to org treasury      │  │
     │                 │   │ 4. Refund remaining 25 coins to user    │  │
     │                 │   │ 5. Check treasury debt ceiling           │  │
     │                 │   │ 6. Log transaction                       │  │
     │                 │   └──────────────────────────────────────────┘  │

--- ON CLOSE WITHOUT MERGE ---

     │                 │   ┌──────────────────────────────────────────┐  │
     │                 │   │ PRService (closed, not merged):          │  │
     │                 │   │ 1. Update PR status → CLOSED             │  │
     │                 │   │ 2. Full refund of stake to contributor   │  │
     │                 │   │ 3. 30% compensation from org treasury   │  │
     │                 │   │    (15 coins) → contributor              │  │
     │                 │   │ 4. Debit 15 from treasury               │  │
     │                 │   │ 5. Check debt ceiling                    │  │
     │                 │   └──────────────────────────────────────────┘  │
```

### 7.5 Act Reset Flow (Scheduled Job)

```
┌──────────┐    ┌────────────┐    ┌────────┐    ┌──────────┐
│  BullMQ  │    │ ActService │    │ Redis  │    │ Supabase │
│  Cron    │    │            │    │        │    │          │
└────┬─────┘    └─────┬──────┘    └───┬────┘    └────┬─────┘
     │                │               │              │
     │  Trigger:      │               │              │
     │  every 45 days │               │              │
     ├───────────────►│               │              │
     │                │               │              │
     │   ┌────────────────────────────────────────────────────┐
     │   │ ActService.executeReset():                         │
     │   │                                                    │
     │   │ 1. ARCHIVE LEADERBOARDS                            │
     │   │    • Snapshot global + all org sorted sets          │
     │   │    • Store in leaderboard_archives table            │
     │   │                                                    │
     │   │ 2. FOR EACH USER:                                  │
     │   │    a. Current tier = Contributor (500-1500)         │
     │   │    b. Drop one tier → Commiter (100-500)           │
     │   │    c. XP reset to midpoint of Commiter             │
     │   │       = (100 + 500) / 2 = 300 XP                  │
     │   │    d. If Initiator → XP = current × 0.5            │
     │   │    e. Reset earned coins to base tier amount        │
     │   │    f. Purchased coins untouched                    │
     │   │    g. Set status = UNRANKED for new Act            │
     │   │    h. has_merged_pr_this_act = false               │
     │   │                                                    │
     │   │ 3. REBUILD LEADERBOARDS                            │
     │   │    • Clear sorted sets in Redis                    │
     │   │    • Re-add all users with compressed XP           │
     │   │    • (Users won't show until first merge)          │
     │   │                                                    │
     │   │ 4. CREATE NEW ACT                                  │
     │   │    • act_number++                                  │
     │   │    • start_date = now                              │
     │   │    • end_date = now + 45 days                      │
     │   │                                                    │
     │   │ 5. EMIT METRICS                                    │
     │   │    • Prometheus: act_reset_duration_seconds         │
     │   │    • Prometheus: users_processed_total              │
     │   │    • Sentry breadcrumb: "Act N reset completed"    │
     │   │                                                    │
     │   │ 6. NOTIFY                                          │
     │   │    • Supabase Realtime: broadcast act_reset event  │
     │   └────────────────────────────────────────────────────┘
```

### 7.6 Coin Economy Flow

```
┌──────────────────────────────────────────────────────────────────┐
│                      COIN FLOW DIAGRAM                           │
│                                                                  │
│  ┌──────────────────┐                                            │
│  │   COIN SOURCES   │                                            │
│  ├──────────────────┤                                            │
│  │ Signup: +150     ├──────────────┐                             │
│  │ Monthly: +100    ├──────────────┤                             │
│  │ Merged PR: +bonus├──────────────┤                             │
│  │ Stripe: +bundle  ├──────────────┤     ┌──────────────────┐   │
│  │ Closed PR: +30%  ├──────────────┼────►│  USER WALLET     │   │
│  │  treasury comp.  │             │     │                  │   │
│  └──────────────────┘             │     │  earned_coins    │   │
│                                   │     │  purchased_coins │   │
│                                   │     │  locked_coins    │   │
│                                   │     └───────┬──────────┘   │
│                                   │             │              │
│                                   │             │ Stake        │
│                                   │             ▼              │
│                                   │     ┌──────────────────┐   │
│                                   │     │  LOCKED STAKE    │   │
│                                   │     │  (per issue)     │   │
│                                   │     └───────┬──────────┘   │
│                                   │             │              │
│                              ┌────┼─────────────┼────────┐     │
│                              │    │  RESOLUTION  │        │     │
│                              │    │             │        │     │
│                              │    ▼             ▼        │     │
│                              │ ┌───────┐ ┌──────────┐   │     │
│                              │ │Merged │ │Rejected  │   │     │
│                              │ │Return │ │50% deduct│   │     │
│                              │ │+Bonus │ │→treasury │   │     │
│                              │ └───────┘ └─────┬────┘   │     │
│                              │                 │        │     │
│                              └─────────────────┼────────┘     │
│                                                │              │
│                                                ▼              │
│                                   ┌──────────────────┐        │
│                                   │  ORG TREASURY    │        │
│                                   │                  │        │
│                                   │  balance (can go │        │
│                                   │  negative to     │        │
│                                   │  -2000 ceiling)  │        │
│                                   └──────────────────┘        │
│                                                               │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │  ACT RESET IMPACT ON COINS:                              │ │
│  │  • earned_coins → reset to base tier amount              │ │
│  │  • purchased_coins → UNCHANGED                           │ │
│  │  • locked_coins → resolved before reset                  │ │
│  └──────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────┘
```

### 7.7 Organization Onboarding Flow

```
┌───────────┐    ┌──────────────┐    ┌──────────┐    ┌────────────┐    ┌────────┐
│ Org Admin │    │  Next.js App │    │  GitHub  │    │ Express API│    │Supabase│
└─────┬─────┘    └──────┬───────┘    └────┬─────┘    └─────┬──────┘    └───┬────┘
      │                 │                  │                 │              │
      │  Sign in        │                  │                 │              │
      ├────────────────►│                  │                 │              │
      │  (already has   │                  │                 │              │
      │   PullQuest     │                  │                 │              │
      │   account)      │                  │                 │              │
      │                 │                  │                 │              │
      │  Click org in   │                  │                 │              │
      │  sidebar        │                  │                 │              │
      ├────────────────►│                  │                 │              │
      │                 │ GET /api/        │                 │              │
      │                 │ installations/   │                 │              │
      │                 │ status?org=X     │                 │              │
      │                 ├─────────────────────────────────►│              │
      │                 │                  │                 │              │
      │                 │  "Not installed" │                 │              │
      │                 │◄─────────────────────────────────┤              │
      │                 │                  │                 │              │
      │  "PullQuest is  │                  │                 │              │
      │   not installed │                  │                 │              │
      │   on OrgName"   │                  │                 │              │
      │  [Install]      │                  │                 │              │
      │◄────────────────┤                  │                 │              │
      │                 │                  │                 │              │
      │  Click Install  │                  │                 │              │
      ├────────────────►│                  │                 │              │
      │                 │  Redirect to     │                 │              │
      │◄────────────────┤  github.com/     │                 │              │
      │                 │  apps/pullquest/ │                 │              │
      │                 │  installations/  │                 │              │
      │                 │  new?target=org  │                 │              │
      ├───────────────────────────────────►│                 │              │
      │                 │                  │                 │              │
      │  Select repos,  │                  │                 │              │
      │  click Install  │                  │                 │              │
      │◄──────────────────────────────────┤                 │              │
      │                 │                  │                 │              │
      │                 │                  │  Webhook:       │              │
      │                 │                  │  installation   │              │
      │                 │                  │  (created,      │              │
      │                 │                  │   target=org)   │              │
      │                 │                  ├────────────────►│              │
      │                 │                  │                 │              │
      │                 │                  │   ┌─────────────────────────┐  │
      │                 │                  │   │ OrgService:             │  │
      │                 │                  │   │ 1. Create org record    │  │
      │                 │                  │   │ 2. Initialize treasury  │  │
      │                 │                  │   │    (balance: 0)         │  │
      │                 │                  │   │ 3. Start 10-day trial   │  │
      │                 │                  │   │ 4. Store installation   │  │
      │                 │                  │   │ 5. Fetch org repos +    │  │
      │                 │                  │   │    members for trust    │  │
      │                 │                  │   │    multiplier calc      │  │
      │                 │                  │   │ 6. Calculate initial    │  │
      │                 │                  │   │    credibility score    │  │
      │                 │                  │   └─────────────────────────┘  │
      │                 │                  │                 │              │
      │  Org dashboard  │                  │                 │              │
      │  now available  │                  │                 │              │
      │◄────────────────┤                  │                 │              │
```

---

## 8. Infrastructure

### 8.1 Docker

All custom services are containerized and orchestrated via `docker-compose.yml`:

| Service | Image / Build | Ports | Purpose |
|---|---|---|---|
| `api` | `./apps/api/Dockerfile` | `3001:3001` | Express REST API |
| `worker` | `./apps/worker/Dockerfile` | — | Background job processor (BullMQ) |
| `web` | `./apps/web/Dockerfile` | `3000:3000` | Next.js frontend |
| `redis` | `redis:7-alpine` | `6379:6379` | Cache, leaderboards, queues |
| `prometheus` | `prom/prometheus:latest` | `9090:9090` | Metrics collection |
| `grafana` | `grafana/grafana:latest` | `3002:3000` | Dashboards & alerting |

> [!NOTE]
> PostgreSQL is hosted by **Supabase** (managed) — not in Docker Compose. The API server connects to Supabase via `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`.

### 8.2 Redis

| Use Case | Redis Data Structure | Key Pattern | TTL |
|---|---|---|---|
| **Global Leaderboard** | Sorted Set | `leaderboard:global:act:{actId}` | None (persistent) |
| **Org Leaderboard** | Sorted Set | `leaderboard:org:{orgId}:act:{actId}` | None (persistent) |
| **User Profile Cache** | Hash | `cache:user:{userId}` | 5 min |
| **Org Credibility Cache** | String | `cache:credibility:{orgId}` | 15 min |
| **Issue Metadata Cache** | Hash | `cache:issue:{issueId}` | 2 min |
| **Rate Limiting** | String (counter) | `ratelimit:{ip}:{window}` | Window size |
| **Session Augmentation** | Hash | `session:{userId}` | 30 min |
| **BullMQ Queues** | Lists + Sets | `bull:{queueName}:*` | Job-specific |

### 8.3 Sentry

**Integration Points:**
- **API server** — Captures unhandled exceptions, transaction performance traces, request breadcrumbs.
- **Worker** — Captures job failures, queue errors, Act reset issues.
- **Frontend** — Client-side error reporting, performance monitoring, session replay.
- **Custom contexts** — User ID, org ID, Act number attached to all events.
- **Alerts** — Critical alerts for: treasury debt ceiling breaches, XP calculation failures, payment errors, GitHub webhook signature failures.

### 8.4 Prometheus

**Custom Metrics:**

| Metric Name | Type | Description |
|---|---|---|
| `pullquest_api_requests_total` | Counter | Total API requests by route, method, status |
| `pullquest_api_request_duration_seconds` | Histogram | Request latency |
| `pullquest_stakes_total` | Counter | Total stakes placed |
| `pullquest_pr_outcomes_total` | Counter | PR outcomes by type |
| `pullquest_xp_awarded_total` | Counter | Total XP awarded |
| `pullquest_coins_minted_total` | Counter | Coins minted (signup, monthly, bonus) |
| `pullquest_treasury_balance` | Gauge | Org treasury balances |
| `pullquest_active_users` | Gauge | Users active in current Act |
| `pullquest_job_queue_depth` | Gauge | BullMQ queue depths |
| `pullquest_leaderboard_update_duration_seconds` | Histogram | Leaderboard write latency |

### 8.5 Grafana

**Pre-provisioned Dashboards:**
- **API Overview** — Request rates, latency percentiles (p50, p95, p99), error rates, top endpoints.
- **Coin Economy** — Minting rates, staking volume, treasury health across orgs, debt ceiling proximity.
- **Leaderboard & XP** — XP distribution, tier distribution, leaderboard update frequency.
- **Worker & Queues** — Job completion rates, failure rates, queue depths, Act reset execution time.

**Alerts:**
- Treasury debt ceiling warning (at −1500)
- API error rate spike (>5% 5xx in 5 min)
- Worker job failure rate (>3 failures in 10 min)
- Act reset job not completing within expected window

---

## 9. Monorepo Structure & Migration

### 9.1 Directory Structure

```
pullquest/
├── docker-compose.yml
├── docker-compose.override.yml     # Dev overrides (volumes, hot-reload)
├── turbo.json
├── pnpm-workspace.yaml
├── package.json                    # Root scripts
├── .env.example
├── .gitignore
│
├── packages/
│   ├── shared/                     # Shared types, constants, enums
│   │   ├── src/
│   │   │   ├── types/              # User, Issue, PR, Coin, XP, Tier types
│   │   │   ├── constants/          # Tier thresholds, XP caps, trust multipliers
│   │   │   ├── enums/              # PROutcome, Difficulty, TierName, UserRole
│   │   │   └── utils/              # XP formula, tier calculator, coin logic
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   └── database/                   # Supabase schema, migrations, types
│       ├── supabase/
│       │   ├── migrations/
│       │   └── seed.sql
│       ├── src/
│       │   ├── client.ts           # Supabase client factory
│       │   └── types.ts            # Generated DB types (supabase gen types)
│       ├── package.json
│       └── tsconfig.json
│
├── apps/
│   ├── api/                        # Express.js REST API
│   │   ├── Dockerfile
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   ├── config/
│   │   │   ├── middleware/
│   │   │   ├── routes/
│   │   │   ├── controllers/
│   │   │   ├── services/
│   │   │   ├── webhooks/
│   │   │   ├── redis/
│   │   │   ├── metrics/
│   │   │   └── utils/
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── worker/                     # BullMQ background job processor
│   │   ├── Dockerfile
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   ├── jobs/
│   │   │   ├── queues/
│   │   │   └── config/
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   └── web/                        # Next.js frontend (existing app)
│       ├── Dockerfile
│       ├── app/
│       ├── components/
│       ├── lib/
│       ├── public/
│       ├── next.config.ts
│       ├── components.json
│       ├── postcss.config.mjs
│       ├── eslint.config.mjs
│       ├── tsconfig.json
│       └── package.json
│
└── infra/
    ├── prometheus/
    │   └── prometheus.yml
    ├── grafana/
    │   ├── provisioning/
    │   │   ├── datasources/
    │   │   └── dashboards/
    │   └── dashboards/
    │       ├── api-overview.json
    │       ├── coin-economy.json
    │       └── leaderboard.json
    └── redis/
        └── redis.conf
```

### 9.2 Migration Steps (From Current Setup)

Your current project is a flat Next.js app at the repo root with pnpm. Here are the exact steps:

```bash
# 1. Create the monorepo directory structure
mkdir -p apps/web apps/api/src apps/worker/src
mkdir -p packages/shared/src packages/database/supabase
mkdir -p infra/prometheus infra/grafana/provisioning/datasources
mkdir -p infra/grafana/provisioning/dashboards infra/grafana/dashboards
mkdir -p infra/redis

# 2. Move existing Next.js files into apps/web/
mv app/ apps/web/
mv components/ apps/web/
mv lib/ apps/web/
mv public/ apps/web/
mv next.config.ts apps/web/
mv next-env.d.ts apps/web/
mv tsconfig.json apps/web/
mv postcss.config.mjs apps/web/
mv eslint.config.mjs apps/web/
mv components.json apps/web/
mv package.json apps/web/

# 3. Clean up old artifacts
rm -rf node_modules .next pnpm-lock.yaml

# 4. Edit apps/web/package.json: change "name" to "@pullquest/web"

# 5. Create root package.json, pnpm-workspace.yaml, turbo.json
#    (contents in section below)

# 6. Reinstall
pnpm install
```

### 9.3 Root Configuration Files

**Root `package.json`:**
```json
{
  "name": "pullquest",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "turbo dev",
    "build": "turbo build",
    "lint": "turbo lint",
    "dev:api": "turbo dev --filter=@pullquest/api",
    "dev:web": "turbo dev --filter=@pullquest/web",
    "dev:worker": "turbo dev --filter=@pullquest/worker",
    "docker:up": "docker compose up -d",
    "docker:down": "docker compose down",
    "docker:build": "docker compose build",
    "db:migrate": "pnpm --filter @pullquest/database supabase:migrate",
    "db:types": "pnpm --filter @pullquest/database supabase:gen-types"
  },
  "devDependencies": {
    "turbo": "^2"
  }
}
```

**Root `pnpm-workspace.yaml`:**
```yaml
packages:
  - "apps/*"
  - "packages/*"
```

**Root `turbo.json`:**
```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**", ".next/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "lint": {
      "dependsOn": ["^build"]
    }
  }
}
```

---

## 10. Product Scope (Full Build)

> [!IMPORTANT]
> No MVP phasing. All features built in a single pass.

### Core Platform
- GitHub OAuth authentication (via Supabase Auth)
- GitHub App installation for repo access (Vercel-style)
- Public contributor profile with full contribution history
- Mandatory `Stake-X` detection and validation
- Difficulty bands (Easy / Medium / Hard)
- Exact coin staking & locking
- 5 PR outcome handling with automated refund/deduction logic
- Treasury tracking with debt ceiling enforcement
- XP engine (cap + trust multiplier + evaluation)
- Tier system (Initiator → Open Source Legend)
- Global and organization leaderboards (Redis-backed sorted sets)
- 45-day Act cycle with automated resets (BullMQ)
- 150 signup coins + 100 monthly coins (BullMQ cron)
- Stripe coin purchase and org subscription
- Debt ceiling enforcement (−2000)

### Organization Layer
- Organization dashboard
- Organization-specific leaderboard
- Credibility score (0–100)
- Treasury visibility (internal)
- Contributor analytics per org
- 10-day free trial + subscription system (Stripe)

### AI Assistance Layer
- AI issue summaries (Gemini)
- AI PR summaries (Gemini)
- Public `pullquestai` comments (posted via GitHub App)
- Maintainer correction loop
- Repository skeletonization & indexing
- AI does not assign XP

### Infrastructure
- Docker containerization for all custom services
- Redis for caching, leaderboards, queues, rate limiting
- Sentry for error tracking and performance monitoring
- Prometheus for metrics collection
- Grafana for dashboards and alerting

### Future Enhancements (Post-Launch)
- Advanced credibility weighting
- Contributor analytics dashboard
- Seasonal badges & rewards
- Reputation export (hiring use-case)
- Anti-abuse monitoring
