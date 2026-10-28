import { Events } from 'discord.js';
import { defineEvent } from '../handlers.js';
import { sendLog } from '../services/logs.js';
import { t } from '../text.js';
import { clip, embeds, userLine } from '../utils/embeds.js';

export default defineEvent({
  name: Events.MessageUpdate,
  async execute(oldMessage, newMessage) {
    if (!newMessage.inGuild() || newMessage.author.bot) return;
    if (oldMessage.partial) {
      // No cached copy to compare with; only fresh edits count, which skips pins and embed loads.
      const edited = newMessage.editedTimestamp;
      if (!edited || Date.now() - edited > 60_000) return;
    } else if (oldMessage.content === newMessage.content) {
      return;
    }

    const embed = embeds
      .info(t.serverLog.messageEdited)
      .setURL(newMessage.url)
      .addFields(
        { name: t.serverLog.author, value: userLine(newMessage.author.id), inline: true },
        { name: t.serverLog.channel, value: `<#${newMessage.channelId}>`, inline: true },
        {
          name: t.serverLog.before,
          value: oldMessage.partial
            ? t.serverLog.notCached
            : clip(oldMessage.content, 1024) || t.serverLog.noText,
        },
        { name: t.serverLog.after, value: clip(newMessage.content, 1024) || t.serverLog.noText },
      );
    await sendLog(newMessage.guild, 'serverLogChannelId', { embeds: [embed] });
  },
});
