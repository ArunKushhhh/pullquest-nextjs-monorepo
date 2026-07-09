import { describe, it, expect } from 'vitest';
import { calculateXP, getTierForXP, calculateActResetXP } from '../src/utils/index.js';
import { Difficulty, TierName } from '../src/enums/index.js';

describe('XP Math & Tier Progression', () => {
  describe('calculateXP', () => {
    it('should correctly calculate XP for Easy difficulty with max score', () => {
      const xp = calculateXP(Difficulty.EASY, 5, 1.0);
      expect(xp).toBe(40); // Cap 40 * (5/5) * 1.0
    });

    it('should correctly calculate XP for Medium difficulty with partial score', () => {
      const xp = calculateXP(Difficulty.MEDIUM, 3, 0.8);
      expect(xp).toBe(33); // Cap 70 * (3/5) * 0.8 = 33.6 -> floored to 33
    });

    it('should correctly calculate XP for Hard difficulty with min score', () => {
      const xp = calculateXP(Difficulty.HARD, 0, 1.5);
      expect(xp).toBe(0); // Cap 100 * (0/5) * 1.5 = 0
    });

    it('should bound XP output to a minimum of 0', () => {
      const xp = calculateXP(Difficulty.EASY, -1, 1.0);
      expect(xp).toBe(0);
    });
  });

  describe('getTierForXP', () => {
    it('should resolve INITIATOR for 0 XP', () => {
      expect(getTierForXP(0)).toBe(TierName.INITIATOR);
    });

    it('should resolve COMMITER for basic XP', () => {
      expect(getTierForXP(150)).toBe(TierName.COMMITER);
    });

    it('should resolve OPEN_SOURCE_LEGEND for maximum tier XP', () => {
      expect(getTierForXP(12000)).toBe(TierName.OPEN_SOURCE_LEGEND);
    });
  });

  describe('calculateActResetXP', () => {
    it('should halve XP for INITIATOR tier resets', () => {
      const resetXp = calculateActResetXP(80, TierName.INITIATOR);
      expect(resetXp).toBe(40); // 80 * 0.5
    });

    it('should return midpoint of lower tier for higher tier resets', () => {
      // Lower tier of COMMITER is INITIATOR.
      // INITIATOR threshold is [0, 100).
      // Midpoint of INITIATOR is (0 + 100) / 2 = 50.
      const resetXp = calculateActResetXP(300, TierName.COMMITER);
      expect(resetXp).toBe(50);
    });
  });
});
