import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  time,
  TimestampStyles,
  type BaseMessageOptions,
  type EmbedBuilder,
  type Guild,
  type GuildMember,
  type Role,
} from 'discord.js';
import { prisma } from '../database/client.js';
import { t } from '../text.js';
import { createCooldown } from '../utils/cooldown.js';
import { embeds, userLine } from '../utils/embeds.js';
import { logger } from '../utils/logger.js';
import { roleAssignProblem } from '../utils/permissions.js';
import { getConfig } from './guildConfig.js';
import { sendLog } from './logs.js';

const DAY_MS = 86_400_000;

type TooNew = { ok: false; reason: 'tooNew'; eligibleAt: Date; minDays: number };
export type Eligibility =
  { ok: true; role: Role } | { ok: false; reason: 'notConfigured' | 'alreadyVerified' } | TooNew;

/** Every requirement a member must meet before they can be verified. */
export async function checkEligibility(member: GuildMember): Promise<Eligibility> {
  const config = await getConfig(member.guild.id);
  const role = config.verifiedRoleId
    ? member.guild.roles.cache.get(config.verifiedRoleId)
    : undefined;
  const problem = role ? roleAssignProblem(role) : 'Verified role not set or deleted';
  if (!role || problem) {
    logger.warn({ guildId: member.guild.id, problem }, 'Verification is misconfigured');
    return { ok: false, reason: 'notConfigured' };
  }
  if (member.roles.cache.has(role.id)) return { ok: false, reason: 'alreadyVerified' };

  const eligibleAt = new Date(member.user.createdTimestamp + config.minAccountAgeDays * DAY_MS);
  if (eligibleAt.getTime() > Date.now()) {
    return { ok: false, reason: 'tooNew', eligibleAt, minDays: config.minAccountAgeDays };
  }

  // Future requirements (e.g. a linked Roblox account) go here.
  return { ok: true, role };
}

export function ineligibleEmbed(result: Exclude<Eligibility, { ok: true }>): EmbedBuilder {
  switch (result.reason) {
    case 'alreadyVerified':
      return embeds.success(t.verify.alreadyVerifiedTitle, t.verify.alreadyVerified);
    case 'notConfigured':
      return embeds.error(t.errors.title, t.verify.notConfigured);
    case 'tooNew':
      return embeds.error(
        t.verify.tooNewTitle,
        t.verify.tooNew(result.minDays, time(result.eligibleAt, TimestampStyles.RelativeTime)),
      );
  }
}

const alertCooldown = createCooldown(60 * 60_000);

/** Alerts staff in the mod log, at most once per member per hour. */
export async function reportTooNew(member: GuildMember, result: TooNew): Promise<void> {
  if (alertCooldown.take(`${member.guild.id}:${member.id}`)) return;
  const created = member.user.createdAt;
  const embed = embeds
    .info(t.verify.logTooNewTitle)
    .setThumbnail(member.displayAvatarURL())
    .addFields(
      { name: t.logs.member, value: userLine(member.id) },
      {
        name: t.logs.accountCreated,
        value: `${time(created, TimestampStyles.LongDateTime)} (${time(created, TimestampStyles.RelativeTime)})`,
      },
      { name: t.verify.requiredAge, value: t.setup.days(result.minDays) },
    );
  await sendLog(member.guild, 'modLogChannelId', { embeds: [embed] });
}

export async function completeVerification(member: GuildMember, role: Role): Promise<void> {
  // Row first: if the role add then fails, the member stays unverified and a retry fixes both.
  const key = { guildId: member.guild.id, userId: member.id };
  await prisma.verification.upsert({
    where: { guildId_userId: key },
    create: key,
    update: { verifiedAt: new Date() },
  });
  await member.roles.add(role, t.verify.auditReason);

  const embed = embeds
    .success(t.verify.logVerifiedTitle)
    .setThumbnail(member.displayAvatarURL())
    .addFields(
      { name: t.logs.member, value: userLine(member.id) },
      {
        name: t.logs.accountCreated,
        value: time(member.user.createdAt, TimestampStyles.RelativeTime),
      },
    );
  await sendLog(member.guild, 'serverLogChannelId', { embeds: [embed] });
}

export function verificationPanel(guild: Guild): BaseMessageOptions {
  const embed = embeds.info(t.verify.panelTitle, t.verify.panelBody).setThumbnail(guild.iconURL());
  const button = new ButtonBuilder()
    .setCustomId('verify:start')
    .setLabel(t.verify.verifyButton)
    .setEmoji(t.verify.verifyEmoji)
    .setStyle(ButtonStyle.Success);
  return {
    embeds: [embed],
    components: [new ActionRowBuilder<ButtonBuilder>().addComponents(button)],
  };
}

export function verificationPrompt(): BaseMessageOptions {
  const button = new ButtonBuilder()
    .setCustomId('verify:accept')
    .setLabel(t.verify.acceptButton)
    .setStyle(ButtonStyle.Success);
  return {
    embeds: [embeds.info(t.verify.promptTitle, t.verify.promptBody)],
    components: [new ActionRowBuilder<ButtonBuilder>().addComponents(button)],
  };
}
