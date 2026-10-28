// Registers slash commands. Usage: --guild (TEST_SERVER_ID, instant) | --global (all servers), add --clear to remove them.
import { REST, Routes, type APIApplication } from 'discord.js';
import { env } from '../env.js';
import { loadCommands } from '../handlers.js';
import { logger } from '../utils/logger.js';

const args = process.argv.slice(2);
const scope = args.includes('--global') ? 'global' : args.includes('--guild') ? 'guild' : null;
const clear = args.includes('--clear');

try {
  if (!scope) throw new Error('Pass --guild or --global');
  const rest = new REST().setToken(env.DISCORD_BOT_TOKEN);
  const app = (await rest.get(Routes.currentApplication())) as APIApplication;

  let route: `/${string}`;
  if (scope === 'global') {
    route = Routes.applicationCommands(app.id);
  } else {
    if (!env.TEST_SERVER_ID) throw new Error('TEST_SERVER_ID must be set for --guild');
    route = Routes.applicationGuildCommands(app.id, env.TEST_SERVER_ID);
  }

  const body = clear ? [] : [...(await loadCommands()).values()].map((c) => c.data.toJSON());
  await rest.put(route, { body });
  logger.info(
    { scope, commands: body.map((c) => c.name) },
    clear ? 'Commands cleared' : 'Commands registered',
  );
  process.exit(0);
} catch (err) {
  logger.error({ err }, 'Command registration failed');
  process.exit(1);
}
