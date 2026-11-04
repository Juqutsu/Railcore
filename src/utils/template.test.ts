import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fillChannelName, fillTemplate } from './template.js';

void test('fillTemplate fills known placeholders and keeps unknown ones', () => {
  const values = new Map([
    ['name', 'Ana'],
    ['count', '12'],
  ]);
  assert.equal(fillTemplate('Hi {name}, #{count} {name}!', values), 'Hi Ana, #12 Ana!');
  assert.equal(fillTemplate('{nmae} {constructor} {}', values), '{nmae} {constructor} {}');
});

void test('fillChannelName gives one line of at most 100 characters', () => {
  const values = new Map([['count', '1,234']]);
  assert.equal(fillChannelName('🚆  {count}\nonline ', values), '🚆 1,234 online');
  assert.equal(fillChannelName('x'.repeat(120), values).length, 100);
  assert.equal(fillChannelName(' \n ', values), '');
});
