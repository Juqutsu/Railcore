import { setTimeout as sleep } from 'node:timers/promises';
import {
  ActionRowBuilder,
  AttachmentBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  LabelBuilder,
  ModalBuilder,
  OverwriteType,
  PermissionFlagsBits,
  TextInputBuilder,
  TextInputStyle,
  time,
  TimestampStyles,
  type BaseMessageOptions,
  type CategoryChannel,
  type Guild,
  type GuildMember,
  type Message,
  type MessageCreateOptions,
  type TextChannel,
  type User,
} from 'discord.js';
import { prisma } from '../database/client.js';
import {
  Prisma,
  type GuildConfig,
  type Ticket,
  type TicketType,
} from '../generated/prisma/client.js';
import { t } from '../text.js';
import { createCooldown } from '../utils/cooldown.js';
import { clip, embeds, userLine } from '../utils/embeds.js';
import { UserError } from '../utils/errors.js';
import { sendDm } from './dm.js';
import { getConfig } from './guildConfig.js';
import { sendLog } from './logs.js';
import { fetchAllMessages, renderTranscript, toTranscriptMessage } from './transcript.js';

export type Answer = { label: string; value: string };
type Question = { id: string; long?: boolean; optional?: boolean; max: number };
type QuestionIds = { [K in TicketType]: keyof (typeof t.tickets.questions)[K] };

const QUESTIONS: { [K in TicketType]: (Question & { id: QuestionIds[K] })[] } = {
  SUPPORT: [
    { id: 'subject', max: 100 },
    { id: 'details', long: true, max: 1000 },
  ],
  BUG_REPORT: [
    { id: 'roblox', max: 50 },
    { id: 'what', long: true, max: 1000 },
    { id: 'steps', long: true, max: 1000 },
    { id: 'where', max: 100 },
    { id: 'device', max: 50 },
  ],
  APPLICATION: [
    { id: 'roblox', max: 50 },
    { id: 'age', max: 3 },
    { id: 'timezone', max: 50 },
    { id: 'experience', long: true, max: 1000 },
    { id: 'why', long: true, max: 1000 },
  ],
  // Opened from a message's context menu, not the panel.
  REPORT: [{ id: 'details', long: true, optional: true, max: 1000 }],
};

/** The types members can open from the ticket panel. */
const PANEL_TYPES = ['SUPPORT', 'BUG_REPORT', 'APPLICATION'] as const satisfies TicketType[];
type PanelType = (typeof PANEL_TYPES)[number];

const BUTTON_STYLES: Record<PanelType, ButtonStyle> = {
  SUPPORT: ButtonStyle.Primary,
  BUG_REPORT: ButtonStyle.Secondary,
  APPLICATION: ButtonStyle.Success,
};

/** What opener and staff may do in a ticket channel. */
const ACCESS = [
  PermissionFlagsBits.ViewChannel,
  PermissionFlagsBits.SendMessages,
  PermissionFlagsBits.ReadMessageHistory,
  PermissionFlagsBits.AttachFiles,
  PermissionFlagsBits.EmbedLinks,
];

export const pad = (n: number) => String(n).padStart(4, '0');
const openKey = (guildId: string, userId: string, type: TicketType) =>
  `${guildId}:${userId}:${type}`;
const questionsOf = (type: TicketType): Question[] => QUESTIONS[type];
const questionText = (type: TicketType, id: string) =>
  (t.tickets.questions[type] as Record<string, { label: string; placeholder: string }>)[id]!;

export const isPanelType = (value: string | undefined): value is PanelType =>
  (PANEL_TYPES as readonly string[]).includes(value ?? '');

export function ticketPanel(): BaseMessageOptions {
  const buttons = PANEL_TYPES.map((type) =>
    new ButtonBuilder()
      .setCustomId(`ticket:open:${type}`)
      .setLabel(t.tickets.types[type].label)
      .setEmoji(t.tickets.types[type].emoji)
      .setStyle(BUTTON_STYLES[type]),
  );
  return {
    embeds: [embeds.info(t.tickets.panelTitle, t.tickets.panelBody)],
    components: [new ActionRowBuilder<ButtonBuilder>().addComponents(buttons)],
  };
}

export function ticketModal(type: TicketType, customId = `ticket:create:${type}`): ModalBuilder {
  return new ModalBuilder()
    .setCustomId(customId)
    .setTitle(t.tickets.types[type].title)
    .addLabelComponents(
      questionsOf(type).map((question) => {
        const text = questionText(type, question.id);
        return new LabelBuilder().setLabel(text.label).setTextInputComponent(
          new TextInputBuilder()
            .setCustomId(question.id)
            .setStyle(question.long ? TextInputStyle.Paragraph : TextInputStyle.Short)
            .setPlaceholder(text.placeholder)
            .setMaxLength(question.max)
            .setRequired(!question.optional),
        );
      }),
    );
}

type ReportEvidence = { authorId: string; answers: Answer[] };

/** Copies a reported message into ticket answers, so later edits or deletes can't change the evidence. */
export function reportEvidence(message: Message): ReportEvidence {
  const answers: Answer[] = [
    { label: t.tickets.reportAuthor, value: userLine(message.author.id) },
    { label: t.tickets.reportMessage, value: clip(message.content, 1024) || t.serverLog.noText },
    { label: t.tickets.reportLink, value: `[${t.tickets.reportJump}](${message.url})` },
  ];
  if (message.attachments.size) {
    const files = [...message.attachments.values()].map((file) => `[${file.name}](${file.url})`);
    answers.push({ label: t.tickets.reportAttachments, value: clip(files.join('\n'), 1024) });
  }
  return { authorId: message.author.id, answers };
}

// ponytail: snapshots live in memory for 15 minutes (Discord's modal lifetime); a bot restart while
// a report form is open means the member has to report again.
const reportSnapshots = new Map<string, { reporterId: string; evidence: ReportEvidence }>();

/** Taken at right-click, because the author may edit or delete the message while the reporter types. */
export function saveReportSnapshot(
  key: string,
  reporterId: string,
  evidence: ReportEvidence,
): void {
  reportSnapshots.set(key, { reporterId, evidence });
  setTimeout(() => reportSnapshots.delete(key), 15 * 60_000).unref();
}

/**
 * The key comes from the modal's custom ID, so it's untrusted: a snapshot only counts for the member
 * who took it. There is deliberately no fallback that fetches a message by ID, because that would
 * let a forged custom ID copy messages the reporter can't read.
 */
export function takeReportSnapshot(key: string, reporterId: string): ReportEvidence {
  const snapshot = reportSnapshots.get(key);
  if (snapshot?.reporterId !== reporterId) throw new UserError(t.tickets.reportExpired);
  reportSnapshots.delete(key);
  return snapshot.evidence;
}

export function readAnswers(type: TicketType, value: (id: string) => string): Answer[] {
  return questionsOf(type).map((question) => ({
    label: questionText(type, question.id).label,
    value: value(question.id).trim(),
  }));
}

/** The ticket category and staff roles, or null if tickets aren't fully set up. */
export function ticketSetup(guild: Guild, config: GuildConfig) {
  const category = config.ticketCategoryId
    ? guild.channels.cache.get(config.ticketCategoryId)
    : undefined;
  const staffRoleIds = config.staffRoleIds.filter((id) => guild.roles.cache.has(id));
  // The log channel is required: closing deletes the channel, so the transcript needs a home.
  const log = config.ticketLogChannelId
    ? guild.channels.cache.get(config.ticketLogChannelId)
    : undefined;
  if (category?.type !== ChannelType.GuildCategory || !log?.isSendable() || !staffRoleIds.length) {
    return null;
  }
  return { category, staffRoleIds };
}

export function isStaff(member: GuildMember, config: GuildConfig): boolean {
  return (
    member.permissions.has(PermissionFlagsBits.Administrator) ||
    config.staffRoleIds.some((id) => member.roles.cache.has(id))
  );
}

export function requireStaff(member: GuildMember, config: GuildConfig): void {
  if (!isStaff(member, config)) throw new UserError(t.tickets.staffOnly);
}

export async function requireCanClose(member: GuildMember, ticket: Ticket): Promise<void> {
  if (ticket.openerId === member.id) return;
  if (!isStaff(member, await getConfig(member.guild.id))) {
    throw new UserError(t.tickets.closeNotAllowed);
  }
}

/** Looks up a ticket from a custom-ID argument; throws a UserError unless it's open in this guild. */
export async function getOpenTicket(id: string | number, guildId: string): Promise<Ticket> {
  const ticketId = Number(id);
  const ticket = Number.isInteger(ticketId)
    ? await prisma.ticket.findUnique({ where: { id: ticketId } })
    : null;
  if (ticket?.guildId !== guildId) throw new UserError(t.errors.unknownInteraction);
  if (ticket.status !== 'OPEN') throw new UserError(t.tickets.alreadyClosed);
  return ticket;
}

async function findOpenTicket(guild: Guild, userId: string, type: TicketType) {
  const existing = await prisma.ticket.findUnique({
    where: { openKey: openKey(guild.id, userId, type) },
  });
  if (!existing) return null;
  const alive = existing.channelId
    ? guild.channels.cache.has(existing.channelId)
    : Date.now() - existing.createdAt.getTime() < 60_000; // still being created
  if (alive) return existing;

  // The channel was deleted by hand, or creation died half-way: retire it so a new one can open.
  await prisma.ticket.update({
    where: { id: existing.id },
    data: {
      status: 'CLOSED',
      openKey: null,
      closedAt: new Date(),
      closeReason: t.tickets.staleReason,
    },
  });
  return null;
}

// Every new ticket pings staff, so stop open-close-open loops.
const opened = createCooldown(60_000);
const cooldownError = (wait: number) =>
  new UserError(
    t.tickets.cooldown(time(new Date(Date.now() + wait), TimestampStyles.RelativeTime)),
  );

/** Throws a UserError if this member can't open a ticket of this type right now. */
export async function assertCanOpen(member: GuildMember, type: TicketType) {
  const setup = ticketSetup(member.guild, await getConfig(member.guild.id));
  if (!setup) throw new UserError(t.tickets.notConfigured);
  const wait = opened.peek(`${member.guild.id}:${member.id}`);
  if (wait) throw cooldownError(wait);
  const existing = await findOpenTicket(member.guild, member.id, type);
  if (existing) {
    const channel = existing.channelId ? `<#${existing.channelId}>` : undefined;
    throw new UserError(t.tickets.alreadyOpen(t.tickets.types[type].label, channel));
  }
  return setup;
}

/** `hideFrom` keeps one member out even if they hold a staff role, e.g. the author of a reported message. */
export async function openTicket(
  member: GuildMember,
  type: TicketType,
  answers: Answer[],
  hideFrom?: string,
): Promise<TextChannel> {
  const { guild } = member;
  const { category, staffRoleIds } = await assertCanOpen(member, type);
  const cooldownKey = `${guild.id}:${member.id}`;
  const wait = opened.take(cooldownKey);
  if (wait) throw cooldownError(wait);
  try {
    return await createTicket(member, type, answers, category, staffRoleIds, hideFrom);
  } catch (err) {
    opened.clear(cooldownKey); // nothing was opened, so nothing pinged staff
    throw err;
  }
}

async function createTicket(
  member: GuildMember,
  type: TicketType,
  answers: Answer[],
  category: CategoryChannel,
  staffRoleIds: string[],
  hideFrom?: string,
): Promise<TextChannel> {
  const { guild } = member;
  const hidden =
    hideFrom &&
    hideFrom !== member.id &&
    hideFrom !== guild.client.user.id &&
    guild.members.cache.has(hideFrom)
      ? [{ id: hideFrom, type: OverwriteType.Member, deny: [PermissionFlagsBits.ViewChannel] }]
      : [];
  const { ticketCounter: number } = await prisma.guildConfig.update({
    where: { guildId: guild.id },
    data: { ticketCounter: { increment: 1 } },
  });

  // The row goes in first: its unique openKey is what stops two tickets of one type opening at once.
  let ticket: Ticket;
  try {
    ticket = await prisma.ticket.create({
      data: {
        guildId: guild.id,
        number,
        type,
        openerId: member.id,
        answers,
        openKey: openKey(guild.id, member.id, type),
        appStatus: type === 'APPLICATION' ? 'PENDING' : null,
      },
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw new UserError(t.tickets.alreadyOpen(t.tickets.types[type].label));
    }
    throw err;
  }

  const { title, channel: prefix } = t.tickets.types[type];
  let channel: TextChannel;
  try {
    channel = await guild.channels.create({
      name: `${prefix}-${pad(number)}`,
      type: ChannelType.GuildText,
      parent: category.id,
      topic: t.tickets.topic(title, pad(number), member.user.username),
      reason: t.tickets.auditOpened(member.user.username),
      permissionOverwrites: [
        {
          id: guild.roles.everyone.id,
          type: OverwriteType.Role,
          deny: [PermissionFlagsBits.ViewChannel],
        },
        { id: member.id, type: OverwriteType.Member, allow: ACCESS },
        ...staffRoleIds.map((id) => ({ id, type: OverwriteType.Role, allow: ACCESS })),
        {
          id: guild.client.user.id,
          type: OverwriteType.Member,
          allow: [...ACCESS, PermissionFlagsBits.ManageChannels],
        },
        ...hidden,
      ],
    });
  } catch (err) {
    await prisma.ticket.delete({ where: { id: ticket.id } });
    throw err;
  }

  ticket = await prisma.ticket.update({
    where: { id: ticket.id },
    data: { channelId: channel.id },
  });
  await channel.send(openingMessage(ticket, member.user, staffRoleIds));
  return channel;
}

function openingMessage(
  ticket: Ticket,
  opener: User,
  staffRoleIds: string[],
): MessageCreateOptions {
  const { title } = t.tickets.types[ticket.type];
  const answers = ticket.answers as Answer[];
  const embed = embeds
    .info(`${title} #${pad(ticket.number)}`, t.tickets.types[ticket.type].intro)
    .setThumbnail(opener.displayAvatarURL())
    .addFields(
      { name: t.tickets.openedBy, value: userLine(opener.id) },
      ...answers.map((answer) => ({ name: answer.label, value: answer.value || '—' })),
    );
  return {
    content: [opener.toString(), ...staffRoleIds.map((id) => `<@&${id}>`)].join(' '),
    embeds: [embed],
    components: ticketControls(ticket),
  };
}

export function ticketControls(ticket: Ticket): ActionRowBuilder<ButtonBuilder>[] {
  const row = new ActionRowBuilder<ButtonBuilder>();
  const reviewing = ticket.appStatus === 'PENDING';
  if (reviewing) {
    row.addComponents(
      new ButtonBuilder()
        .setCustomId(`app:review:${ticket.id}:accept`)
        .setLabel(t.applications.accept)
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`app:review:${ticket.id}:deny`)
        .setLabel(t.applications.deny)
        .setStyle(ButtonStyle.Danger),
    );
  }
  row.addComponents(
    new ButtonBuilder()
      .setCustomId(`ticket:claim:${ticket.id}`)
      .setLabel(ticket.claimedById ? t.tickets.claimed : t.tickets.claim)
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(Boolean(ticket.claimedById)),
    new ButtonBuilder()
      .setCustomId(`ticket:close:${ticket.id}`)
      .setLabel(t.tickets.close)
      .setStyle(reviewing ? ButtonStyle.Secondary : ButtonStyle.Danger),
  );
  return [row];
}

export async function claimTicket(staff: GuildMember, ticketId: string): Promise<Ticket> {
  const ticket = await getOpenTicket(ticketId, staff.guild.id);
  requireStaff(staff, await getConfig(staff.guild.id));
  const { count } = await prisma.ticket.updateMany({
    where: { id: ticket.id, claimedById: null },
    data: { claimedById: staff.id },
  });
  if (!count) {
    const current = await prisma.ticket.findUnique({ where: { id: ticket.id } });
    throw new UserError(
      t.tickets.alreadyClaimed(`<@${current?.claimedById ?? ticket.claimedById}>`),
    );
  }
  // Fresh read, so the rebuilt buttons reflect any review that happened meanwhile.
  return prisma.ticket.findUniqueOrThrow({ where: { id: ticket.id } });
}

export function closeConfirmation(ticketId: number): BaseMessageOptions {
  return {
    embeds: [embeds.info(t.tickets.confirmTitle, t.tickets.confirmBody)],
    components: [
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(`ticket:confirm:${ticketId}`)
          .setLabel(t.tickets.confirmClose)
          .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
          .setCustomId(`ticket:reason:${ticketId}`)
          .setLabel(t.tickets.confirmWithReason)
          .setStyle(ButtonStyle.Secondary),
      ),
    ],
  };
}

export function closeReasonModal(ticketId: number): ModalBuilder {
  return new ModalBuilder()
    .setCustomId(`ticket:close:${ticketId}`)
    .setTitle(t.tickets.reasonModalTitle)
    .addLabelComponents(
      new LabelBuilder()
        .setLabel(t.tickets.reasonLabel)
        .setTextInputComponent(
          new TextInputBuilder()
            .setCustomId('reason')
            .setStyle(TextInputStyle.Paragraph)
            .setPlaceholder(t.tickets.reasonPlaceholder)
            .setMaxLength(500)
            .setRequired(true),
        ),
    );
}

// ponytail: in-memory lock against double closes; fine while one bot process serves the guild.
const closing = new Set<number>();

/** Saves a transcript to the ticket log and the opener's DMs, then deletes the channel. */
export async function closeTicket(
  guild: Guild,
  ticketId: number,
  closer: User,
  reason: string | null,
): Promise<void> {
  if (closing.has(ticketId)) throw new UserError(t.tickets.alreadyClosing);
  closing.add(ticketId);
  try {
    const ticket = await getOpenTicket(ticketId, guild.id);
    const channel = ticket.channelId ? guild.channels.cache.get(ticket.channelId) : undefined;
    if (channel?.type !== ChannelType.GuildText) throw new UserError(t.errors.unknownInteraction);

    const { title } = t.tickets.types[ticket.type];
    const number = pad(ticket.number);
    const messages = await fetchAllMessages(channel);
    const opener = await guild.client.users.fetch(ticket.openerId).catch(() => null);
    const closedAt = new Date();
    const html = renderTranscript(
      {
        title: `${title} #${number}`,
        guildName: guild.name,
        openedBy: opener?.username ?? ticket.openerId,
        openedAt: ticket.createdAt,
        closedAt,
      },
      messages.map(toTranscriptMessage),
    );
    const transcript = () =>
      new AttachmentBuilder(Buffer.from(html, 'utf8'), { name: `${channel.name}.html` });

    // Until the transcript is in the log, this channel is the only copy, so keep it on failure.
    const logged = await sendLog(guild, 'ticketLogChannelId', {
      embeds: [closedLogEmbed(ticket, closer, reason, messages.length)],
      files: [transcript()],
    });
    if (!logged) throw new UserError(t.tickets.transcriptNotSaved);

    await prisma.ticket.update({
      where: { id: ticket.id },
      data: {
        status: 'CLOSED',
        openKey: null,
        closedById: closer.id,
        closeReason: reason,
        closedAt,
      },
    });

    const dm = embeds.info(t.tickets.dmClosedTitle, t.tickets.dmClosed(title, number, guild.name));
    if (reason) dm.addFields({ name: t.tickets.reason, value: reason });
    await sendDm(guild.client, ticket.openerId, { embeds: [dm], files: [transcript()] });

    await channel
      .send({ embeds: [embeds.info(undefined, t.tickets.closingNotice(closer.toString()))] })
      .catch(() => undefined); // cosmetic; the delete below must still happen
    await sleep(5_000);
    await channel.delete(t.tickets.auditClosed);
  } finally {
    closing.delete(ticketId);
  }
}

function closedLogEmbed(ticket: Ticket, closer: User, reason: string | null, messageCount: number) {
  const embed = embeds
    .info(t.tickets.logClosedTitle(t.tickets.types[ticket.type].title, pad(ticket.number)))
    .addFields(
      { name: t.tickets.openedBy, value: userLine(ticket.openerId), inline: true },
      { name: t.tickets.closedBy, value: userLine(closer.id), inline: true },
      {
        name: t.tickets.claimedByField,
        value: ticket.claimedById ? `<@${ticket.claimedById}>` : t.tickets.nobody,
        inline: true,
      },
      { name: t.tickets.reason, value: reason ?? t.tickets.noReason },
      {
        name: t.tickets.openedAt,
        value: time(ticket.createdAt, TimestampStyles.RelativeTime),
        inline: true,
      },
      { name: t.tickets.messages, value: String(messageCount), inline: true },
    );
  if (ticket.appStatus) {
    embed.addFields({
      name: t.applications.status,
      value: t.applications.statuses[ticket.appStatus],
      inline: true,
    });
  }
  return embed;
}
