import { Events, time, TimestampStyles } from 'discord.js';
import { defineEvent } from '../handlers.js';
import { getConfig } from '../services/guildConfig.js';
import { sendLog } from '../services/logs.js';
import { sendWelcome } from '../services/welcome.js';
import { syncNewMember } from '../services/xpRoleSync.js';
import { t } from '../text.js';
import { embeds, userLine } from '../utils/embeds.js';

export default defineEvent({
  name: Events.GuildMemberAdd,
  async execute(member) {
    const { minAccountAgeDays } = await getConfig(member.guild.id);
    const created = member.user.createdAt;
    // Same threshold as verification, so staff can spot raid accounts as they arrive.
    const isNew =
      minAccountAgeDays > 0 && Date.now() - created.getTime() < minAccountAgeDays * 86_400_000;

    const embed = embeds
      .success(t.serverLog.memberJoined)
      .setThumbnail(member.displayAvatarURL())
      .addFields(
        { name: t.logs.member, value: userLine(member.id), inline: true },
        {
          name: t.logs.accountCreated,
          value: `${time(created, TimestampStyles.RelativeTime)}${isNew ? ` · ${t.serverLog.newAccount}` : ''}`,
          inline: true,
        },
        { name: t.serverLog.memberCount, value: String(member.guild.memberCount), inline: true },
      );
    await Promise.all([
      sendLog(member.guild, 'serverLogChannelId', { embeds: [embed] }),
      sendWelcome(member),
      syncNewMember(member),
    ]);
  },
});
