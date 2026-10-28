import { defineComponent } from '../../handlers.js';
import { claimTicket, ticketControls } from '../../services/tickets.js';
import { t } from '../../text.js';
import { embeds } from '../../utils/embeds.js';

export default defineComponent({
  kind: 'button',
  id: 'ticket:claim',
  async execute(interaction, [ticketId = '']) {
    const ticket = await claimTicket(interaction.member, ticketId);
    await interaction.update({ components: ticketControls(ticket) });
    await interaction.followUp({
      embeds: [embeds.success(undefined, t.tickets.claimedBy(interaction.user.toString()))],
    });
  },
});
