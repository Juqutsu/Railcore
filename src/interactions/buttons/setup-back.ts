import { defineComponent } from '../../handlers.js';
import { getConfig } from '../../services/guildConfig.js';
import { setupOverview } from '../../services/setup.js';

export default defineComponent({
  kind: 'button',
  id: 'setup:back',
  async execute(interaction) {
    await interaction.update(setupOverview(await getConfig(interaction.guildId)));
  },
});
