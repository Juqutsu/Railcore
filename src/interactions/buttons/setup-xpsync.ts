import { defineComponent } from '../../handlers.js';
import { canSyncEveryone, isSyncRunning, syncEveryone } from '../../services/xpRoleSync.js';
import { xpRolesEditor } from '../../services/xpRoles.js';
import { t } from '../../text.js';
import { logger } from '../../utils/logger.js';

export default defineComponent({
  kind: 'button',
  id: 'setup:xpsync',
  async execute(interaction) {
    const { guild } = interaction;
    let notice: string;
    if (!canSyncEveryone()) {
      notice = t.xpRoles.syncNeedsKeys;
    } else if (isSyncRunning(guild.id)) {
      notice = t.xpRoles.syncRunning;
    } else {
      const members = guild.members.cache.filter((member) => !member.user.bot).size;
      // One Bloxlink lookup per second, see syncEveryone.
      notice = t.xpRoles.syncStarted(members, Math.max(1, Math.ceil(members / 60)));
      void syncEveryone(guild).catch((err: unknown) =>
        logger.error({ err, guildId: guild.id }, 'XP role sync failed'),
      );
    }
    await interaction.update(await xpRolesEditor(guild, notice));
  },
});
