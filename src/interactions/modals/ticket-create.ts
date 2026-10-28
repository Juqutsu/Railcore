import { MessageFlags, time, TimestampStyles } from 'discord.js';
import { defineComponent } from '../../handlers.js';
import { isTicketType, openTicket, readAnswers } from '../../services/tickets.js';
import { t } from '../../text.js';
import { createCooldown } from '../../utils/cooldown.js';
import { embeds } from '../../utils/embeds.js';
import { UserError } from '../../utils/errors.js';

// Every new ticket pings staff, so stop open-close-open loops.
const opened = createCooldown(60_000);

export default defineComponent({
  kind: 'modal',
  id: 'ticket:create',
  async execute(interaction, [type]) {
    if (!isTicketType(type)) throw new UserError(t.errors.unknownInteraction);
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const wait = opened.take(`${interaction.guildId}:${interaction.user.id}`);
    if (wait) {
      const when = time(new Date(Date.now() + wait), TimestampStyles.RelativeTime);
      throw new UserError(t.tickets.cooldown(when));
    }
    const answers = readAnswers(type, (id) => interaction.fields.getTextInputValue(id));
    const channel = await openTicket(interaction.member, type, answers);
    await interaction.editReply({
      embeds: [embeds.success(t.tickets.openedTitle, t.tickets.opened(channel.toString()))],
    });
  },
});
