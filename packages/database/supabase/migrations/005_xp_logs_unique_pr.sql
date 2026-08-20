-- One XP award per pull request (PRD §2.4 — no double-pay, no manual override)
CREATE UNIQUE INDEX IF NOT EXISTS idx_xp_logs_pr_id ON xp_logs (pr_id);
