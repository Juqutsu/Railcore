import { InteractionContextType, SlashCommandBuilder } from 'discord.js';
import { defineCommand } from '../../handlers.js';
import { assertGameDataReady, statsReply } from '../../services/roblox.js';
import { t } from '../../text.js';
import { UserError } from '../../utils/errors.js';

export default defineCommand({
  data: new SlashCommandBuilder()
    .setName('stats')
    .setDescription(t.commands.stats)
    .setContexts(InteractionContextType.Guild)
    .addUserOption((option) => option.setName('user').setDescription(t.options.statsUser)),

  async execute(interaction) {
    const user = interaction.options.getUser('user') ?? interaction.user;
    if (user.bot) throw new UserError(t.stats.bot);
    assertGameDataReady(true);
    // Public on purpose, so members can show off and compare.
    await interaction.deferReply();
    await interaction.editReply(
      await statsReply(interaction.guildId, user, user.id === interaction.user.id),
    );
  },
});
