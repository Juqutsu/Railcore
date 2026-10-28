import {
  time,
  TimestampStyles,
  type ChatInputCommandInteraction,
  type Guild,
  type GuildMember,
  type SlashCommandStringOption,
  type SlashCommandUserOption,
  type User,
} from 'discord.js';
import { prisma } from '../database/client.js';
import type { CaseAction, ModCase } from '../generated/prisma/client.js';
import { t } from '../text.js';
import { formatDuration } from '../utils/duration.js';
import { embeds, userLine } from '../utils/embeds.js';
import { UserError } from '../utils/errors.js';
import { sendDm } from './dm.js';
import { sendLog } from './logs.js';

export type MemberAction = Exclude<CaseAction, 'PURGE'>;

export const MIN_TIMEOUT_MS = 60_000;
export const MAX_TIMEOUT_MS = 28 * 86_400_000; // Discord's limit

/** Shared options, so every mod command reads the same. */
export const userOption = (option: SlashCommandUserOption) =>
  option.setName('user').setDescription(t.options.user).setRequired(true);
export const reasonOption = (required: boolean) => (option: SlashCommandStringOption) =>
  option.setName('reason').setDescription(t.options.reason).setMaxLength(500).setRequired(required);

export function requireMember(interaction: ChatInputCommandInteraction<'cached'>): GuildMember {
  const member = interaction.options.getMember('user');
  if (!member) throw new UserError(t.mod.notMember);
  return member;
}

/** Staff can't moderate themselves, the bot, the owner, or anyone whose top role isn't below theirs. */
export function assertCanModerate(moderator: GuildMember, target: GuildMember): void {
  const { guild } = moderator;
  if (target.id === moderator.id) throw new UserError(t.mod.notSelf);
  if (target.id === guild.members.me?.id) throw new UserError(t.mod.notBot);
  if (target.id === guild.ownerId) throw new UserError(t.mod.notOwner);
  if (
    moderator.id !== guild.ownerId &&
    target.roles.highest.comparePositionTo(moderator.roles.highest) >= 0
  ) {
    throw new UserError(t.mod.targetHigher(target.toString()));
  }
}

/** `able` is discord.js's kickable / bannable / moderatable, which covers the bot's role and permissions. */
export function assertBotCan(able: boolean, target: GuildMember): void {
  if (!able) throw new UserError(t.mod.botCannot(target.toString()));
}

export async function nextCaseNumber(guildId: string): Promise<number> {
  const { caseCounter } = await prisma.guildConfig.upsert({
    where: { guildId },
    create: { guildId, caseCounter: 1 },
    update: { caseCounter: { increment: 1 } },
  });
  return caseCounter;
}

const tone = (action: CaseAction) =>
  action === 'KICK' || action === 'BAN'
    ? embeds.error
    : action === 'UNTIMEOUT' || action === 'UNBAN'
      ? embeds.success
      : embeds.info;

function dmEmbed(
  guildName: string,
  action: keyof typeof t.mod.dm,
  number: number,
  reason: string | null,
  endsAt?: Date,
) {
  const { title, body } = t.mod.dm[action];
  const embed = tone(action)(title, body(guildName)).addFields({
    name: t.mod.fields.reason,
    value: reason ?? t.mod.noReason,
  });
  if (endsAt) {
    embed.addFields({
      name: t.mod.fields.ends,
      value: `${time(endsAt, TimestampStyles.LongDateTime)} (${time(endsAt, TimestampStyles.RelativeTime)})`,
    });
  }
  return embed.addFields({ name: t.mod.fields.case, value: `#${number}`, inline: true });
}

export async function logCase(guild: Guild, modCase: ModCase, target?: User): Promise<void> {
  const embed = tone(modCase.action)(
    t.mod.caseTitle(modCase.number, t.mod.actions[modCase.action]),
  );
  if (target) embed.setThumbnail(target.displayAvatarURL());
  if (modCase.targetId) {
    embed.addFields({ name: t.mod.fields.user, value: userLine(modCase.targetId), inline: true });
  }
  embed.addFields({
    name: t.mod.fields.moderator,
    value: userLine(modCase.moderatorId),
    inline: true,
  });
  if (modCase.durationSec) {
    const ends = new Date(modCase.createdAt.getTime() + modCase.durationSec * 1000);
    embed.addFields({
      name: t.mod.fields.duration,
      value: `${formatDuration(modCase.durationSec * 1000)} · ${t.mod.endsAt(time(ends, TimestampStyles.RelativeTime))}`,
      inline: true,
    });
  }
  if (modCase.channelId) {
    embed.addFields(
      { name: t.mod.fields.channel, value: `<#${modCase.channelId}>`, inline: true },
      { name: t.mod.fields.messages, value: String(modCase.messageCount ?? 0), inline: true },
    );
  }
  embed.addFields({ name: t.mod.fields.reason, value: modCase.reason ?? t.mod.noReason });
  await sendLog(guild, 'modLogChannelId', { embeds: [embed] });
}

// Once kicked or banned they share no server with the bot, so their DM has to go out first.
const DM_FIRST = new Set<CaseAction>(['KICK', 'BAN']);

/**
 * Runs a moderation action end to end: DM, the Discord action, the case, the mod log and the
 * reply. The caller validates and defers the interaction first.
 */
export async function moderate(
  interaction: ChatInputCommandInteraction<'cached'>,
  options: {
    action: MemberAction;
    target: User;
    reason: string | null;
    durationMs?: number;
    notify?: boolean;
    run?: (auditReason: string) => Promise<unknown>;
  },
): Promise<void> {
  const { action, target, reason, durationMs, notify = true, run } = options;
  const { guild } = interaction;
  const number = await nextCaseNumber(guild.id);
  const endsAt = durationMs ? new Date(Date.now() + durationMs) : undefined;
  // undefined = not attempted, null = DMs closed. An unbanned user shares no server with the bot.
  const dm = () =>
    notify && action !== 'UNBAN'
      ? sendDm(guild.client, target.id, {
          embeds: [dmEmbed(guild.name, action, number, reason, endsAt)],
        })
      : Promise.resolve(undefined);

  let sent = DM_FIRST.has(action) ? await dm() : undefined;
  // The audit log shows the bot as the actor, so name the moderator in the reason.
  const auditReason = t.mod
    .auditReason(interaction.user.username, reason ?? t.mod.noReason)
    .slice(0, 512)
    .toWellFormed();
  try {
    await run?.(auditReason);
  } catch (err) {
    // Don't leave a "you were banned" DM behind for a ban that never happened.
    await sent?.delete().catch(() => undefined);
    throw err;
  }
  if (!DM_FIRST.has(action)) sent = await dm();

  const modCase = await prisma.modCase.create({
    data: {
      guildId: guild.id,
      number,
      action,
      targetId: target.id,
      moderatorId: interaction.user.id,
      reason,
      durationSec: durationMs ? Math.round(durationMs / 1000) : null,
    },
  });
  await logCase(guild, modCase, target);

  const lines = [t.mod.done[action](target.toString())];
  if (endsAt) lines.push(t.mod.endsAt(time(endsAt, TimestampStyles.RelativeTime)));
  if (sent !== undefined) lines.push(sent ? t.mod.dmSent : t.mod.dmFailed);
  await interaction.editReply({
    embeds: [embeds.success(t.mod.caseTitle(number, t.mod.actions[action]), lines.join('\n'))],
  });
}
