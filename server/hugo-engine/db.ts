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

  throw new Error(
    "No database connection available. Set PostgreSQL_connection_string_supabase + SUPABASE_YOUR_PASSWORD.",
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
  // Sync SERIAL sequences to prevent "duplicate key" errors after manual/imported inserts
  return Promise.all([
    pool.query(`SELECT setval('admin_notifications_id_seq', COALESCE((SELECT MAX(id) FROM admin_notifications), 0))`),
    pool.query(`SELECT setval('admin_corrections_id_seq', COALESCE((SELECT MAX(id) FROM admin_corrections), 0))`),
  ]).then(() => {
    console.log('[DB] SERIAL sequences synced');
  });
}).catch((err: Error) => console.warn('[DB] admin_notifications table check failed:', err.message));

// Add audience column to admin_notifications (superadmin/hugo/all filtering)
pool.query(`
  ALTER TABLE admin_notifications ADD COLUMN IF NOT EXISTS audience VARCHAR(50) DEFAULT 'all'
`).then(() => {
  console.log('[DB] admin_notifications audience column ensured');
}).catch((err: Error) => console.warn('[DB] audience column check failed:', err.message));

// Business plan review tracking
pool.query(`
  CREATE TABLE IF NOT EXISTS business_plan_reviews (
    id SERIAL PRIMARY KEY,
    review_notification_id INTEGER,
    status VARCHAR(20) DEFAULT 'pending',
    approved_at TIMESTAMPTZ,
    email_sent BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
  )
`).then(() => {
  console.log('[DB] business_plan_reviews table ensured');
}).catch((err: Error) => console.warn('[DB] business_plan_reviews table check failed:', err.message));

pool.query(`
  CREATE TABLE IF NOT EXISTS hero_text_cache (
    id SERIAL PRIMARY KEY,
    user_id TEXT NOT NULL,
    module TEXT NOT NULL,
    badge_label TEXT NOT NULL,
    title TEXT NOT NULL,
    subtitle TEXT NOT NULL,
    generated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    data_hash TEXT NOT NULL,
    UNIQUE(user_id, module)
  )
`).then(() => {
  console.log('[DB] hero_text_cache table ensured');
}).catch((err: Error) => console.warn('[DB] hero_text_cache table check failed:', err.message));
