import assert from 'node:assert/strict';
import { test } from 'node:test';
import { formatDuration, parseDuration, parseWholeNumber } from './duration.js';

void test('parseWholeNumber accepts whole numbers in range', () => {
  assert.equal(parseWholeNumber('7', 365), 7);
  assert.equal(parseWholeNumber(' 0 ', 365), 0);
  assert.equal(parseWholeNumber('365', 365), 365);
  assert.equal(parseWholeNumber('720', 720), 720);
});

void test('parseWholeNumber rejects everything else', () => {
  for (const input of ['366', '-1', '1.5', 'abc', '', '7d']) {
    assert.equal(parseWholeNumber(input, 365), null, input);
  }
});

void test('parseDuration reads single and combined units', () => {
  assert.equal(parseDuration('10m'), 600_000);
  assert.equal(parseDuration('2H'), 7_200_000);
  assert.equal(parseDuration('1d 12h'), 129_600_000);
  assert.equal(parseDuration('1w'), 604_800_000);
  assert.equal(parseDuration('90s'), 90_000);
});

void test('parseDuration rejects anything else', () => {
  for (const input of ['', '10', 'm', '1x', '-5m', '1.5h', 'ten minutes']) {
    assert.equal(parseDuration(input), null, input);
  }
});

void test('formatDuration shows the two largest units', () => {
  assert.equal(formatDuration(600_000), '10 minutes');
  assert.equal(formatDuration(86_400_000 + 3 * 3_600_000 + 60_000), '1 day 3 hours');
  assert.equal(formatDuration(3_600_000), '1 hour');
  assert.equal(formatDuration(0), '0 seconds');
});
