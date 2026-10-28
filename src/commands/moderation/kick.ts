import {
  InteractionContextType,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from 'discord.js';
import { defineCommand } from '../../handlers.js';
import {
  assertBotCan,
  assertCanModerate,
  moderate,
  reasonOption,
  requireMember,
  userOption,
} from '../../services/moderation.js';
import { t } from '../../text.js';

export default defineCommand({
  data: new SlashCommandBuilder()
    .setName('kick')
    .setDescription(t.commands.kick)
    .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers)
    .setContexts(InteractionContextType.Guild)
    .addUserOption(userOption)
    .addStringOption(reasonOption(false)),

  async execute(interaction) {
    const member = requireMember(interaction);
    assertCanModerate(interaction.member, member);
    assertBotCan(member.kickable, member);

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    await moderate(interaction, {
      action: 'KICK',
      target: member.user,
      reason: interaction.options.getString('reason'),
      run: (auditReason) => member.kick(auditReason),
    });
  },
});
