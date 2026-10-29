import assert from 'node:assert/strict';
import { test } from 'node:test';
import { rankOf, rankUp, reachedTiers } from './xpTiers.js';

// The game's own ranks, in a scrambled order on purpose.
const tiers = [
  { roleId: 'driver', minXp: 150 },
  { roleId: 'guest', minXp: 0 },
  { roleId: 'chief', minXp: 1500 },
  { roleId: 'trainee', minXp: 25 },
  { roleId: 'experienced', minXp: 500 },
];
const ids = (list: { roleId: string }[]) => list.map((tier) => tier.roleId).sort();

void test('reachedTiers stacks every tier up to the XP', () => {
  assert.deepEqual(ids(reachedTiers(tiers, 0)), ['guest']);
  assert.deepEqual(ids(reachedTiers(tiers, 150)), ['driver', 'guest', 'trainee']);
  assert.deepEqual(ids(reachedTiers(tiers, 9999)), ids(tiers));
  assert.deepEqual(reachedTiers(tiers, null), []);
});

void test('rankOf finds the current and the next tier', () => {
  assert.deepEqual(rankOf(tiers, 149), {
    current: { roleId: 'trainee', minXp: 25 },
    next: { roleId: 'driver', minXp: 150 },
  });
  assert.equal(rankOf(tiers, 2000).next, undefined);
  assert.equal(rankOf([{ roleId: 'a', minXp: 10 }], 5).current, undefined);
});

void test('rankUp only fires when playing crosses a tier', () => {
  assert.equal(rankUp(tiers, 140, 160)?.roleId, 'driver');
  assert.equal(rankUp(tiers, 20, 600)?.roleId, 'experienced');
  assert.equal(rankUp(tiers, 150, 160), undefined);
  assert.equal(rankUp(tiers, null, 160), undefined);
  assert.equal(rankUp(tiers, 160, 160), undefined);
  assert.equal(rankUp(tiers, 600, 100), undefined);
});
