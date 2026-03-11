#!/usr/bin/env node
/**
 * Sync Playback Order from Google Drive
 *
 * Doorloopt de Google Drive mapstructuur in NAAM-volgorde (= numerieke volgorde
 * van genummerde mappen) en werkt de `playback_order` van alle video's bij in
 * Supabase. Archief-map wordt altijd overgeslagen.
 *
 * Gebruik:
 *   node scripts/sync_drive_playback_order.js [--dry-run]
 *
 * Flags:
 *   --dry-run   Alleen preview tonen, niets opslaan in Supabase
 */

const { createClient } = require('@supabase/supabase-js');
const readline = require('readline');

// ─── Config ───────────────────────────────────────────────────────────────────

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DRY_RUN = process.argv.includes('--dry-run');

const HUGO_FOLDER_ID    = '1Oaww3IMBcFZ1teFvSoqAUART2B6Q6VrT';
const ARCHIEF_FOLDER_ID = '1E49dwl2hq_nhoe52bmK0DRn5ZhFdRGyq';

// Map-namen die worden overgeslagen (naast archief)
const SKIP_FOLDER_NAMES = new Set([
  'archief', 'archief 2', 'archief2', 'dubbels', 'image.canon', 'raw'
]);

// ─── Google Drive OAuth ───────────────────────────────────────────────────────

async function getGoogleDriveAccessToken() {
  const { google } = require('googleapis');
  const secret = process.env.GOOGLE_CLOUD_SECRET;
  if (!secret) throw new Error('GOOGLE_CLOUD_SECRET niet ingesteld — kan niet authenticeren met Google Drive');

  let keyData;
  try {
    keyData = JSON.parse(secret);
  } catch {
    try {
      keyData = JSON.parse(Buffer.from(secret, 'base64').toString());
    } catch {
      throw new Error('GOOGLE_CLOUD_SECRET is geen geldige JSON of base64');
    }
  }

  // Fix Node.js 24+ (OpenSSL 3.5): literal \n in PEM key must be real newlines
  if (keyData.private_key) {
    keyData.private_key = keyData.private_key.replace(/\\n/g, '\n');
  }

  const auth = new google.auth.GoogleAuth({
    credentials: keyData,
    scopes: ['https://www.googleapis.com/auth/drive.readonly'],
  });
  const client = await auth.getClient();
  const tokenResponse = await client.getAccessToken();
  if (!tokenResponse.token) throw new Error('Kon geen Google Drive access token verkrijgen via service account');
  console.log(`[GoogleAuth] Token verkregen voor ${keyData.client_email}`);
  return tokenResponse.token;
}

// ─── Drive API helpers ────────────────────────────────────────────────────────

async function driveList(query, fields, accessToken) {
  const results = [];
  let pageToken = null;
  do {
    const url = new URL('https://www.googleapis.com/drive/v3/files');
    url.searchParams.set('q', query);
    url.searchParams.set('fields', `nextPageToken,files(${fields})`);
    url.searchParams.set('pageSize', '1000');
    url.searchParams.set('orderBy', 'name');           // Sorteer op naam (numeriek werkt goed)
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

  return results;
}

async function listSubfolders(folderId, accessToken) {
  return driveList(
    `'${folderId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
    'id,name',
    accessToken
  );
}

async function listVideosInFolder(folderId, accessToken) {
  return driveList(
    `'${folderId}' in parents and mimeType contains 'video/' and trashed = false`,
    'id,name,size,modifiedTime',
    accessToken
  );
}

// ─── Titel afleiding van mapnaam ─────────────────────────────────────────────

function cleanFolderTitle(folderName) {
  let title = folderName || '';
  // Strip "Fase X - " prefix (top-level fase folders)
  title = title.replace(/^Fase\s+[\d.]+\s*-\s*/, '');
  // Strip numbering prefix (e.g., "A. 1 ", "2.1.3 ", "4.3.0 ")
  title = title.replace(/^(?:[A-Za-z]\.\s*)?[\d]+[\d.\s]*\s+/, '');
  // Clean double spaces
  title = title.replace(/\s{2,}/g, ' ').trim();
  return title;
}

// ─── Recursieve Drive traversal (namen gesorteerd) ────────────────────────────

async function traverseFolder(folderId, folderName, accessToken, depth = 0) {
  // Archief overslaan
  if (folderId === ARCHIEF_FOLDER_ID) return { videos: [], skipped: true };
  const nameLower = folderName.toLowerCase();
  if (SKIP_FOLDER_NAMES.has(nameLower)) {
    console.log(`${'  '.repeat(depth)}⏭  Overgeslagen: "${folderName}"`);
    return { videos: [], skipped: true };
  }

  const indent = '  '.repeat(depth);
  console.log(`${indent}📁 ${folderName || '(root)'}`);

  // Haal eerst de video's op in DEZE map (gesorteerd op naam)
  const videos = await listVideosInFolder(folderId, accessToken);
  // Attach parent folder info for title derivation
  for (let i = 0; i < videos.length; i++) {
    videos[i].parentFolderName = folderName;
    videos[i].siblingCount = videos.length;
    videos[i].siblingIndex = i;
  }
  if (videos.length > 0) {
    console.log(`${indent}   ${videos.length} video${videos.length !== 1 ? "'s" : ''}: ${videos.map(v => v.name).join(', ').substring(0, 100)}`);
  }

  // Dan alle submappen (al gesorteerd op naam door Drive API orderBy=name)
  const subfolders = await listSubfolders(folderId, accessToken);
  const subResults = [];
  for (const sub of subfolders) {
    const result = await traverseFolder(sub.id, sub.name, accessToken, depth + 1);
    if (!result.skipped) subResults.push(...result.videos);
  }

  return { videos: [...videos, ...subResults], skipped: false };
}

// ─── Confirm prompt ───────────────────────────────────────────────────────────

function confirm(message) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(message, (answer) => { rl.close(); resolve(answer); });
  });
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('🎬  HugoHerbots — Drive Afspeelvolgorde Sync');
  console.log('═'.repeat(50));
  if (DRY_RUN) console.log('⏸   DRY-RUN — geen wijzigingen opgeslagen\n');

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('❌  SUPABASE_URL of SUPABASE_SERVICE_ROLE_KEY ontbreekt');
    process.exit(1);
  }

  const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

  // ── Stap 1: Drive token ophalen ──────────────────────────────────────────
  console.log('🔑  Google Drive access token ophalen...');
  const accessToken = await getGoogleDriveAccessToken();
  console.log('✓   Token verkregen\n');

  // ── Stap 2: Alle video's in Supabase laden (indexed op drive_file_id) ────
  console.log('📦  Video\'s laden uit Supabase...');
  const { data: dbVideos, error: dbError } = await sb
    .from('video_ingest_jobs')
    .select('id, drive_file_id, video_title, drive_file_name, playback_order, is_hidden')
    .neq('status', 'deleted');

  if (dbError) { console.error('❌  Supabase fout:', dbError.message); process.exit(1); }

  const byFileId = {};
  for (const v of dbVideos) {
    if (v.drive_file_id) byFileId[v.drive_file_id] = v;
  }
  console.log(`✓   ${dbVideos.length} video's geladen, ${Object.keys(byFileId).length} met drive_file_id\n`);

  // ── Stap 3: Drive doorlopen ──────────────────────────────────────────────
  console.log('🗂   Google Drive doorlopen (gesorteerd op mapnaam)...\n');
  const { videos: driveVideos } = await traverseFolder(HUGO_FOLDER_ID, '(root)', accessToken, 0);
  console.log(`\n✓   ${driveVideos.length} video's gevonden in Drive\n`);

  // ── Stap 4: Volgorde + titels opstellen + preview ───────────────────────────
  console.log('═'.repeat(120));
  console.log('NIEUWE AFSPEELVOLGORDE + TITELS (afgeleid van mapnaam)');
  console.log('═'.repeat(120));
  console.log(` ${'#'.padStart(3)}  ${'Bestand'.padEnd(16)} ${'Oude titel'.padEnd(32)} ${'Nieuwe titel'.padEnd(42)} ${'Oud#'.padStart(4)} → ${'Nw#'.padStart(3)}`);
  console.log('─'.repeat(120));

  // DRIVE IS AUTHORITY: assign sequential playback_order + title from folder name
  const updates = [];
  let notFound = 0;
  let order = 1;

  for (const driveFile of driveVideos) {
    const dbVideo = byFileId[driveFile.id];
    if (!dbVideo) {
      console.log(`  ⚠️   Niet in DB: ${driveFile.name} (drive_file_id: ${driveFile.id})`);
      notFound++;
      continue;
    }

    // Derive title from parent folder name
    let newTitle = cleanFolderTitle(driveFile.parentFolderName || '');
    if (driveFile.siblingCount > 1) {
      newTitle += ` (deel ${driveFile.siblingIndex + 1})`;
    }

    const oldTitle = dbVideo.video_title || dbVideo.drive_file_name || '?';
    const oldOrder = dbVideo.playback_order;
    const orderChanged = oldOrder !== order;
    const titleChanged = oldTitle !== newTitle;
    const changed = orderChanged || titleChanged;

    const marker = changed ? ' ← WIJZIGING' : ' ✓';
    console.log(` ${String(order).padStart(3)}  ${driveFile.name.substring(0, 14).padEnd(16)} ${oldTitle.substring(0, 30).padEnd(32)} ${newTitle.substring(0, 40).padEnd(42)} ${String(oldOrder ?? '—').padStart(4)} → ${String(order).padStart(3)}${marker}`);

    updates.push({ id: dbVideo.id, playback_order: order, video_title: newTitle, oldTitle, changed, orderChanged, titleChanged });
    order++;
  }

  const orderChanges = updates.filter(u => u.orderChanged).length;
  const titleChanges = updates.filter(u => u.titleChanged).length;
  const totalChanges = updates.filter(u => u.changed).length;
  console.log('═'.repeat(120));
  console.log(`\nSamenvatting: ${updates.length} video's, ${orderChanges} volgorde-wijzigingen, ${titleChanges} titel-wijzigingen, ${notFound} niet gevonden in DB`);

  if (DRY_RUN) {
    console.log('\n⏸   Dry-run — niets opgeslagen. Verwijder --dry-run om te updaten.\n');
    return;
  }

  if (totalChanges === 0) {
    console.log('\n✅  Alles is al correct — geen updates nodig.\n');
    return;
  }

  await confirm(`\nDruk Enter om ${totalChanges} wijzigingen (${orderChanges} volgorde + ${titleChanges} titels) bij te werken in Supabase, of Ctrl+C om te annuleren: `);

  // ── Stap 5: Supabase updaten ──────────────────────────────────────────────
  console.log('\n📝  Supabase updaten...');
  let successCount = 0;
  let failCount = 0;

  // Only update changed rows, in chunks of 50
  const toUpdate = updates.filter(u => u.changed);
  const CHUNK_SIZE = 50;
  for (let i = 0; i < toUpdate.length; i += CHUNK_SIZE) {
    const chunk = toUpdate.slice(i, i + CHUNK_SIZE);
    await Promise.all(chunk.map(async (u) => {
      const { error } = await sb
        .from('video_ingest_jobs')
        .update({ playback_order: u.playback_order, video_title: u.video_title })
        .eq('id', u.id);
      if (error) {
        console.error(`  ❌  Fout bij ${u.oldTitle}: ${error.message}`);
        failCount++;
      } else {
        successCount++;
      }
    }));
    process.stdout.write(`\r  ✓  ${successCount}/${toUpdate.length} bijgewerkt...`);
  }

  console.log(`\n\n${'═'.repeat(50)}`);
  console.log(`✅  Klaar: ${successCount} bijgewerkt, ${failCount} mislukt`);
  console.log('\n🔄  Ververs de admin video-pagina om de nieuwe volgorde en titels te zien.\n');
}

main().catch((err) => {
  console.error('\n❌  Onverwachte fout:', err.message || err);
  process.exit(1);
});
