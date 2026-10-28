import { MessageFlags } from 'discord.js';
import { defineComponent } from '../../handlers.js';
import { closeConfirmation, getOpenTicket, requireCanClose } from '../../services/tickets.js';

export default defineComponent({
  kind: 'button',
  id: 'ticket:close',
  async execute(interaction, [ticketId = '']) {
    const ticket = await getOpenTicket(ticketId, interaction.guildId);
    await requireCanClose(interaction.member, ticket);
    await interaction.reply({ ...closeConfirmation(ticket.id), flags: MessageFlags.Ephemeral });
  },
});
