import { defineComponent } from '../../handlers.js';
import { getConfig } from '../../services/guildConfig.js';
import { isSettingKey, setupEditor } from '../../services/setup.js';
import { t } from '../../text.js';
import { UserError } from '../../utils/errors.js';

// No permission re-check in the setup:* handlers: the dashboard is ephemeral, so only the
// user who passed /setup's command permission (Server Settings → Integrations) can click it.
export default defineComponent({
  kind: 'select',
  id: 'setup:pick',
  async execute(interaction) {
    const key = interaction.values[0];
    if (!isSettingKey(key)) throw new UserError(t.errors.unknownInteraction);
    const config = await getConfig(interaction.guildId);
    await interaction.update(setupEditor(interaction.guild, config, key));
  },
});
