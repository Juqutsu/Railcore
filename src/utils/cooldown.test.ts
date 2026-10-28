import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createCooldown } from './cooldown.js';

void test('cooldown blocks repeat use until it expires', () => {
  const cooldown = createCooldown(1000);
  assert.equal(cooldown.take('a', 0), 0);
  assert.equal(cooldown.take('a', 400), 600);
  assert.equal(cooldown.take('b', 400), 0);
  assert.equal(cooldown.take('a', 1000), 0);
  assert.equal(cooldown.take('a', 1500), 500);
});
