import assert from 'node:assert/strict';
import { test } from 'node:test';
import { pickWinners, shuffle } from './draw.js';

const seq =
  (...xs: number[]) =>
  () =>
    xs.shift() ?? 0; // fake randomInt

void test('picks distinct winners up to count', async () => {
  const w = await pickWinners(['a', 'b', 'c', 'd'], 2, () => Promise.resolve(true));
  assert.equal(w.length, 2);
  assert.equal(new Set(w).size, 2);
});

void test('skips invalid candidates and takes the next one', async () => {
  const w = await pickWinners(['a', 'b', 'c'], 2, (id) => Promise.resolve(id !== 'b'));
  assert.deepEqual([...w].sort(), ['a', 'c']);
});

void test('fewer valid entrants than winners returns only the valid ones', async () => {
  assert.deepEqual(await pickWinners(['a'], 3, () => Promise.resolve(true)), ['a']);
  assert.deepEqual(await pickWinners([], 1, () => Promise.resolve(true)), []);
});

void test('shuffle is a permutation and does not mutate input', () => {
  const input = [1, 2, 3, 4];
  const out = shuffle(input, seq(0, 0, 0));
  assert.deepEqual([...out].sort(), [1, 2, 3, 4]);
  assert.deepEqual(input, [1, 2, 3, 4]);
});
