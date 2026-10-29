import {
  InteractionContextType,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from 'discord.js';
import { defineCommand } from '../../handlers.js';
import {
  assertCanModerate,
  assertTimeoutable,
  moderate,
  parseTimeout,
  reasonOption,
  requireMember,
  userOption,
} from '../../services/moderation.js';
import { t } from '../../text.js';

export default defineCommand({
  data: new SlashCommandBuilder()
    .setName('timeout')
    .setDescription(t.commands.timeout)
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .setContexts(InteractionContextType.Guild)
    .addUserOption(userOption)
    .addStringOption((option) =>
      option
        .setName('duration')
        .setDescription(t.options.duration)
        .setMaxLength(20)
        .setRequired(true),
    )
    .addStringOption(reasonOption(false)),

  async execute(interaction) {
    const member = requireMember(interaction);
    assertCanModerate(interaction.member, member);
    const ms = parseTimeout(interaction.options.getString('duration', true));
    assertTimeoutable(member);

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    await moderate(interaction, {
      action: 'TIMEOUT',
      target: member.user,
      reason: interaction.options.getString('reason'),
      durationMs: ms,
      run: (auditReason) => member.timeout(ms, auditReason),
    });
  },
});
