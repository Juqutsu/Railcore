import { defineComponent } from '../../handlers.js';
import { xpTierModal } from '../../services/xpRoles.js';

export default defineComponent({
  kind: 'button',
  id: 'setup:xpadd',
  async execute(interaction) {
    await interaction.showModal(xpTierModal());
  },
});
