import { escapeMarkdown, type BaseMessageOptions, type User } from 'discord.js';
import { env } from '../env.js';
import { t } from '../text.js';
import { embeds } from '../utils/embeds.js';
import { UserError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';
import { parseProgress } from '../utils/progress.js';

// Falkenberg Railways itself; the API key is scoped to this universe.
const UNIVERSE_ID = '10123051468';
const PROGRESS_STORE = 'FBR_Progress_v1';

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

/** GETs JSON with a timeout. 404 gives null; 429 and 5xx are retried twice, honoring retry-after. */
async function getJson(url: string, headers?: Record<string, string>): Promise<unknown> {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(url, { headers, signal: AbortSignal.timeout(8000) });
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

/**
 * Remembers each key's result for `ttlMs`, so repeated /stats calls don't hit the APIs every
 * time. null is never kept: someone who links their account or starts playing shows up at once.
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
    { Authorization: env.BLOXLINK_API_KEY ?? '' },
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
    { 'x-api-key': env.ROBLOX_API_KEY ?? '' },
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

/** Checked before deferring, so a missing key gets a private reply instead of a public one. */
export function assertStatsReady(): void {
  if (!env.ROBLOX_API_KEY || !env.BLOXLINK_API_KEY) throw new UserError(t.stats.notConfigured);
}

const count = (n: number) => n.toLocaleString('en-US');
const km = (n: number) => n.toLocaleString('en-US', { maximumFractionDigits: 1 });

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
    // A rejected key is a setup mistake that retrying won't fix, so it gets its own message.
    if (err instanceof HttpError && (err.status === 401 || err.status === 403)) {
      logger.error({ err, userId: user.id }, 'Game stats API key rejected');
      throw new UserError(t.stats.keyRejected(err.host));
    }
    logger.warn({ err, userId: user.id }, 'Game stats lookup failed');
    throw new UserError(t.stats.unavailable);
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
    .setURL(`https://www.roblox.com/users/${robloxId}/profile`);
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
