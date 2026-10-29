import {
  ApplicationCommandType,
  ContextMenuCommandBuilder,
  InteractionContextType,
  PermissionFlagsBits,
} from 'discord.js';
import { defineUserCommand } from '../../handlers.js';
import { assertCanModerate, warnModal } from '../../services/moderation.js';
import { t } from '../../text.js';
import { UserError } from '../../utils/errors.js';

export default defineUserCommand({
  data: new ContextMenuCommandBuilder()
    .setName(t.contextMenus.warn)
    .setType(ApplicationCommandType.User)
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .setContexts(InteractionContextType.Guild),

  async execute(interaction) {
    const member = interaction.targetMember;
    if (!member) throw new UserError(t.mod.notMember);
    // Checked before the modal so nobody types a reason for a warning that can't happen.
    assertCanModerate(interaction.member, member);
    await interaction.showModal(warnModal(member.user));
  },
});
