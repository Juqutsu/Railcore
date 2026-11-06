import { ChannelType, InteractionContextType, MessageFlags, SlashCommandBuilder } from 'discord.js';
import { defineCommand } from '../../handlers.js';
import { startGiveaway } from '../../services/giveaways.js';
import { t } from '../../text.js';
import { parseDuration } from '../../utils/duration.js';
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
    ),

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
    }
  },
});
