import { MessageFlags } from 'discord.js';
import { defineComponent } from '../../handlers.js';
import { isPanelType, openTicket, readAnswers } from '../../services/tickets.js';
import { t } from '../../text.js';
import { embeds } from '../../utils/embeds.js';
import { UserError } from '../../utils/errors.js';

export default defineComponent({
  kind: 'modal',
  id: 'ticket:create',
  async execute(interaction, [type]) {
    if (!isPanelType(type)) throw new UserError(t.errors.unknownInteraction);
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const answers = readAnswers(type, (id) => interaction.fields.getTextInputValue(id));
    const channel = await openTicket(interaction.member, type, answers);
    await interaction.editReply({
      embeds: [embeds.success(t.tickets.openedTitle, t.tickets.opened(channel.toString()))],
    });
  },
});
