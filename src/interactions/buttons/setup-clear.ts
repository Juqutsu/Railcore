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
    const { kind } = SETTINGS[key];
    const config = await updateConfig(interaction.guildId, { [key]: kind === 'roles' ? [] : null });
    const label = t.setup.settings[key].label;
    await interaction.update(
      setupOverview(config, kind === 'text' ? t.setup.usingDefault(label) : t.setup.cleared(label)),
    );
  },
});
