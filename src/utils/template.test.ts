import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fillTemplate } from './template.js';

void test('fillTemplate fills known placeholders and keeps unknown ones', () => {
  const values = new Map([
    ['name', 'Ana'],
    ['count', '12'],
  ]);
  assert.equal(fillTemplate('Hi {name}, #{count} {name}!', values), 'Hi Ana, #12 Ana!');
  assert.equal(fillTemplate('{nmae} {constructor} {}', values), '{nmae} {constructor} {}');
});
