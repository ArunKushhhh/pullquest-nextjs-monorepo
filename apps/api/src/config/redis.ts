import { Redis } from 'ioredis';
import { config } from './env.js';

export const redis = new Redis(config.REDIS_URL, {
  maxRetriesPerRequest: null, // Required for BullMQ compatibility
});

redis.on('connect', () => {
  console.log('[Redis]: Connected to Redis server successfully.');
});

redis.on('error', (err) => {
  console.error('[Redis]: Connection error:', err);
});
