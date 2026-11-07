import assert from 'node:assert/strict';
import { test } from 'node:test';
import { weekKey, weekStart } from './week.js';

void test('weekKey matches ISO weeks, including the week year around New Year', () => {
  const cases: [string, string][] = [
    ['2026-11-07T12:00:00Z', '2026_W45'],
    ['2026-01-05T00:00:00Z', '2026_W02'],
    ['2026-12-31T23:59:59Z', '2026_W53'],
    ['2027-01-03T23:59:59Z', '2026_W53'],
    ['2027-01-04T00:00:00Z', '2027_W01'],
    ['2024-12-30T00:00:00Z', '2025_W01'],
    ['2021-01-03T12:00:00Z', '2020_W53'],
  ];
  for (const [date, key] of cases) assert.equal(weekKey(Date.parse(date)), key, date);
});

/** The game's own reference version, as its developer shared it. */
function gameWeekKey(unixSeconds: number): string {
  const day = Math.floor(unixSeconds / 86400);
  const thursday = day - ((day + 3) % 7) + 3;
  const d = new Date(thursday * 86400 * 1000);
  const yday = Math.floor((d.getTime() - Date.UTC(d.getUTCFullYear(), 0, 1)) / 86400000) + 1;
  const week = Math.floor((yday - 1) / 7) + 1;
  return `${d.getUTCFullYear()}_W${String(week).padStart(2, '0')}`;
}

void test('weekKey agrees with the game for every day from 2020 to 2035', () => {
  for (let ms = Date.UTC(2020, 0, 1); ms < Date.UTC(2035, 0, 1); ms += 86_400_000) {
    assert.equal(weekKey(ms + 43_200_000), gameWeekKey((ms + 43_200_000) / 1000));
  }
});

void test('the week changes at Monday 00:00 UTC', () => {
  const monday = Date.parse('2026-11-09T00:00:00Z');
  assert.equal(weekKey(monday - 1), '2026_W45');
  assert.equal(weekKey(monday), '2026_W46');
  assert.equal(weekStart(monday - 1), Date.parse('2026-11-02T00:00:00Z'));
  assert.equal(weekStart(monday), monday);
  // Last week is the week of the millisecond before this one started.
  assert.equal(weekKey(weekStart(monday) - 1), '2026_W45');
});
