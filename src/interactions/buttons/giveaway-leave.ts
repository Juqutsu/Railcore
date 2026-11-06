import { prisma } from '../../database/client.js';
import { defineComponent } from '../../handlers.js';
import { scheduleCountRefresh } from '../../services/giveaways.js';
import { t } from '../../text.js';

export default defineComponent({
  kind: 'button',
  id: 'giveaway:leave',
  async execute(interaction, [id = '']) {
    const giveawayId = Number(id);
    const giveaway = Number.isInteger(giveawayId)
      ? await prisma.giveaway.findUnique({ where: { id: giveawayId } })
      : null;
    if (!giveaway || giveaway.endedAt) {
      await interaction.update({ content: t.giveaways.ended, components: [] });
      return;
    }
    await prisma.giveawayEntry.deleteMany({ where: { giveawayId, userId: interaction.user.id } });
    await interaction.update({ content: t.giveaways.left, components: [] });
    scheduleCountRefresh(interaction.client, giveawayId);
  },
});
