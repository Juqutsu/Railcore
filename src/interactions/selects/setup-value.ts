import { defineComponent } from '../../handlers.js';
import { updateConfig, type ConfigPatch } from '../../services/guildConfig.js';
import { isSettingKey, SETTINGS, setupOverview } from '../../services/setup.js';
import { t } from '../../text.js';
import { UserError } from '../../utils/errors.js';
import { missingPermissions, roleAssignProblem } from '../../utils/permissions.js';

export default defineComponent({
  kind: 'select',
  id: 'setup:value',
  async execute(interaction, [key]) {
    if (!isSettingKey(key)) throw new UserError(t.errors.unknownInteraction);
    const setting = SETTINGS[key];
    const label = t.setup.settings[key].label;
    let patch: ConfigPatch;
    let notice: string = t.setup.saved(label);

    if (interaction.isChannelSelectMenu()) {
      const channel = interaction.channels.first();
      if (!channel || channel.isDMBased()) throw new UserError(t.errors.unknownInteraction);
      patch = { [key]: channel.id };
      if ('permissions' in setting) {
        const missing = missingPermissions(channel, setting.permissions);
        if (missing.length) {
          notice = t.setup.savedMissingPerms(label, channel.toString(), missing.join(', '));
        }
      }
    } else if (interaction.isRoleSelectMenu()) {
      const roles = [...interaction.roles.values()];
      if (setting.kind === 'roles') {
        patch = { [key]: roles.map((role) => role.id) };
      } else {
        const [role] = roles;
        if (!role) throw new UserError(t.errors.unknownInteraction);
        const problem = roleAssignProblem(role);
        if (problem) throw new UserError(problem);
        patch = { [key]: role.id };
      }
    } else {
      throw new UserError(t.errors.unknownInteraction);
    }

    const config = await updateConfig(interaction.guildId, patch);
    await interaction.update(setupOverview(config, notice));
  },
});
