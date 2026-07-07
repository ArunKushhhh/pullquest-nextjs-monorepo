/**
 * User roles in PullQuest, inferred from GitHub permissions.
 */
export enum UserRole {
  CONTRIBUTOR = 'CONTRIBUTOR',
  MAINTAINER = 'MAINTAINER',
  ORG_ADMIN = 'ORG_ADMIN',
  PLATFORM_ADMIN = 'PLATFORM_ADMIN',
}

/**
 * Possible outcomes for a Pull Request linked to a staked issue.
 */
export enum PROutcome {
  UNREVIEWED = 'UNREVIEWED',
  MERGED = 'MERGED',
  REJECTED = 'REJECTED',
  MULTIPLE_ACCEPTED = 'MULTIPLE_ACCEPTED',
  CLOSED_WITHOUT_MERGE = 'CLOSED_WITHOUT_MERGE',
}

/**
 * Issue difficulty bands. Determines XP cap and allowed stake range.
 */
export enum Difficulty {
  EASY = 'EASY',
  MEDIUM = 'MEDIUM',
  HARD = 'HARD',
}

/**
 * Tier names ordered by XP progression.
 */
export enum TierName {
  UNRANKED = 'UNRANKED',
  INITIATOR = 'INITIATOR',
  COMMITER = 'COMMITER',
  CONTRIBUTOR = 'CONTRIBUTOR',
  MERGE_MASTER = 'MERGE_MASTER',
  ARCHITECT = 'ARCHITECT',
  OPEN_SOURCE_LEGEND = 'OPEN_SOURCE_LEGEND',
}

/**
 * Lifecycle status of a stake.
 */
export enum StakeStatus {
  LOCKED = 'LOCKED',
  RETURNED = 'RETURNED',
  DEDUCTED = 'DEDUCTED',
  REFUNDED = 'REFUNDED',
}

/**
 * Types of coin transactions for the full ledger.
 */
export enum CoinTransactionType {
  SIGNUP_BONUS = 'SIGNUP_BONUS',
  MONTHLY_MINT = 'MONTHLY_MINT',
  STAKE_LOCK = 'STAKE_LOCK',
  STAKE_RETURN = 'STAKE_RETURN',
  STAKE_DEDUCTION = 'STAKE_DEDUCTION',
  MERGE_BONUS = 'MERGE_BONUS',
  PURCHASE = 'PURCHASE',
  TREASURY_COMPENSATION = 'TREASURY_COMPENSATION',
  ACT_RESET = 'ACT_RESET',
}

/**
 * Internal status of a PR within PullQuest's system.
 */
export enum PRStatus {
  OPEN = 'OPEN',
  AWAITING_EVALUATION = 'AWAITING_EVALUATION',
  RESOLVED = 'RESOLVED',
}

/**
 * Lifecycle status of a seasonal Act.
 */
export enum ActStatus {
  ACTIVE = 'ACTIVE',
  ENDED = 'ENDED',
  ARCHIVED = 'ARCHIVED',
}
