import { defineComponent } from '../../handlers.js';
import { getConfig } from '../../services/guildConfig.js';
import { isSettingKey, setupEditor } from '../../services/setup.js';
import { t } from '../../text.js';
import { UserError } from '../../utils/errors.js';

// Manage Server is re-checked for every setup:* click in events/interactionCreate.ts.
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
