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
/** Stored as null while the default text (`fallback`) is used. */
type TextSetting = { kind: 'text'; max: number; fallback: string };
type Setting =
  | { kind: 'channel' | 'category'; permissions: PermissionsString[] }
  | { kind: 'role' | 'roles' | 'toggle' }
  | NumberSetting
  | TextSetting;

export const SETTINGS: Record<SettingKey, Setting> = {
  verificationChannelId: { kind: 'channel', permissions: POST },
  verifiedRoleId: { kind: 'role' },
  minAccountAgeDays: { kind: 'number', unit: 'days', max: 365 },
  welcomeChannelId: { kind: 'channel', permissions: POST },
  welcomeMessage: { kind: 'text', max: 1000, fallback: t.welcome.defaultJoin },
  leaveChannelId: { kind: 'channel', permissions: POST },
  leaveMessage: { kind: 'text', max: 1000, fallback: t.welcome.defaultLeave },
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
  applicationsOpen: { kind: 'toggle' },
  modLogChannelId: { kind: 'channel', permissions: POST },
  serverLogChannelId: { kind: 'channel', permissions: POST },
  rankUpChannelId: { kind: 'channel', permissions: POST },
};

/** The dashboard menu value for the XP roles page, which lives in its own table, not GuildConfig. */
export const XP_ROLES_PICK = 'xpRoles';

const GROUPS: { name: keyof typeof t.setup.groups; keys: SettingKey[] }[] = [
  { name: 'verification', keys: ['verificationChannelId', 'verifiedRoleId', 'minAccountAgeDays'] },
  {
    name: 'welcome',
    keys: ['welcomeChannelId', 'welcomeMessage', 'leaveChannelId', 'leaveMessage'],
  },
  {
    name: 'tickets',
    keys: [
      'ticketCategoryId',
      'ticketLogChannelId',
      'staffRoleIds',
      'applicationRoleId',
      'applicationsOpen',
      'ticketReminderHours',
      'ticketAutoCloseHours',
    ],
  },
  { name: 'logs', keys: ['modLogChannelId', 'serverLogChannelId'] },
  // Listed last, so the XP roles menu entry appended after it sits next to it.
  { name: 'game', keys: ['rankUpChannelId'] },
];

export const isSettingKey = (key: string | undefined): key is SettingKey =>
  key !== undefined && Object.hasOwn(SETTINGS, key);

function formatValue(config: GuildConfig, key: SettingKey): string {
  const value = config[key];
  const setting = SETTINGS[key];
  if (setting.kind === 'number' && typeof value === 'number') return t.setup[setting.unit](value);
  if (setting.kind === 'text') return value ? t.setup.customText : t.setup.defaultText;
  if (setting.kind === 'toggle') return value ? t.setup.on : t.setup.off;
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
        value: [
          ...group.keys.map(
            (key) => `**${t.setup.settings[key].label}:** ${formatValue(config, key)}`,
          ),
          ...(group.name === 'game' ? [`**${t.xpRoles.label}:** ${t.setup.xpRolesHint}`] : []),
        ].join('\n'),
      })),
    );

  const menu = new StringSelectMenuBuilder()
    .setCustomId('setup:pick')
    .setPlaceholder(t.setup.pickPlaceholder)
    .addOptions([
      ...GROUPS.flatMap((group) => group.keys).map((key) => ({
        label: t.setup.settings[key].label,
        description: t.setup.settings[key].description,
        value: key,
      })),
      { label: t.xpRoles.label, description: t.xpRoles.description, value: XP_ROLES_PICK },
    ]);

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
  const setting = SETTINGS[key];
  const value = config[key];
  const body =
    setting.kind === 'text'
      ? `${description}\n${t.setup.placeholders}\n\n**${t.setup.current}:** ${formatValue(config, key)}\n>>> ${typeof value === 'string' ? value : setting.fallback}`
      : `${description}\n\n**${t.setup.current}:** ${formatValue(config, key)}`;
  const embed = embeds.info(t.setup.editTitle(label), body);
  const back = new ButtonBuilder()
    .setCustomId('setup:back')
    .setLabel(t.setup.back)
    .setStyle(ButtonStyle.Secondary);

  if (setting.kind === 'toggle') {
    // The target state is in the ID, so a stale or double click repeats it instead of undoing it.
    const toggle = new ButtonBuilder()
      .setCustomId(`setup:toggle:${key}:${value ? 'off' : 'on'}`)
      .setLabel(value ? t.setup.turnOff : t.setup.turnOn)
      .setStyle(value ? ButtonStyle.Danger : ButtonStyle.Success);
    return {
      embeds: [embed],
      components: [new ActionRowBuilder<ButtonBuilder>().addComponents(toggle, back)],
    };
  }

  if (setting.kind === 'number' || setting.kind === 'text') {
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`setup:${setting.kind}:${key}`)
        .setLabel(t.setup.change)
        .setStyle(ButtonStyle.Primary),
      back,
    );
    if (setting.kind === 'text') {
      row.addComponents(
        new ButtonBuilder()
          .setCustomId(`setup:clear:${key}`)
          .setLabel(t.setup.useDefault)
          .setStyle(ButtonStyle.Danger),
      );
    }
    return { embeds: [embed], components: [row] };
  }

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

export function textModal(
  key: SettingKey,
  setting: TextSetting,
  current: string | null,
): ModalBuilder {
  return new ModalBuilder()
    .setCustomId(`setup:text:${key}`)
    .setTitle(t.setup.settings[key].label)
    .addLabelComponents(
      new LabelBuilder()
        .setLabel(t.setup.messageLabel)
        .setDescription(t.setup.textHint)
        .setTextInputComponent(
          new TextInputBuilder()
            .setCustomId('value')
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(false)
            .setMaxLength(setting.max)
            .setValue(current ?? setting.fallback),
        ),
    );
}
