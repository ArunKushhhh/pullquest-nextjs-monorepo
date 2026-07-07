import { createSupabaseAdmin } from '@pullquest/database';
import { Evaluation, EvaluationRequest, PRStatus } from '@pullquest/shared';
import { calculateAndAwardXP } from './xp.service.js';

const supabase = createSupabaseAdmin();

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

export async function submitEvaluation(
  prId: string,
  maintainerId: string,
  scores: EvaluationRequest
): Promise<Evaluation> {
  // Validate scores are between 0 and 5
  const validateScore = (score: number) => {
    if (score < 0 || score > 5) {
      throw new Error('All evaluation scores must be between 0 and 5');
    }
  };

  validateScore(scores.code_quality_score);
  validateScore(scores.complexity_score);
  validateScore(scores.test_coverage_score);
  validateScore(scores.documentation_score);
  validateScore(scores.overall_score);

  // Check if evaluation already exists
  const existing = await getEvaluationForPR(prId);
  if (existing) {
    throw new Error('PR has already been evaluated');
  }

  // Calculate total score (average of the 5 criteria)
  const totalScore =
    (scores.code_quality_score +
      scores.complexity_score +
      scores.test_coverage_score +
      scores.documentation_score +
      scores.overall_score) /
    5;

  // Insert evaluation
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

  if (evalErr) throw evalErr;

  // Update PR status to RESOLVED
  await supabase
    .from('pull_requests')
    .update({ status: PRStatus.RESOLVED })
    .eq('id', prId);

  // Trigger XP calculation and award
  await calculateAndAwardXP(prId, totalScore);

  return evalData as Evaluation;
}
