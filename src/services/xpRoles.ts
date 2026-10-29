import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  LabelBuilder,
  ModalBuilder,
  RoleSelectMenuBuilder,
  StringSelectMenuBuilder,
  TextInputBuilder,
  TextInputStyle,
  type BaseMessageOptions,
  type Guild,
  type GuildMember,
  type PermissionsString,
  type Role,
} from 'discord.js';
import { prisma } from '../database/client.js';
import { t } from '../text.js';
import { embeds } from '../utils/embeds.js';
import { UserError } from '../utils/errors.js';
import { roleAssignProblem } from '../utils/permissions.js';
import { rankUp, reachedTiers, type Tier } from '../utils/xpTiers.js';
import { sendLog } from './logs.js';

/** A select menu holds at most 25 options, and the remove menu lists every tier. */
export const MAX_TIERS = 25;
export const MAX_XP = 999_999;

export const tiersOf = (guildId: string): Promise<Tier[]> =>
  prisma.xpRole.findMany({
    where: { guildId },
    orderBy: { minXp: 'asc' },
    select: { roleId: true, minXp: true },
  });

/** Adds the tier, or changes its XP if the role already is one. */
export async function saveTier(guildId: string, roleId: string, minXp: number): Promise<void> {
  const key = { guildId, roleId };
  const exists = await prisma.xpRole.findUnique({ where: { guildId_roleId: key } });
  if (!exists && (await prisma.xpRole.count({ where: { guildId } })) >= MAX_TIERS) {
    throw new UserError(t.xpRoles.tooMany(MAX_TIERS));
  }
  await prisma.xpRole.upsert({
    where: { guildId_roleId: key },
    create: { ...key, minXp },
    update: { minXp },
  });
}

export const removeTier = (guildId: string, roleId: string) =>
  prisma.xpRole.deleteMany({ where: { guildId, roleId } });

/** Staff powers. XP roles are earned by playing, so a role with any of these is never handed out. */
const ELEVATED: PermissionsString[] = [
  'Administrator',
  'ManageGuild',
  'ManageRoles',
  'ManageChannels',
  'ManageWebhooks',
  'ManageMessages',
  'KickMembers',
  'BanMembers',
  'ModerateMembers',
  'MentionEveryone',
];

/** The staff powers a role carries itself, as readable names. */
const elevatedPermissions = (role: Role) =>
  ELEVATED.filter((permission) => role.permissions.has(permission, false)).map((permission) =>
    permission.replace(/(?<=[a-z])(?=[A-Z])/g, ' '),
  );

/** Why `actor` can't make `role` an XP role, or null if they can. */
export function tierRoleProblem(role: Role, actor: GuildMember): string | null {
  const botProblem = roleAssignProblem(role);
  if (botProblem) return botProblem;
  const elevated = elevatedPermissions(role);
  if (elevated.length) return t.xpRoles.elevatedRole(role.toString(), elevated.join(', '));
  // The same rule Discord applies when someone hands out a role by hand.
  const canAssign =
    actor.id === role.guild.ownerId ||
    (actor.permissions.has('ManageRoles') && role.comparePositionTo(actor.roles.highest) < 0);
  return canAssign ? null : t.xpRoles.aboveYou(role.toString());
}

/**
 * The tiers the bot actually manages: it skips deleted roles (they stay tiers until an admin
 * removes them), roles it can no longer assign, and roles that gained staff powers since.
 */
export const activeTiers = (guild: Guild, tiers: Tier[]): Tier[] =>
  tiers.filter((tier) => {
    const role = guild.roles.cache.get(tier.roleId);
    return role !== undefined && !roleAssignProblem(role) && !elevatedPermissions(role).length;
  });

/** Forgets a member who left, so the background sync stops looking them up. */
export const forgetMember = (guildId: string, userId: string) =>
  prisma.linkedMember.deleteMany({ where: { guildId, userId } });

/**
 * Gives the member exactly the tier roles their XP reaches (`link` null = not linked: none),
 * remembers the link for the background sync, and announces a rank-up. Roles that aren't tiers
 * are never touched.
 */
export async function applyXp(
  member: GuildMember,
  link: { robloxId: string; xp: number } | null,
  allTiers: Tier[],
): Promise<void> {
  // A role given during Membership Screening would let them skip it; they're synced later.
  if (member.pending) return;
  const tiers = activeTiers(member.guild, allTiers);
  const wanted = new Set(reachedTiers(tiers, link?.xp ?? null).map((tier) => tier.roleId));
  // One role per request: the array form PATCHes the whole role list from a possibly stale
  // cache and could drop roles another bot just gave.
  for (const { roleId } of tiers) {
    const has = member.roles.cache.has(roleId);
    if (wanted.has(roleId) && !has) await member.roles.add(roleId, t.xpRoles.auditReason);
    if (!wanted.has(roleId) && has) await member.roles.remove(roleId, t.xpRoles.auditReason);
  }

  // Saved only after the roles, so a failed role edit is retried, announcement included.
  const key = { guildId: member.guild.id, userId: member.id };
  if (!link) {
    await prisma.linkedMember.deleteMany({ where: key });
    return;
  }
  const previous = await prisma.linkedMember.findUnique({ where: { guildId_userId: key } });
  let tier: Tier | undefined;
  if (previous?.robloxId === link.robloxId) {
    if (previous.xp !== link.xp) {
      // Compare-and-swap on the XP read above: of parallel syncs of one member (e.g. /stats
      // during a background pass) only one wins and may announce. A loser's XP is saved next run.
      const { count } = await prisma.linkedMember.updateMany({
        where: { ...key, robloxId: link.robloxId, xp: previous.xp },
        data: { xp: link.xp },
      });
      if (count) tier = rankUp(tiers, previous.xp, link.xp);
    }
  } else {
    // New, or switched to another Roblox account: no rank-up for that.
    await prisma.linkedMember.upsert({
      where: { guildId_userId: key },
      create: { ...key, robloxId: link.robloxId, xp: link.xp },
      update: { robloxId: link.robloxId, xp: link.xp },
    });
  }
  if (tier) {
    const embed = embeds
      .success(t.xpRoles.rankUpTitle, t.xpRoles.rankUp(member.toString(), `<@&${tier.roleId}>`))
      .setThumbnail(member.displayAvatarURL());
    await sendLog(member.guild, 'rankUpChannelId', {
      embeds: [embed],
      allowedMentions: { parse: [] },
    });
  }
}

/** The XP roles page of the /setup dashboard. */
export async function xpRolesEditor(guild: Guild, notice?: string): Promise<BaseMessageOptions> {
  const tiers = await tiersOf(guild.id);
  const list = tiers.length
    ? tiers
        .map((tier) => t.xpRoles.tierLine(tier.minXp.toLocaleString('en-US'), `<@&${tier.roleId}>`))
        .join('\n')
    : t.xpRoles.none;
  const embed = embeds.info(
    t.setup.editTitle(t.xpRoles.label),
    [notice, t.xpRoles.intro, list].filter(Boolean).join('\n\n'),
  );

  const rows: ActionRowBuilder<ButtonBuilder | StringSelectMenuBuilder>[] = [];
  if (tiers.length) {
    rows.push(
      new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId('setup:xpremove')
          .setPlaceholder(t.xpRoles.removePlaceholder)
          .addOptions(
            tiers.map((tier) => ({
              label: guild.roles.cache.get(tier.roleId)?.name ?? t.xpRoles.deletedRole,
              description: t.xpRoles.xp(tier.minXp.toLocaleString('en-US')),
              value: tier.roleId,
            })),
          ),
      ),
    );
  }
  rows.push(
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId('setup:xpadd')
        .setLabel(t.xpRoles.add)
        .setStyle(ButtonStyle.Primary)
        .setDisabled(tiers.length >= MAX_TIERS),
      new ButtonBuilder()
        .setCustomId('setup:xpsync')
        .setLabel(t.xpRoles.sync)
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(!tiers.length),
      new ButtonBuilder()
        .setCustomId('setup:back')
        .setLabel(t.setup.back)
        .setStyle(ButtonStyle.Secondary),
    ),
  );
  return { embeds: [embed], components: rows };
}

export function xpTierModal(): ModalBuilder {
  return new ModalBuilder()
    .setCustomId('setup:xpadd')
    .setTitle(t.xpRoles.modalTitle)
    .addLabelComponents(
      new LabelBuilder()
        .setLabel(t.xpRoles.roleLabel)
        .setDescription(t.xpRoles.roleHint)
        .setRoleSelectMenuComponent(
          new RoleSelectMenuBuilder().setCustomId('role').setMaxValues(1),
        ),
      new LabelBuilder()
        .setLabel(t.xpRoles.xpLabel)
        .setDescription(t.xpRoles.xpHint(MAX_XP.toLocaleString('en-US')))
        .setTextInputComponent(
          new TextInputBuilder()
            .setCustomId('xp')
            .setStyle(TextInputStyle.Short)
            .setMinLength(1)
            .setMaxLength(String(MAX_XP).length),
        ),
    );
}
