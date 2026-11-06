import {
  ChannelType,
  InteractionContextType,
  MessageFlags,
  SlashCommandBuilder,
  time,
} from 'discord.js';
import { prisma } from '../../database/client.js';
import { defineCommand } from '../../handlers.js';
import {
  cancelGiveaway,
  endGiveaway,
  getManagedGiveaway,
  giveawayChoices,
  requireHost,
  rerollGiveaway,
  startGiveaway,
} from '../../services/giveaways.js';
import { getConfig } from '../../services/guildConfig.js';
import { t } from '../../text.js';
import { parseDuration } from '../../utils/duration.js';
import { clip, embeds } from '../../utils/embeds.js';
import { UserError } from '../../utils/errors.js';

export default defineCommand({
  // No default member permissions: host roles from /setup are checked in code.
  data: new SlashCommandBuilder()
    .setName('giveaway')
    .setDescription(t.commands.giveaway)
    .setContexts(InteractionContextType.Guild)
    .addSubcommand((sub) =>
      sub
        .setName('start')
        .setDescription(t.commands.giveawayStart)
        .addStringOption((o) =>
          o
            .setName('prize')
            .setDescription(t.options.giveawayPrize)
            .setRequired(true)
            .setMaxLength(200),
        )
        .addStringOption((o) =>
          o.setName('duration').setDescription(t.options.giveawayDuration).setRequired(true),
        )
        .addIntegerOption((o) =>
          o
            .setName('winners')
            .setDescription(t.options.giveawayWinners)
            .setMinValue(1)
            .setMaxValue(20),
        )
        .addChannelOption((o) =>
          o
            .setName('channel')
            .setDescription(t.options.giveawayChannel)
            .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName('end')
        .setDescription(t.commands.giveawayEnd)
        .addIntegerOption((o) =>
          o
            .setName('giveaway')
            .setDescription(t.options.giveawayPick)
            .setRequired(true)
            .setAutocomplete(true),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName('cancel')
        .setDescription(t.commands.giveawayCancel)
        .addIntegerOption((o) =>
          o
            .setName('giveaway')
            .setDescription(t.options.giveawayPick)
            .setRequired(true)
            .setAutocomplete(true),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName('reroll')
        .setDescription(t.commands.giveawayReroll)
        .addIntegerOption((o) =>
          o
            .setName('giveaway')
            .setDescription(t.options.giveawayPick)
            .setRequired(true)
            .setAutocomplete(true),
        )
        .addIntegerOption((o) =>
          o
            .setName('count')
            .setDescription(t.options.giveawayRerollCount)
            .setMinValue(1)
            .setMaxValue(20),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName('block')
        .setDescription(t.commands.giveawayBlock)
        .addUserOption((o) =>
          o.setName('user').setDescription(t.options.giveawayBlockUser).setRequired(true),
        )
        .addStringOption((o) =>
          o.setName('reason').setDescription(t.options.giveawayBlockReason).setMaxLength(200),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName('unblock')
        .setDescription(t.commands.giveawayUnblock)
        .addUserOption((o) =>
          o.setName('user').setDescription(t.options.giveawayBlockUser).setRequired(true),
        ),
    )
    .addSubcommand((sub) => sub.setName('blocklist').setDescription(t.commands.giveawayBlocklist)),

  async autocomplete(interaction) {
    const state = interaction.options.getSubcommand() === 'reroll' ? 'ended' : 'running';
    await interaction.respond(
      await giveawayChoices(interaction.member, interaction.options.getFocused(), state),
    );
  },

  async execute(interaction) {
    switch (interaction.options.getSubcommand()) {
      case 'start': {
        const durationMs = parseDuration(interaction.options.getString('duration', true));
        if (durationMs === null) throw new UserError(t.giveaways.badDuration);
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        const giveaway = await startGiveaway(interaction.member, {
          prize: interaction.options.getString('prize', true),
          durationMs,
          winners: interaction.options.getInteger('winners') ?? 1,
          channel: interaction.options.getChannel('channel'),
        });
        await interaction.editReply(t.giveaways.started(giveaway.url));
        return;
      }
      case 'end': {
        const giveaway = await getManagedGiveaway(
          interaction.member,
          interaction.options.getInteger('giveaway', true),
        );
        if (giveaway.endedAt) throw new UserError(t.giveaways.alreadyEnded);
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        const result = await endGiveaway(interaction.client, giveaway.id);
        await interaction.editReply(
          {
            ended: t.giveaways.endedNow,
            cancelled: t.giveaways.cancelledNow,
            already: t.giveaways.alreadyEnded,
          }[result],
        );
        return;
      }
      case 'cancel': {
        const giveaway = await getManagedGiveaway(
          interaction.member,
          interaction.options.getInteger('giveaway', true),
        );
        if (giveaway.endedAt) throw new UserError(t.giveaways.alreadyEnded);
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        const done = await cancelGiveaway(interaction.client, { id: giveaway.id });
        await interaction.editReply(done ? t.giveaways.cancelledNow : t.giveaways.alreadyEnded);
        return;
      }
      case 'reroll': {
        const giveaway = await getManagedGiveaway(
          interaction.member,
          interaction.options.getInteger('giveaway', true),
        );
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        const winners = await rerollGiveaway(
          interaction.client,
          giveaway.id,
          interaction.options.getInteger('count') ?? 1,
        );
        await interaction.editReply({
          content: winners.length ? t.giveaways.rerolled(winners) : t.giveaways.noEligibleLeft,
          allowedMentions: { parse: [] },
        });
        return;
      }
      case 'block': {
        const { member, guildId } = interaction;
        requireHost(member, await getConfig(guildId));
        const user = interaction.options.getUser('user', true);
        const reason = interaction.options.getString('reason');
        await prisma.giveawayBlock.upsert({
          where: { guildId_userId: { guildId, userId: user.id } },
          create: { guildId, userId: user.id, addedById: member.id, reason },
          update: { addedById: member.id, reason },
        });
        await interaction.reply({
          content: t.giveaways.blocked(user.toString()),
          flags: MessageFlags.Ephemeral,
          allowedMentions: { parse: [] },
        });
        return;
      }
      case 'unblock': {
        const { guildId } = interaction;
        requireHost(interaction.member, await getConfig(guildId));
        const user = interaction.options.getUser('user', true);
        const { count } = await prisma.giveawayBlock.deleteMany({
          where: { guildId, userId: user.id },
        });
        if (count === 0) throw new UserError(t.giveaways.notBlocked);
        await interaction.reply({
          content: t.giveaways.unblocked(user.toString()),
          flags: MessageFlags.Ephemeral,
          allowedMentions: { parse: [] },
        });
        return;
      }
      case 'blocklist': {
        const { guildId } = interaction;
        requireHost(interaction.member, await getConfig(guildId));
        const blocks = await prisma.giveawayBlock.findMany({
          where: { guildId },
          orderBy: { createdAt: 'asc' },
        });
        const lines = blocks.map((b) =>
          t.giveaways.blocklistLine(b.userId, b.addedById, b.reason, time(b.createdAt, 'd')),
        );
        await interaction.reply({
          embeds: [
            embeds.info(
              t.giveaways.blocklistTitle,
              lines.length ? clip(lines.join('\n'), 4096) : t.giveaways.blocklistEmpty,
            ),
          ],
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
    }
  },
});
