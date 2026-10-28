import { EmbedBuilder } from 'discord.js';
import { t } from '../text.js';

export const colors = {
  brand: 0xf76b15,
  success: 0x3e9b4f,
  error: 0xe5484d,
} as const;

function create(color: number, title?: string, description?: string): EmbedBuilder {
  const embed = new EmbedBuilder().setColor(color).setFooter({ text: t.footer }).setTimestamp();
  if (title) embed.setTitle(title);
  if (description) embed.setDescription(description);
  return embed;
}

/** The only place embeds are created, so every message shares color, footer and timestamp. */
export const embeds = {
  info: (title?: string, description?: string) => create(colors.brand, title, description),
  success: (title?: string, description?: string) => create(colors.success, title, description),
  error: (title?: string, description?: string) => create(colors.error, title, description),
};

/** Shortens text to fit an embed limit, marking the cut with "…". */
export const clip = (text: string, max: number) =>
  text.length > max ? `${text.slice(0, max - 1).toWellFormed()}…` : text;

/** "@name · `123…`" — mention plus raw ID, so logs stay readable after a user leaves. */
export const userLine = (userId: string) => `<@${userId}> · \`${userId}\``;
