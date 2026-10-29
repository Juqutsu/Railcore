import {
  ApplicationCommandType,
  ContextMenuCommandBuilder,
  InteractionContextType,
  PermissionFlagsBits,
} from 'discord.js';
import { defineUserCommand } from '../../handlers.js';
import { assertCanModerate, assertTimeoutable, timeoutModal } from '../../services/moderation.js';
import { t } from '../../text.js';
import { UserError } from '../../utils/errors.js';

export default defineUserCommand({
  data: new ContextMenuCommandBuilder()
    .setName(t.contextMenus.timeout)
    .setType(ApplicationCommandType.User)
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .setContexts(InteractionContextType.Guild),

  async execute(interaction) {
    const member = interaction.targetMember;
    if (!member) throw new UserError(t.mod.notMember);
    assertCanModerate(interaction.member, member);
    assertTimeoutable(member);
    await interaction.showModal(timeoutModal(member.user));
  },
});
