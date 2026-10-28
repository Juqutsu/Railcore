import assert from 'node:assert/strict';
import { test } from 'node:test';
import { renderTranscript } from './transcript.js';

const meta = {
  title: 'Support ticket #0001',
  guildName: 'Falkenberg Railways',
  openedBy: 'eve',
  openedAt: new Date(0),
  closedAt: new Date(60_000),
};

void test('renderTranscript escapes everything users control', () => {
  const html = renderTranscript(meta, [
    {
      author: '<b>Eve</b>',
      avatarUrl: 'https://cdn.example/a.png?x=1&y=2',
      bot: false,
      createdAt: new Date(0),
      content: '<script>alert(1)</script>',
      embeds: [{ title: '<i>t</i>', fields: [{ name: 'Age', value: '"><img src=x>' }] }],
      attachments: [{ name: 'log<1>.txt', url: 'https://cdn.example/f"onclick=1' }],
    },
  ]);
  for (const raw of ['<script>', '<b>Eve</b>', '<i>t</i>', '<img src=x>', 'f"onclick', 'log<1>']) {
    assert.ok(!html.includes(raw), `unescaped: ${raw}`);
  }
  assert.ok(html.includes('&#60;script&#62;'));
  assert.ok(html.includes('1970-01-01 00:00 UTC – 1970-01-01 00:01 UTC'));
});
