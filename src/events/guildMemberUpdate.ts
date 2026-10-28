import { escapeMarkdown, Events, type EmbedBuilder } from 'discord.js';
import { defineEvent } from '../handlers.js';
import { getConfig } from '../services/guildConfig.js';
import { sendLog } from '../services/logs.js';
import { t } from '../text.js';
import { clip, embeds, userLine } from '../utils/embeds.js';

export default defineEvent({
  name: Events.GuildMemberUpdate,
  async execute(oldMember, newMember) {
    // Nothing to compare against; ready.ts fills the member cache so this stays rare.
    if (oldMember.partial) return;
    const logEmbeds: EmbedBuilder[] = [];

    const added = newMember.roles.cache.filter((role) => !oldMember.roles.cache.has(role.id));
    const removed = oldMember.roles.cache.filter((role) => !newMember.roles.cache.has(role.id));
    // Verification logs itself, so its role grant alone would be a duplicate entry.
    const { verifiedRoleId } = await getConfig(newMember.guild.id);
    const onlyVerified =
      !removed.size && added.size === 1 && verifiedRoleId !== null && added.has(verifiedRoleId);
    if ((added.size || removed.size) && !onlyVerified) {
      const embed = embeds
        .info(t.serverLog.rolesChanged)
        .setThumbnail(newMember.displayAvatarURL())
        .addFields({ name: t.logs.member, value: userLine(newMember.id) });
      if (added.size) {
        embed.addFields({
          name: t.serverLog.added,
          value: clip(added.map(String).join(' '), 1024),
          inline: true,
        });
      }
      if (removed.size) {
        embed.addFields({
          name: t.serverLog.removed,
          value: clip(removed.map(String).join(' '), 1024),
          inline: true,
        });
      }
      logEmbeds.push(embed);
    }

    if (oldMember.nickname !== newMember.nickname) {
      const show = (nickname: string | null) =>
        nickname ? escapeMarkdown(nickname) : t.serverLog.none;
      logEmbeds.push(
        embeds
          .info(t.serverLog.nicknameChanged)
          .addFields(
            { name: t.logs.member, value: userLine(newMember.id) },
            { name: t.serverLog.before, value: show(oldMember.nickname), inline: true },
            { name: t.serverLog.after, value: show(newMember.nickname), inline: true },
          ),
      );
    }

    if (logEmbeds.length) {
      await sendLog(newMember.guild, 'serverLogChannelId', { embeds: logEmbeds });
    }
  },
});
