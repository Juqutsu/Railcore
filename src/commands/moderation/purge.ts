import {
  InteractionContextType,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from 'discord.js';
import { prisma } from '../../database/client.js';
import { defineCommand } from '../../handlers.js';
import { logCase, nextCaseNumber, reasonOption } from '../../services/moderation.js';
import { t } from '../../text.js';
import { embeds } from '../../utils/embeds.js';
import { UserError } from '../../utils/errors.js';

// Discord only bulk-deletes messages younger than 14 days; a minute of margin avoids edge failures.
const MAX_AGE_MS = 14 * 86_400_000 - 60_000;

export default defineCommand({
  data: new SlashCommandBuilder()
    .setName('purge')
    .setDescription(t.commands.purge)
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .setContexts(InteractionContextType.Guild)
    .addIntegerOption((option) =>
      option
        .setName('amount')
        .setDescription(t.options.amount)
        .setMinValue(1)
        .setMaxValue(100)
        .setRequired(true),
    )
    .addUserOption((option) => option.setName('user').setDescription(t.options.purgeUser))
    .addStringOption(reasonOption(false)),

  async execute(interaction) {
    const { channel } = interaction;
    // Checked up front so a missing permission isn't reported as "nothing to delete".
    const needed = [PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.ManageMessages];
    if (!channel || !interaction.appPermissions.has(needed)) {
      throw new UserError(t.errors.botMissingPermissions);
    }
    const amount = interaction.options.getInteger('amount', true);
    const user = interaction.options.getUser('user');
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const recent = await channel.messages.fetch({ limit: 100 });
    const picked = [...recent.values()]
      .filter((message) => !user || message.author.id === user.id)
      .slice(0, amount);
    const cutoff = Date.now() - MAX_AGE_MS;
    // Some system messages (e.g. thread starters) can't be deleted and would fail the whole batch.
    const deletable = picked.filter(
      (message) => !message.pinned && !message.system && message.createdTimestamp > cutoff,
    );
    if (!deletable.length) throw new UserError(t.mod.nothingToPurge);
    const deleted = await channel.bulkDelete(deletable, true);

    const number = await nextCaseNumber(interaction.guildId);
    const modCase = await prisma.modCase.create({
      data: {
        guildId: interaction.guildId,
        number,
        action: 'PURGE',
        targetId: user?.id ?? null,
        moderatorId: interaction.user.id,
        reason: interaction.options.getString('reason'),
        channelId: channel.id,
        messageCount: deleted.size,
      },
    });
    await logCase(interaction.guild, modCase, user ?? undefined);

    const lines = [t.mod.purged(deleted.size, channel.toString())];
    if (deleted.size < picked.length) lines.push(t.mod.purgeSkipped);
    await interaction.editReply({
      embeds: [embeds.success(t.mod.caseTitle(number, t.mod.actions.PURGE), lines.join('\n'))],
    });
  },
});
