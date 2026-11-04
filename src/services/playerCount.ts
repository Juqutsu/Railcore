import { ActivityType, ChannelType, type Client, type Guild } from 'discord.js';
import { t } from '../text.js';
import { logger } from '../utils/logger.js';
import { fillChannelName } from '../utils/template.js';
import { getConfig } from './guildConfig.js';
import { isServedGuild } from './guildLock.js';
import { playersOnline } from './roblox.js';

const POLL_EVERY_MS = 10 * 60_000;
/** Discord allows 2 renames per channel in 10 minutes; more would wait on its rate limit. */
const RENAME_WINDOW_MS = 10 * 60_000;
const renames = new Map<string, number[]>();
/** The last count from Roblox, so a /setup change can apply it without asking Roblox again. */
let lastCount: number | null = null;

/** Settings that change the channel, so saving one renames it right away. */
export const PLAYER_COUNT_KEYS: readonly string[] = ['playerCountChannelId', 'playerCountName'];

/** Every 10 minutes, and once at startup: puts the game's player count on the channel and the bot status. */
export function startPlayerCount(client: Client<true>): void {
  const run = () =>
    void poll(client).catch((err: unknown) => logger.warn({ err }, 'Player count lookup failed'));
  run();
  setInterval(run, POLL_EVERY_MS).unref();
}

async function poll(client: Client<true>): Promise<void> {
  // When Roblox doesn't answer, everything keeps the last count rather than showing a wrong one.
  const count = await playersOnline();
  if (count === null) return;
  lastCount = count;
  client.user.setActivity(count ? t.playerCount.presence(count) : t.presence, {
    type: ActivityType.Watching,
  });
  for (const guild of client.guilds.cache.values()) {
    if (isServedGuild(guild.id)) refreshPlayerCount(guild);
  }
}

/** Renames the guild's player count channel to the last known count, if it changed. */
export function refreshPlayerCount(guild: Guild): void {
  if (lastCount === null) return;
  void rename(guild, lastCount).catch((err: unknown) =>
    logger.warn({ err, guildId: guild.id }, 'Could not rename the player count channel'),
  );
}

async function rename(guild: Guild, count: number): Promise<void> {
  const config = await getConfig(guild.id);
  const channel = config.playerCountChannelId
    ? guild.channels.cache.get(config.playerCountChannelId)
    : undefined;
  if (channel?.type !== ChannelType.GuildVoice) return;
  const values = new Map([['count', count.toLocaleString('en-US')]]);
  const name =
    fillChannelName(config.playerCountName ?? t.playerCount.defaultName, values) ||
    fillChannelName(t.playerCount.defaultName, values);
  const now = Date.now();
  const recent = (renames.get(channel.id) ?? []).filter((at) => now - at < RENAME_WINDOW_MS);
  // A rename skipped for the limit is picked up by the next poll.
  if (channel.name === name || recent.length >= 2) return;
  renames.set(channel.id, [...recent, now]);
  await channel.setName(name, t.playerCount.auditRename);
}
