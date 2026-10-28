import { randomUUID } from 'node:crypto';
import { DiscordAPIError, MessageFlags, RESTJSONErrorCodes, type Interaction } from 'discord.js';
import { t } from '../text.js';
import { embeds } from './embeds.js';
import { logger } from './logger.js';

/** An expected failure. Its message is shown to the user as-is. */
export class UserError extends Error {}

const permissionErrors = new Set<unknown>([
  RESTJSONErrorCodes.MissingPermissions,
  RESTJSONErrorCodes.MissingAccess,
]);

export async function handleInteractionError(
  interaction: Interaction,
  err: unknown,
): Promise<void> {
  const context = {
    userId: interaction.user.id,
    guildId: interaction.guildId,
    ...(interaction.isCommand() && { command: interaction.commandName }),
    ...((interaction.isMessageComponent() || interaction.isModalSubmit()) && {
      customId: interaction.customId,
    }),
  };

  let message: string;
  if (err instanceof UserError) {
    message = err.message;
  } else if (err instanceof DiscordAPIError && permissionErrors.has(err.code)) {
    logger.warn({ err, ...context }, 'Missing Discord permissions');
    message = t.errors.botMissingPermissions;
  } else {
    const ref = randomUUID().slice(0, 8);
    logger.error({ err, ref, ...context }, 'Interaction failed');
    message = t.errors.unexpected(ref);
  }

  if (!interaction.isRepliable()) return;
  const payload = {
    embeds: [embeds.error(t.errors.title, message)],
    flags: MessageFlags.Ephemeral,
  } as const;
  try {
    if (interaction.deferred || interaction.replied) await interaction.followUp(payload);
    else await interaction.reply(payload);
  } catch (replyErr) {
    logger.warn({ err: replyErr, ...context }, 'Could not send error reply');
  }
}
