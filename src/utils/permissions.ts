import type { GuildBasedChannel, PermissionsString, Role } from 'discord.js';
import { t } from '../text.js';

/** What the bot needs to post embeds in a channel. */
export const POST_PERMISSIONS: PermissionsString[] = ['ViewChannel', 'SendMessages', 'EmbedLinks'];

/** Permissions from `required` the bot lacks in `channel`, as readable names ("Send Messages"). */
export function missingPermissions(
  channel: GuildBasedChannel,
  required: PermissionsString[],
): string[] {
  const me = channel.guild.members.me;
  const granted = me ? channel.permissionsFor(me) : null;
  return required
    .filter((permission) => !granted?.has(permission))
    .map(
      (permission) => t.permissions[permission] ?? permission.replace(/(?<=[a-z])(?=[A-Z])/g, ' '),
    );
}

/** Why the bot can't give members this role, or null if it can. */
export function roleAssignProblem(role: Role): string | null {
  const me = role.guild.members.me;
  if (role.managed || role.id === role.guild.id) return t.errors.roleNotAssignable(role.toString());
  if (!me?.permissions.has('ManageRoles')) return t.errors.needManageRoles;
  if (role.comparePositionTo(me.roles.highest) >= 0) return t.errors.roleTooHigh(role.toString());
  return null;
}
