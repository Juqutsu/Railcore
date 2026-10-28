import {
  InteractionContextType,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from 'discord.js';
import { defineCommand } from '../../handlers.js';
import { getConfig } from '../../services/guildConfig.js';
import { verificationPanel } from '../../services/verification.js';
import { t } from '../../text.js';
import { embeds } from '../../utils/embeds.js';
import { UserError } from '../../utils/errors.js';
import {
  missingPermissions,
  POST_PERMISSIONS,
  roleAssignProblem,
} from '../../utils/permissions.js';

export default defineCommand({
  data: new SlashCommandBuilder()
    .setName('verify-panel')
    .setDescription(t.commands.verifyPanel)
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setContexts(InteractionContextType.Guild),

  async execute(interaction) {
    const config = await getConfig(interaction.guildId);
    const role = config.verifiedRoleId
      ? interaction.guild.roles.cache.get(config.verifiedRoleId)
      : undefined;
    if (!role) throw new UserError(t.verify.panelNeedsRole);
    const roleProblem = roleAssignProblem(role);
    if (roleProblem) throw new UserError(roleProblem);
    const channel = config.verificationChannelId
      ? interaction.guild.channels.cache.get(config.verificationChannelId)
      : undefined;
    if (!channel?.isSendable()) throw new UserError(t.verify.panelNeedsChannel);
    const missing = missingPermissions(channel, POST_PERMISSIONS);
    if (missing.length) {
      throw new UserError(t.verify.panelMissingPerms(channel.toString(), missing.join(', ')));
    }

    await channel.send(verificationPanel(interaction.guild));
    await interaction.reply({
      embeds: [embeds.success(t.verify.panelPostedTitle, t.verify.panelPosted(channel.toString()))],
      flags: MessageFlags.Ephemeral,
    });
  },
});
