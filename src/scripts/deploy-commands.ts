// Registers slash commands. Usage: --guild (TEST_SERVER_ID) | --prod (PROD_SERVER_ID) | --global
// (all servers); the server ones are instant. Add --clear to remove them.
import { REST, Routes, type APIApplication } from 'discord.js';
import { env } from '../env.js';
import { loadCommands } from '../handlers.js';
import { logger } from '../utils/logger.js';

const args = process.argv.slice(2);
const scope = (['--global', '--guild', '--prod'] as const).find((flag) => args.includes(flag));
const clear = args.includes('--clear');

try {
  if (!scope) throw new Error('Pass --guild, --prod or --global');
  const rest = new REST().setToken(env.DISCORD_BOT_TOKEN);
  const app = (await rest.get(Routes.currentApplication())) as APIApplication;

  let route: `/${string}`;
  if (scope === '--global') {
    route = Routes.applicationCommands(app.id);
  } else {
    const [name, serverId] =
      scope === '--prod'
        ? ['PROD_SERVER_ID', env.PROD_SERVER_ID]
        : ['TEST_SERVER_ID', env.TEST_SERVER_ID];
    if (!serverId) throw new Error(`${name} must be set for ${scope}`);
    route = Routes.applicationGuildCommands(app.id, serverId);
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
