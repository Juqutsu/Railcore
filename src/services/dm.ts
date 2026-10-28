import type { Client, Message, MessageCreateOptions } from 'discord.js';
import { logger } from '../utils/logger.js';

/** DMs a user. Returns null instead of throwing when their DMs are closed or they can't be found. */
export async function sendDm(
  client: Client,
  userId: string,
  message: MessageCreateOptions,
): Promise<Message | null> {
  try {
    const user = await client.users.fetch(userId);
    return await user.send(message);
  } catch (err) {
    logger.debug({ err, userId }, 'Could not send DM');
    return null;
  }
}
