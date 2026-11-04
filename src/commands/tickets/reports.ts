import { InteractionContextType, MessageFlags, SlashCommandBuilder } from 'discord.js';
import { defineCommand } from '../../handlers.js';
import { getConfig } from '../../services/guildConfig.js';
import { reportHistory } from '../../services/playerReports.js';
import { requireStaff } from '../../services/tickets.js';
import { t } from '../../text.js';

export default defineCommand({
  data: new SlashCommandBuilder()
    .setName('reports')
    .setDescription(t.commands.reports)
    .setContexts(InteractionContextType.Guild)
    .addStringOption((option) =>
      option
        .setName('player')
        .setDescription(t.options.reportsPlayer)
        .setRequired(true)
        .setMaxLength(50),
    ),

  async execute(interaction) {
    // Staff roles come from /setup, not from Discord permissions, so this is checked here.
    requireStaff(interaction.member, await getConfig(interaction.guildId));
    // Private: reports stay between staff.
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    await interaction.editReply(
      await reportHistory(interaction.guildId, interaction.options.getString('player', true)),
    );
  },
});
