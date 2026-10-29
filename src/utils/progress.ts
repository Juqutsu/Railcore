/** What /stats shows from a player's `FBR_Progress_v1` profile. */
export interface Progress {
  xp: number;
  points: number;
  trips: number;
  km: number;
  stops: number;
}

const num = (value: unknown) => (typeof value === 'number' && Number.isFinite(value) ? value : 0);

/**
 * Reads a profile the way the game does: a missing or non-number field counts as 0, and
 * profiles before version 2 are old test data whose xp and points the game resets to 0.
 */
export function parseProgress(value: unknown): Progress {
  const profile = (value !== null && typeof value === 'object' ? value : {}) as Record<
    string,
    unknown
  >;
  const current = num(profile.version) >= 2;
  return {
    xp: current ? num(profile.xp) : 0,
    points: current ? num(profile.points) : 0,
    trips: num(profile.tripCount),
    km: num(profile.totalKm),
    stops: num(profile.totalStops),
  };
}
