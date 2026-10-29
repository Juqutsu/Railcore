import {
  ChannelType,
  InteractionContextType,
  SlashCommandBuilder,
  type SlashCommandUserOption,
} from 'discord.js';
import { prisma } from '../../database/client.js';
import { defineCommand } from '../../handlers.js';
import { getConfig } from '../../services/guildConfig.js';
import { isStaff, requireStaff, setTicketAccess } from '../../services/tickets.js';
import { t } from '../../text.js';
import { embeds } from '../../utils/embeds.js';
import { UserError } from '../../utils/errors.js';

const userOption = (option: SlashCommandUserOption) =>
  option.setName('user').setDescription(t.options.ticketUser).setRequired(true);

export default defineCommand({
  data: new SlashCommandBuilder()
    .setName('ticket')
    .setDescription(t.commands.ticket)
    .setContexts(InteractionContextType.Guild)
    .addSubcommand((sub) =>
      sub.setName('add').setDescription(t.commands.ticketAdd).addUserOption(userOption),
    )
    .addSubcommand((sub) =>
      sub.setName('remove').setDescription(t.commands.ticketRemove).addUserOption(userOption),
    ),

  async execute(interaction) {
    const { channel } = interaction;
    const ticket = channel
      ? await prisma.ticket.findUnique({ where: { channelId: channel.id } })
      : null;
    if (ticket?.status !== 'OPEN' || channel?.type !== ChannelType.GuildText) {
      throw new UserError(t.tickets.notInTicket);
    }
    // Staff roles come from /setup, not from Discord permissions, so this is checked here.
    const config = await getConfig(interaction.guildId);
    requireStaff(interaction.member, config);

    const member = interaction.options.getMember('user');
    if (!member) throw new UserError(t.mod.notMember);
    if (member.id === ticket.openerId) throw new UserError(t.tickets.cantChangeOpener);
    if (member.id === interaction.client.user.id) throw new UserError(t.tickets.cantChangeBot);

    const add = interaction.options.getSubcommand() === 'add';
    // A member-level deny would also lock out staff (even yourself), so staff can't be removed.
    if (!add && isStaff(member, config)) throw new UserError(t.tickets.cantRemoveStaff);
    await setTicketAccess(
      channel,
      member.id,
      add,
      t.tickets.auditAccess(interaction.user.username),
    );
    const notice = add ? t.tickets.userAdded : t.tickets.userRemoved;
    await interaction.reply({
      embeds: [embeds.success(undefined, notice(member.toString(), interaction.user.toString()))],
    });
  },
});
