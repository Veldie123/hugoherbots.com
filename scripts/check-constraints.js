const { Pool } = require('pg');

function buildUrl() {
  const connStr = process.env.PostgreSQL_connection_string_supabase;
  const pw = process.env.SUPABASE_YOUR_PASSWORD;
  if (!connStr) throw new Error('No connection string');
  let resolved = connStr;
  if (pw && resolved.includes('[YOUR-PASSWORD]')) {
    resolved = resolved.replace('[YOUR-PASSWORD]', pw);
  }
  const url = new URL(resolved);
  const hostMatch = url.hostname.match(/^db\.([a-z0-9]+)\.supabase\.co$/);
  if (hostMatch) {
    const ref = hostMatch[1];
    const password = decodeURIComponent(url.password);
    const region = process.env.SUPABASE_DB_REGION || 'aws-1-eu-west-3';
    return 'postgresql://postgres.' + ref + ':' + encodeURIComponent(password) + '@' + region + '.pooler.supabase.com:5432/postgres';
  }
  return resolved;
}

const pool = new Pool({ connectionString: buildUrl(), ssl: { rejectUnauthorized: false } });

async function check() {
  // Check character_maximum_length for admin_notifications columns
  console.log('=== admin_notifications COLUMN LENGTHS ===');
  const cols = await pool.query(`
    SELECT column_name, data_type, character_maximum_length, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_name = 'admin_notifications'
    ORDER BY ordinal_position
  `);
  console.table(cols.rows);

  // Check for any constraints or triggers
  console.log('\n=== CONSTRAINTS on admin_notifications ===');
  const constraints = await pool.query(`
    SELECT conname, contype, pg_get_constraintdef(oid) as def
    FROM pg_constraint
    WHERE conrelid = 'admin_notifications'::regclass
  `);
  console.table(constraints.rows);

  // Check for triggers
  console.log('\n=== TRIGGERS on admin_notifications ===');
  const triggers = await pool.query(`
    SELECT tgname, tgtype, tgenabled
    FROM pg_trigger
    WHERE tgrelid = 'admin_notifications'::regclass
    AND NOT tgisinternal
  `);
  console.table(triggers.rows.length > 0 ? triggers.rows : [{ result: 'No triggers' }]);

  // Check for RLS (Row Level Security) on admin_notifications
  console.log('\n=== RLS on admin_notifications ===');
  const rls = await pool.query(`
    SELECT relname, relrowsecurity, relforcerowsecurity
    FROM pg_class
    WHERE relname = 'admin_notifications'
  `);
  console.table(rls.rows);

  // Check indexes
  console.log('\n=== INDEXES on admin_notifications ===');
  const indexes = await pool.query(`
    SELECT indexname, indexdef
    FROM pg_indexes
    WHERE tablename = 'admin_notifications'
  `);
  console.table(indexes.rows);

  // Check all notifications to see which ones exist
  console.log('\n=== ALL admin_notifications ===');
  const all = await pool.query('SELECT id, type, title, read, created_at FROM admin_notifications ORDER BY id');
  console.table(all.rows);

  await pool.end();
}

check().catch(e => { console.error(e); process.exit(1); });
