import {
  ApplicationCommandType,
  ContextMenuCommandBuilder,
  InteractionContextType,
  MessageFlags,
  PermissionFlagsBits,
} from 'discord.js';
import { defineUserCommand } from '../../handlers.js';
import { warningsReply } from '../../services/moderation.js';
import { t } from '../../text.js';

export default defineUserCommand({
  data: new ContextMenuCommandBuilder()
    .setName(t.contextMenus.warnings)
    .setType(ApplicationCommandType.User)
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .setContexts(InteractionContextType.Guild),

  async execute(interaction) {
    await interaction.reply({
      ...(await warningsReply(interaction.guildId, interaction.targetUser)),
      flags: MessageFlags.Ephemeral,
    });
  },
});
