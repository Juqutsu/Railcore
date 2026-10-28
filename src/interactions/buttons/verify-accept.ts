import { defineComponent } from '../../handlers.js';
import {
  checkEligibility,
  completeVerification,
  ineligibleEmbed,
} from '../../services/verification.js';
import { t } from '../../text.js';
import { createCooldown } from '../../utils/cooldown.js';
import { embeds } from '../../utils/embeds.js';

const inProgress = createCooldown(10_000);

export default defineComponent({
  kind: 'button',
  id: 'verify:accept',
  async execute(interaction) {
    // Removing the button acknowledges the click and stops double-clicks on this prompt.
    await interaction.update({ components: [] });
    // Several open prompts could be clicked at once; only the first one goes through.
    if (inProgress.take(`${interaction.guildId}:${interaction.user.id}`)) return;

    // Re-check: config or roles may have changed since the prompt was shown.
    const result = await checkEligibility(interaction.member);
    if (!result.ok) {
      await interaction.editReply({ embeds: [ineligibleEmbed(result)] });
      return;
    }
    await completeVerification(interaction.member, result.role);
    await interaction.editReply({
      embeds: [
        embeds.success(t.verify.welcomeTitle, t.verify.welcome(interaction.user.toString())),
      ],
    });
  },
});
