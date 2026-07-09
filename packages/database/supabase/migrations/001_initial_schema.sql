-- PullQuest Initial Schema
-- 14 tables covering the full domain model

-- ─── Extensions ────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─── Users ─────────────────────────────────────────────────────────
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  github_id BIGINT UNIQUE NOT NULL,
  github_username TEXT UNIQUE NOT NULL,
  email TEXT,
  avatar_url TEXT,
  role TEXT NOT NULL DEFAULT 'CONTRIBUTOR' CHECK (role IN ('CONTRIBUTOR', 'MAINTAINER', 'ORG_ADMIN', 'PLATFORM_ADMIN')),
  global_xp INTEGER NOT NULL DEFAULT 0,
  current_tier TEXT NOT NULL DEFAULT 'UNRANKED' CHECK (current_tier IN ('UNRANKED', 'INITIATOR', 'COMMITER', 'CONTRIBUTOR', 'MERGE_MASTER', 'ARCHITECT', 'OPEN_SOURCE_LEGEND')),
  earned_coins INTEGER NOT NULL DEFAULT 0,
  purchased_coins INTEGER NOT NULL DEFAULT 0,
  locked_coins INTEGER NOT NULL DEFAULT 0,
  has_merged_pr_this_act BOOLEAN NOT NULL DEFAULT FALSE,
  current_act_id UUID,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Acts (Seasons) ────────────────────────────────────────────────
CREATE TABLE acts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  act_number INTEGER UNIQUE NOT NULL,
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'ENDED', 'ARCHIVED')),
  start_date TIMESTAMPTZ NOT NULL,
  end_date TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE users ADD CONSTRAINT fk_users_current_act FOREIGN KEY (current_act_id) REFERENCES acts(id);

-- ─── Installations (GitHub App) ────────────────────────────────────
CREATE TABLE installations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  installation_id BIGINT UNIQUE NOT NULL,
  account_type TEXT NOT NULL CHECK (account_type IN ('User', 'Organization')),
  account_id BIGINT NOT NULL,
  account_login TEXT NOT NULL,
  permissions JSONB NOT NULL DEFAULT '{}',
  installed_by UUID NOT NULL REFERENCES users(id),
  installed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  suspended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Organizations ─────────────────────────────────────────────────
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  github_org_id BIGINT UNIQUE NOT NULL,
  name TEXT UNIQUE NOT NULL,
  display_name TEXT,
  avatar_url TEXT,
  installation_id UUID REFERENCES installations(id),
  credibility_score INTEGER NOT NULL DEFAULT 0 CHECK (credibility_score >= 0 AND credibility_score <= 100),
  subscription_status TEXT NOT NULL DEFAULT 'none' CHECK (subscription_status IN ('trialing', 'active', 'past_due', 'canceled', 'none')),
  trial_start_date TIMESTAMPTZ,
  trial_end_date TIMESTAMPTZ,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Treasuries ────────────────────────────────────────────────────
CREATE TABLE treasuries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID UNIQUE NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  balance INTEGER NOT NULL DEFAULT 0,
  total_credits INTEGER NOT NULL DEFAULT 0,
  total_debits INTEGER NOT NULL DEFAULT 0,
  is_staking_disabled BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Repositories ──────────────────────────────────────────────────
CREATE TABLE repositories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  github_repo_id BIGINT UNIQUE NOT NULL,
  installation_id UUID NOT NULL REFERENCES installations(id) ON DELETE CASCADE,
  org_id UUID REFERENCES organizations(id),
  name TEXT NOT NULL,
  full_name TEXT UNIQUE NOT NULL,
  star_count INTEGER NOT NULL DEFAULT 0,
  member_count INTEGER NOT NULL DEFAULT 0,
  trust_multiplier NUMERIC(3, 1) NOT NULL DEFAULT 0.5,
  is_private BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Issues (Stakable) ────────────────────────────────────────────
CREATE TABLE issues (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  github_issue_id BIGINT UNIQUE NOT NULL,
  github_issue_number INTEGER NOT NULL,
  repo_id UUID NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
  org_id UUID REFERENCES organizations(id),
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  stake_amount INTEGER NOT NULL CHECK (stake_amount > 0),
  difficulty TEXT NOT NULL CHECK (difficulty IN ('EASY', 'MEDIUM', 'HARD')),
  trust_multiplier NUMERIC(3, 1) NOT NULL DEFAULT 0.5,
  is_open BOOLEAN NOT NULL DEFAULT TRUE,
  ai_summary TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Stakes ────────────────────────────────────────────────────────
CREATE TABLE stakes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id),
  issue_id UUID NOT NULL REFERENCES issues(id),
  amount INTEGER NOT NULL CHECK (amount > 0),
  status TEXT NOT NULL DEFAULT 'LOCKED' CHECK (status IN ('LOCKED', 'RETURNED', 'DEDUCTED', 'REFUNDED')),
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, issue_id)
);

-- ─── Pull Requests ─────────────────────────────────────────────────
CREATE TABLE pull_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  github_pr_id BIGINT UNIQUE NOT NULL,
  github_pr_number INTEGER NOT NULL,
  issue_id UUID NOT NULL REFERENCES issues(id),
  user_id UUID NOT NULL REFERENCES users(id),
  repo_id UUID NOT NULL REFERENCES repositories(id),
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  outcome TEXT CHECK (outcome IN ('UNREVIEWED', 'MERGED', 'REJECTED', 'MULTIPLE_ACCEPTED', 'CLOSED_WITHOUT_MERGE')),
  status TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'AWAITING_EVALUATION', 'RESOLVED')),
  ai_summary TEXT,
  last_review_status TEXT,
  merged_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Evaluations ───────────────────────────────────────────────────
CREATE TABLE evaluations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pr_id UUID UNIQUE NOT NULL REFERENCES pull_requests(id),
  maintainer_id UUID NOT NULL REFERENCES users(id),
  code_quality_score NUMERIC(2, 1) NOT NULL CHECK (code_quality_score >= 0 AND code_quality_score <= 5),
  complexity_score NUMERIC(2, 1) NOT NULL CHECK (complexity_score >= 0 AND complexity_score <= 5),
  test_coverage_score NUMERIC(2, 1) NOT NULL CHECK (test_coverage_score >= 0 AND test_coverage_score <= 5),
  documentation_score NUMERIC(2, 1) NOT NULL CHECK (documentation_score >= 0 AND documentation_score <= 5),
  overall_score NUMERIC(2, 1) NOT NULL CHECK (overall_score >= 0 AND overall_score <= 5),
  total_score NUMERIC(3, 2) NOT NULL CHECK (total_score >= 0 AND total_score <= 5),
  comments TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── XP Logs ───────────────────────────────────────────────────────
CREATE TABLE xp_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id),
  pr_id UUID NOT NULL REFERENCES pull_requests(id),
  issue_id UUID NOT NULL REFERENCES issues(id),
  act_id UUID NOT NULL REFERENCES acts(id),
  org_id UUID REFERENCES organizations(id),
  difficulty TEXT NOT NULL CHECK (difficulty IN ('EASY', 'MEDIUM', 'HARD')),
  xp_cap INTEGER NOT NULL,
  evaluation_score NUMERIC(3, 2) NOT NULL,
  trust_multiplier NUMERIC(3, 1) NOT NULL,
  xp_awarded INTEGER NOT NULL CHECK (xp_awarded >= 0),
  global_xp_after INTEGER NOT NULL,
  tier_before TEXT NOT NULL,
  tier_after TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Coin Transactions ─────────────────────────────────────────────
CREATE TABLE coin_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id),
  type TEXT NOT NULL CHECK (type IN ('SIGNUP_BONUS', 'MONTHLY_MINT', 'STAKE_LOCK', 'STAKE_RETURN', 'STAKE_DEDUCTION', 'MERGE_BONUS', 'PURCHASE', 'TREASURY_COMPENSATION', 'ACT_RESET')),
  amount INTEGER NOT NULL,
  earned_balance_after INTEGER NOT NULL,
  purchased_balance_after INTEGER NOT NULL,
  locked_balance_after INTEGER NOT NULL,
  reference_id TEXT,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Leaderboard Archives ──────────────────────────────────────────
CREATE TABLE leaderboard_archives (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  act_id UUID NOT NULL REFERENCES acts(id),
  type TEXT NOT NULL CHECK (type IN ('global', 'org')),
  org_id UUID REFERENCES organizations(id),
  entries JSONB NOT NULL DEFAULT '[]',
  archived_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Subscriptions ─────────────────────────────────────────────────
CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES organizations(id),
  stripe_subscription_id TEXT UNIQUE NOT NULL,
  stripe_customer_id TEXT NOT NULL,
  plan_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('trialing', 'active', 'past_due', 'canceled')),
  current_period_start TIMESTAMPTZ NOT NULL,
  current_period_end TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Indexes ───────────────────────────────────────────────────────
CREATE INDEX idx_users_github_id ON users(github_id);
CREATE INDEX idx_users_github_username ON users(github_username);
CREATE INDEX idx_users_global_xp ON users(global_xp DESC);
CREATE INDEX idx_users_current_tier ON users(current_tier);

CREATE INDEX idx_installations_account_id ON installations(account_id);
CREATE INDEX idx_installations_account_login ON installations(account_login);

CREATE INDEX idx_repositories_github_repo_id ON repositories(github_repo_id);
CREATE INDEX idx_repositories_org_id ON repositories(org_id);

CREATE INDEX idx_issues_repo_id ON issues(repo_id);
CREATE INDEX idx_issues_org_id ON issues(org_id);
CREATE INDEX idx_issues_is_open ON issues(is_open);
CREATE INDEX idx_issues_difficulty ON issues(difficulty);

CREATE INDEX idx_stakes_user_id ON stakes(user_id);
CREATE INDEX idx_stakes_issue_id ON stakes(issue_id);
CREATE INDEX idx_stakes_status ON stakes(status);

CREATE INDEX idx_pull_requests_issue_id ON pull_requests(issue_id);
CREATE INDEX idx_pull_requests_user_id ON pull_requests(user_id);
CREATE INDEX idx_pull_requests_status ON pull_requests(status);

CREATE INDEX idx_xp_logs_user_id ON xp_logs(user_id);
CREATE INDEX idx_xp_logs_act_id ON xp_logs(act_id);
CREATE INDEX idx_xp_logs_org_id ON xp_logs(org_id);

CREATE INDEX idx_coin_transactions_user_id ON coin_transactions(user_id);
CREATE INDEX idx_coin_transactions_type ON coin_transactions(type);
CREATE INDEX idx_coin_transactions_created_at ON coin_transactions(created_at);

CREATE INDEX idx_leaderboard_archives_act_id ON leaderboard_archives(act_id);

-- ─── Updated_at Trigger ────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_acts_updated_at BEFORE UPDATE ON acts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_installations_updated_at BEFORE UPDATE ON installations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_organizations_updated_at BEFORE UPDATE ON organizations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_treasuries_updated_at BEFORE UPDATE ON treasuries FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_repositories_updated_at BEFORE UPDATE ON repositories FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_issues_updated_at BEFORE UPDATE ON issues FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_stakes_updated_at BEFORE UPDATE ON stakes FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_pull_requests_updated_at BEFORE UPDATE ON pull_requests FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_subscriptions_updated_at BEFORE UPDATE ON subscriptions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
