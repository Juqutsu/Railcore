import { defineComponent } from '../../handlers.js';
import { assertCanOpen, isTicketType, ticketModal } from '../../services/tickets.js';
import { t } from '../../text.js';
import { UserError } from '../../utils/errors.js';

export default defineComponent({
  kind: 'button',
  id: 'ticket:open',
  async execute(interaction, [type]) {
    if (!isTicketType(type)) throw new UserError(t.errors.unknownInteraction);
    // Check before the modal, so nobody fills in a form that can't be submitted.
    await assertCanOpen(interaction.member, type);
    await interaction.showModal(ticketModal(type));
  },
});
