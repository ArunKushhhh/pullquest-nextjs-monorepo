import { describe, it, expect } from 'vitest';
import { DIFFICULTY_STAKE_RANGES, TIER_THRESHOLDS, TRUST_MULTIPLIER_BRACKETS } from '../src/constants/index.js';
import { Difficulty, TierName } from '../src/enums/index.js';

describe('Game Rule Configurations', () => {
  it('should verify difficulty stake ranges are valid and logical', () => {
    expect(DIFFICULTY_STAKE_RANGES[Difficulty.EASY].min).toBeLessThanOrEqual(DIFFICULTY_STAKE_RANGES[Difficulty.EASY].max);
    expect(DIFFICULTY_STAKE_RANGES[Difficulty.EASY].max).toBeLessThanOrEqual(DIFFICULTY_STAKE_RANGES[Difficulty.MEDIUM].min);
    expect(DIFFICULTY_STAKE_RANGES[Difficulty.MEDIUM].max).toBeLessThanOrEqual(DIFFICULTY_STAKE_RANGES[Difficulty.HARD].min);
  });

  it('should verify tier thresholds are monotonically increasing', () => {
    const initiatorMax = TIER_THRESHOLDS[TierName.INITIATOR].max;
    const commiterMin = TIER_THRESHOLDS[TierName.COMMITER].min;
    expect(initiatorMax).toBe(commiterMin);
  });

  it('should verify trust multiplier brackets configuration', () => {
    expect(TRUST_MULTIPLIER_BRACKETS.length).toBeGreaterThan(0);
    for (const bracket of TRUST_MULTIPLIER_BRACKETS) {
      expect(bracket.multiplier).toBeGreaterThanOrEqual(0.5);
      expect(bracket.multiplier).toBeLessThanOrEqual(2.0);
    }
  });
});
