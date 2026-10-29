import {
  ApplicationCommandType,
  ContextMenuCommandBuilder,
  InteractionContextType,
} from 'discord.js';
import { defineMessageCommand } from '../../handlers.js';
import {
  assertCanOpen,
  reportEvidence,
  saveReportSnapshot,
  ticketModal,
} from '../../services/tickets.js';
import { t } from '../../text.js';
import { UserError } from '../../utils/errors.js';

// Open to everyone: members report, staff handle it in a private ticket.
export default defineMessageCommand({
  data: new ContextMenuCommandBuilder()
    .setName(t.contextMenus.report)
    .setType(ApplicationCommandType.Message)
    .setContexts(InteractionContextType.Guild),

  async execute(interaction) {
    const message = interaction.targetMessage;
    if (message.author.id === interaction.user.id) throw new UserError(t.tickets.reportOwn);
    await assertCanOpen(interaction.member, 'REPORT');
    saveReportSnapshot(interaction.id, interaction.user.id, reportEvidence(message));
    await interaction.showModal(ticketModal('REPORT', `ticket:report:${interaction.id}`));
  },
});
