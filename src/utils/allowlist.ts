import { Guild } from 'discord.js';

/**
 * The server an event belongs to, from its arguments (a Guild, or anything with `guildId` or
 * `guild`, e.g. a member, message, channel or interaction); undefined for bot-wide events.
 */
export function guildIdOf(args: unknown[]): string | undefined {
  for (const arg of args) {
    if (arg instanceof Guild) return arg.id;
    if (arg && typeof arg === 'object') {
      const { guildId, guild } = arg as { guildId?: unknown; guild?: { id?: unknown } | null };
      if (typeof guildId === 'string') return guildId;
      if (typeof guild?.id === 'string') return guild.id;
    }
  }
  return undefined;
}

/**
 * The servers to leave. Only when the bot is in every allowed server: a wrong ID never names one
 * of its servers, so a typo leaves nothing instead of the real server that ID should have named.
 */
export function guildsToLeave(guildIds: string[], allowed: ReadonlySet<string> | null): string[] {
  if (!allowed || ![...allowed].every((id) => guildIds.includes(id))) return [];
  return guildIds.filter((id) => !allowed.has(id));
}
