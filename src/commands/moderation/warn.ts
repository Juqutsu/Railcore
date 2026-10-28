import {
  InteractionContextType,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from 'discord.js';
import { defineCommand } from '../../handlers.js';
import {
  assertCanModerate,
  moderate,
  reasonOption,
  requireMember,
  userOption,
} from '../../services/moderation.js';
import { t } from '../../text.js';

export default defineCommand({
  data: new SlashCommandBuilder()
    .setName('warn')
    .setDescription(t.commands.warn)
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .setContexts(InteractionContextType.Guild)
    .addUserOption(userOption)
    .addStringOption(reasonOption(true)),

  async execute(interaction) {
    const member = requireMember(interaction);
    assertCanModerate(interaction.member, member);
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    await moderate(interaction, {
      action: 'WARN',
      target: member.user,
      reason: interaction.options.getString('reason', true),
    });
  },
});
