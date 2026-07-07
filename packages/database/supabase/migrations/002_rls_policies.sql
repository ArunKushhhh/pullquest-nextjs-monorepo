-- PullQuest Row Level Security Policies
-- Applied after initial schema migration

-- ─── Enable RLS on all tables ──────────────────────────────────────
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE acts ENABLE ROW LEVEL SECURITY;
ALTER TABLE installations ENABLE ROW LEVEL SECURITY;
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE treasuries ENABLE ROW LEVEL SECURITY;
ALTER TABLE repositories ENABLE ROW LEVEL SECURITY;
ALTER TABLE issues ENABLE ROW LEVEL SECURITY;
ALTER TABLE stakes ENABLE ROW LEVEL SECURITY;
ALTER TABLE pull_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE evaluations ENABLE ROW LEVEL SECURITY;
ALTER TABLE xp_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE coin_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE leaderboard_archives ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

-- ─── Users ─────────────────────────────────────────────────────────
-- Public profiles: anyone can read basic user data
CREATE POLICY "users_select_public" ON users
  FOR SELECT USING (true);

-- Users can update their own profile
CREATE POLICY "users_update_own" ON users
  FOR UPDATE USING (id = auth.uid());

-- Only service role (API server) can insert users
CREATE POLICY "users_insert_service" ON users
  FOR INSERT WITH CHECK (auth.role() = 'service_role');

-- ─── Acts ──────────────────────────────────────────────────────────
-- Acts are publicly readable
CREATE POLICY "acts_select_public" ON acts
  FOR SELECT USING (true);

-- Only service role can manage acts
CREATE POLICY "acts_insert_service" ON acts
  FOR INSERT WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "acts_update_service" ON acts
  FOR UPDATE USING (auth.role() = 'service_role');

-- ─── Installations ─────────────────────────────────────────────────
-- Users can see their own installations
CREATE POLICY "installations_select_own" ON installations
  FOR SELECT USING (installed_by = auth.uid());

-- Service role manages installations (from webhooks)
CREATE POLICY "installations_all_service" ON installations
  FOR ALL USING (auth.role() = 'service_role');

-- ─── Organizations ─────────────────────────────────────────────────
-- Orgs are publicly readable (for credibility score display)
CREATE POLICY "organizations_select_public" ON organizations
  FOR SELECT USING (true);

-- Service role manages orgs
CREATE POLICY "organizations_all_service" ON organizations
  FOR ALL USING (auth.role() = 'service_role');

-- ─── Treasuries ────────────────────────────────────────────────────
-- Treasury is NOT publicly readable (internal to org admins)
-- Service role only
CREATE POLICY "treasuries_all_service" ON treasuries
  FOR ALL USING (auth.role() = 'service_role');

-- ─── Repositories ──────────────────────────────────────────────────
-- Repos are publicly readable (for issue discovery)
CREATE POLICY "repositories_select_public" ON repositories
  FOR SELECT USING (true);

-- Service role manages repos
CREATE POLICY "repositories_all_service" ON repositories
  FOR ALL USING (auth.role() = 'service_role');

-- ─── Issues ────────────────────────────────────────────────────────
-- Issues are publicly readable (feed)
CREATE POLICY "issues_select_public" ON issues
  FOR SELECT USING (true);

-- Service role manages issues (from webhooks)
CREATE POLICY "issues_all_service" ON issues
  FOR ALL USING (auth.role() = 'service_role');

-- ─── Stakes ────────────────────────────────────────────────────────
-- Users can see their own stakes
CREATE POLICY "stakes_select_own" ON stakes
  FOR SELECT USING (user_id = auth.uid());

-- Service role manages stakes (via API)
CREATE POLICY "stakes_all_service" ON stakes
  FOR ALL USING (auth.role() = 'service_role');

-- ─── Pull Requests ─────────────────────────────────────────────────
-- PRs are publicly readable (for transparency)
CREATE POLICY "pull_requests_select_public" ON pull_requests
  FOR SELECT USING (true);

-- Service role manages PRs
CREATE POLICY "pull_requests_all_service" ON pull_requests
  FOR ALL USING (auth.role() = 'service_role');

-- ─── Evaluations ───────────────────────────────────────────────────
-- Evaluations are publicly readable (transparency)
CREATE POLICY "evaluations_select_public" ON evaluations
  FOR SELECT USING (true);

-- Service role inserts evaluations (via API after maintainer submits)
CREATE POLICY "evaluations_insert_service" ON evaluations
  FOR INSERT WITH CHECK (auth.role() = 'service_role');

-- ─── XP Logs ───────────────────────────────────────────────────────
-- XP logs are publicly readable (transparency)
CREATE POLICY "xp_logs_select_public" ON xp_logs
  FOR SELECT USING (true);

-- Service role inserts XP logs
CREATE POLICY "xp_logs_insert_service" ON xp_logs
  FOR INSERT WITH CHECK (auth.role() = 'service_role');

-- ─── Coin Transactions ─────────────────────────────────────────────
-- Users can see their own transactions
CREATE POLICY "coin_transactions_select_own" ON coin_transactions
  FOR SELECT USING (user_id = auth.uid());

-- Service role manages all transactions
CREATE POLICY "coin_transactions_all_service" ON coin_transactions
  FOR ALL USING (auth.role() = 'service_role');

-- ─── Leaderboard Archives ──────────────────────────────────────────
-- Archives are publicly readable
CREATE POLICY "leaderboard_archives_select_public" ON leaderboard_archives
  FOR SELECT USING (true);

-- Service role manages archives
CREATE POLICY "leaderboard_archives_all_service" ON leaderboard_archives
  FOR ALL USING (auth.role() = 'service_role');

-- ─── Subscriptions ─────────────────────────────────────────────────
-- Service role only
CREATE POLICY "subscriptions_all_service" ON subscriptions
  FOR ALL USING (auth.role() = 'service_role');
