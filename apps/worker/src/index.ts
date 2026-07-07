import dotenv from 'dotenv';
import { APP_NAME } from '@pullquest/shared';

dotenv.config();

console.log(`[worker]: Starting background worker for ${APP_NAME}...`);
// Placeholder for worker logic
setInterval(() => {
  console.log('[worker]: Worker heartbeat');
}, 10000);
