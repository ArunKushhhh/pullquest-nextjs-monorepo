import { Redis } from 'ioredis';
import { config } from './env.js';

export const connection = new Redis(config.REDIS_URL, {
  maxRetriesPerRequest: null, // Required by BullMQ
});

connection.on('connect', () => {
  console.log('[Worker Redis]: Connected to Redis server successfully.');
});

connection.on('error', (err) => {
  console.error('[Worker Redis]: Connection error:', err);
});
