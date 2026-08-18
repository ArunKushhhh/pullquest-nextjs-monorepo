import { describe, it, expect } from 'vitest';
import { validateStakeAmount, calculateRejectionDeduction, calculateClosedCompensation, evaluateStakeAttempt } from '@pullquest/shared';
import { Difficulty } from '@pullquest/shared';

describe('Staking Validation & Economy Rules', () => {
  describe('validateStakeAmount', () => {
    it('should approve valid stakes in ranges', () => {
      expect(validateStakeAmount(15, Difficulty.EASY)).toBe(true);
      expect(validateStakeAmount(50, Difficulty.MEDIUM)).toBe(true);
      expect(validateStakeAmount(120, Difficulty.HARD)).toBe(true);
    });

    it('does not treat a band-valid amount as enough without matching Stake-X', () => {
      const result = evaluateStakeAttempt({
        amount: 100,
        issueStakeAmount: 160,
        difficulty: Difficulty.HARD,
        isOpen: true,
        alreadyStaked: false,
        stakingDisabled: false,
      });
      expect(result).toMatchObject({ ok: false, code: 'AMOUNT_MISMATCH' });
    });

    it('should reject stakes below difficulty min', () => {
      expect(validateStakeAmount(5, Difficulty.EASY)).toBe(false);
      expect(validateStakeAmount(20, Difficulty.MEDIUM)).toBe(false);
      expect(validateStakeAmount(70, Difficulty.HARD)).toBe(false);
    });

    it('should reject stakes above difficulty max', () => {
      expect(validateStakeAmount(35, Difficulty.EASY)).toBe(false);
      expect(validateStakeAmount(90, Difficulty.MEDIUM)).toBe(false);
      expect(validateStakeAmount(250, Difficulty.HARD)).toBe(false);
    });
  });

  describe('Rejection deduction math', () => {
    it('should deduct exactly 50% from rejected PR stakes', () => {
      expect(calculateRejectionDeduction(100)).toBe(50);
      expect(calculateRejectionDeduction(30)).toBe(15);
      expect(calculateRejectionDeduction(55)).toBe(27); // Math.floor(55 * 0.5)
    });
  });

  describe('Closed compensation math', () => {
    it('should pay exactly 30% compensation from treasury on closed unmerged PRs', () => {
      expect(calculateClosedCompensation(100)).toBe(30);
      expect(calculateClosedCompensation(50)).toBe(15);
      expect(calculateClosedCompensation(35)).toBe(10); // Math.floor(35 * 0.3)
    });
  });
});
