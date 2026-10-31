import { defineComponent } from '../../handlers.js';
import { updateConfig } from '../../services/guildConfig.js';
import { isSettingKey, SETTINGS, setupOverview } from '../../services/setup.js';
import { refreshTicketPanel } from '../../services/tickets.js';
import { t } from '../../text.js';
import { UserError } from '../../utils/errors.js';

export default defineComponent({
  kind: 'button',
  id: 'setup:toggle',
  async execute(interaction, [key, state]) {
    if (
      !isSettingKey(key) ||
      SETTINGS[key].kind !== 'toggle' ||
      !['on', 'off'].includes(state ?? '')
    ) {
      throw new UserError(t.errors.unknownInteraction);
    }
    // Finding old panels can read many channels, longer than Discord's 3 seconds to answer.
    await interaction.deferUpdate();
    const on = state === 'on';
    const config = await updateConfig(interaction.guildId, { [key]: on });
    let notice = t.setup.switched(t.setup.settings[key].label, on);
    if (key === 'applicationsOpen') {
      // The panel shows the button greyed out while applications are off.
      const updated = await refreshTicketPanel(interaction.guild);
      notice += ` ${updated ? t.setup.panelUpdated(updated) : t.setup.panelNotFound}`;
    }
    await interaction.editReply(setupOverview(config, notice));
  },
});
