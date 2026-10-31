import {
  InteractionContextType,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from 'discord.js';
import { defineCommand } from '../../handlers.js';
import { getConfig, updateConfig } from '../../services/guildConfig.js';
import { ticketPanel, ticketSetup } from '../../services/tickets.js';
import { t } from '../../text.js';
import { embeds } from '../../utils/embeds.js';
import { UserError } from '../../utils/errors.js';
import { missingPermissions, POST_PERMISSIONS } from '../../utils/permissions.js';

export default defineCommand({
  data: new SlashCommandBuilder()
    .setName('ticket-panel')
    .setDescription(t.commands.ticketPanel)
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setContexts(InteractionContextType.Guild),

  async execute(interaction) {
    const config = await getConfig(interaction.guildId);
    if (!ticketSetup(interaction.guild, config)) throw new UserError(t.tickets.panelNeedsSetup);
    const { channel } = interaction;
    if (!channel?.isSendable()) throw new UserError(t.errors.botMissingPermissions);
    const missing = missingPermissions(channel, POST_PERMISSIONS);
    if (missing.length) {
      throw new UserError(t.verify.panelMissingPerms(channel.toString(), missing.join(', ')));
    }

    const panel = await channel.send(ticketPanel(config.applicationsOpen));
    // Remembered so turning applications on or off in /setup can update this panel in place.
    await updateConfig(interaction.guildId, {
      ticketPanelChannelId: channel.id,
      ticketPanelMessageId: panel.id,
    });
    await interaction.reply({
      embeds: [embeds.success(t.tickets.panelPostedTitle, t.tickets.panelPosted)],
      flags: MessageFlags.Ephemeral,
    });
  },
});
