import { InteractionContextType, SlashCommandBuilder } from 'discord.js';
import { defineCommand } from '../../handlers.js';
import { assertGameDataReady, leaderboardReply } from '../../services/roblox.js';
import { t } from '../../text.js';

export default defineCommand({
  data: new SlashCommandBuilder()
    .setName('leaderboard')
    .setDescription(t.commands.leaderboard)
    .setContexts(InteractionContextType.Guild)
    .addStringOption((option) =>
      option
        .setName('by')
        .setDescription(t.options.leaderboardBy)
        .addChoices(
          { name: t.leaderboard.by.xp, value: 'xp' },
          { name: t.leaderboard.by.km, value: 'km' },
        ),
    )
    .addStringOption((option) =>
      option
        .setName('week')
        .setDescription(t.options.leaderboardWeek)
        .addChoices(
          { name: t.leaderboard.week.this, value: 'this' },
          { name: t.leaderboard.week.last, value: 'last' },
        ),
    ),

  async execute(interaction) {
    assertGameDataReady(false);
    const board = interaction.options.getString('by') === 'km' ? 'km' : 'xp';
    const week = interaction.options.getString('week') === 'last' ? 'last' : 'this';
    await interaction.deferReply();
    await interaction.editReply(await leaderboardReply(board, week, 0, interaction.user.id));
  },
});
