import { MessageFlags } from 'discord.js';
import { defineComponent } from '../../handlers.js';
import {
  assertCanModerate,
  assertStillModerator,
  assertTimeoutable,
  fetchMember,
  moderate,
  parseTimeout,
} from '../../services/moderation.js';

export default defineComponent({
  kind: 'modal',
  id: 'mod:timeout',
  async execute(interaction, [userId = '']) {
    // Checked again: permissions and roles may have changed while the modal was open.
    assertStillModerator(interaction.member);
    const member = await fetchMember(interaction.guild, userId);
    assertCanModerate(interaction.member, member);
    const ms = parseTimeout(interaction.fields.getTextInputValue('duration'));
    assertTimeoutable(member);

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    await moderate(interaction, {
      action: 'TIMEOUT',
      target: member.user,
      reason: interaction.fields.getTextInputValue('reason').trim() || null,
      durationMs: ms,
      run: (auditReason) => member.timeout(ms, auditReason),
    });
  },
});
