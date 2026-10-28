import {
  DiscordAPIError,
  InteractionContextType,
  MessageFlags,
  PermissionFlagsBits,
  RESTJSONErrorCodes,
  SlashCommandBuilder,
} from 'discord.js';
import { defineCommand } from '../../handlers.js';
import { moderate, reasonOption } from '../../services/moderation.js';
import { t } from '../../text.js';
import { UserError } from '../../utils/errors.js';

export default defineCommand({
  data: new SlashCommandBuilder()
    .setName('unban')
    .setDescription(t.commands.unban)
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
    .setContexts(InteractionContextType.Guild)
    .addStringOption((option) =>
      option
        .setName('user_id')
        .setDescription(t.options.userId)
        .setMinLength(17)
        .setMaxLength(40)
        .setRequired(true),
    )
    .addStringOption(reasonOption(false)),

  async execute(interaction) {
    // Accepts a raw ID or a pasted mention like <@123…>.
    const id = /\d{17,20}/.exec(interaction.options.getString('user_id', true))?.[0];
    if (!id) throw new UserError(t.mod.invalidUserId);

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    // force: the ban cache never learns about unbans (no GuildModeration intent).
    const ban = await interaction.guild.bans
      .fetch({ user: id, force: true })
      .catch((err: unknown) => {
        if (err instanceof DiscordAPIError && err.code === RESTJSONErrorCodes.UnknownBan)
          return null;
        throw err;
      });
    if (!ban) throw new UserError(t.mod.notBanned);

    await moderate(interaction, {
      action: 'UNBAN',
      target: ban.user,
      reason: interaction.options.getString('reason'),
      run: (auditReason) => interaction.guild.bans.remove(id, auditReason),
    });
  },
});
