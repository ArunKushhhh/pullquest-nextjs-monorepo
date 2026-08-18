import { describe, it, expect } from 'vitest';
import {
  parseStakeLabels,
  evaluateStakeAttempt,
  validateStakeAmount,
} from '../src/utils/index.js';
import { Difficulty } from '../src/enums/index.js';

describe('parseStakeLabels', () => {
  it('parses difficulty and exact Stake-X amount', () => {
    expect(parseStakeLabels(['Medium', 'Stake-50'])).toEqual({
      difficulty: Difficulty.MEDIUM,
      amount: 50,
    });
  });

  it('treats Stake-Easy as difficulty, not an amount', () => {
    expect(parseStakeLabels(['Stake-Easy', 'Stake-20'])).toEqual({
      difficulty: Difficulty.EASY,
      amount: 20,
    });
  });

  it('returns nulls when labels are missing', () => {
    expect(parseStakeLabels(['bug', 'help wanted'])).toEqual({
      difficulty: null,
      amount: null,
    });
  });
});

describe('evaluateStakeAttempt', () => {
  const base = {
    amount: 160,
    issueStakeAmount: 160,
    difficulty: Difficulty.HARD,
    isOpen: true,
    alreadyStaked: false,
    stakingDisabled: false,
  };

  it('accepts the exact Stake-X amount inside the difficulty band', () => {
    expect(evaluateStakeAttempt(base)).toEqual({ ok: true });
    expect(validateStakeAmount(160, Difficulty.HARD)).toBe(true);
  });

  it('rejects a band-valid amount that does not match Stake-X', () => {
    const result = evaluateStakeAttempt({ ...base, amount: 100 });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('AMOUNT_MISMATCH');
  });

  it('rejects a closed issue, duplicate stake, and disabled treasury', () => {
    expect(evaluateStakeAttempt({ ...base, isOpen: false })).toMatchObject({
      code: 'ISSUE_CLOSED',
    });
    expect(evaluateStakeAttempt({ ...base, alreadyStaked: true })).toMatchObject({
      code: 'ALREADY_STAKED',
    });
    expect(evaluateStakeAttempt({ ...base, stakingDisabled: true })).toMatchObject({
      code: 'STAKING_DISABLED',
    });
  });
});
