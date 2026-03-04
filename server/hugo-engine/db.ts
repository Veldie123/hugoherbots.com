import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from "@shared/schema";

function convertToPoolerUrl(directUrl: string): string {
  try {
    const url = new URL(directUrl);
    const hostMatch = url.hostname.match(/^db\.([a-z0-9]+)\.supabase\.co$/);
    if (!hostMatch) return directUrl;
    const projectRef = hostMatch[1];
    const password = decodeURIComponent(url.password);
    const region = process.env.SUPABASE_DB_REGION || 'aws-1-eu-west-3';
    return `postgresql://postgres.${projectRef}:${encodeURIComponent(password)}@${region}.pooler.supabase.com:5432/postgres`;
  } catch {
    return directUrl;
  }
}

function buildSupabaseConnectionString(): string | null {
  const supabaseConnStr = process.env.PostgreSQL_connection_string_supabase;
  const supabasePassword = process.env.SUPABASE_YOUR_PASSWORD;
  if (!supabaseConnStr) return null;
  let resolved = supabaseConnStr;
  if (supabasePassword && resolved.includes('[YOUR-PASSWORD]')) {
    resolved = resolved.replace('[YOUR-PASSWORD]', supabasePassword);
  }
  if (resolved.includes('[YOUR-PASSWORD]')) return null;
  return convertToPoolerUrl(resolved);
}

function getConnectionString(): { url: string; source: string } {
  const supabaseUrl = buildSupabaseConnectionString();
  if (supabaseUrl) {
    return { url: supabaseUrl, source: 'supabase-session-pooler' };
  }

  if (process.env.DATABASE_URL) {
    return { url: process.env.DATABASE_URL, source: 'local' };
  }

  throw new Error(
    "No database connection available. Set PostgreSQL_connection_string_supabase + SUPABASE_YOUR_PASSWORD, or DATABASE_URL.",
  );
}

const conn = getConnectionString();
const isSupabase = conn.source === 'supabase-session-pooler';

console.log(`[DB] Connecting to ${conn.source}`);

export const pool = new Pool({
  connectionString: conn.url,
  ssl: isSupabase ? { rejectUnauthorized: false } : undefined,
});
export const db = drizzle(pool, { schema });

pool.query('SELECT 1').then(() => {
  console.log(`[DB] Connection verified (${conn.source})`);
}).catch((err: Error) => {
  console.error(`[DB] Connection test FAILED (${conn.source}): ${err.message}`);
  if (isSupabase && process.env.DATABASE_URL) {
    console.log('[DB] TIP: Fix SUPABASE_YOUR_PASSWORD secret to use Supabase. Currently falling back is not possible after pool creation.');
  }
});

pool.query(`
  CREATE TABLE IF NOT EXISTS config_proposals (
    id SERIAL PRIMARY KEY,
    proposed_by TEXT DEFAULT 'hugo',
    type TEXT NOT NULL,
    field TEXT,
    current_value TEXT,
    proposed_value TEXT NOT NULL,
    reason TEXT,
    status TEXT DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT now(),
    reviewed_at TIMESTAMPTZ,
    reviewed_by TEXT
  )
`).catch((err: Error) => console.warn('[DB] config_proposals table check failed:', err.message));

pool.query(`
  CREATE TABLE IF NOT EXISTS admin_onboarding_progress (
    id SERIAL PRIMARY KEY,
    admin_user_id TEXT,
    module TEXT,
    item_key TEXT,
    item_name TEXT,
    status TEXT DEFAULT 'pending',
    feedback_text TEXT,
    correction_id INTEGER,
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(admin_user_id, module, item_key)
  )
`).then(() => {
  console.log('[DB] admin_onboarding_progress table ensured');
}).catch((err: Error) => console.warn('[DB] admin_onboarding_progress table check failed:', err.message));

pool.query(`
  CREATE UNIQUE INDEX IF NOT EXISTS idx_onboarding_user_module_key
  ON admin_onboarding_progress (admin_user_id, module, item_key)
`).catch(() => {});

pool.query(`
  CREATE TABLE IF NOT EXISTS admin_corrections (
    id SERIAL PRIMARY KEY,
    analysis_id VARCHAR(255),
    type VARCHAR(100) NOT NULL,
    field VARCHAR(100) NOT NULL,
    original_value TEXT,
    new_value TEXT NOT NULL,
    context TEXT,
    submitted_by VARCHAR(100) DEFAULT 'admin',
    status VARCHAR(20) DEFAULT 'pending',
    reviewed_by VARCHAR(100),
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    source VARCHAR(100) DEFAULT 'analysis',
    target_file VARCHAR(255),
    target_key VARCHAR(255),
    original_json TEXT,
    new_json TEXT
  )
`).then(() => {
  console.log('[DB] admin_corrections table ensured');
}).catch((err: Error) => console.warn('[DB] admin_corrections table check failed:', err.message));

pool.query(`
  CREATE TABLE IF NOT EXISTS admin_notifications (
    id SERIAL PRIMARY KEY,
    type VARCHAR(100) NOT NULL,
    title VARCHAR(500) NOT NULL,
    message TEXT,
    category VARCHAR(100) DEFAULT 'content',
    severity VARCHAR(20) DEFAULT 'info',
    related_id INTEGER,
    related_page VARCHAR(100),
    read BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
  )
`).then(() => {
  console.log('[DB] admin_notifications table ensured');
}).catch((err: Error) => console.warn('[DB] admin_notifications table check failed:', err.message));
