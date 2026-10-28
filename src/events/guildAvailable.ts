import { Events } from 'discord.js';
import { defineEvent } from '../handlers.js';

// Fires for every guild at startup and again after outages or re-identifies. A full member cache
// lets the server log diff role and nickname changes and list roles when someone leaves.
// ponytail: fine up to tens of thousands of members; rethink for huge servers.
export default defineEvent({
  name: Events.GuildAvailable,
  async execute(guild) {
    await guild.members.fetch();
  },
});
