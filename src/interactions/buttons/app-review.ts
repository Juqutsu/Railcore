import { defineComponent } from '../../handlers.js';
import { getPendingApplication, isDecision, reviewModal } from '../../services/applications.js';
import { t } from '../../text.js';
import { UserError } from '../../utils/errors.js';

export default defineComponent({
  kind: 'button',
  id: 'app:review',
  async execute(interaction, [ticketId = '', decision]) {
    if (!isDecision(decision)) throw new UserError(t.errors.unknownInteraction);
    const { ticket } = await getPendingApplication(interaction.member, ticketId);
    await interaction.showModal(reviewModal(ticket.id, decision));
  },
});
