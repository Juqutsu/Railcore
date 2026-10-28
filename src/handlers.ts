import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import type {
  AnySelectMenuInteraction,
  ButtonInteraction,
  ChatInputCommandInteraction,
  Client,
  ClientEvents,
  ModalSubmitInteraction,
  RESTPostAPIChatInputApplicationCommandsJSONBody,
} from 'discord.js';
import { logger } from './utils/logger.js';

export interface Command {
  data: { name: string; toJSON(): RESTPostAPIChatInputApplicationCommandsJSONBody };
  execute(interaction: ChatInputCommandInteraction<'cached'>): Promise<unknown>;
}

export interface Event<K extends keyof ClientEvents = keyof ClientEvents> {
  name: K;
  once?: boolean;
  execute(...args: ClientEvents[K]): unknown;
}

interface ComponentInteractions {
  button: ButtonInteraction<'cached'>;
  select: AnySelectMenuInteraction<'cached'>;
  modal: ModalSubmitInteraction<'cached'>;
}

export type ComponentKind = keyof ComponentInteractions;

export interface Component<K extends ComponentKind = ComponentKind> {
  kind: K;
  /** `scope:action`. Handles every custom ID `scope:action[:arg...]`; the args are passed on. */
  id: string;
  execute(interaction: ComponentInteractions[K], args: string[]): Promise<unknown>;
}

export const defineCommand = (command: Command) => command;
export const defineEvent = <K extends keyof ClientEvents>(event: Event<K>) => event;
export const defineComponent = <K extends ComponentKind>(component: Component<K>) => component;

export const commands = new Map<string, Command>();
export const components = new Map<string, Component>();
export const componentKey = (kind: ComponentKind, id: string) => `${kind}:${id}`;

async function importDefaults<T>(folder: string): Promise<T[]> {
  const dir = join(import.meta.dirname, folder);
  const files = (await readdir(dir, { recursive: true })).filter(
    (file) => /\.(ts|js)$/.test(file) && !/\.(d|test)\.(ts|js)$/.test(file),
  );
  return Promise.all(
    files.map(async (file) => {
      const module = (await import(pathToFileURL(join(dir, file)).href)) as { default: T };
      return module.default;
    }),
  );
}

export async function loadCommands(): Promise<Map<string, Command>> {
  for (const command of await importDefaults<Command>('commands')) {
    if (commands.has(command.data.name)) throw new Error(`Duplicate command: ${command.data.name}`);
    commands.set(command.data.name, command);
  }
  return commands;
}

export async function loadHandlers(client: Client): Promise<void> {
  await loadCommands();

  for (const component of await importDefaults<Component>('interactions')) {
    const key = componentKey(component.kind, component.id);
    if (components.has(key)) throw new Error(`Duplicate component handler: ${key}`);
    components.set(key, component);
  }

  for (const event of await importDefaults<Event>('events')) {
    const listener = (...args: unknown[]) =>
      void (async () => {
        try {
          await event.execute(...(args as ClientEvents[keyof ClientEvents]));
        } catch (err) {
          logger.error({ err, event: event.name }, 'Event handler failed');
        }
      })();
    if (event.once) client.once(event.name, listener);
    else client.on(event.name, listener);
  }

  logger.info({ commands: commands.size, components: components.size }, 'Handlers loaded');
}
