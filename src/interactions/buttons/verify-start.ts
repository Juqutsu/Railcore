import { MessageFlags, time, TimestampStyles } from 'discord.js';
import { defineComponent } from '../../handlers.js';
import {
  checkEligibility,
  ineligibleEmbed,
  reportTooNew,
  verificationPrompt,
} from '../../services/verification.js';
import { t } from '../../text.js';
import { createCooldown } from '../../utils/cooldown.js';
import { UserError } from '../../utils/errors.js';

const clicks = createCooldown(15_000);

export default defineComponent({
  kind: 'button',
  id: 'verify:start',
  async execute(interaction) {
    const retryIn = clicks.take(`${interaction.guildId}:${interaction.user.id}`);
    if (retryIn) {
      const when = time(new Date(Date.now() + retryIn), TimestampStyles.RelativeTime);
      throw new UserError(t.verify.cooldown(when));
    }

    const result = await checkEligibility(interaction.member);
    if (!result.ok) {
      await interaction.reply({ embeds: [ineligibleEmbed(result)], flags: MessageFlags.Ephemeral });
      if (result.reason === 'tooNew') await reportTooNew(interaction.member, result);
      return;
    }
    await interaction.reply({ ...verificationPrompt(), flags: MessageFlags.Ephemeral });
  },
});
