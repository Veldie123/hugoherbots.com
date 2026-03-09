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
  // Check actual admin_notifications schema
  console.log('=== admin_notifications COLUMNS ===');
  const cols = await pool.query(`
    SELECT column_name, data_type, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_name = 'admin_notifications'
    ORDER BY ordinal_position
  `);
  console.table(cols.rows);

  // Check admin_corrections schema
  console.log('\n=== admin_corrections COLUMNS ===');
  const ccols = await pool.query(`
    SELECT column_name, data_type, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_name = 'admin_corrections'
    ORDER BY ordinal_position
  `);
  console.table(ccols.rows);

  // Test INSERT with actual related_id (integer)
  console.log('\n=== TEST INSERT WITH related_id=999 ===');
  try {
    const r = await pool.query(
      `INSERT INTO admin_notifications (type, title, message, category, severity, related_id, related_page)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
      ['test', 'Test with related_id', 'test', 'content', 'info', 999, 'admin-config-review']
    );
    console.log('SUCCESS, id:', r.rows[0]?.id);
    await pool.query('DELETE FROM admin_notifications WHERE id = $1', [r.rows[0]?.id]);
    console.log('Cleaned up');
  } catch (err) {
    console.error('FAILED:', err.message);
    console.error('Code:', err.code, 'Detail:', err.detail);
  }

  // Test with a very long message (like the real one)
  console.log('\n=== TEST INSERT WITH LONG MESSAGE ===');
  const longMsg = 'Hugo heeft 1.1 - Koopklimaat creëren gewijzigd van "(leeg)" naar "very long value here '.padEnd(600, 'x') + '". Bron: technique_edit';
  try {
    const r = await pool.query(
      `INSERT INTO admin_notifications (type, title, message, category, severity, related_id, related_page)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
      ['correction_submitted', 'Techniek 1.1 bewerkt door Hugo', longMsg, 'content', 'warning', 8, 'admin-config-review']
    );
    console.log('SUCCESS, id:', r.rows[0]?.id);
    await pool.query('DELETE FROM admin_notifications WHERE id = $1', [r.rows[0]?.id]);
    console.log('Cleaned up');
  } catch (err) {
    console.error('FAILED:', err.message);
    console.error('Code:', err.code, 'Detail:', err.detail);
  }

  // Check: what does the real newValue look like for correction #8?
  console.log('\n=== CORRECTION #8 VALUES ===');
  const c8 = await pool.query('SELECT id, type, field, original_value, length(new_value) as new_value_len, submitted_by, source FROM admin_corrections WHERE id = 8');
  console.table(c8.rows);

  // Try to simulate the exact INSERT that would happen for correction #8
  console.log('\n=== SIMULATE REAL INSERT FOR CORRECTION #8 ===');
  const c = (await pool.query('SELECT * FROM admin_corrections WHERE id = 8')).rows[0];
  if (c) {
    const submitter = c.submitted_by || 'admin';
    const corrSource = c.source || 'analysis';
    const titleMap = {
      'technique_edit': `Techniek ${c.field} bewerkt door ${submitter}`,
      'video_edit': `Video ${c.field} bewerkt door ${submitter}`,
    };
    const notifTitle = titleMap[corrSource] || `Correctie: ${c.field} door ${submitter}`;
    const notifSeverity = ['technique_edit', 'ssot_edit'].includes(corrSource) ? 'warning' : 'info';
    const notifMessage = `${submitter} heeft ${c.field} gewijzigd van "${c.original_value || '(leeg)'}" naar "${c.new_value}". Bron: ${corrSource}`;

    console.log('Title length:', notifTitle.length);
    console.log('Message length:', notifMessage.length);

    try {
      const r = await pool.query(
        `INSERT INTO admin_notifications (type, title, message, category, severity, related_id, related_page)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
        ['correction_submitted', notifTitle, notifMessage, 'content', notifSeverity, c.id, 'admin-config-review']
      );
      console.log('SUCCESS, id:', r.rows[0]?.id);
      // DON'T clean up — this is the notification that was missing!
      console.log('NOTE: Keeping this notification (it was the missing one)');
    } catch (err) {
      console.error('FAILED:', err.message);
      console.error('Code:', err.code, 'Detail:', err.detail);
      console.error('Full:', err);
    }
  }

  await pool.end();
}

check().catch(e => { console.error(e); process.exit(1); });
