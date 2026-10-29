import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  escapeMarkdown,
  type BaseMessageOptions,
  type User,
} from 'discord.js';
import { env } from '../env.js';
import { t } from '../text.js';
import { embeds } from '../utils/embeds.js';
import { UserError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';
import { parseProgress } from '../utils/progress.js';

// Falkenberg Railways itself; the API key is scoped to this universe.
const UNIVERSE_ID = '10123051468';
const PROGRESS_STORE = 'FBR_Progress_v1';
/** The game's OrderedDataStores; same `u_<userId>` keys, whole-number values. */
const BOARDS = { xp: 'FBR_Leaderboard_XP_v1', km: 'FBR_Leaderboard_Km_v1' } as const;
export type Board = keyof typeof BOARDS;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object';

class HttpError extends Error {
  constructor(
    readonly host: string,
    readonly status: number,
    detail: string,
  ) {
    super(`${host} answered HTTP ${status}: ${detail}`);
  }
}

/** Fetches JSON with a timeout. 404 gives null; 429 and 5xx are retried twice, honoring retry-after. */
async function getJson(url: string, init: RequestInit = {}): Promise<unknown> {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(url, { ...init, signal: AbortSignal.timeout(8000) });
    if (res.status === 404) return null;
    if (res.ok) return res.json();
    if ((res.status !== 429 && res.status < 500) || attempt === 2) {
      // The service's own error text, e.g. Bloxlink's "Guild ID does not match API Key".
      const detail = (await res.text().catch(() => '')).slice(0, 200);
      throw new HttpError(new URL(url).hostname, res.status, detail);
    }
    await res.body?.cancel();
    const seconds = Number(res.headers.get('retry-after')) || 1;
    await new Promise((resolve) => setTimeout(resolve, Math.min(seconds, 5) * 1000));
  }
}

/** Turns a failed lookup into the message the member sees, and logs the cause with `context`. */
function lookupError(err: unknown, context: object): UserError {
  // A rejected key is a setup mistake that retrying won't fix, so it gets its own message.
  if (err instanceof HttpError && (err.status === 401 || err.status === 403)) {
    logger.error({ err, ...context }, 'Game data API key rejected');
    return new UserError(t.stats.keyRejected(err.host));
  }
  logger.warn({ err, ...context }, 'Game data lookup failed');
  return new UserError(t.stats.unavailable);
}

/**
 * Remembers each key's result for `ttlMs`, so repeated calls don't hit the APIs every time.
 * null is never kept: someone who links their account or starts playing shows up at once.
 */
function cached<T>(ttlMs: number, load: (key: string) => Promise<T | null>) {
  const entries = new Map<string, { value: T; expires: number }>();
  return async (key: string): Promise<T | null> => {
    const now = Date.now();
    const hit = entries.get(key);
    if (hit && hit.expires > now) return hit.value;
    const value = await load(key);
    if (value === null) return null;
    // ponytail: expired entries are only swept once the map grows; plenty for one server.
    if (entries.size > 1000) {
      for (const [k, entry] of entries) if (entry.expires <= now) entries.delete(k);
    }
    entries.set(key, { value, expires: now + ttlMs });
    return value;
  };
}

/** Key `guildId:userId`. The member's Roblox user ID from Bloxlink, or null if not linked. */
const linkedRobloxId = cached(5 * 60_000, async (key) => {
  const [guildId, userId] = key.split(':');
  const body = await getJson(
    `https://api.blox.link/v4/public/guilds/${guildId}/discord-to-roblox/${userId}`,
    { headers: { Authorization: env.BLOXLINK_API_KEY ?? '' } },
  );
  const raw = isRecord(body) ? body.robloxID : undefined;
  const id = typeof raw === 'string' || typeof raw === 'number' ? String(raw) : '';
  // Only real players: negative IDs are Studio test profiles.
  return /^[1-9]\d*$/.test(id) ? id : null;
});

/** The player's saved progress, or null if they never played (no entry). */
const progressOf = cached(60_000, async (robloxId) => {
  const body = await getJson(
    `https://apis.roblox.com/cloud/v2/universes/${UNIVERSE_ID}/data-stores/${PROGRESS_STORE}/entries/u_${robloxId}`,
    { headers: { 'x-api-key': env.ROBLOX_API_KEY ?? '' } },
  );
  return isRecord(body) ? parseProgress(body.value) : null;
});

const robloxUserOf = cached(60 * 60_000, async (robloxId) => {
  const body = await getJson(`https://users.roblox.com/v1/users/${robloxId}`);
  if (!isRecord(body) || typeof body.name !== 'string') return null;
  const displayName = typeof body.displayName === 'string' ? body.displayName : body.name;
  return { name: body.name, displayName };
});

const headshotOf = cached(60 * 60_000, async (robloxId) => {
  const body = await getJson(
    `https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${robloxId}&size=150x150&format=Png`,
  );
  const first: unknown = isRecord(body) && Array.isArray(body.data) ? body.data[0] : null;
  // Pending or blocked renders have no usable URL; null keeps them out of the cache.
  if (!isRecord(first) || first.state !== 'Completed') return null;
  return typeof first.imageUrl === 'string' && first.imageUrl ? first.imageUrl : null;
});

/** Display names for many players in one request. Missing ones are left out. */
async function displayNames(robloxIds: string[]): Promise<Map<string, string>> {
  const body = await getJson('https://users.roblox.com/v1/users', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ userIds: robloxIds.map(Number), excludeBannedUsers: false }),
  });
  const names = new Map<string, string>();
  for (const user of isRecord(body) && Array.isArray(body.data) ? body.data : []) {
    if (isRecord(user) && typeof user.displayName === 'string') {
      names.set(String(user.id), user.displayName);
    }
  }
  return names;
}

const TOP = 100;
const PAGE_SIZE = 10;

/** Key is a Board. Its top 100 real players, best first, with their display names. */
const topOf = cached(60_000, async (board) => {
  const top: { robloxId: string; value: number }[] = [];
  let pageToken = '';
  // A second page only when Studio test profiles (negative IDs) were skipped on the first.
  for (let request = 0; request < 2 && top.length < TOP; request++) {
    const body = await getJson(
      `https://apis.roblox.com/cloud/v2/universes/${UNIVERSE_ID}/ordered-data-stores/${BOARDS[board as Board]}/scopes/global/entries?maxPageSize=${TOP}&orderBy=value%20desc${pageToken && `&pageToken=${encodeURIComponent(pageToken)}`}`,
      { headers: { 'x-api-key': env.ROBLOX_API_KEY ?? '' } },
    );
    if (!isRecord(body)) break;
    const entries = Array.isArray(body.orderedDataStoreEntries) ? body.orderedDataStoreEntries : [];
    for (const entry of entries) {
      if (!isRecord(entry) || typeof entry.value !== 'number' || typeof entry.id !== 'string')
        continue;
      const robloxId = /^u_([1-9]\d*)$/.exec(entry.id)?.[1];
      if (robloxId && top.length < TOP) top.push({ robloxId, value: entry.value });
    }
    if (typeof body.nextPageToken !== 'string' || !body.nextPageToken) break;
    pageToken = body.nextPageToken;
  }
  // Names are cosmetic: without them the board still shows, with "Roblox user 123".
  const names = top.length
    ? await displayNames(top.map((row) => row.robloxId)).catch(() => new Map<string, string>())
    : new Map<string, string>();
  return top.map((row) => ({ ...row, name: names.get(row.robloxId) }));
});

/** Checked before deferring, so a missing key gets a private reply instead of a public one. */
export function assertGameDataReady(needsBloxlink: boolean): void {
  if (!env.ROBLOX_API_KEY || (needsBloxlink && !env.BLOXLINK_API_KEY)) {
    throw new UserError(t.stats.notConfigured);
  }
}

const count = (n: number) => n.toLocaleString('en-US');
const km = (n: number) => n.toLocaleString('en-US', { maximumFractionDigits: 1 });
const profileUrl = (robloxId: string) => `https://www.roblox.com/users/${robloxId}/profile`;

export async function statsReply(
  guildId: string,
  user: User,
  self: boolean,
): Promise<BaseMessageOptions> {
  let robloxId: string | null;
  let progress;
  try {
    robloxId = await linkedRobloxId(`${guildId}:${user.id}`);
    progress = robloxId ? await progressOf(robloxId) : null;
  } catch (err) {
    throw lookupError(err, { userId: user.id });
  }
  if (!robloxId) {
    throw new UserError(self ? t.stats.notLinkedSelf : t.stats.notLinked(user.toString()));
  }

  // Name and picture are cosmetic, so their failures only cost the nicer card.
  const [profile, headshot] = await Promise.all([
    robloxUserOf(robloxId).catch(() => null),
    headshotOf(robloxId).catch(() => null),
  ]);
  const title = profile
    ? t.stats.title(escapeMarkdown(profile.displayName), escapeMarkdown(profile.name))
    : t.stats.unknownName(robloxId);
  const embed = embeds
    .info(
      title,
      progress ? t.stats.statsFor(user.toString()) : t.stats.neverPlayed(user.toString()),
    )
    .setURL(profileUrl(robloxId));
  if (headshot) embed.setThumbnail(headshot);
  if (progress) {
    embed.addFields(
      { name: t.stats.xp, value: count(progress.xp), inline: true },
      { name: t.stats.points, value: count(progress.points), inline: true },
      { name: t.stats.trips, value: count(progress.trips), inline: true },
      { name: t.stats.distance, value: t.stats.km(km(progress.km)), inline: true },
      { name: t.stats.stops, value: count(progress.stops), inline: true },
    );
  }
  return { embeds: [embed] };
}

/**
 * One page of a board. The buttons carry `ownerId`, board and page in their custom IDs, so they
 * keep working after a restart; see interactions/buttons/lb-page.ts.
 */
export async function leaderboardReply(
  board: Board,
  page: number,
  ownerId: string,
): Promise<BaseMessageOptions> {
  let top;
  try {
    top = (await topOf(board)) ?? [];
  } catch (err) {
    throw lookupError(err, { board });
  }
  const pages = Math.max(1, Math.ceil(top.length / PAGE_SIZE));
  const current = Math.min(Math.max(0, Math.trunc(page) || 0), pages - 1);
  const lines = top.slice(current * PAGE_SIZE, (current + 1) * PAGE_SIZE).map((row, i) => {
    const name = escapeMarkdown(row.name ?? t.stats.unknownName(row.robloxId));
    const value =
      board === 'xp' ? t.leaderboard.xp(count(row.value)) : t.stats.km(count(row.value));
    return t.leaderboard.line(
      t.leaderboard.place(current * PAGE_SIZE + i + 1),
      `[${name}](${profileUrl(row.robloxId)})`,
      value,
    );
  });
  const embed = embeds.info(
    t.leaderboard.title(t.leaderboard.by[board]),
    lines.join('\n') || t.leaderboard.empty,
  );

  // Custom IDs must be unique within a message, hence the trailing tags on the extra buttons.
  const id = (target: Board, targetPage: number, tag = '') =>
    `lb:page:${ownerId}:${target}:${targetPage}${tag && `:${tag}`}`;
  const button = (customId: string, label: string, style = ButtonStyle.Secondary) =>
    new ButtonBuilder().setCustomId(customId).setLabel(label).setStyle(style);
  const rows = [];
  if (pages > 1) {
    rows.push(
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        button(id(board, current - 1), t.leaderboard.prev).setDisabled(current === 0),
        button(id(board, current, 'now'), t.leaderboard.page(current + 1, pages)).setDisabled(true),
        button(id(board, current + 1), t.leaderboard.next).setDisabled(current === pages - 1),
      ),
    );
  }
  rows.push(
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      (Object.keys(BOARDS) as Board[]).map((target) =>
        button(
          id(target, 0, 'board'),
          t.leaderboard.by[target],
          target === board ? ButtonStyle.Primary : ButtonStyle.Secondary,
        ).setDisabled(target === board),
      ),
    ),
  );
  return { embeds: [embed], components: rows };
}
