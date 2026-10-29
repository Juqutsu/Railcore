import { defineComponent } from '../../handlers.js';
import { getConfig } from '../../services/guildConfig.js';
import { isSettingKey, numberModal, SETTINGS } from '../../services/setup.js';
import { t } from '../../text.js';
import { UserError } from '../../utils/errors.js';

export default defineComponent({
  kind: 'button',
  id: 'setup:number',
  async execute(interaction, [key]) {
    if (!isSettingKey(key)) throw new UserError(t.errors.unknownInteraction);
    const setting = SETTINGS[key];
    const current = (await getConfig(interaction.guildId))[key];
    if (setting.kind !== 'number' || typeof current !== 'number') {
      throw new UserError(t.errors.unknownInteraction);
    }
    await interaction.showModal(numberModal(key, setting, current));
  },
});
