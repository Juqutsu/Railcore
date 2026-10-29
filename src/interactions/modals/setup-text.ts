import { defineComponent } from '../../handlers.js';
import { updateConfig } from '../../services/guildConfig.js';
import { isSettingKey, SETTINGS, setupOverview } from '../../services/setup.js';
import { t } from '../../text.js';
import { UserError } from '../../utils/errors.js';

export default defineComponent({
  kind: 'modal',
  id: 'setup:text',
  async execute(interaction, [key]) {
    if (!isSettingKey(key) || !interaction.isFromMessage()) {
      throw new UserError(t.errors.unknownInteraction);
    }
    const setting = SETTINGS[key];
    if (setting.kind !== 'text') throw new UserError(t.errors.unknownInteraction);
    const text = interaction.fields.getTextInputValue('value').trim();
    // Empty or the unchanged default stores null, so later wording changes in text.ts still apply.
    const value = text && text !== setting.fallback ? text : null;
    const config = await updateConfig(interaction.guildId, { [key]: value });
    const label = t.setup.settings[key].label;
    await interaction.update(
      setupOverview(config, value ? t.setup.saved(label) : t.setup.usingDefault(label)),
    );
  },
});
