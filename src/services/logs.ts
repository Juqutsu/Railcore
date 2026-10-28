import type { Guild, MessageCreateOptions } from 'discord.js';
import { logger } from '../utils/logger.js';
import { getConfig } from './guildConfig.js';

type LogChannel = 'modLogChannelId' | 'serverLogChannelId' | 'ticketLogChannelId';

/**
 * Posts to a configured log channel and reports whether it arrived.
 * Never throws: a broken log channel must not break the action.
 */
export async function sendLog(
  guild: Guild,
  key: LogChannel,
  message: MessageCreateOptions,
): Promise<boolean> {
  const channelId = (await getConfig(guild.id))[key];
  if (!channelId) return false;
  const channel = guild.channels.cache.get(channelId);
  if (!channel?.isSendable()) {
    logger.warn({ guildId: guild.id, key, channelId }, 'Log channel missing or not sendable');
    return false;
  }
  try {
    await channel.send(message);
    return true;
  } catch (err) {
    logger.warn({ err, guildId: guild.id, key, channelId }, 'Could not send log message');
    return false;
  }
}
