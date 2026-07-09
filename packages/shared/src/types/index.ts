import {
  UserRole,
  PROutcome,
  Difficulty,
  TierName,
  StakeStatus,
  CoinTransactionType,
  PRStatus,
  ActStatus,
} from '../enums/index.js';

// ─── Core Domain Models ────────────────────────────────────────────

export interface User {
  id: string;
  github_id: number;
  github_username: string;
  email: string | null;
  avatar_url: string | null;
  role: UserRole;
  global_xp: number;
  current_tier: TierName;
  earned_coins: number;
  purchased_coins: number;
  locked_coins: number;
  has_merged_pr_this_act: boolean;
  current_act_id: string | null;
  created_at: string;
  updated_at: string;
  last_login_at: string | null;
}

export interface Installation {
  id: string;
  installation_id: number;
  account_type: 'User' | 'Organization';
  account_id: number;
  account_login: string;
  permissions: Record<string, string>;
  installed_by: string; // User ID
  installed_at: string;
  suspended_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Repository {
  id: string;
  github_repo_id: number;
  installation_id: string;
  org_id: string | null;
  name: string;
  full_name: string;
  star_count: number;
  member_count: number;
  trust_multiplier: number;
  is_private: boolean;
  created_at: string;
  updated_at: string;
}

export interface Organization {
  id: string;
  github_org_id: number;
  name: string;
  display_name: string | null;
  avatar_url: string | null;
  installation_id: string | null;
  credibility_score: number;
  subscription_status: 'trialing' | 'active' | 'past_due' | 'canceled' | 'none';
  trial_start_date: string | null;
  trial_end_date: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface Treasury {
  id: string;
  org_id: string;
  balance: number;
  total_credits: number;
  total_debits: number;
  is_staking_disabled: boolean;
  created_at: string;
  updated_at: string;
}

// ─── Issue & Staking ───────────────────────────────────────────────

export interface Issue {
  id: string;
  github_issue_id: number;
  github_issue_number: number;
  repo_id: string;
  org_id: string | null;
  title: string;
  url: string;
  stake_amount: number;
  difficulty: Difficulty;
  trust_multiplier: number;
  is_open: boolean;
  ai_summary: string | null;
  created_at: string;
  updated_at: string;
}

export interface Stake {
  id: string;
  user_id: string;
  issue_id: string;
  amount: number;
  status: StakeStatus;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
}

// ─── Pull Requests ─────────────────────────────────────────────────

export interface PullRequest {
  id: string;
  github_pr_id: number;
  github_pr_number: number;
  issue_id: string;
  user_id: string;
  repo_id: string;
  title: string;
  url: string;
  outcome: PROutcome | null;
  status: PRStatus;
  ai_summary: string | null;
  last_review_status: string | null;
  merged_at: string | null;
  closed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Evaluation {
  id: string;
  pr_id: string;
  maintainer_id: string;
  // Individual scores from structured questionnaire (MCQ + sliders)
  code_quality_score: number;
  complexity_score: number;
  test_coverage_score: number;
  documentation_score: number;
  overall_score: number;
  // Computed total (0-5 scale)
  total_score: number;
  comments: string | null;
  created_at: string;
}

// ─── XP & Coins ────────────────────────────────────────────────────

export interface XPLog {
  id: string;
  user_id: string;
  pr_id: string;
  issue_id: string;
  act_id: string;
  org_id: string | null;
  difficulty: Difficulty;
  xp_cap: number;
  evaluation_score: number;
  trust_multiplier: number;
  xp_awarded: number;
  global_xp_after: number;
  tier_before: TierName;
  tier_after: TierName;
  created_at: string;
}

export interface CoinTransaction {
  id: string;
  user_id: string;
  type: CoinTransactionType;
  amount: number; // Positive = credit, negative = debit
  earned_balance_after: number;
  purchased_balance_after: number;
  locked_balance_after: number;
  reference_id: string | null; // Stake ID, PR ID, Stripe payment ID, etc.
  description: string | null;
  created_at: string;
}

// ─── Seasonal Acts ─────────────────────────────────────────────────

export interface Act {
  id: string;
  act_number: number;
  status: ActStatus;
  start_date: string;
  end_date: string;
  created_at: string;
  updated_at: string;
}

// ─── Leaderboard ───────────────────────────────────────────────────

export interface LeaderboardEntry {
  rank: number;
  user_id: string;
  github_username: string;
  avatar_url: string | null;
  xp: number;
  tier: TierName;
}

export interface LeaderboardArchive {
  id: string;
  act_id: string;
  type: 'global' | 'org';
  org_id: string | null;
  entries: LeaderboardEntry[];
  archived_at: string;
}

// ─── Subscription ──────────────────────────────────────────────────

export interface Subscription {
  id: string;
  org_id: string;
  stripe_subscription_id: string;
  stripe_customer_id: string;
  plan_id: string;
  status: 'trialing' | 'active' | 'past_due' | 'canceled';
  current_period_start: string;
  current_period_end: string;
  created_at: string;
  updated_at: string;
}

// ─── API Request / Response Types ──────────────────────────────────

export interface StakeRequest {
  amount: number;
}

export interface EvaluationRequest {
  code_quality_score: number;
  complexity_score: number;
  test_coverage_score: number;
  documentation_score: number;
  overall_score: number;
  comments?: string;
}

export interface PaginatedRequest {
  page?: number;
  limit?: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface IssueFilters {
  org_id?: string;
  difficulty?: Difficulty;
  is_open?: boolean;
}

export interface CoinPurchaseRequest {
  bundle_id: string;
}

export interface ApiError {
  error: string;
  message: string;
  statusCode: number;
}
