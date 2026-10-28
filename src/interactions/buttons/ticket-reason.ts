import { defineComponent } from '../../handlers.js';
import { closeReasonModal, getOpenTicket, requireCanClose } from '../../services/tickets.js';

export default defineComponent({
  kind: 'button',
  id: 'ticket:reason',
  async execute(interaction, [ticketId = '']) {
    const ticket = await getOpenTicket(ticketId, interaction.guildId);
    await requireCanClose(interaction.member, ticket);
    await interaction.showModal(closeReasonModal(ticket.id));
  },
});
