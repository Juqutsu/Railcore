import {
  escapeMarkdown,
  type Attachment,
  type GuildMember,
  type ModalSubmitFields,
  type TextChannel,
} from 'discord.js';
import { prisma } from '../database/client.js';
import { t } from '../text.js';
import { embeds } from '../utils/embeds.js';
import { logger } from '../utils/logger.js';
import { findRobloxUser, linkedAccount, type RobloxAccount } from './roblox.js';
import { openTicket, type Answer } from './tickets.js';

// ponytail: the upload limit of servers without boosts; read guild.premiumTier if boosted servers
// should keep bigger videos as files too.
const UPLOAD_LIMIT = 10 * 1024 * 1024;

const accountLine = (account: RobloxAccount) =>
  `[${escapeMarkdown(account.displayName)} (@${escapeMarkdown(account.name)})](${account.url}) · \`${account.robloxId}\``;

/** Opens a player report ticket from its form, then posts the evidence into it. */
export async function openPlayerReport(
  member: GuildMember,
  fields: ModalSubmitFields,
): Promise<TextChannel> {
  const questions = t.tickets.questions.PLAYER_REPORT;
  const typed = fields.getTextInputValue('roblox').trim();
  // Neither lookup can fail the report: a missing account is flagged in the ticket instead.
  const [player, reporter] = await Promise.all([
    findRobloxUser(typed),
    linkedAccount(member.guild.id, member.id),
  ]);
  const earlier = player
    ? await prisma.ticket.count({
        where: {
          guildId: member.guild.id,
          type: 'PLAYER_REPORT',
          reportedRobloxId: player.robloxId,
        },
      })
    : 0;
  const reason = fields.getStringSelectValues('reason')[0] ?? '';
  const reasons: Record<string, { label: string }> = questions.reason.options;

  const answers: Answer[] = [
    {
      label: t.tickets.reportedPlayer,
      value: player
        ? `${accountLine(player)}\n${t.tickets.reportedBefore(earlier)}`
        : t.tickets.robloxNotFound(escapeMarkdown(typed)),
    },
    { label: questions.reason.label, value: reasons[reason]?.label ?? reason },
    { label: questions.what.label, value: fields.getTextInputValue('what').trim() },
    { label: questions.link.label, value: fields.getTextInputValue('link').trim() },
  ];
  if (reporter) answers.push({ label: t.tickets.reporterRoblox, value: accountLine(reporter) });

  const channel = await openTicket(member, 'PLAYER_REPORT', answers, {
    thumbnail: player?.headshot ?? undefined,
    reportedRobloxId: player?.robloxId,
  });
  const files = [...(fields.getUploadedFiles('evidence')?.values() ?? [])];
  // The ticket is open either way, so a failed upload must not turn into an error reply.
  await postEvidence(channel, files, member.id).catch((err: unknown) =>
    logger.warn({ err, channelId: channel.id }, 'Could not post report evidence'),
  );
  return channel;
}

/**
 * Uploads the form's files into the ticket, because links to them expire after about a day. Files
 * over the upload limit, or ones that fail to upload, are posted as links instead.
 */
async function postEvidence(channel: TextChannel, files: Attachment[], reporterId: string) {
  if (!files.length) return;
  const asLinks = (list: Attachment[]) =>
    t.tickets.evidenceLinks(
      list.map((file) => `[${escapeMarkdown(file.name)}](${file.url})`).join('\n'),
    );
  const attach = (file: Attachment) => ({ attachment: file.url, name: file.name });
  const uploads = files.filter((file) => file.size <= UPLOAD_LIMIT);
  const tooBig = files.filter((file) => file.size > UPLOAD_LIMIT);

  let text = t.tickets.evidenceFrom(`<@${reporterId}>`);
  if (tooBig.length) text += `\n\n${asLinks(tooBig)}`;
  await channel.send({ embeds: [embeds.info(t.tickets.evidenceTitle, text)] });
  if (!uploads.length) return;
  try {
    await channel.send({ files: uploads.map(attach) });
  } catch (err) {
    // Most likely too much for one message: try each file on its own.
    logger.warn({ err, channelId: channel.id }, 'Evidence upload failed, retrying file by file');
    for (const file of uploads) {
      await channel
        .send({ files: [attach(file)] })
        .catch(() => channel.send({ embeds: [embeds.info(undefined, asLinks([file]))] }))
        .catch(() => undefined);
    }
  }
}
