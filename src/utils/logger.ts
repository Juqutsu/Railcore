import { pino } from 'pino';
import { env } from '../env.js';

export const logger = pino({
  level: env.LOG_LEVEL,
  // Discord REST errors carry the request URL, which holds live interaction tokens.
  redact: ['err.url', 'err.requestBody'],
  transport:
    env.NODE_ENV === 'development'
      ? {
          target: 'pino-pretty',
          options: { translateTime: 'SYS:HH:MM:ss', ignore: 'pid,hostname' },
        }
      : undefined,
});
