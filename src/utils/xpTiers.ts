/** An XP role: reached once a member's in-game XP is at least `minXp`. */
export interface Tier {
  roleId: string;
  minXp: number;
}

/** Every tier `xp` has reached, since tiers stack. null (not linked) reaches none. */
export const reachedTiers = (tiers: Tier[], xp: number | null): Tier[] =>
  xp === null ? [] : tiers.filter((tier) => tier.minXp <= xp);

/** The highest tier reached and the next one up, either may be missing. */
export function rankOf(tiers: Tier[], xp: number): { current?: Tier; next?: Tier } {
  const sorted = [...tiers].sort((a, b) => a.minXp - b.minXp);
  return {
    current: sorted.filter((tier) => tier.minXp <= xp).at(-1),
    next: sorted.find((tier) => tier.minXp > xp),
  };
}

/**
 * The tier to announce when XP grew from `before` to `after`. Only a tier crossed by playing
 * counts, so the first sync (before = null) and threshold changes by admins stay quiet.
 */
export function rankUp(tiers: Tier[], before: number | null, after: number): Tier | undefined {
  if (before === null || after <= before) return undefined;
  const { current } = rankOf(tiers, after);
  return current && current.minXp > before ? current : undefined;
}
