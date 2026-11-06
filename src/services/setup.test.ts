import assert from 'node:assert/strict';
import { test } from 'node:test';
import { GAME_GROUPS, GROUPS, textProblem } from './setup.js';

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

void test('each setup menu fits Discord’s 25-option limit', () => {
  const count = (game: boolean) =>
    GROUPS.filter((g) => GAME_GROUPS.includes(g.name) === game).flatMap((g) => g.keys).length +
    (game ? 1 : 0); // XP roles entry
  assert.ok(count(false) <= 25);
  assert.ok(count(true) <= 25);
});

void test('giveaway settings are in the Giveaways group', () => {
  const group = GROUPS.find((g) => g.name === 'giveaways');
  assert.deepEqual(group?.keys, [
    'giveawayChannelId',
    'giveawayPingRoleId',
    'giveawayHostRoleIds',
    'giveawayBlockedRoleIds',
    'giveawayBlockWarned',
    'giveawayWarnDays',
    'giveawayWinnerCooldownDays',
  ]);
});
