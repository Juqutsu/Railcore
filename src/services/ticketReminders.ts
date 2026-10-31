import {
  ChannelType,
  time,
  TimestampStyles,
  type Client,
  type Guild,
  type TextChannel,
} from 'discord.js';
import { prisma } from '../database/client.js';
import type { GuildConfig, Ticket } from '../generated/prisma/client.js';
import { t } from '../text.js';
import { embeds } from '../utils/embeds.js';
import { logger } from '../utils/logger.js';
import { getConfig } from './guildConfig.js';
import { isServedGuild } from './guildLock.js';
import { closeTicket } from './tickets.js';

const CHECK_EVERY_MS = 10 * 60_000;
const HOUR_MS = 3_600_000;

/** Reminds openers who stopped answering staff, then closes their ticket if it stays quiet. */
export function startTicketReminders(client: Client<true>): void {
  const run = () =>
    void checkTickets(client).catch((err: unknown) =>
      logger.error({ err }, 'Ticket reminder check failed'),
    );
  setTimeout(run, 60_000).unref();
  setInterval(run, CHECK_EVERY_MS).unref();
}

async function checkTickets(client: Client<true>): Promise<void> {
  const tickets = await prisma.ticket.findMany({ where: { status: 'OPEN' } });
  for (const ticket of tickets) {
    // A pending application waits on staff, not on the applicant.
    if (ticket.appStatus === 'PENDING' || !ticket.channelId) continue;
    // The other copy (test or production) handles its own server's tickets.
    if (!isServedGuild(ticket.guildId)) continue;
    const guild = client.guilds.cache.get(ticket.guildId);
    const channel = guild?.channels.cache.get(ticket.channelId);
    if (!guild || channel?.type !== ChannelType.GuildText) continue;
    const config = await getConfig(guild.id);
    if (!config.ticketReminderHours) continue;
    try {
      await checkTicket(guild, channel, ticket, config);
    } catch (err) {
      logger.warn({ err, ticketId: ticket.id }, 'Ticket reminder failed');
    }
  }
}

async function checkTicket(
  guild: Guild,
  channel: TextChannel,
  ticket: Ticket,
  config: GuildConfig,
): Promise<void> {
  const last = (await channel.messages.fetch({ limit: 1 })).first();
  if (!last) return;
  const now = Date.now();

  if (ticket.reminderMessageId) {
    if (last.id !== ticket.reminderMessageId) {
      // Someone replied after the reminder, so the ticket is active again.
      await prisma.ticket.update({
        where: { id: ticket.id },
        data: { reminderMessageId: null, remindedAt: null },
      });
      return;
    }
    const closeAfter = config.ticketAutoCloseHours * HOUR_MS;
    if (closeAfter && ticket.remindedAt && now - ticket.remindedAt.getTime() >= closeAfter) {
      try {
        await closeTicket(guild, ticket.id, guild.client.user, t.tickets.autoCloseReason);
      } catch (err) {
        // Wait another full period before retrying instead of hammering every 10 minutes.
        await prisma.ticket.update({
          where: { id: ticket.id },
          data: { remindedAt: new Date(now) },
        });
        throw err;
      }
    }
    return;
  }

  // Only when staff (or an added member) spoke last is the ticket waiting on the opener.
  if (last.author.bot || last.author.id === ticket.openerId) return;
  if (now - last.createdTimestamp < config.ticketReminderHours * HOUR_MS) return;

  const closesAt = config.ticketAutoCloseHours
    ? new Date(now + config.ticketAutoCloseHours * HOUR_MS)
    : null;
  const text = closesAt
    ? t.tickets.reminderWithClose(time(closesAt, TimestampStyles.RelativeTime))
    : t.tickets.reminder;
  const reminder = await channel.send({
    content: `<@${ticket.openerId}>`,
    embeds: [embeds.info(t.tickets.reminderTitle, text)],
  });
  await prisma.ticket.update({
    where: { id: ticket.id },
    data: { reminderMessageId: reminder.id, remindedAt: new Date(now) },
  });
}
