import {
  LabelBuilder,
  ModalBuilder,
  PermissionFlagsBits,
  TextInputBuilder,
  TextInputStyle,
  time,
  TimestampStyles,
  type BaseMessageOptions,
  type ChatInputCommandInteraction,
  type Guild,
  type GuildMember,
  type ModalSubmitInteraction,
  type SlashCommandStringOption,
  type SlashCommandUserOption,
  type User,
} from 'discord.js';
import { prisma } from '../database/client.js';
import type { CaseAction, ModCase } from '../generated/prisma/client.js';
import { t } from '../text.js';
import { formatDuration, parseDuration } from '../utils/duration.js';
import { clip, embeds, userLine } from '../utils/embeds.js';
import { UserError } from '../utils/errors.js';
import { sendDm } from './dm.js';
import { sendLog } from './logs.js';

export type MemberAction = Exclude<CaseAction, 'PURGE'>;

const MIN_TIMEOUT_MS = 60_000;
const MAX_TIMEOUT_MS = 28 * 86_400_000; // Discord's limit
const SHOWN_WARNINGS = 10;

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

/** For modals, which only carry the user ID. */
export async function fetchMember(guild: Guild, userId: string): Promise<GuildMember> {
  const member = await guild.members.fetch(userId).catch(() => null);
  if (!member) throw new UserError(t.mod.notMember);
  return member;
}

/** Parses "10m", "2h"… and enforces Discord's 1 minute to 28 days range. */
export function parseTimeout(input: string): number {
  const ms = parseDuration(input);
  if (ms === null || ms < MIN_TIMEOUT_MS || ms > MAX_TIMEOUT_MS) {
    throw new UserError(t.mod.invalidDuration);
  }
  return ms;
}

export function assertTimeoutable(member: GuildMember): void {
  if (member.permissions.has(PermissionFlagsBits.Administrator)) {
    throw new UserError(t.mod.timeoutAdmin);
  }
  assertBotCan(member.moderatable, member);
}

const reasonInput = (required: boolean) =>
  new LabelBuilder()
    .setLabel(t.mod.reasonLabel)
    .setTextInputComponent(
      new TextInputBuilder()
        .setCustomId('reason')
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder(t.mod.reasonPlaceholder)
        .setMaxLength(500)
        .setRequired(required),
    );

export const warnModal = (user: User) =>
  new ModalBuilder()
    .setCustomId(`mod:warn:${user.id}`)
    .setTitle(clip(t.mod.warnModalTitle(user.username), 45)) // Discord's modal title limit
    .addLabelComponents(reasonInput(true));

export const timeoutModal = (user: User) =>
  new ModalBuilder()
    .setCustomId(`mod:timeout:${user.id}`)
    .setTitle(clip(t.mod.timeoutModalTitle(user.username), 45))
    .addLabelComponents(
      new LabelBuilder()
        .setLabel(t.mod.durationLabel)
        .setTextInputComponent(
          new TextInputBuilder()
            .setCustomId('duration')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder(t.mod.durationPlaceholder)
            .setMaxLength(20)
            .setRequired(true),
        ),
      reasonInput(false),
    );

export async function warningsReply(guildId: string, user: User): Promise<BaseMessageOptions> {
  const warnings = await prisma.modCase.findMany({
    where: { guildId, targetId: user.id, action: 'WARN', clearedAt: null },
    orderBy: { number: 'desc' },
  });
  if (!warnings.length) {
    return { embeds: [embeds.success(undefined, t.mod.noWarnings(user.toString()))] };
  }

  // Reasons are clipped so ten of them stay inside the 4096-character embed limit.
  const lines = warnings
    .slice(0, SHOWN_WARNINGS)
    .map((warning) =>
      t.mod.warningLine(
        warning.number,
        time(warning.createdAt, TimestampStyles.ShortDate),
        `<@${warning.moderatorId}>`,
        clip(warning.reason ?? t.mod.noReason, 200),
      ),
    );
  if (warnings.length > SHOWN_WARNINGS) {
    lines.push(t.mod.moreWarnings(warnings.length - SHOWN_WARNINGS));
  }
  return {
    embeds: [
      embeds
        .info(t.mod.warningsTitle(user.username, warnings.length), lines.join('\n\n'))
        .setThumbnail(user.displayAvatarURL()),
    ],
  };
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
  interaction: ChatInputCommandInteraction<'cached'> | ModalSubmitInteraction<'cached'>,
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
