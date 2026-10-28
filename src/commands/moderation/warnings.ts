import {
  InteractionContextType,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
  time,
  TimestampStyles,
} from 'discord.js';
import { prisma } from '../../database/client.js';
import { defineCommand } from '../../handlers.js';
import { userOption } from '../../services/moderation.js';
import { t } from '../../text.js';
import { clip, embeds } from '../../utils/embeds.js';

const SHOWN = 10;

export default defineCommand({
  data: new SlashCommandBuilder()
    .setName('warnings')
    .setDescription(t.commands.warnings)
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .setContexts(InteractionContextType.Guild)
    .addUserOption(userOption),

  async execute(interaction) {
    const user = interaction.options.getUser('user', true);
    const warnings = await prisma.modCase.findMany({
      where: { guildId: interaction.guildId, targetId: user.id, action: 'WARN', clearedAt: null },
      orderBy: { number: 'desc' },
    });

    if (!warnings.length) {
      await interaction.reply({
        embeds: [embeds.success(undefined, t.mod.noWarnings(user.toString()))],
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    // Reasons are clipped so ten of them stay inside the 4096-character embed limit.
    const lines = warnings
      .slice(0, SHOWN)
      .map((warning) =>
        t.mod.warningLine(
          warning.number,
          time(warning.createdAt, TimestampStyles.ShortDate),
          `<@${warning.moderatorId}>`,
          clip(warning.reason ?? t.mod.noReason, 200),
        ),
      );
    if (warnings.length > SHOWN) lines.push(t.mod.moreWarnings(warnings.length - SHOWN));

    await interaction.reply({
      embeds: [
        embeds
          .info(t.mod.warningsTitle(user.username, warnings.length), lines.join('\n\n'))
          .setThumbnail(user.displayAvatarURL()),
      ],
      flags: MessageFlags.Ephemeral,
    });
  },
});
