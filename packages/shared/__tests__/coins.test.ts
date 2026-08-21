import { describe, it, expect } from 'vitest';
import {
  COIN_BUNDLES,
  coinBundlePurchaseDescription,
  inferCoinBundleId,
  isCoinBundleId,
} from '../src/index.js';

describe('Coin bundles', () => {
  it('recognizes catalog ids', () => {
    expect(isCoinBundleId('coins_100')).toBe(true);
    expect(isCoinBundleId('coins_999')).toBe(false);
  });

  it('tags purchase descriptions with the bundle id', () => {
    expect(coinBundlePurchaseDescription('coins_500')).toBe(
      'Purchased coin bundle:coins_500'
    );
  });

  it('infers a bundle from a tagged description even if amount drifts', () => {
    expect(
      inferCoinBundleId({
        amount: 220,
        description: coinBundlePurchaseDescription('coins_1000'),
      })
    ).toBe('coins_1000');
  });

  it('falls back to catalog amount for legacy untagged purchases', () => {
    expect(
      inferCoinBundleId({ amount: 100, description: 'Purchased coin bundle' })
    ).toBe('coins_100');
    expect(
      inferCoinBundleId({ amount: COIN_BUNDLES.coins_500.amount, description: null })
    ).toBe('coins_500');
  });

  it('returns null when amount does not match a catalog pack', () => {
    expect(inferCoinBundleId({ amount: 220, description: 'Purchased coin bundle' })).toBeNull();
  });
});
