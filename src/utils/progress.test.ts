import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseProgress } from './progress.js';

void test('parseProgress reads the fields the bot shows', () => {
  const profile = {
    version: 3,
    xp: 46,
    points: 560,
    tripCount: 44,
    totalKm: 103.84,
    totalStops: 212,
    ownedTrains: { BR442: true },
  };
  assert.deepEqual(parseProgress(profile), {
    xp: 46,
    points: 560,
    trips: 44,
    km: 103.84,
    stops: 212,
  });
});

void test('parseProgress treats bad, missing and pre-v2 values as 0', () => {
  const zero = { xp: 0, points: 0, trips: 0, km: 0, stops: 0 };
  assert.deepEqual(parseProgress(null), zero);
  assert.deepEqual(parseProgress('nope'), zero);
  assert.deepEqual(parseProgress({ version: 3, xp: '46', points: null, totalKm: NaN }), zero);
  assert.deepEqual(parseProgress({ version: 1, xp: 46, points: 560, tripCount: 5 }), {
    ...zero,
    trips: 5,
  });
  assert.deepEqual(parseProgress({ xp: 46, points: 560 }), zero);
});
