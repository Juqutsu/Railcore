import {
  PermissionFlagsBits,
  type Client,
  type GuildMember,
  type GuildTextBasedChannel,
} from 'discord.js';
import { prisma } from '../database/client.js';
import type { Giveaway, GuildConfig } from '../generated/prisma/client.js';
import { t } from '../text.js';
import { UserError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';
import { missingPermissions, POST_PERMISSIONS } from '../utils/permissions.js';
import { giveawayMessage, type GiveawayView } from './giveawayMessage.js';
import { getConfig } from './guildConfig.js';

export { giveawayMessage, type GiveawayView };

export function isHost(member: GuildMember, config: GuildConfig): boolean {
  return (
    member.permissions.has(PermissionFlagsBits.ManageGuild) ||
    config.giveawayHostRoleIds.some((id) => member.roles.cache.has(id))
  );
}

export function requireHost(member: GuildMember, config: GuildConfig): void {
  if (!isHost(member, config)) throw new UserError(t.giveaways.cantHost);
}

const REFRESH_INTERVAL_MS = 10_000;
const lastEdit = new Map<number, number>();
const pending = new Set<number>();

/** Re-renders the post with the current count, at most once per 10 s per giveaway. */
export function scheduleCountRefresh(client: Client, giveawayId: number): void {
  if (pending.has(giveawayId)) return;
  pending.add(giveawayId);
  const wait = Math.max(0, (lastEdit.get(giveawayId) ?? 0) + REFRESH_INTERVAL_MS - Date.now());
  setTimeout(() => {
    pending.delete(giveawayId);
    refreshCount(client, giveawayId).catch((err: unknown) =>
      logger.warn({ err, giveawayId }, 'Giveaway count refresh failed'),
    );
  }, wait).unref();
}

async function refreshCount(client: Client, giveawayId: number): Promise<void> {
  const g = await prisma.giveaway.findUnique({
    where: { id: giveawayId },
    include: { _count: { select: { entries: true } } },
  });
  if (!g?.messageId || g.endedAt) return;
  const channel = await client.channels.fetch(g.channelId);
  if (!channel?.isTextBased()) return;
  lastEdit.set(giveawayId, Date.now());
  await channel.messages.edit(
    g.messageId,
    giveawayMessage({ ...g, winnerIds: [] }, g._count.entries),
  );
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
