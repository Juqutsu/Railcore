import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelSelectMenuBuilder,
  ChannelType,
  LabelBuilder,
  ModalBuilder,
  RoleSelectMenuBuilder,
  StringSelectMenuBuilder,
  TextInputBuilder,
  TextInputStyle,
  type BaseMessageOptions,
  type Guild,
  type PermissionsString,
} from 'discord.js';
import type { GuildConfig } from '../generated/prisma/client.js';
import { t } from '../text.js';
import { embeds } from '../utils/embeds.js';
import { POST_PERMISSIONS as POST } from '../utils/permissions.js';

export type SettingKey = keyof typeof t.setup.settings;

type NumberSetting = { kind: 'number'; unit: keyof typeof t.setup.units; max: number };
type Setting =
  | { kind: 'channel' | 'category'; permissions: PermissionsString[] }
  | { kind: 'role' | 'roles' }
  | NumberSetting;

export const SETTINGS: Record<SettingKey, Setting> = {
  verificationChannelId: { kind: 'channel', permissions: POST },
  verifiedRoleId: { kind: 'role' },
  minAccountAgeDays: { kind: 'number', unit: 'days', max: 365 },
  ticketReminderHours: { kind: 'number', unit: 'hours', max: 720 },
  ticketAutoCloseHours: { kind: 'number', unit: 'hours', max: 720 },
  ticketCategoryId: {
    kind: 'category',
    // Ticket channels grant these to members, and Discord only lets the bot grant what it has.
    permissions: [...POST, 'ManageChannels', 'ManageRoles', 'AttachFiles', 'ReadMessageHistory'],
  },
  ticketLogChannelId: { kind: 'channel', permissions: [...POST, 'AttachFiles'] },
  staffRoleIds: { kind: 'roles' },
  applicationRoleId: { kind: 'role' },
  modLogChannelId: { kind: 'channel', permissions: POST },
  serverLogChannelId: { kind: 'channel', permissions: POST },
};

const GROUPS: { name: keyof typeof t.setup.groups; keys: SettingKey[] }[] = [
  { name: 'verification', keys: ['verificationChannelId', 'verifiedRoleId', 'minAccountAgeDays'] },
  {
    name: 'tickets',
    keys: [
      'ticketCategoryId',
      'ticketLogChannelId',
      'staffRoleIds',
      'applicationRoleId',
      'ticketReminderHours',
      'ticketAutoCloseHours',
    ],
  },
  { name: 'logs', keys: ['modLogChannelId', 'serverLogChannelId'] },
];

export const isSettingKey = (key: string | undefined): key is SettingKey =>
  key !== undefined && Object.hasOwn(SETTINGS, key);

function formatValue(config: GuildConfig, key: SettingKey): string {
  const value = config[key];
  const setting = SETTINGS[key];
  if (setting.kind === 'number' && typeof value === 'number') return t.setup[setting.unit](value);
  if (Array.isArray(value)) {
    return value.length ? value.map((id) => `<@&${id}>`).join(' ') : t.setup.notSet;
  }
  if (!value) return t.setup.notSet;
  return SETTINGS[key].kind === 'role' ? `<@&${value}>` : `<#${value}>`;
}

export function setupOverview(config: GuildConfig, notice?: string): BaseMessageOptions {
  const embed = embeds
    .info(t.setup.title, notice ? `${notice}\n\n${t.setup.intro}` : t.setup.intro)
    .addFields(
      GROUPS.map((group) => ({
        name: t.setup.groups[group.name],
        value: group.keys
          .map((key) => `**${t.setup.settings[key].label}:** ${formatValue(config, key)}`)
          .join('\n'),
      })),
    );

  const menu = new StringSelectMenuBuilder()
    .setCustomId('setup:pick')
    .setPlaceholder(t.setup.pickPlaceholder)
    .addOptions(
      GROUPS.flatMap((group) => group.keys).map((key) => ({
        label: t.setup.settings[key].label,
        description: t.setup.settings[key].description,
        value: key,
      })),
    );

  return {
    embeds: [embed],
    components: [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu)],
  };
}

export function setupEditor(
  guild: Guild,
  config: GuildConfig,
  key: SettingKey,
): BaseMessageOptions {
  const { label, description } = t.setup.settings[key];
  const embed = embeds.info(
    t.setup.editTitle(label),
    `${description}\n\n**${t.setup.current}:** ${formatValue(config, key)}`,
  );
  const back = new ButtonBuilder()
    .setCustomId('setup:back')
    .setLabel(t.setup.back)
    .setStyle(ButtonStyle.Secondary);
  const setting = SETTINGS[key];

  if (setting.kind === 'number') {
    const change = new ButtonBuilder()
      .setCustomId(`setup:number:${key}`)
      .setLabel(t.setup.change)
      .setStyle(ButtonStyle.Primary);
    return {
      embeds: [embed],
      components: [new ActionRowBuilder<ButtonBuilder>().addComponents(change, back)],
    };
  }

  const value = config[key];
  const current = (Array.isArray(value) ? value : [value]).filter(
    (id): id is string => typeof id === 'string',
  );
  const customId = `setup:value:${key}`;
  let menu: ChannelSelectMenuBuilder | RoleSelectMenuBuilder;

  if (setting.kind === 'channel' || setting.kind === 'category') {
    const isCategory = setting.kind === 'category';
    menu = new ChannelSelectMenuBuilder()
      .setCustomId(customId)
      .setChannelTypes(isCategory ? ChannelType.GuildCategory : ChannelType.GuildText)
      .setPlaceholder(isCategory ? t.setup.categoryPlaceholder : t.setup.channelPlaceholder);
    // Discord rejects default values that no longer exist, e.g. a deleted channel.
    const existing = current.filter((id) => guild.channels.cache.has(id));
    if (existing.length) menu.setDefaultChannels(existing);
  } else {
    const multiple = setting.kind === 'roles';
    menu = new RoleSelectMenuBuilder()
      .setCustomId(customId)
      .setPlaceholder(multiple ? t.setup.rolesPlaceholder : t.setup.rolePlaceholder)
      .setMaxValues(multiple ? 10 : 1);
    const existing = current.filter((id) => guild.roles.cache.has(id));
    if (existing.length) menu.setDefaultRoles(existing);
  }

  const clear = new ButtonBuilder()
    .setCustomId(`setup:clear:${key}`)
    .setLabel(t.setup.clear)
    .setStyle(ButtonStyle.Danger);

  return {
    embeds: [embed],
    components: [
      new ActionRowBuilder<ChannelSelectMenuBuilder | RoleSelectMenuBuilder>().addComponents(menu),
      new ActionRowBuilder<ButtonBuilder>().addComponents(back, clear),
    ],
  };
}

export function numberModal(
  key: SettingKey,
  setting: NumberSetting,
  current: number,
): ModalBuilder {
  return new ModalBuilder()
    .setCustomId(`setup:number:${key}`)
    .setTitle(t.setup.settings[key].label)
    .addLabelComponents(
      new LabelBuilder()
        .setLabel(t.setup.units[setting.unit])
        .setDescription(t.setup.numberHint(setting.max))
        .setTextInputComponent(
          new TextInputBuilder()
            .setCustomId('value')
            .setStyle(TextInputStyle.Short)
            .setMinLength(1)
            .setMaxLength(String(setting.max).length)
            .setValue(String(current)),
        ),
    );
}
