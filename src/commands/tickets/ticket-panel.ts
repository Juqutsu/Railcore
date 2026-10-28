import {
  InteractionContextType,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from 'discord.js';
import { defineCommand } from '../../handlers.js';
import { getConfig } from '../../services/guildConfig.js';
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
    if (!ticketSetup(interaction.guild, await getConfig(interaction.guildId))) {
      throw new UserError(t.tickets.panelNeedsSetup);
    }
    const { channel } = interaction;
    if (!channel?.isSendable()) throw new UserError(t.errors.botMissingPermissions);
    const missing = missingPermissions(channel, POST_PERMISSIONS);
    if (missing.length) {
      throw new UserError(t.verify.panelMissingPerms(channel.toString(), missing.join(', ')));
    }

    await channel.send(ticketPanel());
    await interaction.reply({
      embeds: [embeds.success(t.tickets.panelPostedTitle, t.tickets.panelPosted)],
      flags: MessageFlags.Ephemeral,
    });
  },
});
