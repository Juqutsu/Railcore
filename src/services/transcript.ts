import type { Message, TextChannel } from 'discord.js';
import { t } from '../text.js';

export type TranscriptMessage = {
  author: string;
  avatarUrl: string;
  bot: boolean;
  createdAt: Date;
  content: string;
  embeds: { title?: string; description?: string; fields: { name: string; value: string }[] }[];
  attachments: { name: string; url: string }[];
};

export type TranscriptMeta = {
  title: string;
  guildName: string;
  openedBy: string;
  openedAt: Date;
  closedAt: Date;
};

/** All messages in a channel, oldest first. */
// ponytail: capped at 5000 messages; page further if tickets ever get that long.
export async function fetchAllMessages(channel: TextChannel, max = 5000): Promise<Message[]> {
  const messages: Message[] = [];
  let before: string | undefined;
  while (messages.length < max) {
    const batch = await channel.messages.fetch({ limit: 100, before });
    messages.push(...batch.values());
    if (batch.size < 100) break;
    before = batch.lastKey();
  }
  return messages.reverse();
}

export function toTranscriptMessage(message: Message): TranscriptMessage {
  const { guild } = message;
  // Raw mentions (<@123>) mean nothing outside Discord, so swap in names.
  const readable = (text: string) =>
    text
      .replace(/<@!?(\d+)>/g, (_, id: string) => {
        const user = message.mentions.users.get(id) ?? message.client.users.cache.get(id);
        return `@${user?.username ?? id}`;
      })
      .replace(/<@&(\d+)>/g, (_, id: string) => `@${guild?.roles.cache.get(id)?.name ?? id}`)
      .replace(/<#(\d+)>/g, (_, id: string) => `#${guild?.channels.cache.get(id)?.name ?? id}`);

  return {
    author: message.member?.displayName ?? message.author.username,
    avatarUrl: message.author.displayAvatarURL({ size: 64 }),
    bot: message.author.bot,
    createdAt: message.createdAt,
    content: readable(message.content),
    embeds: message.embeds.map((embed) => ({
      title: embed.title ? readable(embed.title) : undefined,
      description: embed.description ? readable(embed.description) : undefined,
      fields: embed.fields.map((field) => ({ name: field.name, value: readable(field.value) })),
    })),
    attachments: [...message.attachments.values()].map((file) => ({
      name: file.name,
      url: file.url,
    })),
  };
}

const escape = (text: string) => text.replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`);
const stamp = (date: Date) => `${date.toISOString().slice(0, 16).replace('T', ' ')} UTC`;

function renderMessage(message: TranscriptMessage): string {
  const embeds = message.embeds
    .map(
      (embed) =>
        `<div class="embed">${embed.title ? `<h3>${escape(embed.title)}</h3>` : ''}${
          embed.description ? `<div class="text">${escape(embed.description)}</div>` : ''
        }${embed.fields
          .map(
            (f) =>
              `<div class="field"><b>${escape(f.name)}</b><div class="text">${escape(f.value)}</div></div>`,
          )
          .join('')}</div>`,
    )
    .join('');
  const files = message.attachments
    .map(
      (file) => `<div class="file"><a href="${escape(file.url)}">📎 ${escape(file.name)}</a></div>`,
    )
    .join('');
  const badge = message.bot ? `<span class="bot">${escape(t.transcript.bot)}</span>` : '';
  const content = message.content ? `<div class="text">${escape(message.content)}</div>` : '';
  return `<div class="msg"><img src="${escape(message.avatarUrl)}" alt=""><div class="body"><div><span class="name">${escape(message.author)}</span>${badge}<time>${stamp(message.createdAt)}</time></div>${content}${embeds}${files}</div></div>`;
}

export function renderTranscript(meta: TranscriptMeta, messages: TranscriptMessage[]): string {
  const summary = [
    meta.guildName,
    `${t.transcript.openedBy} ${meta.openedBy}`,
    `${stamp(meta.openedAt)} – ${stamp(meta.closedAt)}`,
    t.transcript.messages(messages.length),
  ]
    .map(escape)
    .join(' · ');

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escape(meta.title)}</title>
<style>
:root{--brand:#f76b15;--bg:#f6f6f7;--card:#fff;--text:#1d1d20;--muted:#6c6c75;--line:#e5e5e9}
@media (prefers-color-scheme:dark){:root{--bg:#131315;--card:#1c1c20;--text:#ececf0;--muted:#9b9ba5;--line:#2a2a30}}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--text);font:15px/1.5 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
header{background:var(--card);border-top:4px solid var(--brand);border-bottom:1px solid var(--line);padding:20px 16px}
header div,main{max-width:860px;margin:0 auto}
h1{margin:0 0 4px;font-size:20px}
header p{margin:0;color:var(--muted);font-size:13px}
main{padding:8px 16px}
.msg{display:flex;gap:12px;padding:12px 0;border-bottom:1px solid var(--line)}
.msg img{width:36px;height:36px;border-radius:50%;flex:none}
.body{min-width:0;flex:1}
.name{font-weight:600}
.bot{background:var(--brand);color:#fff;font-size:10px;font-weight:700;padding:1px 5px;border-radius:4px;margin-left:6px;vertical-align:2px}
time{color:var(--muted);font-size:12px;margin-left:8px}
.text{white-space:pre-wrap;overflow-wrap:anywhere}
.embed{background:var(--card);border-left:4px solid var(--brand);border-radius:4px;padding:8px 12px;margin-top:6px}
.embed h3{margin:0 0 4px;font-size:15px}
.field{margin-top:6px}
.field b{font-size:13px}
a{color:var(--brand)}
footer{color:var(--muted);font-size:12px;text-align:center;padding:24px 16px}
</style>
</head>
<body>
<header><div><h1>${escape(meta.title)}</h1><p>${summary}</p></div></header>
<main>
${messages.map(renderMessage).join('\n')}
</main>
<footer>${escape(t.footer)}</footer>
</body>
</html>
`;
}
