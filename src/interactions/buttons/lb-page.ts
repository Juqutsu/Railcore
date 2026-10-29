import { MessageFlags } from 'discord.js';
import { defineComponent } from '../../handlers.js';
import { leaderboardReply } from '../../services/roblox.js';

export default defineComponent({
  kind: 'button',
  id: 'lb:page',
  async execute(interaction, [ownerId, board, page]) {
    const own = interaction.user.id === ownerId;
    // Only whoever ran /leaderboard flips the public message; anyone else gets a private copy.
    if (own) await interaction.deferUpdate();
    else await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const reply = await leaderboardReply(
      board === 'km' ? 'km' : 'xp',
      Number(page),
      interaction.user.id,
    );
    await interaction.editReply(reply);
  },
});
