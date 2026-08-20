import { createSupabaseAdmin } from '@pullquest/database';
import {
  Evaluation,
  EvaluationRequest,
  PROutcome,
  PRStatus,
  averageEvaluationScore,
} from '@pullquest/shared';
import { calculateAndAwardXP } from './xp.service.js';

const supabase = createSupabaseAdmin();

const EVALUABLE_OUTCOMES: PROutcome[] = [PROutcome.MERGED, PROutcome.MULTIPLE_ACCEPTED];

export class EvaluationError extends Error {
  readonly statusCode: number;
  readonly code: string;

  constructor(code: string, message: string, statusCode: number) {
    super(message);
    this.name = 'EvaluationError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

export async function getEvaluationForPR(prId: string): Promise<Evaluation | null> {
  const { data, error } = await supabase
    .from('evaluations')
    .select('*')
    .eq('pr_id', prId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw error;
  }
  return data as Evaluation;
}

export async function listPendingEvaluations(maintainerId: string) {
  const { data: installs, error: instErr } = await supabase
    .from('installations')
    .select('id')
    .eq('installed_by', maintainerId);

  if (instErr) throw instErr;
  const installIds = (installs ?? []).map((row) => row.id);
  if (installIds.length === 0) return [];

  const { data: repos, error: repoErr } = await supabase
    .from('repositories')
    .select('id, full_name, star_count, member_count')
    .in('installation_id', installIds);

  if (repoErr) throw repoErr;
  const repoIds = (repos ?? []).map((row) => row.id);
  if (repoIds.length === 0) return [];

  const repoById = new Map((repos ?? []).map((row) => [row.id, row]));

  const { data: prs, error: prErr } = await supabase
    .from('pull_requests')
    .select('*, issues(title, github_issue_number, difficulty)')
    .in('repo_id', repoIds)
    .eq('status', PRStatus.AWAITING_EVALUATION)
    .in('outcome', EVALUABLE_OUTCOMES)
    .order('updated_at', { ascending: false });

  if (prErr) throw prErr;

  const unwrap = <T,>(value: T | T[] | null | undefined): T | null => {
    if (Array.isArray(value)) return value[0] ?? null;
    return value ?? null;
  };

  return (prs ?? []).map((pr) => {
    const repo = repoById.get(pr.repo_id);
    return {
      ...pr,
      issues: unwrap(pr.issues),
      repositories: repo
        ? { full_name: repo.full_name, star_count: repo.star_count, member_count: repo.member_count }
        : null,
    };
  });
}

export async function assertMaintainerCanEvaluate(prId: string, maintainerId: string) {
  const { data: pr, error } = await supabase
    .from('pull_requests')
    .select('id, status, outcome, repo_id, repositories(installation_id, installations(installed_by))')
    .eq('id', prId)
    .single();

  if (error || !pr) {
    throw new EvaluationError('NOT_FOUND', 'Pull request not found', 404);
  }

  if (pr.status !== PRStatus.AWAITING_EVALUATION) {
    throw new EvaluationError(
      'NOT_AWAITING',
      'This pull request is not awaiting evaluation',
      409
    );
  }

  if (!EVALUABLE_OUTCOMES.includes(pr.outcome as PROutcome)) {
    throw new EvaluationError(
      'NOT_MERGED',
      'Only merged pull requests can be evaluated for XP',
      409
    );
  }

  const repo = Array.isArray(pr.repositories) ? pr.repositories[0] : pr.repositories;
  const installation = repo?.installations
    ? Array.isArray(repo.installations)
      ? repo.installations[0]
      : repo.installations
    : null;

  if (!installation || installation.installed_by !== maintainerId) {
    throw new EvaluationError(
      'FORBIDDEN',
      'Only the GitHub App installer for this repository can evaluate the PR',
      403
    );
  }

  return pr;
}

export async function submitEvaluation(
  prId: string,
  maintainerId: string,
  scores: EvaluationRequest
): Promise<Evaluation> {
  const validateScore = (score: number) => {
    if (typeof score !== 'number' || Number.isNaN(score) || score < 0 || score > 5) {
      throw new EvaluationError(
        'INVALID_SCORE',
        'All evaluation scores must be between 0 and 5',
        400
      );
    }
  };

  validateScore(scores.code_quality_score);
  validateScore(scores.complexity_score);
  validateScore(scores.test_coverage_score);
  validateScore(scores.documentation_score);
  validateScore(scores.overall_score);

  await assertMaintainerCanEvaluate(prId, maintainerId);

  const existing = await getEvaluationForPR(prId);
  if (existing) {
    throw new EvaluationError('ALREADY_EVALUATED', 'PR has already been evaluated', 409);
  }

  const totalScore = averageEvaluationScore(scores);

  const { data: evalData, error: evalErr } = await supabase
    .from('evaluations')
    .insert({
      pr_id: prId,
      maintainer_id: maintainerId,
      code_quality_score: scores.code_quality_score,
      complexity_score: scores.complexity_score,
      test_coverage_score: scores.test_coverage_score,
      documentation_score: scores.documentation_score,
      overall_score: scores.overall_score,
      total_score: totalScore,
      comments: scores.comments || null,
    })
    .select('*')
    .single();

  if (evalErr) {
    if (evalErr.code === '23505') {
      throw new EvaluationError('ALREADY_EVALUATED', 'PR has already been evaluated', 409);
    }
    throw evalErr;
  }

  await supabase
    .from('pull_requests')
    .update({ status: PRStatus.RESOLVED, updated_at: new Date().toISOString() })
    .eq('id', prId);

  await calculateAndAwardXP(prId, totalScore);

  return evalData as Evaluation;
}
