import { Events } from 'discord.js';
import { defineEvent } from '../handlers.js';
import { leaveIfForeign } from '../services/guildLock.js';

// Same member cache as guildAvailable.ts, for servers the bot joins while running.
export default defineEvent({
  name: Events.GuildCreate,
  async execute(guild) {
    // Someone invited the bot to a server it isn't meant for.
    if (await leaveIfForeign(guild)) return;
    await guild.members.fetch();
  },
});
