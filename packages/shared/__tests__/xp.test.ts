import { describe, it, expect } from 'vitest';
import {
  averageEvaluationScore,
  calculateXP,
  getTierForXP,
  calculateActResetXP,
  getTrustMultiplier,
  effectiveTierForActReset,
  actDaysRemaining,
  getActResetCoinBalance,
} from '../src/utils/index.js';
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

    it('should award Hard cap × 0.5× trust at a perfect evaluation', () => {
      const xp = calculateXP(Difficulty.HARD, 5, 0.5);
      expect(xp).toBe(50);
    });
  });

  describe('getTrustMultiplier', () => {
    it('defaults small orgs (0–4 members, no stars) to 0.5×', () => {
      expect(getTrustMultiplier(0, 0)).toBe(0.5);
      expect(getTrustMultiplier(4, 0)).toBe(0.5);
    });

    it('applies 0.8× for 5–19 members without star boosts', () => {
      expect(getTrustMultiplier(5, 0)).toBe(0.8);
      expect(getTrustMultiplier(19, 0)).toBe(0.8);
    });

    it('uses the highest applicable star bracket over member count', () => {
      expect(getTrustMultiplier(1, 100)).toBe(1.0);
      expect(getTrustMultiplier(1, 1000)).toBe(1.5);
      expect(getTrustMultiplier(19, 1000)).toBe(1.5);
    });
  });

  describe('averageEvaluationScore', () => {
    it('averages the five questionnaire scores onto a 0–5 scale', () => {
      expect(
        averageEvaluationScore({
          code_quality_score: 5,
          complexity_score: 4,
          test_coverage_score: 5,
          documentation_score: 4,
          overall_score: 5,
        })
      ).toBe(4.6);
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

    it('should reset Contributor XP to the Commiter midpoint', () => {
      expect(calculateActResetXP(800, TierName.CONTRIBUTOR)).toBe(300);
    });
  });

  describe('effectiveTierForActReset', () => {
    it('keeps a ranked tier as-is', () => {
      expect(effectiveTierForActReset(TierName.COMMITER, 200)).toBe(TierName.COMMITER);
    });

    it('maps UNRANKED to the XP-derived ranked tier', () => {
      expect(effectiveTierForActReset(TierName.UNRANKED, 40)).toBe(TierName.INITIATOR);
      expect(effectiveTierForActReset(TierName.UNRANKED, 300)).toBe(TierName.COMMITER);
    });
  });

  describe('actDaysRemaining', () => {
    it('returns 0 when the act has ended', () => {
      expect(actDaysRemaining('2020-01-01T00:00:00.000Z', new Date('2026-08-21'))).toBe(0);
    });
  });

  describe('getActResetCoinBalance', () => {
    it('returns Initiator base coins after an Initiator drop', () => {
      expect(getActResetCoinBalance(TierName.INITIATOR)).toBe(50);
    });
  });
});
