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
  MAX_TIMEOUT_MS,
  MIN_TIMEOUT_MS,
  moderate,
  reasonOption,
  requireMember,
  userOption,
} from '../../services/moderation.js';
import { t } from '../../text.js';
import { parseDuration } from '../../utils/duration.js';
import { UserError } from '../../utils/errors.js';

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
    const ms = parseDuration(interaction.options.getString('duration', true));
    if (ms === null || ms < MIN_TIMEOUT_MS || ms > MAX_TIMEOUT_MS) {
      throw new UserError(t.mod.invalidDuration);
    }
    if (member.permissions.has(PermissionFlagsBits.Administrator)) {
      throw new UserError(t.mod.timeoutAdmin);
    }
    assertBotCan(member.moderatable, member);

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
