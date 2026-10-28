import {
  LabelBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  type GuildMember,
} from 'discord.js';
import { prisma } from '../database/client.js';
import type { Ticket } from '../generated/prisma/client.js';
import { t } from '../text.js';
import { embeds, userLine } from '../utils/embeds.js';
import { UserError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';
import { roleAssignProblem } from '../utils/permissions.js';
import { sendDm } from './dm.js';
import { getConfig } from './guildConfig.js';
import { sendLog } from './logs.js';
import { getOpenTicket, pad, requireStaff } from './tickets.js';

export type Decision = 'accept' | 'deny';

export const isDecision = (value: string | undefined): value is Decision =>
  value === 'accept' || value === 'deny';

/** Loads an application that is still waiting for a decision; throws a UserError otherwise. */
export async function getPendingApplication(reviewer: GuildMember, ticketId: string) {
  const ticket = await getOpenTicket(ticketId, reviewer.guild.id);
  const config = await getConfig(reviewer.guild.id);
  requireStaff(reviewer, config);
  if (ticket.openerId === reviewer.id) throw new UserError(t.applications.ownApplication);
  if (ticket.appStatus !== 'PENDING') throw new UserError(t.applications.alreadyReviewed);
  return { ticket, config };
}

export function reviewModal(ticketId: number, decision: Decision): ModalBuilder {
  return new ModalBuilder()
    .setCustomId(`app:review:${ticketId}:${decision}`)
    .setTitle(decision === 'accept' ? t.applications.acceptTitle : t.applications.denyTitle)
    .addLabelComponents(
      new LabelBuilder()
        .setLabel(t.applications.reasonLabel)
        .setDescription(t.applications.reasonHint)
        .setTextInputComponent(
          new TextInputBuilder()
            .setCustomId('reason')
            .setStyle(TextInputStyle.Paragraph)
            .setMaxLength(1000)
            .setRequired(false),
        ),
    );
}

/**
 * Records the decision, gives the application role on accept and DMs the applicant.
 * The reason only goes to the ticket log, never to the applicant.
 */
export async function reviewApplication(
  reviewer: GuildMember,
  ticketId: string,
  decision: Decision,
  reason: string | null,
): Promise<{ ticket: Ticket; dmSent: boolean; roleFailed: boolean }> {
  const { guild } = reviewer;
  const { ticket, config } = await getPendingApplication(reviewer, ticketId);
  const accepted = decision === 'accept';
  const role =
    accepted && config.applicationRoleId
      ? guild.roles.cache.get(config.applicationRoleId)
      : undefined;
  const problem = role ? roleAssignProblem(role) : null;
  if (problem) throw new UserError(problem);

  const appStatus = accepted ? 'ACCEPTED' : 'DENIED';
  const { count } = await prisma.ticket.updateMany({
    where: { id: ticket.id, appStatus: 'PENDING' },
    data: { appStatus, reviewedById: reviewer.id, reviewReason: reason, reviewedAt: new Date() },
  });
  if (!count) throw new UserError(t.applications.alreadyReviewed);

  // The decision is already saved, so a failed role grant is reported instead of aborting the rest.
  let roleFailed = false;
  if (role) {
    const applicant = await guild.members.fetch(ticket.openerId).catch(() => null);
    roleFailed = !(await applicant?.roles.add(role, t.applications.auditAccepted).then(
      () => true,
      (err: unknown) => {
        logger.warn(
          { err, guildId: guild.id, ticketId: ticket.id },
          'Could not give application role',
        );
        return false;
      },
    ));
  }

  const dmSent = await sendDm(guild.client, ticket.openerId, {
    embeds: [
      accepted
        ? embeds.success(t.applications.dmAcceptedTitle, t.applications.dmAccepted(guild.name))
        : embeds.info(t.applications.dmDeniedTitle, t.applications.dmDenied(guild.name)),
    ],
  });

  await sendLog(guild, 'ticketLogChannelId', {
    embeds: [
      (accepted ? embeds.success : embeds.error)(
        t.applications.logTitle(pad(ticket.number), accepted),
      ).addFields(
        { name: t.applications.applicant, value: userLine(ticket.openerId), inline: true },
        { name: t.applications.reviewedBy, value: userLine(reviewer.id), inline: true },
        { name: t.applications.ticket, value: `<#${ticket.channelId}>`, inline: true },
        { name: t.tickets.reason, value: reason ?? t.tickets.noReason },
      ),
    ],
  });

  return {
    ticket: await prisma.ticket.findUniqueOrThrow({ where: { id: ticket.id } }),
    dmSent: dmSent !== null,
    roleFailed,
  };
}
