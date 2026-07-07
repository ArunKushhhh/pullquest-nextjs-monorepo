import { Difficulty, TierName } from '../enums/index.js';
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
} from '../constants/index.js';

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

// ─── Tier Resolution ───────────────────────────────────────────────

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
  let highest = 0.5; // default minimum

  for (const bracket of TRUST_MULTIPLIER_BRACKETS) {
    const membersMatch =
      memberCount >= bracket.minMembers &&
      memberCount < bracket.maxMembers;
    const starsMatch = starCount >= bracket.minStars;

    if (membersMatch || starsMatch) {
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

// ─── Stake Validation ──────────────────────────────────────────────

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
