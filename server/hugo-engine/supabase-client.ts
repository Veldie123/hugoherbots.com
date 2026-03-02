import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.warn('⚠️ SUPABASE_URL or SUPABASE_ANON_KEY not set in environment variables');
}
if (!SUPABASE_SERVICE_ROLE_KEY) {
  console.error('🚨 SUPABASE_SERVICE_ROLE_KEY not set — server cannot perform admin operations. Set this env var before deploying.');
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

export const supabaseAnon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export { SUPABASE_URL, SUPABASE_ANON_KEY };
