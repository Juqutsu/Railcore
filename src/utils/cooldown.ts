/** Per-key cooldown kept in memory. Resets on restart, which is fine for anti-spam. */
export function createCooldown(ms: number) {
  const until = new Map<string, number>();
  return {
    /** Returns the ms left if `key` is still cooling down; otherwise starts its cooldown and returns 0. */
    take(key: string, now = Date.now()): number {
      const end = until.get(key) ?? 0;
      if (end > now) return end - now;
      if (until.size >= 10_000) {
        for (const [k, v] of until) if (v <= now) until.delete(k);
      }
      until.set(key, now + ms);
      return 0;
    },
    /** The ms left, without starting a cooldown. */
    peek(key: string, now = Date.now()): number {
      return Math.max(0, (until.get(key) ?? 0) - now);
    },
    /** Gives the key its turn back, e.g. when the action it guarded failed. */
    clear(key: string): void {
      until.delete(key);
    },
  };
}
