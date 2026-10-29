import { existsSync } from 'node:fs';
import { defineConfig, env } from 'prisma/config';

// The Prisma CLI doesn't read .env itself. In Docker there is no .env; compose passes real env vars.
if (existsSync('.env')) process.loadEnvFile();

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  datasource: { url: env('DATABASE_URL') },
});
