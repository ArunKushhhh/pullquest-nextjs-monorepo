import { Difficulty, PROutcome, StakeStatus, TierName } from '../enums/index.js';
import {
  TIER_THRESHOLDS,
  TIER_ORDER,
  XP_CAPS,
  TRUST_MULTIPLIER_BRACKETS,
  DIFFICULTY_STAKE_RANGES,
  MAX_EVALUATION_SCORE,
  REJECTION_DEDUCTION_RATE,
  CLOSED_COMPENSATION_RATE,
  INITIATOR_XP_RESET_FACTOR,
  BASE_TIER_COINS,
  MERGE_BONUS,
  COIN_BUNDLES,
  TREASURY_DEBT_CEILING,
  TREASURY_DEBT_WARNING,
  type CoinBundleId,
} from '../constants/index.js';
import type { EvaluationRequest } from '../types/index.js';

// ─── XP Calculation ────────────────────────────────────────────────

/**
 * Calculate final XP for a merged PR.
 *
 * Formula: `Cap × (evaluationScore / 5) × trustMultiplier`
 *
 * @returns XP amount (floored integer, minimum 0).
 */
export function calculateXP(
  difficulty: Difficulty,
  evaluationScore: number,
  trustMultiplier: number
): number {
  const cap = XP_CAPS[difficulty];
  const normalized = evaluationScore / MAX_EVALUATION_SCORE;
  const xp = cap * normalized * trustMultiplier;
  return Math.max(0, Math.floor(xp));
}

/**
 * Mean of the five structured questionnaire scores, rounded to 2 decimals.
 */
export function averageEvaluationScore(
  scores: Pick<
    EvaluationRequest,
    | 'code_quality_score'
    | 'complexity_score'
    | 'test_coverage_score'
    | 'documentation_score'
    | 'overall_score'
  >
): number {
  const total =
    scores.code_quality_score +
    scores.complexity_score +
    scores.test_coverage_score +
    scores.documentation_score +
    scores.overall_score;
  return Math.round((total / 5) * 100) / 100;
}

// ─── Tier Resolution ───────────────────────────────────────────────

/**
 * Public boards hide Unranked users until they merge ≥1 PR in this Act
 * and their tier is activated (PRD §2.6 / §4.4).
 * `current_act_id` null is treated as this Act so pre-Act-clock rows still rank.
 */
export function isVisibleOnLeaderboard(
  user: {
    has_merged_pr_this_act: boolean;
    current_tier: string;
    current_act_id: string | null;
  },
  actId: string
): boolean {
  return (
    user.has_merged_pr_this_act === true &&
    user.current_tier !== TierName.UNRANKED &&
    (user.current_act_id === actId || user.current_act_id === null)
  );
}

/**
 * Determine which tier a user belongs to based on their global XP.
 */
export function getTierForXP(xp: number): TierName {
  // Walk tiers from highest to lowest
  for (let i = TIER_ORDER.length - 1; i >= 0; i--) {
    const tier = TIER_ORDER[i];
    if (xp >= TIER_THRESHOLDS[tier].min) {
      return tier;
    }
  }
  return TierName.INITIATOR;
}

/**
 * Get the tier one step below the given tier.
 * Returns INITIATOR if already at the lowest tier.
 */
export function getTierBelow(
  tier: Exclude<TierName, TierName.UNRANKED>
): Exclude<TierName, TierName.UNRANKED> {
  const idx = TIER_ORDER.indexOf(tier);
  if (idx <= 0) return TierName.INITIATOR;
  return TIER_ORDER[idx - 1];
}

// ─── Trust Multiplier ──────────────────────────────────────────────

/**
 * Determine the trust multiplier for a repository based on
 * org member count and repo star count.
 *
 * Returns the highest applicable multiplier.
 */
export function getTrustMultiplier(
  memberCount: number,
  starCount: number
): number {
  let highest = 0.5; // default minimum (1–5 members / unknown repo)

  for (const bracket of TRUST_MULTIPLIER_BRACKETS) {
    // minStars === 0 marks a member-count bracket. Star brackets must not
    // match every repo just because 0 stars is >= 0.
    if (bracket.minStars === 0) {
      if (memberCount >= bracket.minMembers && memberCount < bracket.maxMembers) {
        highest = Math.max(highest, bracket.multiplier);
      }
    } else if (starCount >= bracket.minStars) {
      highest = Math.max(highest, bracket.multiplier);
    }
  }

  return highest;
}

// ─── Act Reset ─────────────────────────────────────────────────────

/**
 * Calculate what a user's XP should be after an Act reset.
 *
 * Rules:
 * - Drop exactly one tier
 * - XP resets to midpoint of the lower tier
 * - Initiator tier: XP becomes 50% of current
 */
export function calculateActResetXP(
  currentXP: number,
  currentTier: Exclude<TierName, TierName.UNRANKED>
): number {
  if (currentTier === TierName.INITIATOR) {
    return Math.floor(currentXP * INITIATOR_XP_RESET_FACTOR);
  }

  const lowerTier = getTierBelow(currentTier);
  const lowerThreshold = TIER_THRESHOLDS[lowerTier];
  const midpoint = Math.floor((lowerThreshold.min + lowerThreshold.max) / 2);

  return midpoint;
}

/**
 * Calculate the base coin balance a user resets to after an Act.
 * Purchased coins are unaffected (handled separately).
 */
export function getActResetCoinBalance(
  tier: Exclude<TierName, TierName.UNRANKED>
): number {
  return BASE_TIER_COINS[tier];
}

/**
 * UNRANKED users still compress from the tier their XP maps to.
 */
export function effectiveTierForActReset(
  currentTier: TierName,
  currentXP: number
): Exclude<TierName, TierName.UNRANKED> {
  if (currentTier !== TierName.UNRANKED) {
    return currentTier;
  }
  return getTierForXP(currentXP) as Exclude<TierName, TierName.UNRANKED>;
}

/** Whole days until `endDate`, floored at 0. */
export function actDaysRemaining(endDate: string, now = new Date()): number {
  const ms = new Date(endDate).getTime() - now.getTime();
  return Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)));
}

export type TreasuryHealthStatus = 'healthy' | 'warning' | 'breached';

export function treasuryHealthStatus(balance: number): TreasuryHealthStatus {
  if (balance <= TREASURY_DEBT_CEILING) return 'breached';
  if (balance <= TREASURY_DEBT_WARNING) return 'warning';
  return 'healthy';
}

/** Staking is disabled at or below the −2000 debt ceiling (PRD §2.7). */
export function isTreasuryStakingDisabled(balance: number): boolean {
  return balance <= TREASURY_DEBT_CEILING;
}

export function isCoinBundleId(id: string): id is CoinBundleId {
  return Object.prototype.hasOwnProperty.call(COIN_BUNDLES, id);
}

export function coinBundlePurchaseDescription(bundleId: CoinBundleId): string {
  return `Purchased coin bundle:${bundleId}`;
}

/** Resolve a ledger row back to a catalog bundle (tagged description, else amount). */
export function inferCoinBundleId(input: {
  amount: number;
  description: string | null;
}): CoinBundleId | null {
  const tagged = input.description?.match(/bundle:([a-z0-9_]+)/i);
  if (tagged && isCoinBundleId(tagged[1])) return tagged[1];

  for (const bundle of Object.values(COIN_BUNDLES)) {
    if (bundle.amount === input.amount) return bundle.id;
  }
  return null;
}

// ─── Stake Validation ──────────────────────────────────────────────

export type StakeRejectionCode =
  | 'INVALID_AMOUNT'
  | 'ISSUE_CLOSED'
  | 'AMOUNT_MISMATCH'
  | 'AMOUNT_OUT_OF_BAND'
  | 'ALREADY_STAKED'
  | 'STAKING_DISABLED';

export const STAKE_REJECTION_MESSAGES: Record<StakeRejectionCode, string> = {
  INVALID_AMOUNT: 'Stake amount must be a positive integer',
  ISSUE_CLOSED: 'Issue is closed for staking',
  AMOUNT_MISMATCH: 'Stake amount must match the issue Stake-X label',
  AMOUNT_OUT_OF_BAND: 'Stake amount is outside the difficulty band',
  ALREADY_STAKED: 'You have already placed a stake on this issue',
  STAKING_DISABLED:
    'Staking is disabled for this organization (treasury debt ceiling)',
};

const DIFFICULTY_BY_NAME: Record<string, Difficulty> = {
  EASY: Difficulty.EASY,
  MEDIUM: Difficulty.MEDIUM,
  HARD: Difficulty.HARD,
};

/**
 * Parse maintainer labels into a difficulty band and exact Stake-X amount.
 * `Stake-Easy` / `Easy` set difficulty only; `Stake-50` sets the exact coin amount.
 */
export function parseStakeLabels(labelNames: string[]): {
  difficulty: Difficulty | null;
  amount: number | null;
} {
  let difficulty: Difficulty | null = null;
  let amount: number | null = null;

  for (const raw of labelNames) {
    const name = raw.trim();
    const diffMatch = name.match(/^(Stake-)?(Easy|Medium|Hard)$/i);
    if (diffMatch) {
      difficulty = DIFFICULTY_BY_NAME[diffMatch[2].toUpperCase()] ?? null;
      continue;
    }

    const amountMatch = name.match(/^Stake-(\d+)$/i);
    if (amountMatch) {
      amount = parseInt(amountMatch[1], 10);
    }
  }

  return { difficulty, amount };
}

/**
 * Validate that a stake amount is within the allowed range for a difficulty.
 */
export function validateStakeAmount(
  amount: number,
  difficulty: Difficulty
): boolean {
  const range = DIFFICULTY_STAKE_RANGES[difficulty];
  return amount >= range.min && amount <= range.max;
}

/**
 * Contributor stake rules from PRD §2.2 / §7.3 — exact Stake-X, open issue, band, uniqueness.
 */
export function evaluateStakeAttempt(input: {
  amount: number;
  issueStakeAmount: number;
  difficulty: Difficulty;
  isOpen: boolean;
  alreadyStaked: boolean;
  stakingDisabled: boolean;
}): { ok: true } | { ok: false; code: StakeRejectionCode; message: string } {
  if (!Number.isInteger(input.amount) || input.amount <= 0) {
    return {
      ok: false,
      code: 'INVALID_AMOUNT',
      message: STAKE_REJECTION_MESSAGES.INVALID_AMOUNT,
    };
  }
  if (!input.isOpen) {
    return {
      ok: false,
      code: 'ISSUE_CLOSED',
      message: STAKE_REJECTION_MESSAGES.ISSUE_CLOSED,
    };
  }
  if (input.stakingDisabled) {
    return {
      ok: false,
      code: 'STAKING_DISABLED',
      message: STAKE_REJECTION_MESSAGES.STAKING_DISABLED,
    };
  }
  if (input.alreadyStaked) {
    return {
      ok: false,
      code: 'ALREADY_STAKED',
      message: STAKE_REJECTION_MESSAGES.ALREADY_STAKED,
    };
  }
  if (input.amount !== input.issueStakeAmount) {
    return {
      ok: false,
      code: 'AMOUNT_MISMATCH',
      message: `Stake amount must be exactly ${input.issueStakeAmount} PC`,
    };
  }
  if (!validateStakeAmount(input.amount, input.difficulty)) {
    return {
      ok: false,
      code: 'AMOUNT_OUT_OF_BAND',
      message: STAKE_REJECTION_MESSAGES.AMOUNT_OUT_OF_BAND,
    };
  }
  return { ok: true };
}

// ─── Economic Helpers ──────────────────────────────────────────────

/**
 * Calculate coins deducted from contributor on PR rejection (50%).
 * This amount goes to the org treasury.
 */
export function calculateRejectionDeduction(stakeAmount: number): number {
  return Math.floor(stakeAmount * REJECTION_DEDUCTION_RATE);
}

/**
 * Calculate compensation paid from org treasury on issue closed without merge (30%).
 * This amount is paid to the contributor.
 */
export function calculateClosedCompensation(stakeAmount: number): number {
  return Math.floor(stakeAmount * CLOSED_COMPENSATION_RATE);
}

// ─── PR Lifecycle (PRD §2.3) ───────────────────────────────────────

const ISSUE_REF_RE = /#(\d+)/g;

/**
 * Issue numbers referenced in a PR title/body (`Fixes #12`, `#15`).
 * Order is first-mention; callers try each until a staked issue matches.
 */
export function parseIssueNumbers(text: string | null | undefined): number[] {
  if (!text) return [];
  const seen = new Set<number>();
  const numbers: number[] = [];
  for (const match of text.matchAll(ISSUE_REF_RE)) {
    const n = Number.parseInt(match[1], 10);
    if (!Number.isFinite(n) || seen.has(n)) continue;
    seen.add(n);
    numbers.push(n);
  }
  return numbers;
}

export interface ClassifyPROutcomeInput {
  merged: boolean;
  /** GitHub review.state: approved | changes_requested | commented | dismissed */
  lastReviewStatus: string | null | undefined;
  /** Merged PRs on this issue including the one being resolved. */
  acceptedCount: number;
}

/**
 * Map a GitHub close/merge event to one of the five PRD outcomes.
 *
 * Unreviewed = closed unmerged with no review on file.
 * Closed without merge = closed unmerged after a non-rejection review.
 * Rejected = closed unmerged and the latest review is `changes_requested`.
 */
export function classifyPROutcome(input: ClassifyPROutcomeInput): PROutcome {
  if (input.merged) {
    return input.acceptedCount > 1
      ? PROutcome.MULTIPLE_ACCEPTED
      : PROutcome.MERGED;
  }
  const status = (input.lastReviewStatus ?? '').trim().toLowerCase();
  if (status === 'changes_requested') return PROutcome.REJECTED;
  if (!status) return PROutcome.UNREVIEWED;
  return PROutcome.CLOSED_WITHOUT_MERGE;
}

export interface ComputePRFinancialsInput {
  outcome: PROutcome;
  stakeAmount: number;
  difficulty: Difficulty;
  acceptedCount: number;
}

export interface PRFinancials {
  stakeStatus: StakeStatus;
  /** Full locked stake is always released when a linked stake exists. */
  releaseLocked: boolean;
  refundToUser: number;
  deductionToTreasury: number;
  compensationFromTreasury: number;
  mergeBonus: number;
}

/**
 * Coin movements for a resolved PR. XP split for Multiple Accepted is §2.4.
 */
export function computePRFinancials(input: ComputePRFinancialsInput): PRFinancials {
  const { outcome, stakeAmount, difficulty, acceptedCount } = input;
  const fullBonus = MERGE_BONUS[difficulty] ?? 0;
  const splitBonus =
    acceptedCount > 0 ? Math.floor(fullBonus / acceptedCount) : 0;

  switch (outcome) {
    case PROutcome.MERGED:
      return {
        stakeStatus: StakeStatus.RETURNED,
        releaseLocked: true,
        refundToUser: stakeAmount,
        deductionToTreasury: 0,
        compensationFromTreasury: 0,
        mergeBonus: fullBonus,
      };
    case PROutcome.MULTIPLE_ACCEPTED:
      return {
        stakeStatus: StakeStatus.RETURNED,
        releaseLocked: true,
        refundToUser: stakeAmount,
        deductionToTreasury: 0,
        compensationFromTreasury: 0,
        mergeBonus: splitBonus,
      };
    case PROutcome.REJECTED: {
      const deduction = calculateRejectionDeduction(stakeAmount);
      return {
        stakeStatus: StakeStatus.DEDUCTED,
        releaseLocked: true,
        refundToUser: stakeAmount - deduction,
        deductionToTreasury: deduction,
        compensationFromTreasury: 0,
        mergeBonus: 0,
      };
    }
    case PROutcome.CLOSED_WITHOUT_MERGE:
      return {
        stakeStatus: StakeStatus.REFUNDED,
        releaseLocked: true,
        refundToUser: stakeAmount,
        deductionToTreasury: 0,
        compensationFromTreasury: calculateClosedCompensation(stakeAmount),
        mergeBonus: 0,
      };
    case PROutcome.UNREVIEWED:
      return {
        stakeStatus: StakeStatus.REFUNDED,
        releaseLocked: true,
        refundToUser: stakeAmount,
        deductionToTreasury: 0,
        compensationFromTreasury: 0,
        mergeBonus: 0,
      };
  }
}
