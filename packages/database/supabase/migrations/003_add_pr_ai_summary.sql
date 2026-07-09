-- Migration to add columns to pull_requests table
ALTER TABLE pull_requests ADD COLUMN IF NOT EXISTS ai_summary TEXT;
ALTER TABLE pull_requests ADD COLUMN IF NOT EXISTS last_review_status TEXT;
