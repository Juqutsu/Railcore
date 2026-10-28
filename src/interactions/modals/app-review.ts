import { EmbedBuilder, MessageFlags } from 'discord.js';
import { defineComponent } from '../../handlers.js';
import { isDecision, reviewApplication } from '../../services/applications.js';
import { ticketControls } from '../../services/tickets.js';
import { t } from '../../text.js';
import { embeds } from '../../utils/embeds.js';
import { UserError } from '../../utils/errors.js';

export default defineComponent({
  kind: 'modal',
  id: 'app:review',
  async execute(interaction, [ticketId = '', decision]) {
    if (!isDecision(decision) || !interaction.isFromMessage()) {
      throw new UserError(t.errors.unknownInteraction);
    }
    // Role, DM and log calls can take longer than Discord's 3s limit, so acknowledge first.
    await interaction.deferUpdate();
    const reason = interaction.fields.getTextInputValue('reason').trim() || null;
    const { ticket, dmSent, roleFailed } = await reviewApplication(
      interaction.member,
      ticketId,
      decision,
      reason,
    );

    // The applicant can read this channel, so the decision shows here but the reason does not.
    const [original] = interaction.message.embeds;
    const by = interaction.user.toString();
    const embed = (original ? EmbedBuilder.from(original) : embeds.info()).addFields({
      name: t.applications.decision,
      value: decision === 'accept' ? t.applications.acceptedBy(by) : t.applications.deniedBy(by),
    });
    await interaction.editReply({ embeds: [embed], components: ticketControls(ticket) });
    if (roleFailed) {
      await interaction.followUp({
        embeds: [embeds.error(t.errors.title, t.applications.roleFailed)],
        flags: MessageFlags.Ephemeral,
      });
    }
    if (!dmSent) {
      await interaction.followUp({
        embeds: [embeds.error(t.errors.title, t.applications.dmFailed)],
      });
    }
  },
});
