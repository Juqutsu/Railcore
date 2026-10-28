import { Events } from 'discord.js';
import { defineEvent } from '../handlers.js';

// Same member cache as guildAvailable.ts, for servers the bot joins while running.
export default defineEvent({
  name: Events.GuildCreate,
  async execute(guild) {
    await guild.members.fetch();
  },
});
