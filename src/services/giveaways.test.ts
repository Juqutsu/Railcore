import assert from 'node:assert/strict';
import { test } from 'node:test';
import { giveawayMessage, type GiveawayView } from './giveawayMessage.js';

type ButtonJson = { custom_id: string; label: string; disabled?: boolean };

const running = (overrides: Partial<GiveawayView> = {}): GiveawayView => ({
  id: 1,
  guildId: 'g',
  channelId: 'c',
  messageId: 'm',
  hostId: 'h',
  prize: 'Discord Nitro',
  winnerCount: 1,
  endsAt: new Date(Date.now() + 60_000),
  endedAt: null,
  announcedAt: null,
  cancelledAt: null,
  createdAt: new Date(),
  winnerIds: [],
  ...overrides,
});

const embedOf = (msg: ReturnType<typeof giveawayMessage>) => msg.embeds[0].toJSON();

void test('running giveaway shows count on the enter button', () => {
  const msg = giveawayMessage(running({ id: 7 }), 42);
  const button = msg.components[0].toJSON().components[0] as ButtonJson;
  assert.equal(button.custom_id, 'giveaway:enter:7');
  assert.match(button.label, /Enter · 42/);
  assert.notEqual(button.disabled, true);
  assert.match(embedOf(msg).title!, /^🎉 Discord Nitro$/);
});

void test('ended giveaway is grey with a disabled "Ended" button and lists winners', () => {
  const msg = giveawayMessage(running({ endedAt: new Date(), winnerIds: ['1', '2'] }), 128);
  const button = msg.components[0].toJSON().components[0] as ButtonJson;
  assert.equal(button.disabled, true);
  assert.equal(button.label, '🎉 Ended');
  assert.equal(embedOf(msg).color, 0x4e5058);
  assert.match(embedOf(msg).title!, /· Ended$/);
  assert.match(embedOf(msg).description!, /<@1>.*<@2>/s);
});

void test('ended without winners says "No valid entries."', () => {
  const msg = giveawayMessage(running({ endedAt: new Date(), winnerIds: [] }), 3);
  assert.match(embedOf(msg).description!, /No valid entries\./);
});

void test('cancelled giveaway shows "Cancelled"', () => {
  const now = new Date();
  const msg = giveawayMessage(running({ endedAt: now, cancelledAt: now }), 5);
  const button = msg.components[0].toJSON().components[0] as ButtonJson;
  assert.equal(button.label, '🎉 Cancelled');
  assert.match(embedOf(msg).title!, /· Cancelled$/);
});
