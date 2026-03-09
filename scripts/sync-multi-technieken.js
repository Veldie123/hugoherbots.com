#!/usr/bin/env node
/**
 * Sync multi-technique analysis results to Supabase.
 * Updates video_ingest_jobs.detected_technieken JSONB column.
 *
 * Usage: node --env-file=.env scripts/sync-multi-technieken.js
 */
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

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

// Multi-technique analysis results from transcript review
// Compiled from 5 parallel agent analyses of all 47 video transcripts
// Cleaned: max 5 per video, single is_primary, sorted by confidence desc
const ANALYSIS_RESULTS = [
  // Batch 1 (videos 1-10)
  {"file":"MVI_0464","technieken":[{"techniek_id":"2.1","confidence":0.50,"source":"manual_review","is_primary":true},{"techniek_id":"0.1","confidence":0.40,"source":"manual_review","is_primary":false},{"techniek_id":"3.2","confidence":0.40,"source":"manual_review","is_primary":false},{"techniek_id":"4.3","confidence":0.30,"source":"manual_review","is_primary":false},{"techniek_id":"1.1","confidence":0.30,"source":"manual_review","is_primary":false}]},
  {"file":"MVI_0519","technieken":[{"techniek_id":"2.1.1.2","confidence":0.90,"source":"manual_review","is_primary":true},{"techniek_id":"2.1.1.8","confidence":0.60,"source":"manual_review","is_primary":false},{"techniek_id":"2.1.1.6","confidence":0.50,"source":"manual_review","is_primary":false},{"techniek_id":"1.1","confidence":0.30,"source":"manual_review","is_primary":false}]},
  {"file":"MVI_0526","technieken":[{"techniek_id":"1.3","confidence":0.95,"source":"manual_review","is_primary":true},{"techniek_id":"2.1","confidence":0.40,"source":"manual_review","is_primary":false},{"techniek_id":"1.1","confidence":0.30,"source":"manual_review","is_primary":false}]},
  {"file":"MVI_0538","technieken":[{"techniek_id":"0.1","confidence":0.90,"source":"manual_review","is_primary":true},{"techniek_id":"0.4","confidence":0.90,"source":"manual_review","is_primary":false},{"techniek_id":"0.2","confidence":0.80,"source":"manual_review","is_primary":false},{"techniek_id":"0.3","confidence":0.70,"source":"manual_review","is_primary":false},{"techniek_id":"0.5","confidence":0.50,"source":"manual_review","is_primary":false}]},
  {"file":"MVI_0565","technieken":[{"techniek_id":"4.2","confidence":0.80,"source":"manual_review","is_primary":true},{"techniek_id":"4.2.3","confidence":0.70,"source":"manual_review","is_primary":false},{"techniek_id":"4.2.5","confidence":0.60,"source":"manual_review","is_primary":false},{"techniek_id":"4.2.2","confidence":0.60,"source":"manual_review","is_primary":false},{"techniek_id":"2.1.1.7","confidence":0.50,"source":"manual_review","is_primary":false}]},
  {"file":"MVI_0568","technieken":[{"techniek_id":"1.1","confidence":0.90,"source":"manual_review","is_primary":true},{"techniek_id":"2.3","confidence":0.60,"source":"manual_review","is_primary":false},{"techniek_id":"3.4","confidence":0.50,"source":"manual_review","is_primary":false}]},
  {"file":"MVI_0569","technieken":[{"techniek_id":"1.1","confidence":0.60,"source":"manual_review","is_primary":true},{"techniek_id":"2.1.1.7","confidence":0.60,"source":"manual_review","is_primary":false},{"techniek_id":"2.1","confidence":0.50,"source":"manual_review","is_primary":false},{"techniek_id":"4.2.3","confidence":0.40,"source":"manual_review","is_primary":false}]},
  {"file":"MVI_0572","technieken":[{"techniek_id":"4.3.3","confidence":0.90,"source":"manual_review","is_primary":true},{"techniek_id":"3.2","confidence":0.70,"source":"manual_review","is_primary":false},{"techniek_id":"3.4","confidence":0.70,"source":"manual_review","is_primary":false},{"techniek_id":"3.7","confidence":0.50,"source":"manual_review","is_primary":false},{"techniek_id":"2.1.1.5","confidence":0.50,"source":"manual_review","is_primary":false}]},
  {"file":"MVI_0636","technieken":[{"techniek_id":"4.1","confidence":0.95,"source":"manual_review","is_primary":true},{"techniek_id":"4.INDIEN","confidence":0.90,"source":"manual_review","is_primary":false},{"techniek_id":"4.3.4","confidence":0.80,"source":"manual_review","is_primary":false},{"techniek_id":"4.3","confidence":0.70,"source":"manual_review","is_primary":false},{"techniek_id":"1.2","confidence":0.65,"source":"manual_review","is_primary":false}]},
  {"file":"MVI_0645","technieken":[{"techniek_id":"4.2.6","confidence":0.80,"source":"manual_review","is_primary":true},{"techniek_id":"1.1","confidence":0.70,"source":"manual_review","is_primary":false},{"techniek_id":"4.2.2","confidence":0.60,"source":"manual_review","is_primary":false},{"techniek_id":"4.2.5","confidence":0.60,"source":"manual_review","is_primary":false},{"techniek_id":"4.3","confidence":0.50,"source":"manual_review","is_primary":false}]},
  // Batch 2 (videos 11-20)
  {"file":"MVI_0672","technieken":[{"techniek_id":"0.4","confidence":0.70,"source":"manual_review","is_primary":true},{"techniek_id":"2.1","confidence":0.30,"source":"manual_review","is_primary":false}]},
  {"file":"MVI_0908","technieken":[{"techniek_id":"4.2","confidence":0.95,"source":"manual_review","is_primary":true},{"techniek_id":"4.1","confidence":0.90,"source":"manual_review","is_primary":false},{"techniek_id":"4.2.1","confidence":0.60,"source":"manual_review","is_primary":false},{"techniek_id":"4.2.2","confidence":0.50,"source":"manual_review","is_primary":false},{"techniek_id":"4.2.3","confidence":0.50,"source":"manual_review","is_primary":false}]},
  {"file":"MVI_0915","technieken":[{"techniek_id":"4.2.1","confidence":0.95,"source":"manual_review","is_primary":true},{"techniek_id":"4.1","confidence":0.70,"source":"manual_review","is_primary":false},{"techniek_id":"4.3.4","confidence":0.40,"source":"manual_review","is_primary":false}]},
  {"file":"MVI_0916","technieken":[{"techniek_id":"4.2.2","confidence":0.95,"source":"manual_review","is_primary":true},{"techniek_id":"2.4","confidence":0.70,"source":"manual_review","is_primary":false},{"techniek_id":"2.1","confidence":0.60,"source":"manual_review","is_primary":false},{"techniek_id":"4.1","confidence":0.40,"source":"manual_review","is_primary":false}]},
  {"file":"MVI_0921","technieken":[{"techniek_id":"4.2.3","confidence":0.95,"source":"manual_review","is_primary":true},{"techniek_id":"2.4","confidence":0.70,"source":"manual_review","is_primary":false},{"techniek_id":"2.1","confidence":0.60,"source":"manual_review","is_primary":false},{"techniek_id":"3.1","confidence":0.40,"source":"manual_review","is_primary":false},{"techniek_id":"2.1.1","confidence":0.40,"source":"manual_review","is_primary":false}]},
  {"file":"MVI_0927","technieken":[{"techniek_id":"4.2.4","confidence":0.95,"source":"manual_review","is_primary":true},{"techniek_id":"3.6","confidence":0.70,"source":"manual_review","is_primary":false},{"techniek_id":"2.1","confidence":0.60,"source":"manual_review","is_primary":false},{"techniek_id":"3.4","confidence":0.50,"source":"manual_review","is_primary":false},{"techniek_id":"2.3","confidence":0.40,"source":"manual_review","is_primary":false}]},
  {"file":"MVI_0932","technieken":[{"techniek_id":"2.1","confidence":0.90,"source":"manual_review","is_primary":true},{"techniek_id":"2.2","confidence":0.70,"source":"manual_review","is_primary":false},{"techniek_id":"2.3","confidence":0.70,"source":"manual_review","is_primary":false},{"techniek_id":"2.4","confidence":0.70,"source":"manual_review","is_primary":false}]},
  {"file":"MVI_0936","technieken":[{"techniek_id":"2.1","confidence":0.90,"source":"manual_review","is_primary":true},{"techniek_id":"2.2","confidence":0.90,"source":"manual_review","is_primary":false},{"techniek_id":"2.3","confidence":0.90,"source":"manual_review","is_primary":false},{"techniek_id":"2.4","confidence":0.90,"source":"manual_review","is_primary":false}]},
  {"file":"MVI_0937","technieken":[{"techniek_id":"2.1","confidence":0.95,"source":"manual_review","is_primary":true},{"techniek_id":"2.1.1","confidence":0.70,"source":"manual_review","is_primary":false},{"techniek_id":"2.1.2","confidence":0.70,"source":"manual_review","is_primary":false},{"techniek_id":"2.1.4","confidence":0.60,"source":"manual_review","is_primary":false},{"techniek_id":"2.1.5","confidence":0.60,"source":"manual_review","is_primary":false}]},
  {"file":"MVI_0940","technieken":[{"techniek_id":"2.1.1","confidence":0.95,"source":"manual_review","is_primary":true},{"techniek_id":"2.1.1.3","confidence":0.60,"source":"manual_review","is_primary":false},{"techniek_id":"2.1.1.4","confidence":0.60,"source":"manual_review","is_primary":false},{"techniek_id":"2.1.1.5","confidence":0.60,"source":"manual_review","is_primary":false},{"techniek_id":"2.1.6","confidence":0.40,"source":"manual_review","is_primary":false}]},
  // Batch 3 (videos 21-30)
  {"file":"MVI_0950","technieken":[{"techniek_id":"2.1.2","confidence":0.95,"source":"manual_review","is_primary":true},{"techniek_id":"2.1.1","confidence":0.55,"source":"manual_review","is_primary":false},{"techniek_id":"2.1.6","confidence":0.30,"source":"manual_review","is_primary":false}]},
  {"file":"MVI_0951","technieken":[{"techniek_id":"2.1.3","confidence":0.95,"source":"manual_review","is_primary":true},{"techniek_id":"2.1.1","confidence":0.60,"source":"manual_review","is_primary":false},{"techniek_id":"2.1.2","confidence":0.60,"source":"manual_review","is_primary":false},{"techniek_id":"2.4","confidence":0.35,"source":"manual_review","is_primary":false}]},
  {"file":"MVI_0957","technieken":[{"techniek_id":"2.1.4","confidence":0.95,"source":"manual_review","is_primary":true},{"techniek_id":"2.1.1","confidence":0.45,"source":"manual_review","is_primary":false},{"techniek_id":"2.1.2","confidence":0.40,"source":"manual_review","is_primary":false}]},
  {"file":"MVI_0960","technieken":[{"techniek_id":"2.1.5","confidence":0.95,"source":"manual_review","is_primary":true},{"techniek_id":"2.1.2","confidence":0.45,"source":"manual_review","is_primary":false},{"techniek_id":"2.1.6","confidence":0.40,"source":"manual_review","is_primary":false},{"techniek_id":"2.1.1","confidence":0.35,"source":"manual_review","is_primary":false}]},
  {"file":"MVI_0963","technieken":[{"techniek_id":"2.1.6","confidence":0.95,"source":"manual_review","is_primary":true},{"techniek_id":"3.1","confidence":0.50,"source":"manual_review","is_primary":false},{"techniek_id":"2.1","confidence":0.40,"source":"manual_review","is_primary":false}]},
  {"file":"MVI_0969","technieken":[{"techniek_id":"2.2","confidence":0.95,"source":"manual_review","is_primary":true},{"techniek_id":"2.1","confidence":0.50,"source":"manual_review","is_primary":false},{"techniek_id":"2.3","confidence":0.45,"source":"manual_review","is_primary":false},{"techniek_id":"2.1.6","confidence":0.35,"source":"manual_review","is_primary":false}]},
  {"file":"MVI_0971","technieken":[{"techniek_id":"2.3","confidence":0.95,"source":"manual_review","is_primary":true},{"techniek_id":"2.2","confidence":0.60,"source":"manual_review","is_primary":false},{"techniek_id":"2.1","confidence":0.40,"source":"manual_review","is_primary":false}]},
  {"file":"MVI_0972","technieken":[{"techniek_id":"2.4","confidence":0.92,"source":"manual_review","is_primary":true},{"techniek_id":"2.3","confidence":0.60,"source":"manual_review","is_primary":false},{"techniek_id":"2.2","confidence":0.55,"source":"manual_review","is_primary":false},{"techniek_id":"2.1","confidence":0.45,"source":"manual_review","is_primary":false}]},
  {"file":"MVI_0987","technieken":[{"techniek_id":"3.2","confidence":0.90,"source":"manual_review","is_primary":true},{"techniek_id":"3.3","confidence":0.85,"source":"manual_review","is_primary":false},{"techniek_id":"3.4","confidence":0.85,"source":"manual_review","is_primary":false},{"techniek_id":"2.4","confidence":0.60,"source":"manual_review","is_primary":false},{"techniek_id":"2.2","confidence":0.50,"source":"manual_review","is_primary":false}]},
  {"file":"MVI_0990","technieken":[{"techniek_id":"1.1","confidence":0.85,"source":"manual_review","is_primary":true},{"techniek_id":"1.2","confidence":0.75,"source":"manual_review","is_primary":false},{"techniek_id":"1.3","confidence":0.70,"source":"manual_review","is_primary":false},{"techniek_id":"1.4","confidence":0.65,"source":"manual_review","is_primary":false},{"techniek_id":"2.1.1","confidence":0.60,"source":"manual_review","is_primary":false}]},
  // Batch 4 (videos 31-40)
  {"file":"MVI_0992","technieken":[{"techniek_id":"2.1.1","confidence":0.90,"source":"manual_review","is_primary":true},{"techniek_id":"2.2","confidence":0.90,"source":"manual_review","is_primary":false},{"techniek_id":"2.3","confidence":0.85,"source":"manual_review","is_primary":false},{"techniek_id":"2.1.2","confidence":0.80,"source":"manual_review","is_primary":false},{"techniek_id":"2.1.1.3","confidence":0.75,"source":"manual_review","is_primary":false}]},
  {"file":"MVI_0993","technieken":[{"techniek_id":"2.2","confidence":0.90,"source":"manual_review","is_primary":true},{"techniek_id":"2.1.1","confidence":0.85,"source":"manual_review","is_primary":false},{"techniek_id":"2.3","confidence":0.85,"source":"manual_review","is_primary":false},{"techniek_id":"2.4","confidence":0.75,"source":"manual_review","is_primary":false},{"techniek_id":"2.1.2","confidence":0.70,"source":"manual_review","is_primary":false}]},
  {"file":"MVI_0994","technieken":[{"techniek_id":"2.2","confidence":0.90,"source":"manual_review","is_primary":true},{"techniek_id":"2.1.1","confidence":0.85,"source":"manual_review","is_primary":false},{"techniek_id":"2.3","confidence":0.85,"source":"manual_review","is_primary":false},{"techniek_id":"2.1.4","confidence":0.75,"source":"manual_review","is_primary":false},{"techniek_id":"0.5","confidence":0.70,"source":"manual_review","is_primary":false}]},
  {"file":"MVI_0997","technieken":[{"techniek_id":"2.1.1.4","confidence":0.90,"source":"manual_review","is_primary":true},{"techniek_id":"1.1","confidence":0.65,"source":"manual_review","is_primary":false},{"techniek_id":"1.2","confidence":0.65,"source":"manual_review","is_primary":false},{"techniek_id":"1.3","confidence":0.65,"source":"manual_review","is_primary":false},{"techniek_id":"1.4","confidence":0.60,"source":"manual_review","is_primary":false}]},
  {"file":"MVI_0998","technieken":[{"techniek_id":"2.1.1.4","confidence":0.90,"source":"manual_review","is_primary":true},{"techniek_id":"2.2","confidence":0.85,"source":"manual_review","is_primary":false},{"techniek_id":"2.3","confidence":0.80,"source":"manual_review","is_primary":false},{"techniek_id":"2.4","confidence":0.75,"source":"manual_review","is_primary":false},{"techniek_id":"3.6","confidence":0.40,"source":"manual_review","is_primary":false}]},
  {"file":"MVI_1000","technieken":[{"techniek_id":"2.1.1.4","confidence":0.90,"source":"manual_review","is_primary":true},{"techniek_id":"2.2","confidence":0.85,"source":"manual_review","is_primary":false},{"techniek_id":"2.3","confidence":0.80,"source":"manual_review","is_primary":false},{"techniek_id":"3.6","confidence":0.75,"source":"manual_review","is_primary":false},{"techniek_id":"2.4","confidence":0.70,"source":"manual_review","is_primary":false}]},
  {"file":"MVI_1006","technieken":[{"techniek_id":"2.1.1.4","confidence":0.90,"source":"manual_review","is_primary":true},{"techniek_id":"2.2","confidence":0.85,"source":"manual_review","is_primary":false},{"techniek_id":"2.4","confidence":0.75,"source":"manual_review","is_primary":false},{"techniek_id":"2.3","confidence":0.70,"source":"manual_review","is_primary":false},{"techniek_id":"4.1","confidence":0.60,"source":"manual_review","is_primary":false}]},
  {"file":"MVI_1011","technieken":[{"techniek_id":"2.1.1.4","confidence":0.90,"source":"manual_review","is_primary":true},{"techniek_id":"2.2","confidence":0.85,"source":"manual_review","is_primary":false},{"techniek_id":"2.3","confidence":0.80,"source":"manual_review","is_primary":false},{"techniek_id":"2.4","confidence":0.75,"source":"manual_review","is_primary":false},{"techniek_id":"2.1.2","confidence":0.65,"source":"manual_review","is_primary":false}]},
  {"file":"MVI_1012","technieken":[{"techniek_id":"2.1.1.5","confidence":0.95,"source":"manual_review","is_primary":true},{"techniek_id":"2.2","confidence":0.85,"source":"manual_review","is_primary":false},{"techniek_id":"2.4","confidence":0.85,"source":"manual_review","is_primary":false},{"techniek_id":"2.3","confidence":0.75,"source":"manual_review","is_primary":false},{"techniek_id":"2.1.1","confidence":0.70,"source":"manual_review","is_primary":false}]},
  {"file":"MVI_1013","technieken":[{"techniek_id":"2.1.1.6","confidence":0.80,"source":"manual_review","is_primary":true},{"techniek_id":"2.1.1.7","confidence":0.75,"source":"manual_review","is_primary":false},{"techniek_id":"2.1.1.8","confidence":0.75,"source":"manual_review","is_primary":false},{"techniek_id":"2.1.1.5","confidence":0.50,"source":"manual_review","is_primary":false},{"techniek_id":"4.1","confidence":0.45,"source":"manual_review","is_primary":false}]},
  // Batch 5 (videos 41-47)
  {"file":"MVI_1015","technieken":[{"techniek_id":"4.1","confidence":0.90,"source":"manual_review","is_primary":true},{"techniek_id":"4.INDIEN","confidence":0.85,"source":"manual_review","is_primary":false},{"techniek_id":"4.3.4","confidence":0.80,"source":"manual_review","is_primary":false},{"techniek_id":"3.7","confidence":0.70,"source":"manual_review","is_primary":false},{"techniek_id":"4.2.4","confidence":0.50,"source":"manual_review","is_primary":false}]},
  {"file":"MVI_1019","technieken":[{"techniek_id":"4.ABC","confidence":0.65,"source":"manual_review","is_primary":true},{"techniek_id":"2.3","confidence":0.55,"source":"manual_review","is_primary":false},{"techniek_id":"4.2.4","confidence":0.40,"source":"manual_review","is_primary":false}]},
  {"file":"MVI_1028","technieken":[{"techniek_id":"1.1","confidence":0.95,"source":"manual_review","is_primary":true},{"techniek_id":"1.2","confidence":0.50,"source":"manual_review","is_primary":false}]},
  {"file":"MVI_1029","technieken":[{"techniek_id":"1.2","confidence":0.92,"source":"manual_review","is_primary":true},{"techniek_id":"1.3","confidence":0.85,"source":"manual_review","is_primary":false},{"techniek_id":"1.1","confidence":0.55,"source":"manual_review","is_primary":false}]},
  {"file":"MVI_1031","technieken":[{"techniek_id":"1.3","confidence":0.95,"source":"manual_review","is_primary":true},{"techniek_id":"1.2","confidence":0.60,"source":"manual_review","is_primary":false},{"techniek_id":"1.1","confidence":0.40,"source":"manual_review","is_primary":false}]},
  {"file":"MVI_1033","technieken":[{"techniek_id":"2.1.1.2","confidence":0.90,"source":"manual_review","is_primary":true},{"techniek_id":"2.1.1.1","confidence":0.85,"source":"manual_review","is_primary":false},{"techniek_id":"2.1.1.5","confidence":0.65,"source":"manual_review","is_primary":false},{"techniek_id":"1.3","confidence":0.60,"source":"manual_review","is_primary":false},{"techniek_id":"1.4","confidence":0.45,"source":"manual_review","is_primary":false}]},
  {"file":"MVI_1039","technieken":[{"techniek_id":"4.2.5","confidence":0.95,"source":"manual_review","is_primary":true},{"techniek_id":"2.4","confidence":0.80,"source":"manual_review","is_primary":false},{"techniek_id":"2.2","confidence":0.80,"source":"manual_review","is_primary":false},{"techniek_id":"2.3","confidence":0.75,"source":"manual_review","is_primary":false},{"techniek_id":"4.2.6","confidence":0.55,"source":"manual_review","is_primary":false}]}
];

async function main() {
  console.log(`Syncing ${ANALYSIS_RESULTS.length} videos to Supabase...`);

  const pool = new Pool({
    connectionString: buildConnectionString(),
    ssl: { rejectUnauthorized: false },
  });

  try {
    await pool.query('SELECT 1');
    console.log('Connected to Supabase');

    // Check if detected_technieken column exists
    const colCheck = await pool.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'video_ingest_jobs' AND column_name = 'detected_technieken'
    `);
    if (colCheck.rows.length === 0) {
      console.log('Adding detected_technieken column...');
      await pool.query('ALTER TABLE video_ingest_jobs ADD COLUMN IF NOT EXISTS detected_technieken JSONB');
    }

    let updated = 0;
    let notFound = 0;
    let totalTags = 0;

    for (const video of ANALYSIS_RESULTS) {
      const fileName = video.file + '.MP4';

      // Find the video in video_ingest_jobs by drive_file_name
      const findResult = await pool.query(
        `SELECT id, drive_file_name FROM video_ingest_jobs WHERE drive_file_name LIKE $1 AND status != 'deleted' LIMIT 1`,
        [`%${video.file}%`]
      );

      if (findResult.rows.length === 0) {
        console.warn(`  NOT FOUND in DB: ${video.file}`);
        notFound++;
        continue;
      }

      const jobId = findResult.rows[0].id;
      const technieken = video.technieken;

      // Update detected_technieken JSONB
      const updateResult = await pool.query(
        `UPDATE video_ingest_jobs SET detected_technieken = $1::jsonb WHERE id = $2`,
        [JSON.stringify(technieken), jobId]
      );

      if (updateResult.rowCount > 0) {
        updated++;
        totalTags += technieken.length;
        const primary = technieken.find(t => t.is_primary);
        const others = technieken.filter(t => !t.is_primary).map(t => t.techniek_id).join(', ');
        console.log(`  ${video.file}: primary=${primary?.techniek_id} + [${others}] (${technieken.length} tags)`);
      }
    }

    console.log(`\nDone: ${updated} videos updated, ${notFound} not found`);
    console.log(`Total technique tags: ${totalTags} across ${updated} videos`);
    console.log(`Average tags per video: ${(totalTags / updated).toFixed(1)}`);
  } finally {
    await pool.end();
  }
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
