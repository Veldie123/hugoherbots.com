process.env.PORT = '3002';
process.env.NODE_ENV = 'production';

import path from 'path';
import { fileURLToPath } from 'url';

console.log('[HugoEngine] Starting Hugo Engine backend on port 3002...');
console.log('[HugoEngine] Environment:', {
  SUPABASE_URL: process.env.SUPABASE_URL ? 'set' : 'NOT SET',
  SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY ? 'set' : 'NOT SET',
  AI_INTEGRATIONS_OPENAI_BASE_URL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL ? 'set' : 'NOT SET',
  AI_INTEGRATIONS_OPENAI_API_KEY: process.env.AI_INTEGRATIONS_OPENAI_API_KEY ? 'set' : 'NOT SET',
  DATABASE_URL: process.env.DATABASE_URL ? 'set' : 'NOT SET',
});

import('./api').catch(err => {
  console.error('[HugoEngine] Failed to start:', err.message);
  console.error('[HugoEngine] Stack:', err.stack);
  process.exit(1);
});
