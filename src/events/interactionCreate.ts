import { Events } from 'discord.js';
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

export default defineEvent({
  name: Events.InteractionCreate,
  async execute(interaction) {
    // Every command is guild-only and every component lives in a guild message.
    if (!interaction.inCachedGuild()) return;

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
        await component.execute(interaction, args);
      }
    } catch (err) {
      await handleInteractionError(interaction, err);
    }
  },
});
