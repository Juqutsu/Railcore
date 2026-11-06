import {
  DiscordAPIError,
  PermissionFlagsBits,
  RESTJSONErrorCodes,
  type ApplicationCommandOptionChoiceData,
  type Client,
  type Guild,
  type GuildMember,
  type GuildTextBasedChannel,
} from 'discord.js';
import { prisma } from '../database/client.js';
import type { Giveaway, GuildConfig } from '../generated/prisma/client.js';
import { t } from '../text.js';
import { pickWinners } from '../utils/draw.js';
import { UserError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';
import { missingPermissions, POST_PERMISSIONS } from '../utils/permissions.js';
import { sendDm } from './dm.js';
import { giveawayMessage, type GiveawayView } from './giveawayMessage.js';
import {
  canManage,
  choiceName,
  ineligibleReason,
  isHost,
  type EligibilityFacts,
} from './giveawayRules.js';
import { getConfig } from './guildConfig.js';
import { isServedGuild } from './guildLock.js';

export { canManage, giveawayMessage, isHost, type EligibilityFacts, type GiveawayView };

export function requireHost(member: GuildMember, config: GuildConfig): void {
  if (!isHost(member, config)) throw new UserError(t.giveaways.cantHost);
}

export function requireManage(member: GuildMember, config: GuildConfig, g: Giveaway): void {
  requireHost(member, config);
  if (!canManage(member, config, g)) throw new UserError(t.giveaways.notYours);
}

/** Loads a giveaway of the member's server that they may manage, or throws a UserError. */
export async function getManagedGiveaway(member: GuildMember, id: number): Promise<Giveaway> {
  const g = await prisma.giveaway.findUnique({ where: { id } });
  if (g?.guildId !== member.guild.id) throw new UserError(t.giveaways.notFound);
  requireManage(member, await getConfig(member.guild.id), g);
  return g;
}

const DAY_MS = 86_400_000;

export async function eligibilityFacts(
  member: GuildMember,
  config: GuildConfig,
  now: Date,
): Promise<EligibilityFacts> {
  const guildId = member.guild.id;
  const since = (days: number) => new Date(now.getTime() - days * DAY_MS);
  const [block, warning, win] = await Promise.all([
    prisma.giveawayBlock.findUnique({ where: { guildId_userId: { guildId, userId: member.id } } }),
    config.giveawayBlockWarned
      ? prisma.modCase.findFirst({
          where: {
            guildId,
            targetId: member.id,
            action: 'WARN',
            clearedAt: null,
            createdAt: config.giveawayWarnDays
              ? { gte: since(config.giveawayWarnDays) }
              : undefined,
          },
          select: { id: true },
        })
      : null,
    config.giveawayWinnerCooldownDays > 0
      ? prisma.giveawayWinner.findFirst({
          where: {
            userId: member.id,
            wonAt: { gte: since(config.giveawayWinnerCooldownDays) },
            giveaway: { guildId },
          },
          select: { userId: true },
        })
      : null,
  ]);
  return {
    roleIds: [...member.roles.cache.keys()],
    blocked: block !== null,
    hasActiveWarning: warning !== null,
    wonRecently: win !== null,
  };
}

/** Why the member can't enter right now, or null. Used on Enter and in the draw. */
export async function checkEligible(
  member: GuildMember,
  config: GuildConfig,
  now: Date,
): Promise<string | null> {
  return ineligibleReason(await eligibilityFacts(member, config, now), config);
}

const REFRESH_INTERVAL_MS = 10_000;
const lastEdit = new Map<number, number>();
const pending = new Map<number, NodeJS.Timeout>();

/** Re-renders the post with the current count, at most once per 10 s per giveaway. */
export function scheduleCountRefresh(client: Client, giveawayId: number): void {
  if (pending.has(giveawayId)) return;
  const wait = Math.max(0, (lastEdit.get(giveawayId) ?? 0) + REFRESH_INTERVAL_MS - Date.now());
  const timer = setTimeout(() => {
    pending.delete(giveawayId);
    refreshCount(client, giveawayId).catch((err: unknown) =>
      logger.warn({ err, giveawayId }, 'Giveaway count refresh failed'),
    );
  }, wait).unref();
  pending.set(giveawayId, timer);
}

/** Drops a giveaway's pending refresh and debounce state; called once it has ended. */
function forgetRefresh(giveawayId: number): void {
  clearTimeout(pending.get(giveawayId));
  pending.delete(giveawayId);
  lastEdit.delete(giveawayId);
}

async function refreshCount(client: Client, giveawayId: number): Promise<void> {
  const found = await prisma.giveaway.findUnique({ where: { id: giveawayId } });
  if (!found) return;
  const channel = await client.channels.fetch(found.channelId);
  if (!channel?.isTextBased()) return;
  // endedAt is read right before the edit, so an end that committed meanwhile is seen. An end
  // committing after this read edits later on the same Discord route, so its edit lands last.
  const g = await prisma.giveaway.findUnique({
    where: { id: giveawayId },
    include: { _count: { select: { entries: true } } },
  });
  if (!g?.messageId || g.endedAt) return forgetRefresh(giveawayId);
  lastEdit.set(giveawayId, Date.now());
  await channel.messages.edit(
    g.messageId,
    giveawayMessage({ ...g, winnerIds: [] }, g._count.entries),
  );
}

const notAMember = new Set<unknown>([
  RESTJSONErrorCodes.UnknownMember,
  RESTJSONErrorCodes.UnknownUser,
]);

/**
 * Only "not a member" disqualifies. Any other failure (outage) throws before the commit, so the
 * next tick redraws instead of committing a wrong draw.
 */
function isValidEntrant(guild: Guild, config: GuildConfig): (id: string) => Promise<boolean> {
  return async (id) => {
    try {
      const member = await guild.members.fetch(id);
      return (await checkEligible(member, config, new Date())) === null;
    } catch (err) {
      if (err instanceof DiscordAPIError && notAMember.has(err.code)) return false;
      throw err;
    }
  };
}

async function drawContext(
  client: Client,
  guildId: string,
): Promise<{ guild: Guild; config: GuildConfig }> {
  const guild = client.guilds.cache.get(guildId);
  if (!guild?.available) throw new Error(`Guild ${guildId} is not available`);
  return { guild, config: await getConfig(guildId) };
}

const goneCodes = new Set<unknown>([
  RESTJSONErrorCodes.UnknownChannel,
  RESTJSONErrorCodes.UnknownMessage,
]);

const noAccess = new Set<unknown>([
  RESTJSONErrorCodes.MissingAccess,
  RESTJSONErrorCodes.MissingPermissions,
]);

/** True when Discord says the giveaway's channel or post no longer exists. */
async function isGone(client: Client, g: Giveaway): Promise<boolean> {
  if (!g.messageId) return false;
  try {
    const channel = await client.channels.fetch(g.channelId);
    if (!channel?.isTextBased()) return true;
    await channel.messages.fetch(g.messageId);
    return false;
  } catch (err) {
    if (err instanceof DiscordAPIError) {
      if (goneCodes.has(err.code)) return true;
      // Can't read the post (no history/view access): not proof it's gone, so draw as usual.
      if (noAccess.has(err.code)) return false;
    }
    throw err;
  }
}

/**
 * Cancels a running giveaway (command, or its post was deleted). A cheap no-op for any other id.
 * Same conditional write as the draw, so a giveaway can't end both ways.
 */
export async function cancelGiveaway(
  client: Client,
  where: { id: number } | { messageId: string },
): Promise<boolean> {
  const now = new Date();
  const { count } = await prisma.giveaway.updateMany({
    where: { ...where, endedAt: null },
    data: { endedAt: now, cancelledAt: now },
  });
  if (count === 0) return false;
  const g = await prisma.giveaway.findFirstOrThrow({
    where,
    include: { _count: { select: { entries: true } } },
  });
  forgetRefresh(g.id);
  try {
    const channel = await client.channels.fetch(g.channelId);
    if (channel?.isTextBased() && g.messageId) {
      await channel.messages.edit(
        g.messageId,
        giveawayMessage({ ...g, winnerIds: [] }, g._count.entries),
      );
    }
  } catch (err) {
    if (!(err instanceof DiscordAPIError && goneCodes.has(err.code))) {
      logger.warn({ err, giveawayId: g.id }, 'Could not edit the cancelled giveaway');
    }
  }
  return true;
}

/** Draws `count` more winners from the entries who haven't won yet. Returns the new winners. */
export async function rerollGiveaway(
  client: Client,
  giveawayId: number,
  count: number,
): Promise<string[]> {
  const g = await prisma.giveaway.findUnique({
    where: { id: giveawayId },
    include: { entries: { select: { userId: true } }, winners: { select: { userId: true } } },
  });
  if (!g) throw new UserError(t.giveaways.notFound);
  if (!g.endedAt) throw new UserError(t.giveaways.notEnded);
  if (g.cancelledAt) throw new UserError(t.giveaways.wasCancelled);
  const { guild, config } = await drawContext(client, g.guildId);
  const won = new Set(g.winners.map((w) => w.userId));
  const picked = await pickWinners(
    g.entries.map((e) => e.userId).filter((id) => !won.has(id)),
    count,
    isValidEntrant(guild, config),
  );
  if (!picked.length) return [];
  // skipDuplicates: two rerolls at once can't create a winner row twice.
  await prisma.giveawayWinner.createMany({
    data: picked.map((userId) => ({ giveawayId, userId, wonAt: new Date() })),
    skipDuplicates: true,
  });
  const all = await prisma.giveaway.findUniqueOrThrow({
    where: { id: giveawayId },
    include: {
      winners: { select: { userId: true }, orderBy: { wonAt: 'asc' } },
      _count: { select: { entries: true } },
    },
  });
  const log = { giveawayId, guildId: g.guildId };
  const channel = await client.channels.fetch(g.channelId).catch((err: unknown) => {
    logger.warn({ err, ...log }, 'Giveaway channel is gone');
    return null;
  });
  if (channel?.isSendable() && g.messageId) {
    try {
      await channel.messages.edit(
        g.messageId,
        giveawayMessage(
          { ...all, winnerIds: all.winners.map((w) => w.userId) },
          all._count.entries,
        ),
      );
    } catch (err) {
      logger.warn({ err, ...log }, 'Could not edit the rerolled giveaway');
    }
    try {
      await channel.send({
        content: t.giveaways.winnerPing(picked, g.prize, g.hostId),
        reply: { messageReference: g.messageId, failIfNotExists: false },
        allowedMentions: { users: [...picked, g.hostId] },
      });
    } catch (err) {
      logger.warn({ err, ...log }, 'Could not ping the rerolled winners');
    }
  }
  return picked;
}

/**
 * Draws, then commits the winners. The conditional write is what stops a second draw: a losing
 * racer (job vs /giveaway end) discards its draw. A crash before it just redraws next tick.
 */
export async function endGiveaway(
  client: Client,
  giveawayId: number,
): Promise<'ended' | 'already'> {
  const g = await prisma.giveaway.findUnique({
    where: { id: giveawayId },
    include: { entries: { select: { userId: true } } },
  });
  if (!g || g.endedAt) return 'already';
  // A deleted post or channel cancels it. Any other failure throws, so the next tick retries.
  if (await isGone(client, g)) {
    logger.warn({ giveawayId, guildId: g.guildId }, 'Giveaway post or channel is gone, cancelling');
    return (await cancelGiveaway(client, { id: giveawayId })) ? 'ended' : 'already';
  }
  const { guild, config } = await drawContext(client, g.guildId);
  const winners = await pickWinners(
    g.entries.map((e) => e.userId),
    g.winnerCount,
    isValidEntrant(guild, config),
  );
  const endedAt = new Date();
  const count = await prisma.$transaction(async (tx) => {
    const { count } = await tx.giveaway.updateMany({
      where: { id: giveawayId, endedAt: null },
      data: { endedAt },
    });
    if (count === 1) {
      await tx.giveawayWinner.createMany({
        data: winners.map((userId) => ({ giveawayId, userId, wonAt: endedAt })),
      });
    }
    return count;
  });
  if (count !== 1) return 'already';
  await announce(client, giveawayId);
  return 'ended';
}

// /giveaway end announces right after its commit; a job tick in that moment must not ping again.
const announcing = new Set<number>();

/** Ended embed, winner ping and host DM, each allowed to fail on its own; then announcedAt. */
export async function announce(client: Client, giveawayId: number): Promise<void> {
  if (announcing.has(giveawayId)) return;
  announcing.add(giveawayId);
  try {
    forgetRefresh(giveawayId);
    const g = await prisma.giveaway.findUniqueOrThrow({
      where: { id: giveawayId },
      include: {
        winners: { select: { userId: true }, orderBy: { wonAt: 'asc' } },
        _count: { select: { entries: true } },
      },
    });
    // A job tick's list can be stale: /giveaway end may have announced it meanwhile.
    if (!g.endedAt || g.cancelledAt || g.announcedAt) return;
    const winnerIds = g.winners.map((w) => w.userId);
    const log = { giveawayId, guildId: g.guildId };

    const channel = await client.channels.fetch(g.channelId).catch((err: unknown) => {
      logger.warn({ err, ...log }, 'Giveaway channel is gone');
      return null;
    });
    if (channel?.isSendable() && g.messageId) {
      try {
        await channel.messages.edit(
          g.messageId,
          giveawayMessage({ ...g, winnerIds }, g._count.entries),
        );
      } catch (err) {
        logger.warn({ err, ...log }, 'Could not edit the ended giveaway');
      }
      if (winnerIds.length) {
        try {
          await channel.send({
            content: t.giveaways.winnerPing(winnerIds, g.prize, g.hostId),
            reply: { messageReference: g.messageId, failIfNotExists: false },
            allowedMentions: { users: [...winnerIds, g.hostId] },
          });
        } catch (err) {
          logger.warn({ err, ...log }, 'Could not ping the giveaway winners');
        }
      }
    }
    await sendDm(client, g.hostId, { content: t.giveaways.hostDm(g.prize, winnerIds) });
    await prisma.giveaway.update({ where: { id: giveawayId }, data: { announcedAt: new Date() } });
  } finally {
    announcing.delete(giveawayId);
  }
}

const CHECK_EVERY_MS = 15_000;

/** Ends due giveaways and retries announcements a crash interrupted. */
export function startGiveaways(client: Client<true>): void {
  let busy = false;
  const run = () => {
    // A slow tick (many member lookups) must not overlap the next one.
    if (busy) return;
    busy = true;
    checkGiveaways(client)
      .catch((err: unknown) => logger.error({ err }, 'Giveaway check failed'))
      .finally(() => (busy = false));
  };
  run();
  setInterval(run, CHECK_EVERY_MS).unref();
}

async function checkGiveaways(client: Client<true>): Promise<void> {
  const [due, unannounced] = await Promise.all([
    prisma.giveaway.findMany({ where: { endedAt: null, endsAt: { lte: new Date() } } }),
    prisma.giveaway.findMany({
      where: { endedAt: { not: null }, cancelledAt: null, announcedAt: null },
    }),
  ]);
  // The other copy (test or production) handles its own server's giveaways.
  for (const g of due.filter((g) => isServedGuild(g.guildId))) {
    try {
      await endGiveaway(client, g.id);
    } catch (err) {
      logger.warn({ err, giveawayId: g.id }, 'Ending giveaway failed');
    }
  }
  for (const g of unannounced.filter((g) => isServedGuild(g.guildId))) {
    try {
      await announce(client, g.id);
    } catch (err) {
      logger.warn({ err, giveawayId: g.id }, 'Announcing giveaway failed');
    }
  }
}

/** Up to 25 giveaways of the member's server they may manage, matching what they typed. */
export async function giveawayChoices(
  member: GuildMember,
  focused: string,
  state: 'running' | 'ended',
): Promise<ApplicationCommandOptionChoiceData<number>[]> {
  const config = await getConfig(member.guild.id);
  if (!isHost(member, config)) return [];
  const rows = await prisma.giveaway.findMany({
    where: {
      guildId: member.guild.id,
      ...(state === 'running' ? { endedAt: null } : { endedAt: { not: null }, cancelledAt: null }),
      // canManage's rule, applied in the query so all 25 slots go to giveaways they may manage.
      ...(!member.permissions.has(PermissionFlagsBits.ManageGuild) && { hostId: member.id }),
      ...(focused && { prize: { contains: focused, mode: 'insensitive' as const } }),
    },
    orderBy: state === 'running' ? { endsAt: 'asc' } : { endedAt: 'desc' },
    take: 25,
  });
  return rows.map((g) => ({ name: choiceName(g), value: g.id }));
}

export async function startGiveaway(
  member: GuildMember,
  input: {
    prize: string;
    durationMs: number;
    winners: number;
    channel: GuildTextBasedChannel | null;
  },
): Promise<Giveaway & { url: string }> {
  const config = await getConfig(member.guild.id);
  requireHost(member, config);
  if (input.durationMs < 60_000 || input.durationMs > 30 * 86_400_000) {
    throw new UserError(t.giveaways.badDuration);
  }
  const channel =
    input.channel ??
    (config.giveawayChannelId ? member.guild.channels.cache.get(config.giveawayChannelId) : null);
  if (!channel?.isTextBased()) throw new UserError(t.giveaways.noChannel);
  if (
    input.channel &&
    !channel
      .permissionsFor(member)
      .has([PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages])
  ) {
    throw new UserError(t.giveaways.memberCantPost);
  }
  const missing = missingPermissions(channel, POST_PERMISSIONS);
  if (missing.length) throw new UserError(t.giveaways.cantPost(channel.toString(), missing));

  const giveaway = await prisma.giveaway.create({
    data: {
      guildId: member.guild.id,
      channelId: channel.id,
      hostId: member.id,
      prize: input.prize,
      winnerCount: input.winners,
      endsAt: new Date(Date.now() + input.durationMs),
    },
  });
  try {
    const role = config.giveawayPingRoleId;
    const message = await channel.send({
      content: role ? `<@&${role}>` : undefined,
      ...giveawayMessage({ ...giveaway, winnerIds: [] }, 0),
      allowedMentions: { roles: role ? [role] : [] },
    });
    const updated = await prisma.giveaway.update({
      where: { id: giveaway.id },
      data: { messageId: message.id },
    });
    return Object.assign(updated, { url: message.url });
  } catch (err) {
    await prisma.giveaway.delete({ where: { id: giveaway.id } }).catch(() => undefined);
    throw err;
  }
}
