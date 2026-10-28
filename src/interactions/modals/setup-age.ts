import { defineComponent } from '../../handlers.js';
import { updateConfig } from '../../services/guildConfig.js';
import { setupOverview } from '../../services/setup.js';
import { t } from '../../text.js';
import { parseDays } from '../../utils/duration.js';
import { UserError } from '../../utils/errors.js';

export default defineComponent({
  kind: 'modal',
  id: 'setup:age',
  async execute(interaction) {
    const days = parseDays(interaction.fields.getTextInputValue('days'));
    if (days === null) throw new UserError(t.setup.invalidAge);
    if (!interaction.isFromMessage()) throw new UserError(t.errors.unknownInteraction);
    const config = await updateConfig(interaction.guildId, { minAccountAgeDays: days });
    await interaction.update(
      setupOverview(config, t.setup.saved(t.setup.settings.minAccountAgeDays.label)),
    );
  },
});
