import { Events, time, TimestampStyles } from 'discord.js';
import { defineEvent } from '../handlers.js';
import { sendLog } from '../services/logs.js';
import { sendLeave } from '../services/welcome.js';
import { forgetMember } from '../services/xpRoles.js';
import { t } from '../text.js';
import { clip, embeds, userLine } from '../utils/embeds.js';
import { logger } from '../utils/logger.js';

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
    await Promise.all([
      sendLog(member.guild, 'serverLogChannelId', { embeds: [embed] }),
      sendLeave(member),
      // The XP role sync stops looking them up; a returning member is found again on join.
      forgetMember(member.guild.id, member.id).catch((err: unknown) =>
        logger.warn({ err, userId: member.id }, 'Could not forget linked member'),
      ),
    ]);
  },
});
