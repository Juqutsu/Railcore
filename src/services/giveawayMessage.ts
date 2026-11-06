import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  time,
  TimestampStyles,
  type EmbedBuilder,
} from 'discord.js';
import type { Giveaway } from '../generated/prisma/client.js';
import { t } from '../text.js';
import { embeds } from '../utils/embeds.js';

// Kept apart from giveaways.ts so tests can render without loading the database client.
export type GiveawayView = Giveaway & { winnerIds: string[] };

type Rendered = { embeds: [EmbedBuilder]; components: [ActionRowBuilder<ButtonBuilder>] };

/** Renders the giveaway post: running, ended or cancelled. */
export function giveawayMessage(g: GiveawayView, entryCount: number): Rendered {
  const cancelled = g.cancelledAt !== null;
  const ended = g.endedAt !== null;
  const host = `**${t.giveaways.hostedBy}:** <@${g.hostId}>`;

  let embed;
  if (!ended) {
    embed = embeds.info(
      `🎉 ${g.prize}`,
      [
        t.giveaways.enterPrompt,
        '',
        `**${t.giveaways.ends}:** ${time(g.endsAt, TimestampStyles.RelativeTime)} (${time(g.endsAt, TimestampStyles.ShortDateTime)})`,
        `**${t.giveaways.winners}:** ${g.winnerCount}`,
        host,
      ].join('\n'),
    );
  } else if (cancelled) {
    embed = embeds.muted(`🎉 ${g.prize} · ${t.giveaways.cancelledSuffix}`, host);
  } else {
    const winners = g.winnerIds.length
      ? `**${t.giveaways.winnersLabel(g.winnerIds.length)}:** ${g.winnerIds.map((id) => `<@${id}>`).join(', ')}`
      : t.giveaways.noValidEntries;
    embed = embeds.muted(
      `🎉 ${g.prize} · ${t.giveaways.endedSuffix}`,
      [winners, `**${t.giveaways.entries}:** ${entryCount}`, host].join('\n'),
    );
  }

  const button = new ButtonBuilder().setCustomId(`giveaway:enter:${g.id}`);
  if (ended) {
    button
      .setStyle(ButtonStyle.Secondary)
      .setLabel(cancelled ? t.giveaways.cancelledLabel : t.giveaways.endedLabel)
      .setDisabled(true);
  } else {
    button.setStyle(ButtonStyle.Primary).setLabel(t.giveaways.enter(entryCount));
  }
  return {
    embeds: [embed],
    components: [new ActionRowBuilder<ButtonBuilder>().addComponents(button)],
  };
}
