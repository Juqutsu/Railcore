import { Events } from 'discord.js';
import { defineEvent } from '../handlers.js';
import { sendLog } from '../services/logs.js';
import { t } from '../text.js';
import { clip, embeds } from '../utils/embeds.js';

// /purge, ban with message deletion and other bots' cleanups arrive here, not as messageDelete.
export default defineEvent({
  name: Events.MessageBulkDelete,
  async execute(messages, channel) {
    // Uncached messages count toward the total but have no content to show.
    const lines = [...messages.values()]
      .flatMap((message) => (message.partial || message.author.bot ? [] : [message]))
      .sort((a, b) => a.createdTimestamp - b.createdTimestamp)
      .map((message) => `<@${message.author.id}>: ${message.content || t.serverLog.noText}`);

    const embed = embeds
      .error(t.serverLog.messagesBulkDeleted(messages.size), clip(lines.join('\n'), 4096))
      .addFields({ name: t.serverLog.channel, value: `<#${channel.id}>`, inline: true });
    await sendLog(channel.guild, 'serverLogChannelId', { embeds: [embed] });
  },
});
