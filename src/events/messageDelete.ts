import { Events } from 'discord.js';
import { defineEvent } from '../handlers.js';
import { sendLog } from '../services/logs.js';
import { t } from '../text.js';
import { clip, embeds, userLine } from '../utils/embeds.js';

export default defineEvent({
  name: Events.MessageDelete,
  async execute(message) {
    const { guild } = message;
    // An uncached message has no author or content, so there's nothing useful to log
    // (and it might be one of the bot's own messages).
    if (!guild || message.partial || message.author.bot) return;

    const embed = embeds
      .error(t.serverLog.messageDeleted)
      .addFields(
        { name: t.serverLog.author, value: userLine(message.author.id), inline: true },
        { name: t.serverLog.channel, value: `<#${message.channelId}>`, inline: true },
        { name: t.serverLog.content, value: clip(message.content, 1024) || t.serverLog.noText },
      );
    if (message.attachments.size) {
      const names = [...message.attachments.values()].map((file) => file.name).join('\n');
      embed.addFields({ name: t.serverLog.attachments, value: clip(names, 1024) });
    }
    await sendLog(guild, 'serverLogChannelId', { embeds: [embed] });
  },
});
