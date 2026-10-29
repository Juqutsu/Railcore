import { defineComponent } from '../../handlers.js';
import { removeTier, xpRolesEditor } from '../../services/xpRoles.js';
import { t } from '../../text.js';
import { UserError } from '../../utils/errors.js';

export default defineComponent({
  kind: 'select',
  id: 'setup:xpremove',
  async execute(interaction) {
    const roleId = interaction.values[0];
    if (!roleId) throw new UserError(t.errors.unknownInteraction);
    await removeTier(interaction.guildId, roleId);
    await interaction.update(
      await xpRolesEditor(interaction.guild, t.xpRoles.removed(`<@&${roleId}>`)),
    );
  },
});
