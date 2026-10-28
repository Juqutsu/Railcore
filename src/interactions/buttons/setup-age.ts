import { defineComponent } from '../../handlers.js';
import { getConfig } from '../../services/guildConfig.js';
import { ageModal } from '../../services/setup.js';

export default defineComponent({
  kind: 'button',
  id: 'setup:age',
  async execute(interaction) {
    const config = await getConfig(interaction.guildId);
    await interaction.showModal(ageModal(config.minAccountAgeDays));
  },
});
