import { defineComponent } from '../../handlers.js';
import { updateConfig } from '../../services/guildConfig.js';
import { isSettingKey, SETTINGS, setupOverview } from '../../services/setup.js';
import { t } from '../../text.js';
import { parseWholeNumber } from '../../utils/duration.js';
import { UserError } from '../../utils/errors.js';

export default defineComponent({
  kind: 'modal',
  id: 'setup:number',
  async execute(interaction, [key]) {
    if (!isSettingKey(key) || !interaction.isFromMessage()) {
      throw new UserError(t.errors.unknownInteraction);
    }
    const setting = SETTINGS[key];
    if (setting.kind !== 'number') throw new UserError(t.errors.unknownInteraction);
    const value = parseWholeNumber(interaction.fields.getTextInputValue('value'), setting.max);
    if (value === null) throw new UserError(t.setup.invalidNumber(setting.max));
    const config = await updateConfig(interaction.guildId, { [key]: value });
    await interaction.update(setupOverview(config, t.setup.saved(t.setup.settings[key].label)));
  },
});
