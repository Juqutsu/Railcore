import { MessageFlags } from 'discord.js';
import { defineComponent } from '../../handlers.js';
import {
  assertCanModerate,
  assertStillModerator,
  fetchMember,
  moderate,
} from '../../services/moderation.js';

export default defineComponent({
  kind: 'modal',
  id: 'mod:warn',
  async execute(interaction, [userId = '']) {
    // Checked again: permissions and roles may have changed while the modal was open.
    assertStillModerator(interaction.member);
    const member = await fetchMember(interaction.guild, userId);
    assertCanModerate(interaction.member, member);
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    await moderate(interaction, {
      action: 'WARN',
      target: member.user,
      reason: interaction.fields.getTextInputValue('reason').trim() || null,
    });
  },
});
