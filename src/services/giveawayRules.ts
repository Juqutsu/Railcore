import { PermissionFlagsBits, type GuildMember } from 'discord.js';
import type { Giveaway, GuildConfig } from '../generated/prisma/client.js';
import { t } from '../text.js';

// Pure rules, kept apart from giveaways.ts so tests don't load the database client.

export function isHost(member: GuildMember, config: GuildConfig): boolean {
  return (
    member.permissions.has(PermissionFlagsBits.ManageGuild) ||
    config.giveawayHostRoleIds.some((id) => member.roles.cache.has(id))
  );
}

/** Manage Server: every giveaway. Host role: only the ones they host. */
export function canManage(
  member: GuildMember,
  config: GuildConfig,
  g: Pick<Giveaway, 'hostId'>,
): boolean {
  return (
    member.permissions.has(PermissionFlagsBits.ManageGuild) ||
    (isHost(member, config) && g.hostId === member.id)
  );
}

export type EligibilityFacts = {
  roleIds: readonly string[];
  blocked: boolean;
  hasActiveWarning: boolean;
  wonRecently: boolean;
};

/** Why the member can't enter, or null. First failure wins. */
export function ineligibleReason(facts: EligibilityFacts, config: GuildConfig): string | null {
  if (config.giveawayBlockedRoleIds.some((id) => facts.roleIds.includes(id))) {
    return t.giveaways.reasonRole;
  }
  if (facts.blocked) return t.giveaways.reasonBlocked;
  if (config.giveawayBlockWarned && facts.hasActiveWarning) return t.giveaways.reasonWarned;
  if (config.giveawayWinnerCooldownDays > 0 && facts.wonRecently) {
    return t.giveaways.reasonWon(config.giveawayWinnerCooldownDays);
  }
  return null;
}

const MAX_CHOICE_NAME = 100;
const formatDate = (d: Date) => `${d.toISOString().slice(0, 16).replace('T', ' ')} UTC`;

/** "<prize> · ends <date>" / "<prize> · ended <date>", prize clipped to Discord's 100 chars. */
export function choiceName(g: Pick<Giveaway, 'prize' | 'endsAt' | 'endedAt'>): string {
  const suffix = g.endedAt
    ? ` · ${t.giveaways.choiceEnded} ${formatDate(g.endedAt)}`
    : ` · ${t.giveaways.choiceEnds} ${formatDate(g.endsAt)}`;
  return g.prize.slice(0, MAX_CHOICE_NAME - suffix.length) + suffix;
}
