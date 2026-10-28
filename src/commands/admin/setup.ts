import {
  InteractionContextType,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from 'discord.js';
import { defineCommand } from '../../handlers.js';
import { getConfig } from '../../services/guildConfig.js';
import { setupOverview } from '../../services/setup.js';
import { t } from '../../text.js';

export default defineCommand({
  data: new SlashCommandBuilder()
    .setName('setup')
    .setDescription(t.commands.setup)
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setContexts(InteractionContextType.Guild),

  async execute(interaction) {
    const config = await getConfig(interaction.guildId);
    await interaction.reply({ ...setupOverview(config), flags: MessageFlags.Ephemeral });
  },
});
