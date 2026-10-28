import { prisma } from '../database/client.js';
import type { GuildConfig } from '../generated/prisma/client.js';

export type ConfigPatch = Partial<Omit<GuildConfig, 'guildId' | 'updatedAt'>>;

// ponytail: in-memory cache assumes this process is the only writer; drop it if you ever run several bot processes.
const cache = new Map<string, GuildConfig>();

export async function getConfig(guildId: string): Promise<GuildConfig> {
  const cached = cache.get(guildId);
  if (cached) return cached;
  const config = await prisma.guildConfig.upsert({
    where: { guildId },
    create: { guildId },
    update: {},
  });
  cache.set(guildId, config);
  return config;
}

export async function updateConfig(guildId: string, patch: ConfigPatch): Promise<GuildConfig> {
  const config = await prisma.guildConfig.upsert({
    where: { guildId },
    create: { guildId, ...patch },
    update: patch,
  });
  cache.set(guildId, config);
  return config;
}
