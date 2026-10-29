import { defineComponent } from '../../handlers.js';
import { getConfig } from '../../services/guildConfig.js';
import { isSettingKey, SETTINGS, textModal } from '../../services/setup.js';
import { t } from '../../text.js';
import { UserError } from '../../utils/errors.js';

export default defineComponent({
  kind: 'button',
  id: 'setup:text',
  async execute(interaction, [key]) {
    if (!isSettingKey(key)) throw new UserError(t.errors.unknownInteraction);
    const setting = SETTINGS[key];
    if (setting.kind !== 'text') throw new UserError(t.errors.unknownInteraction);
    const current = (await getConfig(interaction.guildId))[key];
    await interaction.showModal(
      textModal(key, setting, typeof current === 'string' ? current : null),
    );
  },
});
