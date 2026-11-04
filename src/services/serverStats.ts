import { ActivityType, ChannelType, type Client, type Guild } from 'discord.js';
import { t } from '../text.js';
import { logger } from '../utils/logger.js';
import { fillChannelName } from '../utils/template.js';
import { checkGameUpdate } from './gameUpdates.js';
import { getConfig } from './guildConfig.js';
import { isServedGuild } from './guildLock.js';
import { gameInfo } from './roblox.js';

const POLL_EVERY_MS = 10 * 60_000;
/** Discord allows 2 renames per channel in 10 minutes; more would wait on its rate limit. */
const RENAME_WINDOW_MS = 10 * 60_000;
const renames = new Map<string, number[]>();
/** The last count from Roblox, so a /setup change can apply it without asking Roblox again. */
let lastPlayers: number | null = null;

type Stat = {
  channel: 'memberCountChannelId' | 'playerCountChannelId' | 'boostCountChannelId';
  name: 'memberCountName' | 'playerCountName' | 'boostCountName';
  fallback: string;
  /** null while unknown, e.g. before Roblox answered once. */
  count: (guild: Guild) => number | null;
};

const STATS: Stat[] = [
  {
    channel: 'memberCountChannelId',
    name: 'memberCountName',
    fallback: t.serverStats.defaults.members,
    count: (guild) => guild.memberCount,
  },
  {
    channel: 'playerCountChannelId',
    name: 'playerCountName',
    fallback: t.serverStats.defaults.players,
    count: () => lastPlayers,
  },
  {
    channel: 'boostCountChannelId',
    name: 'boostCountName',
    fallback: t.serverStats.defaults.boosts,
    count: (guild) => guild.premiumSubscriptionCount ?? 0,
  },
];

/** Settings that change a stat channel, so saving one renames right away. */
export const SERVER_STATS_KEYS: readonly string[] = STATS.flatMap((stat) => [
  stat.channel,
  stat.name,
]);

/**
 * Every 10 minutes, and once at startup: one look at the game feeds the stat channels, the bot
 * status and the update posts.
 */
export function startServerStats(client: Client<true>): void {
  const run = () =>
    void poll(client).catch((err: unknown) => logger.warn({ err }, 'Server stats update failed'));
  run();
  setInterval(run, POLL_EVERY_MS).unref();
}

async function poll(client: Client<true>): Promise<void> {
  // When Roblox doesn't answer, the player count stays as it was rather than showing a wrong one.
  const game = await gameInfo().catch((err: unknown) => {
    logger.warn({ err }, 'Game lookup failed');
    return null;
  });
  if (game) {
    // Also shows that the 10-minute poll is alive.
    if (game.playing !== lastPlayers) logger.info({ players: game.playing }, 'Players in game');
    lastPlayers = game.playing;
    client.user.setActivity(game.playing ? t.serverStats.presence(game.playing) : t.presence, {
      type: ActivityType.Watching,
    });
  }
  for (const guild of client.guilds.cache.values()) {
    if (!isServedGuild(guild.id)) continue;
    refreshServerStats(guild);
    if (game) {
      void checkGameUpdate(guild, game).catch((err: unknown) =>
        logger.warn({ err, guildId: guild.id }, 'Game update check failed'),
      );
    }
  }
}

/** Renames the guild's stat channels whose name changed. */
export function refreshServerStats(guild: Guild): void {
  void renameAll(guild).catch((err: unknown) =>
    logger.warn({ err, guildId: guild.id }, 'Could not update the server stats'),
  );
}

async function renameAll(guild: Guild): Promise<void> {
  const config = await getConfig(guild.id);
  for (const stat of STATS) {
    const count = stat.count(guild);
    const channelId = config[stat.channel];
    const channel = channelId ? guild.channels.cache.get(channelId) : undefined;
    if (count === null || channel?.type !== ChannelType.GuildVoice) continue;
    const values = new Map([['count', count.toLocaleString('en-US')]]);
    const name =
      fillChannelName(config[stat.name] ?? stat.fallback, values) ||
      fillChannelName(stat.fallback, values);
    const now = Date.now();
    const recent = (renames.get(channel.id) ?? []).filter((at) => now - at < RENAME_WINDOW_MS);
    // A rename skipped for the limit is picked up by the next poll.
    if (channel.name === name || recent.length >= 2) continue;
    renames.set(channel.id, [...recent, now]);
    logger.info({ channelId: channel.id, name }, 'Renaming stat channel');
    // One broken channel (e.g. missing permission) must not stop the others.
    await channel
      .setName(name, t.serverStats.auditRename)
      .catch((err: unknown) =>
        logger.warn({ err, channelId: channel.id }, 'Could not rename a stat channel'),
      );
  }
}
