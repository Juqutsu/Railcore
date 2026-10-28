import {
  DiscordAPIError,
  InteractionContextType,
  MessageFlags,
  PermissionFlagsBits,
  RESTJSONErrorCodes,
  SlashCommandBuilder,
} from 'discord.js';
import { defineCommand } from '../../handlers.js';
import {
  assertBotCan,
  assertCanModerate,
  moderate,
  reasonOption,
  userOption,
} from '../../services/moderation.js';
import { t } from '../../text.js';
import { UserError } from '../../utils/errors.js';

export default defineCommand({
  data: new SlashCommandBuilder()
    .setName('ban')
    .setDescription(t.commands.ban)
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
    .setContexts(InteractionContextType.Guild)
    .addUserOption(userOption)
    .addStringOption(reasonOption(false))
    .addIntegerOption((option) =>
      option
        .setName('delete_messages')
        .setDescription(t.options.deleteMessages)
        .addChoices(
          { name: t.mod.deleteChoices.none, value: 0 },
          { name: t.mod.deleteChoices.hour, value: 3_600 },
          { name: t.mod.deleteChoices.day, value: 86_400 },
          { name: t.mod.deleteChoices.week, value: 604_800 },
        ),
    ),

  async execute(interaction) {
    const user = interaction.options.getUser('user', true);
    // Users who already left can still be banned; hierarchy only applies to current members.
    const member = interaction.options.getMember('user');
    if (member) {
      assertCanModerate(interaction.member, member);
      assertBotCan(member.bannable, member);
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    // force: the ban cache never learns about unbans (no GuildModeration intent).
    const banned = await interaction.guild.bans.fetch({ user: user.id, force: true }).then(
      () => true,
      (err: unknown) => {
        if (err instanceof DiscordAPIError && err.code === RESTJSONErrorCodes.UnknownBan)
          return false;
        throw err;
      },
    );
    if (banned) throw new UserError(t.mod.alreadyBanned(user.toString()));

    await moderate(interaction, {
      action: 'BAN',
      target: user,
      reason: interaction.options.getString('reason'),
      notify: Boolean(member),
      run: (auditReason) =>
        interaction.guild.bans.create(user.id, {
          reason: auditReason,
          deleteMessageSeconds: interaction.options.getInteger('delete_messages') ?? 0,
        }),
    });
  },
});
