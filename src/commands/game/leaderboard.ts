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
    ),

  async execute(interaction) {
    assertGameDataReady(false);
    const board = interaction.options.getString('by') === 'km' ? 'km' : 'xp';
    await interaction.deferReply();
    await interaction.editReply(await leaderboardReply(board, 0, interaction.user.id));
  },
});
