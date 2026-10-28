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
import { UserError } from '../../utils/errors.js';

export default defineCommand({
  data: new SlashCommandBuilder()
    .setName('untimeout')
    .setDescription(t.commands.untimeout)
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .setContexts(InteractionContextType.Guild)
    .addUserOption(userOption)
    .addStringOption(reasonOption(false)),

  async execute(interaction) {
    const member = requireMember(interaction);
    assertCanModerate(interaction.member, member);
    if (!member.isCommunicationDisabled()) {
      throw new UserError(t.mod.notTimedOut(member.toString()));
    }
    assertBotCan(member.moderatable, member);

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    await moderate(interaction, {
      action: 'UNTIMEOUT',
      target: member.user,
      reason: interaction.options.getString('reason'),
      run: (auditReason) => member.timeout(null, auditReason),
    });
  },
});
