import type { Client, Guild } from 'discord.js';
import { env } from '../env.js';
import { guildsToLeave } from '../utils/allowlist.js';
import { logger } from '../utils/logger.js';

/**
 * The servers the bot may work in. Only active when both IDs are set: the same bot token often
 * runs a dev copy and a production copy, and neither may make the bot leave the other's server.
 */
const allowed =
  env.TEST_SERVER_ID && env.PROD_SERVER_ID
    ? new Set([env.TEST_SERVER_ID, env.PROD_SERVER_ID])
    : null;

export const isAllowedGuild = (guildId: string) => !allowed || allowed.has(guildId);

/**
 * The one server this copy handles: the production server in Docker (NODE_ENV=production), the
 * test server everywhere else. Both copies share the bot token and so receive every event, but
 * each handles only its own server and keeps that server's data in its own database.
 */
const home = env.NODE_ENV === 'production' ? env.PROD_SERVER_ID : env.TEST_SERVER_ID;

export const isServedGuild = (guildId: string) =>
  home ? guildId === home : isAllowedGuild(guildId);

export const servedScope = () =>
  home ? (env.NODE_ENV === 'production' ? 'PROD_SERVER_ID' : 'TEST_SERVER_ID') : 'all servers';

/** Leaves a server that is neither the test nor the production server. */
export async function leaveIfForeign(guild: Guild): Promise<boolean> {
  if (isAllowedGuild(guild.id)) return false;
  logger.warn({ guildId: guild.id, name: guild.name }, 'Leaving a server that is not allowed');
  await guild.leave();
  return true;
}

/**
 * At startup, leaves every foreign server, but only while the bot is in both allowed servers.
 * Otherwise an ID may be wrong, and leaving could hit the real server that ID should name.
 */
export async function leaveForeignGuilds(client: Client<true>): Promise<void> {
  if (!allowed) return;
  const ids = [...client.guilds.cache.keys()];
  if (![...allowed].every((id) => ids.includes(id))) {
    logger.warn(
      { allowed: [...allowed] },
      "I'm not in both the TEST_SERVER_ID and PROD_SERVER_ID servers, so I leave no server at startup. Check both IDs.",
    );
  }
  for (const id of guildsToLeave(ids, allowed)) {
    const guild = client.guilds.cache.get(id);
    if (!guild) continue;
    await leaveIfForeign(guild).catch((err: unknown) =>
      logger.error({ err, guildId: id }, 'Could not leave a server'),
    );
  }
}
