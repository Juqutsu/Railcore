import { defineComponent } from '../../handlers.js';
import { closeTicket, getOpenTicket, requireCanClose } from '../../services/tickets.js';
import { t } from '../../text.js';
import { embeds } from '../../utils/embeds.js';
import { UserError } from '../../utils/errors.js';

export default defineComponent({
  kind: 'modal',
  id: 'ticket:close',
  async execute(interaction, [ticketId = '']) {
    if (!interaction.isFromMessage()) throw new UserError(t.errors.unknownInteraction);
    const ticket = await getOpenTicket(ticketId, interaction.guildId);
    await requireCanClose(interaction.member, ticket);
    const reason = interaction.fields.getTextInputValue('reason').trim() || null;
    await interaction.update({ embeds: [embeds.info(t.tickets.closingTitle)], components: [] });
    await closeTicket(interaction.guild, ticket.id, interaction.user, reason);
  },
});
