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
    return `postgresql://postgres.${projectRef}:${encodeURIComponent(password)}@aws-0-eu-central-1.pooler.supabase.com:6543/postgres`;
  } catch {
    return directUrl;
  }
}

function getConnectionString(): string {
  const supabaseConnStr = process.env.PostgreSQL_connection_string_supabase;
  const supabasePassword = process.env.SUPABASE_YOUR_PASSWORD;

  if (supabaseConnStr) {
    let resolved = supabaseConnStr;
    if (supabasePassword && resolved.includes('[YOUR-PASSWORD]')) {
      resolved = resolved.replace('[YOUR-PASSWORD]', supabasePassword);
    }

    if (!resolved.includes('[YOUR-PASSWORD]')) {
      resolved = convertToPoolerUrl(resolved);
      console.log('[DB] Using Supabase PostgreSQL connection (pooler)');
      return resolved;
    }
  }

  if (process.env.DATABASE_URL) {
    console.log('[DB] Falling back to local DATABASE_URL');
    return process.env.DATABASE_URL;
  }

  throw new Error(
    "No database connection available. Set PostgreSQL_connection_string_supabase + SUPABASE_YOUR_PASSWORD, or DATABASE_URL.",
  );
}

const connectionString = getConnectionString();

export const pool = new Pool({ connectionString, ssl: connectionString.includes('supabase') ? { rejectUnauthorized: false } : undefined });
export const db = drizzle(pool, { schema });

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
