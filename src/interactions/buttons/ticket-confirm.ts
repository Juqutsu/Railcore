import { defineComponent } from '../../handlers.js';
import { closeTicket, getOpenTicket, requireCanClose } from '../../services/tickets.js';
import { t } from '../../text.js';
import { embeds } from '../../utils/embeds.js';

export default defineComponent({
  kind: 'button',
  id: 'ticket:confirm',
  async execute(interaction, [ticketId = '']) {
    const ticket = await getOpenTicket(ticketId, interaction.guildId);
    await requireCanClose(interaction.member, ticket);
    await interaction.update({ embeds: [embeds.info(t.tickets.closingTitle)], components: [] });
    await closeTicket(interaction.guild, ticket.id, interaction.user, null);
  },
});
