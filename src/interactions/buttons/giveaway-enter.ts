import { ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } from 'discord.js';
import { prisma } from '../../database/client.js';
import { defineComponent } from '../../handlers.js';
import { checkEligible, scheduleCountRefresh } from '../../services/giveaways.js';
import { getConfig } from '../../services/guildConfig.js';
import { t } from '../../text.js';

export default defineComponent({
  kind: 'button',
  id: 'giveaway:enter',
  async execute(interaction, [id = '']) {
    const giveawayId = Number(id);
    const giveaway = Number.isInteger(giveawayId)
      ? await prisma.giveaway.findUnique({ where: { id: giveawayId } })
      : null;
    if (!giveaway || giveaway.endedAt) {
      await interaction.reply({ content: t.giveaways.ended, flags: MessageFlags.Ephemeral });
      return;
    }
    if (!interaction.inCachedGuild()) return;
    const reason = await checkEligible(
      interaction.member,
      await getConfig(interaction.guildId),
      new Date(),
    );
    if (reason) {
      await interaction.reply({
        content: t.giveaways.cantEnter(reason),
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    const { count } = await prisma.giveawayEntry.createMany({
      data: [{ giveawayId, userId: interaction.user.id }],
      skipDuplicates: true,
    });
    if (count === 0) {
      await interaction.reply({
        content: t.giveaways.alreadyEntered,
        components: [
          new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder()
              .setCustomId(`giveaway:leave:${giveawayId}`)
              .setStyle(ButtonStyle.Danger)
              .setLabel(t.giveaways.leave),
          ),
        ],
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    await interaction.reply({
      content: t.giveaways.entered(giveaway.prize),
      flags: MessageFlags.Ephemeral,
    });
    scheduleCountRefresh(interaction.client, giveawayId);
  },
});
