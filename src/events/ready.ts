import { ActivityType, Events, RESTEvents } from 'discord.js';
import { defineEvent } from '../handlers.js';
import { leaveForeignGuilds, servedScope } from '../services/guildLock.js';
import { startServerStats } from '../services/serverStats.js';
import { startTicketReminders } from '../services/ticketReminders.js';
import { startXpRoleSync } from '../services/xpRoleSync.js';
import { t } from '../text.js';
import { logger } from '../utils/logger.js';

export default defineEvent({
  name: Events.ClientReady,
  once: true,
  execute(client) {
    client.user.setActivity(t.presence, { type: ActivityType.Watching });
    // discord.js waits out rate limits silently; this makes them visible, e.g. on channel renames.
    client.rest.on(RESTEvents.RateLimited, (info) =>
      logger.warn(
        { route: info.route, method: info.method, retryAfterMs: info.retryAfter },
        'Discord rate limit',
      ),
    );
    startTicketReminders(client);
    startXpRoleSync(client);
    startServerStats(client);
    void leaveForeignGuilds(client);
    logger.info({ serving: servedScope() }, 'Handling events for this server only');
    logger.info({ user: client.user.tag, guilds: client.guilds.cache.size }, 'Railcore is online');
  },
});
