import { defineComponent } from '../../handlers.js';
import { refreshKnown } from '../../services/xpRoleSync.js';
import { MAX_XP, saveTier, tierRoleProblem, xpRolesEditor } from '../../services/xpRoles.js';
import { t } from '../../text.js';
import { parseWholeNumber } from '../../utils/duration.js';
import { UserError } from '../../utils/errors.js';
import { logger } from '../../utils/logger.js';

export default defineComponent({
  kind: 'modal',
  id: 'setup:xpadd',
  async execute(interaction) {
    if (!interaction.isFromMessage()) throw new UserError(t.errors.unknownInteraction);
    const picked = interaction.fields.getSelectedRoles('role', true).first();
    const role = picked && interaction.guild.roles.cache.get(picked.id);
    if (!role) throw new UserError(t.errors.unknownInteraction);
    // The bot hands this role out on its own later, so both it and the admin must be allowed to.
    const problem = tierRoleProblem(role, interaction.member);
    if (problem) throw new UserError(problem);
    const xp = parseWholeNumber(interaction.fields.getTextInputValue('xp'), MAX_XP);
    if (xp === null) throw new UserError(t.xpRoles.invalidXp(MAX_XP.toLocaleString('en-US')));

    await saveTier(interaction.guildId, role.id, xp);
    await interaction.update(
      await xpRolesEditor(
        interaction.guild,
        t.xpRoles.saved(role.toString(), xp.toLocaleString('en-US')),
      ),
    );
    // Known members get the change now instead of on the next 10-minute run.
    void refreshKnown(interaction.guild).catch((err: unknown) =>
      logger.error({ err, guildId: interaction.guildId }, 'XP role refresh failed'),
    );
  },
});
