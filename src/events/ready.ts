import { ActivityType, Events } from 'discord.js';
import { defineEvent } from '../handlers.js';
import { t } from '../text.js';
import { logger } from '../utils/logger.js';

export default defineEvent({
  name: Events.ClientReady,
  once: true,
  execute(client) {
    client.user.setActivity(t.presence, { type: ActivityType.Watching });
    logger.info({ user: client.user.tag, guilds: client.guilds.cache.size }, 'Railcore is online');
  },
});
