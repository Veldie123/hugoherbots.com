#!/usr/bin/env node
/**
 * Reconcile Drive File IDs
 *
 * Voor video's die in Drive bestaan maar niet gevonden worden via drive_file_id
 * (omdat het bestand ooit opnieuw geüpload is en een nieuw ID heeft gekregen):
 *
 * 1. Traverseer Drive in de juiste volgorde (orderBy=name)
 * 2. Voor elke video: zoek in DB op drive_file_name als drive_file_id niet matcht
 * 3. Update drive_file_id naar het huidige Drive ID
 * 4. Sla de Drive-positie op als playback_order
 *
 * Gebruik:
 *   node scripts/reconcile_drive_file_ids.js [--dry-run]
 */

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DRY_RUN = process.argv.includes('--dry-run');

const HUGO_FOLDER_ID    = '1Oaww3IMBcFZ1teFvSoqAUART2B6Q6VrT';
const ARCHIEF_FOLDER_ID = '1E49dwl2hq_nhoe52bmK0DRn5ZhFdRGyq';

const SKIP_FOLDER_NAMES = new Set([
  'archief', 'archief 2', 'archief2', 'dubbels', 'image.canon', 'raw'
]);

async function getGoogleDriveAccessToken() {
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const replIdentity = process.env.REPL_IDENTITY;
  const webRenewal = process.env.WEB_REPL_RENEWAL;

  if (!hostname) throw new Error('REPLIT_CONNECTORS_HOSTNAME niet beschikbaar');

  const xReplitToken = replIdentity ? `repl ${replIdentity}`
    : webRenewal ? `depl ${webRenewal}`
    : null;
  if (!xReplitToken) throw new Error('Replit connector credentials niet beschikbaar');

  const response = await fetch(
    `https://${hostname}/api/v2/connection?include_secrets=true&connector_names=google-drive`,
    { headers: { 'Accept': 'application/json', 'X_REPLIT_TOKEN': xReplitToken } }
  );

  const data = await response.json();
  const connection = (data.items || [])[0] || {};
  const settings = connection.settings || {};
  const accessToken = settings.access_token || settings.oauth?.credentials?.access_token;

  if (!accessToken) throw new Error('Google Drive niet verbonden');
  return accessToken;
}

async function driveList(query, fields, accessToken) {
  const results = [];
  let pageToken = null;
  do {
    const url = new URL('https://www.googleapis.com/drive/v3/files');
    url.searchParams.set('q', query);
    url.searchParams.set('fields', `nextPageToken,files(${fields})`);
    url.searchParams.set('pageSize', '1000');
    url.searchParams.set('orderBy', 'name');
    if (pageToken) url.searchParams.set('pageToken', pageToken);

    const resp = await fetch(url.toString(), {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });
    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`Drive API fout ${resp.status}: ${text.substring(0, 200)}`);
    }
    const data = await resp.json();
    results.push(...(data.files || []));
    pageToken = data.nextPageToken || null;
  } while (pageToken);

  results.sort((a, b) => a.name.localeCompare(b.name, 'nl', { numeric: true, sensitivity: 'base' }));
  return results;
}

async function traverseDrive(folderId, accessToken, depth = 0) {
  if (folderId === ARCHIEF_FOLDER_ID) return [];
  const results = [];
  const indent = '  '.repeat(depth);

  const videos = await driveList(
    `'${folderId}' in parents and mimeType contains 'video/' and trashed = false`,
    'id,name',
    accessToken
  );

  for (const v of videos) {
    results.push({ id: v.id, name: v.name });
  }

  const subfolders = await driveList(
    `'${folderId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
    'id,name',
    accessToken
  );

  for (const sf of subfolders) {
    if (sf.id === ARCHIEF_FOLDER_ID || SKIP_FOLDER_NAMES.has(sf.name.toLowerCase())) continue;
    const sub = await traverseDrive(sf.id, accessToken, depth + 1);
    results.push(...sub);
  }

  return results;
}

(async () => {
  console.log('🔧  HugoHerbots — Drive File ID Reconciliation');
  console.log('══════════════════════════════════════════════════');
  if (DRY_RUN) console.log('⏸   DRY-RUN — geen wijzigingen opgeslagen\n');

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('❌  SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY ontbreekt');
    process.exit(1);
  }

  const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

  // 1. Haal alle video_ingest_jobs op (drive_file_id + drive_file_name)
  console.log('📦  DB laden...');
  const { data: jobs, error: jobsErr } = await sb
    .from('video_ingest_jobs')
    .select('id, drive_file_id, drive_file_name, playback_order, status, mux_playback_id, video_title')
    .neq('status', 'deleted');

  if (jobsErr) throw new Error('DB fout: ' + jobsErr.message);
  console.log(`✓   ${jobs.length} video_ingest_jobs geladen`);

  // Index op drive_file_id voor snelle lookup
  const byFileId = new Map(jobs.map(j => [j.drive_file_id, j]));

  // Index op bestandsnaam → beste rij (voorkeur: met mux_playback_id, anders eerste)
  const byFileName = new Map();
  for (const j of jobs) {
    if (!j.drive_file_name) continue;
    const name = j.drive_file_name.toUpperCase();
    const existing = byFileName.get(name);
    if (!existing) {
      byFileName.set(name, j);
    } else if (j.mux_playback_id && !existing.mux_playback_id) {
      byFileName.set(name, j); // Voorkeur voor rij met Mux-data
    }
  }

  // 2. Traverseer Drive
  console.log('\n🔑  Google Drive access token ophalen...');
  const accessToken = await getGoogleDriveAccessToken();
  console.log('✓   Token verkregen');
  console.log('\n🗂   Google Drive doorlopen (orderBy=name)...');
  const driveVideos = await traverseDrive(HUGO_FOLDER_ID, accessToken);
  console.log(`✓   ${driveVideos.length} video's gevonden in Drive\n`);

  // 3. Reconcile: vergelijk Drive file_id met DB
  const repairs = [];
  const orderUpdates = [];
  let drivePosition = 0;

  for (const dv of driveVideos) {
    drivePosition++;
    const nameUpper = dv.name.toUpperCase();

    if (byFileId.has(dv.id)) {
      // File_id matcht — enkel playback_order controleren
      const dbRow = byFileId.get(dv.id);
      if (dbRow.playback_order !== drivePosition) {
        orderUpdates.push({ id: dbRow.id, newOrder: drivePosition, oldOrder: dbRow.playback_order, name: dv.name });
      }
    } else {
      // File_id matcht NIET — zoek op bestandsnaam
      const dbByName = byFileName.get(nameUpper);
      if (dbByName) {
        repairs.push({
          id: dbByName.id,
          name: dv.name,
          oldFileId: dbByName.drive_file_id,
          newFileId: dv.id,
          newOrder: drivePosition,
          oldOrder: dbByName.playback_order,
          hasVideo: !!dbByName.mux_playback_id
        });
      } else {
        console.log(`  ⚠️  Geen DB match voor ${dv.name} (drive_file_id: ${dv.id}) — Sync Drive eerst uitvoeren`);
      }
    }
  }

  console.log(`📊  Resultaat analyse:`);
  console.log(`    ${repairs.length} video's met verouderde drive_file_id`);
  console.log(`    ${orderUpdates.length} video's met verkeerde playback_order`);

  if (repairs.length > 0) {
    console.log('\n🔑  Drive file_id reparaties:');
    for (const r of repairs) {
      console.log(`  ${r.name}: order ${r.oldOrder} → ${r.newOrder}${r.hasVideo ? ' (heeft Mux-video)' : ''}`);
    }
  }
  if (orderUpdates.length > 0) {
    console.log('\n📋  Playback order updates:');
    for (const u of orderUpdates) {
      console.log(`  ${u.name}: ${u.oldOrder} → ${u.newOrder}`);
    }
  }

  if (DRY_RUN) {
    console.log('\n⏸   Dry-run — niets opgeslagen.');
    return;
  }

  // 4. Updates uitvoeren
  let repaired = 0;
  let reordered = 0;

  for (const r of repairs) {
    const { error } = await sb.from('video_ingest_jobs')
      .update({ drive_file_id: r.newFileId, playback_order: r.newOrder })
      .eq('id', r.id);
    if (error) {
      console.error(`  ❌  ${r.name}: ${error.message}`);
    } else {
      console.log(`  ✓  ${r.name} → drive_file_id bijgewerkt, order: ${r.newOrder}`);
      repaired++;
      // Verwijder ook de duplicate entry die nu een stale ID heeft (als er maar 1 van de naam is)
    }
  }

  for (const u of orderUpdates) {
    const { error } = await sb.from('video_ingest_jobs')
      .update({ playback_order: u.newOrder })
      .eq('id', u.id);
    if (error) {
      console.error(`  ❌  ${u.name}: ${error.message}`);
    } else {
      console.log(`  ✓  ${u.name} → order: ${u.newOrder}`);
      reordered++;
    }
  }

  console.log(`\n════════════════════════════════════════`);
  console.log(`✅  Klaar: ${repaired} file_ids gerepareerd, ${reordered} volgorden bijgewerkt`);
})().catch(err => {
  console.error('❌  Fout:', err.message);
  process.exit(1);
});
