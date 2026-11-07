const DAY = 86_400_000;

/** Monday 00:00 UTC of the ISO week that holds `ms`, when the game's weekly boards reset. */
export function weekStart(ms: number): number {
  const day = Math.floor(ms / DAY);
  // 1970-01-01 was a Thursday, so (day + 3) % 7 counts the days since Monday.
  return (day - ((day + 3) % 7)) * DAY;
}

/**
 * The game's week tag for `ms`, e.g. `2026_W45`: the ISO week with the ISO week year, which can
 * differ from the calendar year around New Year. Must match the game's LeaderboardRules.luau.
 */
export function weekKey(ms: number): string {
  const thursday = new Date(weekStart(ms) + 3 * DAY);
  const year = thursday.getUTCFullYear();
  const week = Math.floor((thursday.getTime() - Date.UTC(year, 0, 1)) / (7 * DAY)) + 1;
  return `${year}_W${String(week).padStart(2, '0')}`;
}
