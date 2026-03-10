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
  LANGWATCH_API_KEY: process.env.LANGWATCH_API_KEY ? 'set' : 'NOT SET',
  ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY ? 'set' : 'NOT SET',
  ELEVENLABS_API_KEY: (process.env.ELEVENLABS_API_KEY || process.env.Elevenlabs_api_key) ? 'set' : 'NOT SET',
});

if (!process.env.ANTHROPIC_API_KEY) {
  console.error('⚠️  ANTHROPIC_API_KEY is LEEG — V3 chat en voice zullen NIET werken.');
  console.error('   Fix: unset ANTHROPIC_API_KEY && PORT=5001 node --env-file=.env server/production-server.js');
}

// Initialize LangWatch observability BEFORE importing api (which loads Anthropic SDK)
import { initObservability } from './v3/observability';

initObservability()
  .then(() => import('./api'))
  .catch(err => {
    console.error('[HugoEngine] Failed to start:', err.message);
    console.error('[HugoEngine] Stack:', err.stack);
    process.exit(1);
  });
