import { randomInt as cryptoRandomInt } from 'node:crypto';

const defaultRandomInt = (maxExclusive: number) => cryptoRandomInt(maxExclusive);

/** Fisher–Yates shuffle into a new array. */
export function shuffle<T>(items: readonly T[], randomInt = defaultRandomInt): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

/**
 * Shuffles the candidates and keeps valid ones until `count`. Checks lazily, so only as many
 * candidates as needed are looked up.
 */
export async function pickWinners(
  candidates: readonly string[],
  count: number,
  isValid: (id: string) => Promise<boolean>,
  randomInt = defaultRandomInt,
): Promise<string[]> {
  const winners: string[] = [];
  for (const id of shuffle([...new Set(candidates)], randomInt)) {
    if (winners.length >= count) break;
    if (await isValid(id)) winners.push(id);
  }
  return winners;
}
