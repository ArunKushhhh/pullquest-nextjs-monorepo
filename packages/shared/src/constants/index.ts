import { Difficulty, TierName } from '../enums/index.js';

// ─── Tier Thresholds ───────────────────────────────────────────────
/**
 * XP range per tier. `min` is inclusive, `max` is exclusive (except OPEN_SOURCE_LEGEND).
 */
export const TIER_THRESHOLDS: Record<
  Exclude<TierName, TierName.UNRANKED>,
  { min: number; max: number }
> = {
  [TierName.INITIATOR]: { min: 0, max: 100 },
  [TierName.COMMITER]: { min: 100, max: 500 },
  [TierName.CONTRIBUTOR]: { min: 500, max: 1500 },
  [TierName.MERGE_MASTER]: { min: 1500, max: 3000 },
  [TierName.ARCHITECT]: { min: 3000, max: 5000 },
  [TierName.OPEN_SOURCE_LEGEND]: { min: 5000, max: Infinity },
};

/**
 * Ordered list of tiers from lowest to highest (excluding UNRANKED).
 */
export const TIER_ORDER: Exclude<TierName, TierName.UNRANKED>[] = [
  TierName.INITIATOR,
  TierName.COMMITER,
  TierName.CONTRIBUTOR,
  TierName.MERGE_MASTER,
  TierName.ARCHITECT,
  TierName.OPEN_SOURCE_LEGEND,
];

// ─── XP Caps ───────────────────────────────────────────────────────
/**
 * Maximum XP awardable per difficulty before multipliers.
 */
export const XP_CAPS: Record<Difficulty, number> = {
  [Difficulty.EASY]: 40,
  [Difficulty.MEDIUM]: 70,
  [Difficulty.HARD]: 100,
};

// ─── Trust Multipliers ─────────────────────────────────────────────
/**
 * Trust multiplier brackets. Evaluated in order — highest applicable wins.
 * Based on repo star count and org member count.
 */
export const TRUST_MULTIPLIER_BRACKETS = [
  { minMembers: 0, maxMembers: 5, minStars: 0, multiplier: 0.5 },
  { minMembers: 5, maxMembers: 20, minStars: 0, multiplier: 0.8 },
  { minMembers: 0, maxMembers: Infinity, minStars: 100, multiplier: 1.0 },
  { minMembers: 0, maxMembers: Infinity, minStars: 1000, multiplier: 1.5 },
] as const;

// ─── Difficulty Stake Ranges ───────────────────────────────────────
/**
 * Allowed coin stake range per difficulty band.
 */
export const DIFFICULTY_STAKE_RANGES: Record<
  Difficulty,
  { min: number; max: number }
> = {
  [Difficulty.EASY]: { min: 10, max: 30 },
  [Difficulty.MEDIUM]: { min: 30, max: 80 },
  [Difficulty.HARD]: { min: 80, max: 200 },
};

// ─── Coin Amounts ──────────────────────────────────────────────────
/**
 * Fixed coin amounts for system events.
 */
export const COIN_AMOUNTS = {
  SIGNUP: 150,
  MONTHLY: 100,
} as const;

/**
 * Bonus coins awarded on PR merge, per difficulty.
 */
export const MERGE_BONUS: Record<Difficulty, number> = {
  [Difficulty.EASY]: 10,
  [Difficulty.MEDIUM]: 25,
  [Difficulty.HARD]: 50,
};

/**
 * Base coin balance users are reset to at Act end, per tier.
 */
export const BASE_TIER_COINS: Record<
  Exclude<TierName, TierName.UNRANKED>,
  number
> = {
  [TierName.INITIATOR]: 50,
  [TierName.COMMITER]: 100,
  [TierName.CONTRIBUTOR]: 150,
  [TierName.MERGE_MASTER]: 200,
  [TierName.ARCHITECT]: 300,
  [TierName.OPEN_SOURCE_LEGEND]: 500,
};

// ─── Economic Rates ────────────────────────────────────────────────
/** Fraction of stake deducted on PR rejection (sent to org treasury). */
export const REJECTION_DEDUCTION_RATE = 0.5;

/** Fraction of stake amount paid as compensation from org treasury on closed-without-merge. */
export const CLOSED_COMPENSATION_RATE = 0.3;

/** Org treasury cannot go below this amount. Staking disabled beyond. */
export const TREASURY_DEBT_CEILING = -2000;

// ─── Seasonal ──────────────────────────────────────────────────────
/** Duration of one Act in days. */
export const ACT_DURATION_DAYS = 45;

/** Initiator tier XP reset factor at Act end. */
export const INITIATOR_XP_RESET_FACTOR = 0.5;

// ─── Evaluation ────────────────────────────────────────────────────
/** Maximum evaluation score a maintainer can give. */
export const MAX_EVALUATION_SCORE = 5;
