#!/usr/bin/env node
const { Pool } = require('pg');
const fs = require('fs');

function buildConnectionString() {
  const connStr = process.env.PostgreSQL_connection_string_supabase;
  const password = process.env.SUPABASE_YOUR_PASSWORD;
  if (!connStr) throw new Error('PostgreSQL_connection_string_supabase not set');
  let resolved = connStr;
  if (password && resolved.includes('[YOUR-PASSWORD]')) {
    resolved = resolved.replace('[YOUR-PASSWORD]', password);
  }
  if (resolved.includes('[YOUR-PASSWORD]')) throw new Error('SUPABASE_YOUR_PASSWORD not set');
  try {
    const url = new URL(resolved);
    const hostMatch = url.hostname.match(/^db\.([a-z0-9]+)\.supabase\.co$/);
    if (hostMatch) {
      const projectRef = hostMatch[1];
      const pw = decodeURIComponent(url.password);
      const region = process.env.SUPABASE_DB_REGION || 'aws-1-eu-west-3';
      return `postgresql://postgres.${projectRef}:${encodeURIComponent(pw)}@${region}.pooler.supabase.com:5432/postgres`;
    }
  } catch {}
  return resolved;
}

async function main() {
  const data = JSON.parse(fs.readFileSync('/tmp/detected_technieken_with_source.json', 'utf-8'));
  console.log(`Syncing ${data.length} videos to Supabase...`);

  const pool = new Pool({ connectionString: buildConnectionString(), ssl: { rejectUnauthorized: false } });

  try {
    await pool.query('SELECT 1');
    console.log('Connected to Supabase');

    const jobs = await pool.query("SELECT id, drive_file_name FROM video_ingest_jobs WHERE status = 'completed'");
    const jobMap = new Map();
    for (const row of jobs.rows) {
      const match = (row.drive_file_name || '').match(/(MVI_\d+)/i);
      if (match) jobMap.set(match[1], row.id);
    }
    console.log(`Found ${jobMap.size} completed jobs in DB`);

    let updated = 0, notFound = 0;
    for (const video of data) {
      const jobId = jobMap.get(video.file);
      if (!jobId) {
        console.warn(`  NOT FOUND in DB: ${video.file}`);
        notFound++;
        continue;
      }

      await pool.query(
        'UPDATE video_ingest_jobs SET detected_technieken = $1, updated_at = NOW() WHERE id = $2',
        [JSON.stringify(video.technieken), jobId]
      );

      const primary = video.technieken.find(t => t.is_primary);
      if (primary) {
        await pool.query(
          'UPDATE video_ingest_jobs SET techniek_id = $1 WHERE id = $2',
          [primary.techniek_id, jobId]
        );
      }

      updated++;
    }

    console.log(`\nUpdated ${updated} videos, ${notFound} not found`);

    const verify = await pool.query("SELECT COUNT(*) as cnt FROM video_ingest_jobs WHERE detected_technieken IS NOT NULL AND detected_technieken::text != 'null'");
    console.log(`Videos with detected_technieken in DB: ${verify.rows[0].cnt}`);
  } finally {
    await pool.end();
  }
}

main().catch(err => { console.error('Error:', err.message); process.exit(1); });
