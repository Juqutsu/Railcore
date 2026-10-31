import { z } from 'zod';

const schema = z
  .object({
    DISCORD_BOT_TOKEN: z.string().min(1),
    TEST_SERVER_ID: z
      .string()
      .regex(/^\d{17,20}$/, 'must be a server ID')
      .optional(),
    PROD_SERVER_ID: z
      .string()
      .regex(/^\d{17,20}$/, 'must be a server ID')
      .optional(),
    DATABASE_URL: z.string().min(1),
    // Both are needed for /stats; without them the command says it isn't set up.
    ROBLOX_API_KEY: z.string().optional(),
    BLOXLINK_API_KEY: z.string().optional(),
    NODE_ENV: z.enum(['development', 'production']).default('development'),
    LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  })
  .refine((env) => !env.TEST_SERVER_ID || env.TEST_SERVER_ID !== env.PROD_SERVER_ID, {
    // The server lock would then allow one server and leave the other.
    message: 'must differ from TEST_SERVER_ID',
    path: ['PROD_SERVER_ID'],
  });

// Treat `KEY=` in .env as unset.
const input = Object.fromEntries(Object.entries(process.env).filter(([, value]) => value !== ''));
const parsed = schema.safeParse(input);

if (!parsed.success) {
  console.error(
    `Invalid environment variables (check your .env):\n${z.prettifyError(parsed.error)}`,
  );
  process.exit(1);
}

export const env = parsed.data;
