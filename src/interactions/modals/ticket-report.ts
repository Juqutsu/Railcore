import { MessageFlags } from 'discord.js';
import { defineComponent } from '../../handlers.js';
import { openTicket, readAnswers, takeReportSnapshot } from '../../services/tickets.js';
import { t } from '../../text.js';
import { embeds } from '../../utils/embeds.js';

export default defineComponent({
  kind: 'modal',
  id: 'ticket:report',
  async execute(interaction, [snapshotKey = '']) {
    const { authorId, answers } = takeReportSnapshot(snapshotKey, interaction.user.id);
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const details = readAnswers('REPORT', (id) => interaction.fields.getTextInputValue(id));
    // The reported author never sees the report, even if they are staff.
    const channel = await openTicket(
      interaction.member,
      'REPORT',
      [...answers, ...details],
      authorId,
    );
    await interaction.editReply({
      embeds: [embeds.success(t.tickets.openedTitle, t.tickets.opened(channel.toString()))],
    });
  },
});
