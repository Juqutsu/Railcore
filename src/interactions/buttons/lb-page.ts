import { MessageFlags } from 'discord.js';
import { defineComponent } from '../../handlers.js';
import { leaderboardReply } from '../../services/roblox.js';

export default defineComponent({
  kind: 'button',
  id: 'lb:page',
  // Buttons from before the weekly boards lack `week`; they fall back to this week, page 1.
  async execute(interaction, [ownerId, board, week, page]) {
    const own = interaction.user.id === ownerId;
    // Only whoever ran /leaderboard flips the public message; anyone else gets a private copy.
    if (own) await interaction.deferUpdate();
    else await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const reply = await leaderboardReply(
      board === 'km' ? 'km' : 'xp',
      week === 'last' ? 'last' : 'this',
      Number(page),
      interaction.user.id,
    );
    await interaction.editReply(reply);
  },
});
