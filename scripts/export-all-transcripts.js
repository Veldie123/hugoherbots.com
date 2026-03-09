#!/usr/bin/env node
/**
 * Export all transcripts for user-ready videos from Supabase to local files.
 * Only exports transcripts that don't already exist locally.
 *
 * Usage: node --env-file=.env scripts/export-all-transcripts.js
 */
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const TRANSCRIPTS_DIR = path.join(__dirname, '../data/transcripts');

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

function loadVideoMapping() {
  const mappingPath = path.join(__dirname, '../config/video_mapping.json');
  const data = JSON.parse(fs.readFileSync(mappingPath, 'utf-8'));
  const map = new Map();
  for (const [fileName, video] of Object.entries(data.videos)) {
    const baseName = fileName.replace('.MP4', '').replace('.mp4', '');
    map.set(baseName, { id: video.id, fileName });
  }
  return map;
}

async function main() {
  const videoMap = loadVideoMapping();
  console.log(`Found ${videoMap.size} user-ready videos in video_mapping.json`);

  const existing = new Set();
  if (fs.existsSync(TRANSCRIPTS_DIR)) {
    for (const f of fs.readdirSync(TRANSCRIPTS_DIR)) {
      if (f.startsWith('MVI_') && f.endsWith('.txt')) {
        existing.add(f.replace('.txt', ''));
      }
    }
  }

  const missing = [...videoMap.keys()].filter(k => !existing.has(k));
  console.log(`Already have ${existing.size} local transcripts`);
  console.log(`Need to export ${missing.length} transcripts from Supabase`);

  if (missing.length === 0) {
    console.log('All transcripts already exist locally!');
    return;
  }

  const pool = new Pool({
    connectionString: buildConnectionString(),
    ssl: { rejectUnauthorized: false },
  });

  try {
    await pool.query('SELECT 1');
    console.log('Connected to Supabase');

    const result = await pool.query(`
      SELECT id, drive_file_name, video_title, transcript
      FROM video_ingest_jobs
      WHERE status = 'completed'
        AND transcript IS NOT NULL
        AND transcript != ''
    `);
    console.log(`Found ${result.rows.length} videos with transcripts in Supabase`);

    const dbTranscripts = new Map();
    for (const row of result.rows) {
      const fileName = row.drive_file_name || '';
      const match = fileName.match(/(MVI_\d+)/i);
      if (match) {
        dbTranscripts.set(match[1], row.transcript);
      }
    }

    const ragResult = await pool.query(`
      SELECT source_id, content
      FROM rag_documents
      WHERE doc_type = 'video_transcript'
        AND content IS NOT NULL
        AND content != ''
    `);
    console.log(`Found ${ragResult.rows.length} RAG transcript documents`);

    for (const row of ragResult.rows) {
      const match = (row.source_id || '').match(/(MVI_\d+)/i);
      if (match && !dbTranscripts.has(match[1])) {
        dbTranscripts.set(match[1], row.content);
      }
    }

    let exported = 0;
    let notFound = 0;
    for (const baseName of missing) {
      const transcript = dbTranscripts.get(baseName);
      if (transcript) {
        const outPath = path.join(TRANSCRIPTS_DIR, `${baseName}.txt`);
        fs.writeFileSync(outPath, transcript, 'utf-8');
        exported++;
        console.log(`  Exported: ${baseName}.txt (${transcript.length} chars)`);
      } else {
        notFound++;
        console.warn(`  NOT FOUND: ${baseName} — no transcript in Supabase`);
      }
    }

    console.log(`\nDone: ${exported} exported, ${notFound} not found`);

    const allVideoNames = [...videoMap.keys()];
    let totalAvailable = 0;
    for (const name of allVideoNames) {
      if (fs.existsSync(path.join(TRANSCRIPTS_DIR, `${name}.txt`))) totalAvailable++;
    }
    console.log(`Total transcripts available: ${totalAvailable}/${allVideoNames.length}`);
  } finally {
    await pool.end();
  }
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
