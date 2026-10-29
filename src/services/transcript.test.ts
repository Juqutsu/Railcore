import assert from 'node:assert/strict';
import { test } from 'node:test';
import { dataUri, renderTranscript, type TranscriptMessage } from './transcript.js';

const meta = {
  title: 'Support ticket #0001',
  guildName: 'Falkenberg Railways',
  openedBy: 'eve',
  openedAt: new Date(0),
  closedAt: new Date(60_000),
};

const message = (overrides: Partial<TranscriptMessage>): TranscriptMessage => ({
  author: 'eve',
  avatarUrl: 'https://cdn.example/a.png',
  bot: false,
  createdAt: new Date(0),
  content: '',
  embeds: [],
  attachments: [],
  ...overrides,
});

void test('renderTranscript escapes everything users control', () => {
  const html = renderTranscript(meta, [
    message({
      author: '<b>Eve</b>',
      avatarUrl: 'https://cdn.example/a.png?x=1&y=2',
      content: '<script>alert(1)</script>',
      embeds: [{ title: '<i>t</i>', fields: [{ name: 'Age', value: '"><img src=x>' }] }],
      attachments: [
        { name: 'log<1>.txt', url: 'https://cdn.example/f"onclick=1', contentType: null, size: 1 },
      ],
    }),
  ]);
  for (const raw of ['<script>', '<b>Eve</b>', '<i>t</i>', '<img src=x>', 'f"onclick', 'log<1>']) {
    assert.ok(!html.includes(raw), `unescaped: ${raw}`);
  }
  assert.ok(html.includes('&#60;script&#62;'));
  assert.ok(html.includes('1970-01-01 00:00 UTC – 1970-01-01 00:01 UTC'));
});

void test('renderTranscript inlines saved files and marks the rest as expiring links', () => {
  const png = dataUri('image/png', Buffer.from('png'));
  const pdf = dataUri('application/pdf', Buffer.from('pdf'));
  const html = renderTranscript(meta, [
    message({
      attachments: [
        { name: 'a.png', url: 'https://cdn/a', contentType: 'image/png', size: 3, dataUri: png },
        {
          name: 'b.pdf',
          url: 'https://cdn/b',
          contentType: 'application/pdf',
          size: 3,
          dataUri: pdf,
        },
        { name: 'c.zip', url: 'https://cdn/c', contentType: 'application/zip', size: 3 },
      ],
    }),
  ]);
  assert.ok(html.includes(`<img class="attachment" src="${png}"`));
  assert.ok(!html.includes(`href="${png}"`), 'images must be embedded only once');
  assert.ok(html.includes(`href="${pdf}" download="b.pdf"`));
  assert.ok(html.includes('href="https://cdn/c"'));
  assert.ok(html.includes('link may expire'));
});

void test('dataUri never trusts an odd content type', () => {
  assert.ok(dataUri('image/png', Buffer.from('x')).startsWith('data:image/png;base64,'));
  for (const type of ['text/html"><script>', 'image/png;base64,AAA', null]) {
    assert.ok(dataUri(type, Buffer.from('x')).startsWith('data:application/octet-stream;base64,'));
  }
});
