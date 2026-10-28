import {
  InteractionContextType,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from 'discord.js';
import { prisma } from '../../database/client.js';
import { defineCommand } from '../../handlers.js';
import { sendLog } from '../../services/logs.js';
import { assertCanModerate, userOption } from '../../services/moderation.js';
import { t } from '../../text.js';
import { embeds, userLine } from '../../utils/embeds.js';
import { UserError } from '../../utils/errors.js';

export default defineCommand({
  data: new SlashCommandBuilder()
    .setName('clearwarn')
    .setDescription(t.commands.clearwarn)
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .setContexts(InteractionContextType.Guild)
    .addUserOption(userOption)
    .addIntegerOption((option) =>
      option
        .setName('case')
        .setDescription(t.options.case)
        .setMinValue(1)
        .setMaxValue(2_147_483_647),
    ),

  async execute(interaction) {
    const user = interaction.options.getUser('user', true);
    // Same rules as warning: nobody clears their own record or that of higher staff.
    const member = interaction.options.getMember('user');
    if (member) assertCanModerate(interaction.member, member);
    const number = interaction.options.getInteger('case');

    // Warnings are only marked as cleared, so the case history stays intact.
    const { count } = await prisma.modCase.updateMany({
      where: {
        guildId: interaction.guildId,
        targetId: user.id,
        action: 'WARN',
        clearedAt: null,
        ...(number !== null ? { number } : {}),
      },
      data: { clearedAt: new Date(), clearedById: interaction.user.id },
    });
    if (!count) {
      throw new UserError(
        number !== null ? t.mod.caseNotFound(number) : t.mod.noWarnings(user.toString()),
      );
    }

    const summary =
      number !== null
        ? t.mod.clearedOne(number, user.toString())
        : t.mod.clearedAll(count, user.toString());
    await interaction.reply({
      embeds: [embeds.success(undefined, summary)],
      flags: MessageFlags.Ephemeral,
    });
    await sendLog(interaction.guild, 'modLogChannelId', {
      embeds: [
        embeds
          .success(t.mod.logClearedTitle, summary)
          .addFields(
            { name: t.mod.fields.user, value: userLine(user.id), inline: true },
            { name: t.mod.fields.moderator, value: userLine(interaction.user.id), inline: true },
          ),
      ],
    });
  },
});
