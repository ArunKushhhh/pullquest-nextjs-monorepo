import { describe, it, expect } from 'vitest';
import {
  parseIssueNumbers,
  classifyPROutcome,
  computePRFinancials,
  MERGE_BONUS,
} from '../src/index.js';
import { Difficulty, PROutcome, StakeStatus } from '../src/enums/index.js';

describe('parseIssueNumbers', () => {
  it('extracts unique issue refs in mention order', () => {
    expect(parseIssueNumbers('Fixes #1 and also #12. Re: #1')).toEqual([1, 12]);
  });

  it('returns empty when there are no hash refs', () => {
    expect(parseIssueNumbers('closes issue 4')).toEqual([]);
    expect(parseIssueNumbers(null)).toEqual([]);
  });
});

describe('classifyPROutcome', () => {
  it('classifies a first merge as MERGED and a later merge as MULTIPLE_ACCEPTED', () => {
    expect(
      classifyPROutcome({ merged: true, lastReviewStatus: 'approved', acceptedCount: 1 })
    ).toBe(PROutcome.MERGED);
    expect(
      classifyPROutcome({ merged: true, lastReviewStatus: null, acceptedCount: 2 })
    ).toBe(PROutcome.MULTIPLE_ACCEPTED);
  });

  it('rejects only when the latest review is changes_requested', () => {
    expect(
      classifyPROutcome({
        merged: false,
        lastReviewStatus: 'changes_requested',
        acceptedCount: 0,
      })
    ).toBe(PROutcome.REJECTED);
  });

  it('treats a close with no review as UNREVIEWED', () => {
    expect(
      classifyPROutcome({ merged: false, lastReviewStatus: null, acceptedCount: 0 })
    ).toBe(PROutcome.UNREVIEWED);
    expect(
      classifyPROutcome({ merged: false, lastReviewStatus: '  ', acceptedCount: 0 })
    ).toBe(PROutcome.UNREVIEWED);
  });

  it('pays closed-without-merge compensation after a non-rejection review', () => {
    expect(
      classifyPROutcome({ merged: false, lastReviewStatus: 'approved', acceptedCount: 0 })
    ).toBe(PROutcome.CLOSED_WITHOUT_MERGE);
    expect(
      classifyPROutcome({ merged: false, lastReviewStatus: 'commented', acceptedCount: 0 })
    ).toBe(PROutcome.CLOSED_WITHOUT_MERGE);
  });
});

describe('computePRFinancials', () => {
  it('returns the stake and full merge bonus on MERGED', () => {
    expect(
      computePRFinancials({
        outcome: PROutcome.MERGED,
        stakeAmount: 160,
        difficulty: Difficulty.HARD,
        acceptedCount: 1,
      })
    ).toEqual({
      stakeStatus: StakeStatus.RETURNED,
      releaseLocked: true,
      refundToUser: 160,
      deductionToTreasury: 0,
      compensationFromTreasury: 0,
      mergeBonus: MERGE_BONUS[Difficulty.HARD],
    });
  });

  it('splits the merge bonus equally on MULTIPLE_ACCEPTED', () => {
    const financials = computePRFinancials({
      outcome: PROutcome.MULTIPLE_ACCEPTED,
      stakeAmount: 50,
      difficulty: Difficulty.MEDIUM,
      acceptedCount: 2,
    });
    expect(financials.mergeBonus).toBe(Math.floor(MERGE_BONUS[Difficulty.MEDIUM] / 2));
    expect(financials.refundToUser).toBe(50);
    expect(financials.stakeStatus).toBe(StakeStatus.RETURNED);
  });

  it('sends 50% of the stake to the org treasury on REJECTED', () => {
    expect(
      computePRFinancials({
        outcome: PROutcome.REJECTED,
        stakeAmount: 100,
        difficulty: Difficulty.HARD,
        acceptedCount: 0,
      })
    ).toMatchObject({
      stakeStatus: StakeStatus.DEDUCTED,
      refundToUser: 50,
      deductionToTreasury: 50,
      compensationFromTreasury: 0,
      mergeBonus: 0,
    });
  });

  it('refunds in full on UNREVIEWED with no treasury compensation', () => {
    expect(
      computePRFinancials({
        outcome: PROutcome.UNREVIEWED,
        stakeAmount: 80,
        difficulty: Difficulty.HARD,
        acceptedCount: 0,
      })
    ).toMatchObject({
      stakeStatus: StakeStatus.REFUNDED,
      refundToUser: 80,
      deductionToTreasury: 0,
      compensationFromTreasury: 0,
    });
  });

  it('refunds and pays 30% treasury compensation on CLOSED_WITHOUT_MERGE', () => {
    expect(
      computePRFinancials({
        outcome: PROutcome.CLOSED_WITHOUT_MERGE,
        stakeAmount: 100,
        difficulty: Difficulty.MEDIUM,
        acceptedCount: 0,
      })
    ).toMatchObject({
      stakeStatus: StakeStatus.REFUNDED,
      refundToUser: 100,
      compensationFromTreasury: 30,
    });
  });
});
