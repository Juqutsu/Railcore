import { escapeMarkdown, type GuildMember, type PartialGuildMember } from 'discord.js';
import { t } from '../text.js';
import { clip, embeds } from '../utils/embeds.js';
import { fillTemplate } from '../utils/template.js';
import { getConfig } from './guildConfig.js';
import { sendLog } from './logs.js';

// Members pick their own names, so a nickname like "[Free Nitro](https://…)" must not become a link.
const escapeName = (name: string) =>
  escapeMarkdown(name, { maskedLink: true, heading: true, bulletedList: true, numberedList: true });

function render(member: GuildMember | PartialGuildMember, template: string): string {
  const values = new Map([
    ['user', `<@${member.id}>`],
    ['name', escapeName(member.displayName)],
    ['server', escapeName(member.guild.name)],
    ['count', String(member.guild.memberCount)],
  ]);
  return clip(fillTemplate(template, values), 4096);
}

/** Greets a new member in the welcome channel, if one is set. Never throws, like sendLog. */
export async function sendWelcome(member: GuildMember): Promise<void> {
  if (member.user.bot) return;
  const { welcomeMessage } = await getConfig(member.guild.id);
  const embed = embeds
    .success(undefined, render(member, welcomeMessage ?? t.welcome.defaultJoin))
    .setThumbnail(member.displayAvatarURL());
  // Only the new member is pinged, even if the custom text contains @everyone or role mentions.
  await sendLog(member.guild, 'welcomeChannelId', {
    content: `<@${member.id}>`,
    embeds: [embed],
    allowedMentions: { users: [member.id] },
  });
}

/** Announces a member who left (or was kicked or banned) in the leave channel, if one is set. */
export async function sendLeave(member: GuildMember | PartialGuildMember): Promise<void> {
  if (member.user.bot) return;
  const { leaveMessage } = await getConfig(member.guild.id);
  const embed = embeds
    .info(undefined, render(member, leaveMessage ?? t.welcome.defaultLeave))
    .setThumbnail(member.user.displayAvatarURL());
  await sendLog(member.guild, 'leaveChannelId', {
    embeds: [embed],
    allowedMentions: { parse: [] },
  });
}
