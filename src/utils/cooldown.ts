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
  };
}
