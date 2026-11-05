import assert from 'node:assert/strict';
import { test } from 'node:test';
import { textProblem } from './setup.js';

void test('stat channel names must keep {count}, or the number never changes', () => {
  // The real case: a channel name pasted as the template, with the number typed in.
  assert.ok(textProblem('playerCountName', '🚄・126 on duty'));
  assert.ok(textProblem('memberCountName', '👥 Members: 135'));
  assert.equal(textProblem('playerCountName', '🚄・{count} on duty'), null);
  // Empty means "use the default name".
  assert.equal(textProblem('boostCountName', ''), null);
  // Other texts have no required placeholder.
  assert.equal(textProblem('welcomeMessage', 'Welcome aboard!'), null);
});
