import {
  InteractionContextType,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from 'discord.js';
import { defineCommand } from '../../handlers.js';
import { userOption, warningsReply } from '../../services/moderation.js';
import { t } from '../../text.js';

export default defineCommand({
  data: new SlashCommandBuilder()
    .setName('warnings')
    .setDescription(t.commands.warnings)
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .setContexts(InteractionContextType.Guild)
    .addUserOption(userOption),

  async execute(interaction) {
    const user = interaction.options.getUser('user', true);
    await interaction.reply({
      ...(await warningsReply(interaction.guildId, user)),
      flags: MessageFlags.Ephemeral,
    });
  },
});
