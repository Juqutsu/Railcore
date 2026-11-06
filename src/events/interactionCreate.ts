import { Events, PermissionFlagsBits } from 'discord.js';
import {
  commandKey,
  commands,
  componentKey,
  components,
  defineEvent,
  type ComponentKind,
} from '../handlers.js';
import { t } from '../text.js';
import { handleInteractionError, UserError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';

export default defineEvent({
  name: Events.InteractionCreate,
  async execute(interaction) {
    // Every command is guild-only and every component lives in a guild message. Other servers'
    // interactions never get here: handlers.ts drops them (see services/guildLock.ts).
    if (!interaction.inCachedGuild()) return;

    if (interaction.isAutocomplete()) {
      const command = commands.get(commandKey(interaction.commandType, interaction.commandName));
      try {
        await command?.autocomplete?.(interaction);
      } catch (err) {
        logger.warn({ err, command: interaction.commandName }, 'Autocomplete failed');
      }
      // An empty list beats Discord's "Loading options failed".
      if (!interaction.responded) await interaction.respond([]).catch(() => undefined);
      return;
    }

    try {
      if (
        interaction.isChatInputCommand() ||
        interaction.isUserContextMenuCommand() ||
        interaction.isMessageContextMenuCommand()
      ) {
        const command = commands.get(commandKey(interaction.commandType, interaction.commandName));
        if (!command) throw new UserError(t.errors.unknownInteraction);
        await command.execute(interaction);
      } else if (interaction.isMessageComponent() || interaction.isModalSubmit()) {
        const [scope = '', action = '', ...args] = interaction.customId.split(':');
        const kind: ComponentKind = interaction.isButton()
          ? 'button'
          : interaction.isModalSubmit()
            ? 'modal'
            : 'select';
        const component = components.get(componentKey(kind, `${scope}:${action}`));
        if (!component) throw new UserError(t.errors.unknownInteraction);
        // The /setup dashboard can stay open after someone loses Manage Server, so re-check every click.
        if (
          scope === 'setup' &&
          !interaction.memberPermissions.has(PermissionFlagsBits.ManageGuild)
        ) {
          throw new UserError(t.errors.noPermission);
        }
        await component.execute(interaction, args);
      }
    } catch (err) {
      await handleInteractionError(interaction, err);
    }
  },
});
