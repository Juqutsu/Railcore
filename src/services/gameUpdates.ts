import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  time,
  TimestampStyles,
  type Guild,
  type MessageCreateOptions,
} from 'discord.js';
import { t } from '../text.js';
import { embeds } from '../utils/embeds.js';
import { getConfig, updateConfig } from './guildConfig.js';
import { gameIcon, type GameInfo } from './roblox.js';

/** At most one post per hour, so a burst of hotfixes doesn't flood the channel. */
const POST_GAP_MS = 60 * 60_000;

/** Posts in the update channel when the game was published since the last check. */
export async function checkGameUpdate(guild: Guild, game: GameInfo): Promise<void> {
  const config = await getConfig(guild.id);
  const seen = config.gameUpdatedAt;
  if (seen && game.updated <= seen) return;
  // Tracked even while posts are off, so turning them on never announces an old update.
  await updateConfig(guild.id, { gameUpdatedAt: game.updated });
  // The very first check only sets the starting point.
  if (!seen || !config.gameUpdatesOn) return;

  const channel = config.gameUpdateChannelId
    ? guild.channels.cache.get(config.gameUpdateChannelId)
    : undefined;
  const lastPost = config.gameUpdateAnnouncedAt?.getTime() ?? 0;
  if (!channel?.isSendable() || Date.now() - lastPost < POST_GAP_MS) return;
  await channel.send(await updatePost(game, config.gameUpdateMessage, config.gameUpdatePingRoleId));
  await updateConfig(guild.id, { gameUpdateAnnouncedAt: new Date() });
}

async function updatePost(
  game: GameInfo,
  message: string | null,
  roleId: string | null,
): Promise<MessageCreateOptions> {
  const embed = embeds
    .info(t.gameUpdates.title(game.name), message ?? t.gameUpdates.defaultMessage)
    .setURL(game.url)
    .addFields({
      name: t.gameUpdates.updated,
      value: time(game.updated, TimestampStyles.RelativeTime),
    });
  const icon = await gameIcon();
  if (icon) embed.setThumbnail(icon);
  return {
    content: roleId ? `<@&${roleId}>` : undefined,
    allowedMentions: { roles: roleId ? [roleId] : [] },
    embeds: [embed],
    components: [
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setStyle(ButtonStyle.Link)
          .setURL(game.url)
          .setLabel(t.gameUpdates.play),
      ),
    ],
  };
}
