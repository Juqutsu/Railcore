import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Guild } from 'discord.js';
import { guildIdOf, guildsToLeave } from './allowlist.js';

void test('guildIdOf finds the server of an event', () => {
  const guild = Object.assign(Object.create(Guild.prototype) as Guild, { id: 'g1' });
  assert.equal(guildIdOf([guild]), 'g1');
  assert.equal(guildIdOf([{ guildId: 'g2' }]), 'g2'); // message, interaction, channel
  assert.equal(guildIdOf([{ guild: { id: 'g3' } }]), 'g3'); // member
  assert.equal(guildIdOf([new Map(), { guildId: 'g4' }]), 'g4'); // bulk delete: messages, channel
  assert.equal(guildIdOf([{ user: {} }]), undefined); // ready: the client
});

void test('guildsToLeave leaves only foreign servers, and never all of them', () => {
  const allowed = new Set(['test', 'prod']);
  assert.deepEqual(guildsToLeave(['test', 'prod', 'random'], allowed), ['random']);
  assert.deepEqual(guildsToLeave(['test', 'prod'], allowed), []);
  // One wrong ID: the bot is not in that server, so it must not leave the real one.
  assert.deepEqual(guildsToLeave(['test', 'realProd'], new Set(['test', 'prod-typo'])), []);
  assert.deepEqual(guildsToLeave(['prod', 'random'], allowed), []);
  assert.deepEqual(guildsToLeave(['random'], null), []);
});
