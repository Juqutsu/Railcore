import { ActivityType, Events } from 'discord.js';
import { defineEvent } from '../handlers.js';
import { leaveForeignGuilds, servedScope } from '../services/guildLock.js';
import { startTicketReminders } from '../services/ticketReminders.js';
import { startXpRoleSync } from '../services/xpRoleSync.js';
import { t } from '../text.js';
import { logger } from '../utils/logger.js';

export default defineEvent({
  name: Events.ClientReady,
  once: true,
  execute(client) {
    client.user.setActivity(t.presence, { type: ActivityType.Watching });
    startTicketReminders(client);
    startXpRoleSync(client);
    void leaveForeignGuilds(client);
    logger.info({ serving: servedScope() }, 'Handling events for this server only');
    logger.info({ user: client.user.tag, guilds: client.guilds.cache.size }, 'Railcore is online');
  },
});
