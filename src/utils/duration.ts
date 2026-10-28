import { t } from '../text.js';

/** Parses a whole number of days from 0 to `max`, or returns null. */
export function parseDays(input: string, max = 365): number | null {
  const trimmed = input.trim();
  if (!/^\d{1,4}$/.test(trimmed)) return null;
  const days = Number(trimmed);
  return days <= max ? days : null;
}

const UNIT_MS = { w: 604_800_000, d: 86_400_000, h: 3_600_000, m: 60_000, s: 1_000 } as const;

/** Parses "10m", "2h", "1d12h" or "1w" into milliseconds, or returns null. */
export function parseDuration(input: string): number | null {
  const text = input.toLowerCase().replace(/\s+/g, '');
  if (!/^(\d+[wdhms])+$/.test(text)) return null;
  let ms = 0;
  for (const [, amount, unit] of text.matchAll(/(\d+)([wdhms])/g)) {
    ms += Number(amount) * UNIT_MS[unit as keyof typeof UNIT_MS];
  }
  return ms;
}

/** "1 day 3 hours": the two largest non-zero units. */
export function formatDuration(ms: number): string {
  const parts: string[] = [];
  let rest = ms;
  for (const unit of ['d', 'h', 'm', 's'] as const) {
    const amount = Math.floor(rest / UNIT_MS[unit]);
    rest -= amount * UNIT_MS[unit];
    if (amount) parts.push(t.time[unit](amount));
  }
  return parts.slice(0, 2).join(' ') || t.time.s(0);
}
