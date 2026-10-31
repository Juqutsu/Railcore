import { setTimeout as sleep } from 'node:timers/promises';
import type { Client, Guild, GuildMember } from 'discord.js';
import { prisma } from '../database/client.js';
import { env } from '../env.js';
import { logger } from '../utils/logger.js';
import { getConfig, updateConfig } from './guildConfig.js';
import { isServedGuild } from './guildLock.js';
import { isKeyRejected, linkAndXp, xpOf } from './roblox.js';
import { applyXp, tiersOf } from './xpRoles.js';

const REFRESH_EVERY_MS = 10 * 60_000;
const FULL_PASS_EVERY_MS = 24 * 3_600_000;
/** Guilds with a pass in progress; one at a time per guild. */
const running = new Set<string>();

export const isSyncRunning = (guildId: string) => running.has(guildId);
/** A full pass needs both keys: Bloxlink finds the account, Open Cloud has the XP. */
export const canSyncEveryone = () => Boolean(env.ROBLOX_API_KEY && env.BLOXLINK_API_KEY);

/**
 * Every 10 minutes: re-reads the XP of members the bot already knows (Open Cloud only).
 * Once a day: asks Bloxlink about every member, which finds new links and unlinks.
 */
export function startXpRoleSync(client: Client<true>): void {
  const run = () =>
    void syncAll(client).catch((err: unknown) => logger.error({ err }, 'XP role sync failed'));
  setTimeout(run, 90_000).unref();
  setInterval(run, REFRESH_EVERY_MS).unref();
}

async function syncAll(client: Client<true>): Promise<void> {
  for (const guild of client.guilds.cache.values()) {
    // The other copy (test or production) syncs its own server.
    if (!isServedGuild(guild.id) || !(await tiersOf(guild.id)).length) continue;
    const { xpRolesSyncedAt } = await getConfig(guild.id);
    const fullPassDue =
      !xpRolesSyncedAt || Date.now() - xpRolesSyncedAt.getTime() > FULL_PASS_EVERY_MS;
    if (fullPassDue && env.BLOXLINK_API_KEY) await syncEveryone(guild);
    else await refreshKnown(guild);
  }
}

/** Runs `pass` unless the guild has no tiers or a pass is already going; stops on a rejected key. */
async function exclusive(guild: Guild, pass: () => Promise<void>): Promise<void> {
  if (!env.ROBLOX_API_KEY || running.has(guild.id)) return;
  running.add(guild.id);
  try {
    if ((await tiersOf(guild.id)).length) await pass();
  } catch (err) {
    // Every further lookup would fail the same way, so one log line instead of hundreds.
    if (!isKeyRejected(err)) throw err;
    logger.error({ err, guildId: guild.id }, 'XP role sync stopped: API key rejected');
  } finally {
    running.delete(guild.id);
  }
}

type Lookup = () => ReturnType<typeof linkAndXp>;

/**
 * Applies one member's result; failures other than a rejected key are logged and skipped. Tiers
 * are read per member, so an admin's change applies at once even during an hour-long pass.
 */
async function syncOne(member: GuildMember, lookup: Lookup, knownLinkOnly = false) {
  try {
    const tiers = await tiersOf(member.guild.id);
    if (tiers.length) await applyXp(member, await lookup(), tiers, knownLinkOnly);
  } catch (err) {
    if (isKeyRejected(err)) throw err;
    logger.warn({ err, userId: member.id }, 'XP role sync failed for member');
  }
}

/** Re-reads XP for linked members the bot knows. No Bloxlink calls. */
export function refreshKnown(guild: Guild): Promise<void> {
  return exclusive(guild, async () => {
    const rows = await prisma.linkedMember.findMany({
      where: { guildId: guild.id },
      select: { userId: true },
    });
    for (const { userId } of rows) {
      // Left members are forgotten by guildMemberRemove; a missing one here is a cache gap.
      const member = guild.members.cache.get(userId);
      // Read fresh: /stats may have unlinked or relinked them since the pass started.
      const row = await prisma.linkedMember.findUnique({
        where: { guildId_userId: { guildId: guild.id, userId } },
      });
      if (!member || !row) continue;
      // knownLinkOnly: the XP lookup takes a moment, and a relink in between must win.
      await syncOne(
        member,
        async () => ({ robloxId: row.robloxId, xp: await xpOf(row.robloxId) }),
        true,
      );
      await sleep(250);
    }
  });
}

/** Asks Bloxlink about every member, so new links and unlinks are picked up. Slow on purpose. */
export function syncEveryone(guild: Guild): Promise<void> {
  return exclusive(guild, async () => {
    if (!env.BLOXLINK_API_KEY) return;
    // Stamped first, so a crash halfway doesn't restart the whole pass on every boot.
    await updateConfig(guild.id, { xpRolesSyncedAt: new Date() });
    for (const member of guild.members.cache.values()) {
      if (member.user.bot) continue;
      await syncOne(member, () => linkAndXp(guild.id, member.id));
      // ponytail: one Bloxlink call per second, so 3,000 members take ~50 minutes; fine daily.
      await sleep(1000);
    }
  });
}

/** For a member who just joined: picks up an existing Bloxlink link right away. */
export async function syncNewMember(member: GuildMember): Promise<void> {
  if (member.user.bot || !env.ROBLOX_API_KEY || !env.BLOXLINK_API_KEY) return;
  if (!(await tiersOf(member.guild.id)).length) return;
  await syncOne(member, () => linkAndXp(member.guild.id, member.id)).catch((err: unknown) =>
    logger.error({ err, userId: member.id }, 'XP role sync on join failed'),
  );
}
