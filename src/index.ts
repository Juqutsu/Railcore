import { Client, GatewayIntentBits, Partials } from 'discord.js';
import { prisma } from './database/client.js';
import { env } from './env.js';
import { loadHandlers } from './handlers.js';
import { logger } from './utils/logger.js';

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
  // Lets the server log see edits/deletes of messages and leaves of members that aren't cached.
  partials: [Partials.Message, Partials.GuildMember],
});

let shuttingDown = false;

async function shutdown(reason: string, exitCode = 0): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info({ reason }, 'Shutting down');
  setTimeout(() => process.exit(1), 10_000).unref();
  try {
    await client.destroy();
    await prisma.$disconnect();
  } catch (err) {
    logger.error({ err }, 'Error during shutdown');
    exitCode = 1;
  }
  process.exit(exitCode);
}

process.once('SIGINT', () => void shutdown('SIGINT'));
process.once('SIGTERM', () => void shutdown('SIGTERM'));
process.on('unhandledRejection', (err) => logger.error({ err }, 'Unhandled promise rejection'));
process.on('uncaughtException', (err) => {
  logger.fatal({ err }, 'Uncaught exception');
  void shutdown('uncaughtException', 1);
});

try {
  // $connect() is lazy with driver adapters; a real query fails fast on a bad DATABASE_URL.
  await prisma.$queryRaw`SELECT 1`;
  await loadHandlers(client);
  await client.login(env.DISCORD_BOT_TOKEN);
} catch (err) {
  const hint =
    err instanceof Error && /disallowed intents/i.test(err.message)
      ? 'Enable the Server Members and Message Content intents: Developer Portal → your app → Bot → Privileged Gateway Intents'
      : undefined;
  logger.fatal({ err, hint }, 'Startup failed');
  await shutdown('startup failure', 1);
}
