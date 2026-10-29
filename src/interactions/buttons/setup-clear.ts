import { defineComponent } from '../../handlers.js';
import { updateConfig } from '../../services/guildConfig.js';
import { isSettingKey, SETTINGS, setupOverview } from '../../services/setup.js';
import { t } from '../../text.js';
import { UserError } from '../../utils/errors.js';

export default defineComponent({
  kind: 'button',
  id: 'setup:clear',
  async execute(interaction, [key]) {
    if (!isSettingKey(key) || SETTINGS[key].kind === 'number') {
      throw new UserError(t.errors.unknownInteraction);
    }
    const config = await updateConfig(interaction.guildId, {
      [key]: SETTINGS[key].kind === 'roles' ? [] : null,
    });
    await interaction.update(setupOverview(config, t.setup.cleared(t.setup.settings[key].label)));
  },
});
