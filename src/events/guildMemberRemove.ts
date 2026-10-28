import { Events, time, TimestampStyles } from 'discord.js';
import { defineEvent } from '../handlers.js';
import { sendLog } from '../services/logs.js';
import { t } from '../text.js';
import { clip, embeds, userLine } from '../utils/embeds.js';

export default defineEvent({
  name: Events.GuildMemberRemove,
  async execute(member) {
    const roles = member.partial
      ? null
      : member.roles.cache
          .filter((role) => role.id !== member.guild.id)
          .map((role) => role.toString())
          .join(' ');

    const embed = embeds
      .error(t.serverLog.memberLeft)
      .setThumbnail(member.user.displayAvatarURL())
      .addFields(
        { name: t.logs.member, value: userLine(member.id), inline: true },
        {
          name: t.serverLog.joined,
          value: member.joinedAt
            ? time(member.joinedAt, TimestampStyles.RelativeTime)
            : t.serverLog.unknown,
          inline: true,
        },
        {
          name: t.serverLog.roles,
          value: roles === null ? t.serverLog.unknown : clip(roles, 1024) || t.serverLog.none,
        },
      );
    await sendLog(member.guild, 'serverLogChannelId', { embeds: [embed] });
  },
});
