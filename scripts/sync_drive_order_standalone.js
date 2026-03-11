#!/usr/bin/env node
/**
 * Standalone Drive sync script — runs as separate process spawned by video-processor.
 * Scans active Drive folders (skips archief), syncs video_ingest_jobs, sets playback_order.
 * 
 * Usage: node scripts/sync_drive_order_standalone.js <rootFolderId> [<rootFolderId2> ...]
 */

const { createClient } = require('@supabase/supabase-js');

const ROOT_FOLDER_IDS = process.argv.slice(2);
const ARCHIEF_FOLDER_ID = '1E49dwl2hq_nhoe52bmK0DRn5ZhFdRGyq';

if (!ROOT_FOLDER_IDS.length) {
  console.error('[StandaloneSync] No folder IDs provided');
  process.exit(1);
}

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

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

async function listDriveSubfolders(folderId, accessToken) {
  const folders = [];
  let pageToken = null;
  do {
    const query = `'${folderId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
    let url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=nextPageToken,files(id,name)&pageSize=1000&orderBy=name`;
    if (pageToken) url += `&pageToken=${pageToken}`;

    const resp = await fetch(url, { headers: { 'Authorization': `Bearer ${accessToken}` } });
    if (!resp.ok) throw new Error(`Drive API ${resp.status}: ${await resp.text()}`);
    const data = await resp.json();
    folders.push(...(data.files || []));
    pageToken = data.nextPageToken || null;
  } while (pageToken);

  return folders.sort((a, b) => a.name.localeCompare(b.name, 'nl', { numeric: true, sensitivity: 'base' }));
}

async function listDriveVideosInFolder(folderId, accessToken) {
  const videos = [];
  let pageToken = null;
  do {
    const query = `'${folderId}' in parents and mimeType != 'application/vnd.google-apps.folder' and trashed = false`;
    let url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=nextPageToken,files(id,name,mimeType,size,modifiedTime,parents)&pageSize=1000&orderBy=name`;
    if (pageToken) url += `&pageToken=${pageToken}`;

    const resp = await fetch(url, { headers: { 'Authorization': `Bearer ${accessToken}` } });
    if (!resp.ok) throw new Error(`Drive API ${resp.status}: ${await resp.text()}`);
    const data = await resp.json();
    const videoFiles = (data.files || []).filter(f => {
      const mime = (f.mimeType || '').toLowerCase();
      const name = (f.name || '').toLowerCase();
      return mime.startsWith('video/') || name.match(/\.(mp4|mov|avi|mkv|wmv|flv|webm|m4v|mts|m2ts)$/i);
    });
    for (const v of videoFiles) v.folderId = folderId;
    videos.push(...videoFiles);
    pageToken = data.nextPageToken || null;
  } while (pageToken);

  return videos.sort((a, b) => a.name.localeCompare(b.name, 'nl', { numeric: true, sensitivity: 'base' }));
}

// Load SSOT technique IDs for matching
const SSOT_TECHNIQUE_IDS = new Set();
try {
  const path = require('path');
  const fs = require('fs');
  const indexPath = path.join(__dirname, '..', 'config', 'ssot', 'technieken_index.json');
  const index = JSON.parse(fs.readFileSync(indexPath, 'utf8'));
  for (const id of Object.keys(index.technieken)) {
    SSOT_TECHNIQUE_IDS.add(id);
  }
  console.log(`[SSOT] ${SSOT_TECHNIQUE_IDS.size} technieken geladen`);
} catch (e) {
  console.warn('[SSOT] Kon technieken_index.json niet laden:', e.message);
}

function deriveFaseFromFolder(folderName) {
  const match = (folderName || '').match(/^Fase\s+([\d]+)/i);
  return match ? match[1] : null;
}

function deriveTechniqueId(folderName) {
  const match = (folderName || '').match(/^(\d[\d.]*\d)\s/);
  if (!match) return null;
  const id = match[1];
  if (SSOT_TECHNIQUE_IDS.has(id)) return id;
  const parts = id.split('.');
  while (parts.length > 1) {
    parts.pop();
    const parentId = parts.join('.');
    if (SSOT_TECHNIQUE_IDS.has(parentId)) return parentId;
  }
  return null;
}

function cleanFolderTitle(folderName) {
  let title = folderName || '';
  title = title.replace(/^Fase\s+[\d.]+\s*-\s*/, '');
  title = title.replace(/^(?:[A-Za-z]\.\s*)?[\d]+[\d.\s]*\s+/, '');
  title = title.replace(/\s{2,}/g, ' ').trim();
  return title;
}

async function scanFolder(folderId, folderName, accessToken, depth = 0, parentFase = null, parentTechId = null) {
  // Skip archief entirely
  if (folderId === ARCHIEF_FOLDER_ID) {
    console.log(`${'  '.repeat(depth)}[Scan] SKIPPING archief folder`);
    return [];
  }

  // Derive fase + techniek from this folder's name (inherit from parent if not found)
  const faseHere = deriveFaseFromFolder(folderName) || parentFase;
  const techHere = deriveTechniqueId(folderName) || parentTechId;

  const indent = '  '.repeat(depth);
  const videos = await listDriveVideosInFolder(folderId, accessToken);
  const subfolders = await listDriveSubfolders(folderId, accessToken);

  // Attach parent folder info for title + fase/techniek derivation
  for (let i = 0; i < videos.length; i++) {
    videos[i].parentFolderName = folderName;
    videos[i].siblingCount = videos.length;
    videos[i].siblingIndex = i;
    videos[i].faseFromDrive = faseHere;
    videos[i].techIdFromDrive = techHere;
  }

  console.log(`${indent}[Scan] ${videos.length} videos, ${subfolders.length} subfolders in ${folderName || folderId}${faseHere ? ` [F${faseHere}]` : ''}${techHere ? ` [T${techHere}]` : ''}`);

  let allVideos = [...videos];
  for (const sf of subfolders) {
    const isArchief = sf.id === ARCHIEF_FOLDER_ID || sf.name.toLowerCase() === 'archief';
    if (isArchief) {
      console.log(`${indent}[Scan] SKIPPING archief subfolder: ${sf.name}`);
      continue;
    }
    const sub = await scanFolder(sf.id, sf.name, accessToken, depth + 1, faseHere, techHere);
    allVideos = allVideos.concat(sub);
  }
  return allVideos;
}

async function main() {
  console.log('[StandaloneSync] Starting Drive sync for folders:', ROOT_FOLDER_IDS);

  const accessToken = await getGoogleDriveAccessToken();
  console.log('[StandaloneSync] Got Google Drive access token');

  let allActiveVideos = [];
  for (const folderId of ROOT_FOLDER_IDS) {
    const videos = await scanFolder(folderId, '(root)', accessToken);
    allActiveVideos = allActiveVideos.concat(videos);
    console.log(`[StandaloneSync] Folder ${folderId}: ${videos.length} active videos`);
  }

  console.log(`[StandaloneSync] Total active videos from Drive: ${allActiveVideos.length}`);

  // Load existing non-deleted jobs from Supabase, deduplicate by drive_file_id
  const { data: existingJobs, error } = await supabase
    .from('video_ingest_jobs')
    .select('id, drive_file_id, drive_folder_id, drive_modified_time, status, mux_playback_id, video_title, is_hidden, fase, ai_suggested_techniek_id, ai_confidence')
    .neq('status', 'deleted');

  if (error) throw new Error(`Supabase error: ${error.message}`);

  // Deduplicate: keep row with mux_playback_id if available
  const existingMap = new Map();
  for (const job of (existingJobs || [])) {
    const existing = existingMap.get(job.drive_file_id);
    if (!existing || (job.mux_playback_id && !existing.mux_playback_id)) {
      existingMap.set(job.drive_file_id, job);
    }
  }
  console.log(`[StandaloneSync] Loaded ${existingJobs?.length || 0} jobs, deduped to ${existingMap.size} unique`);

  let added = 0, ordersUpdated = 0;
  const newVideos = [];

  // Drive is the authority: assign sequential playback_order based on Drive traversal order
  let order = 1;
  for (const video of allActiveVideos) {
    if (video.name.startsWith('Kopie van ')) continue;

    const existing = existingMap.get(video.id);

    // Derive title from parent folder name
    let derivedTitle = cleanFolderTitle(video.parentFolderName || '');
    if (video.siblingCount > 1) {
      derivedTitle += ` (deel ${video.siblingIndex + 1})`;
    }

    // Fase + techniek from Drive folder structure
    const derivedFase = video.faseFromDrive || null;
    const derivedTechId = video.techIdFromDrive || null;

    if (!existing) {
      // New video — insert at Drive-determined position with folder-derived title + fase + techniek
      const { error: insertError } = await supabase.from('video_ingest_jobs').insert({
        drive_file_id: video.id,
        drive_file_name: video.name,
        drive_folder_id: video.folderId,
        drive_file_size: video.size,
        drive_modified_time: video.modifiedTime,
        status: 'pending',
        video_title: derivedTitle,
        is_hidden: false,
        playback_order: order,
        fase: derivedFase,
        ai_suggested_techniek_id: derivedTechId,
        ai_confidence: derivedTechId ? 1.0 : null,
      });
      if (insertError) {
        console.error(`[StandaloneSync] Insert error for ${video.name}:`, insertError.message);
      } else {
        added++;
        newVideos.push(video.name);
        console.log(`[StandaloneSync] Added: ${video.name} → "${derivedTitle}" F${derivedFase || '—'} T${derivedTechId || '—'} (order ${order})`);
      }
    } else {
      // Existing video — update playback_order + title + fase + techniek to match Drive
      const updateFields = {};
      if (existing.playback_order !== order) updateFields.playback_order = order;
      if (existing.video_title !== derivedTitle) updateFields.video_title = derivedTitle;
      if ((derivedFase || null) !== (existing.fase || null)) updateFields.fase = derivedFase;
      if ((derivedTechId || null) !== (existing.ai_suggested_techniek_id || null)) {
        updateFields.ai_suggested_techniek_id = derivedTechId;
        updateFields.ai_confidence = derivedTechId ? 1.0 : null;
      }

      if (Object.keys(updateFields).length > 0) {
        const { error: updateError } = await supabase.from('video_ingest_jobs')
          .update(updateFields)
          .eq('id', existing.id);
        if (updateError) {
          console.error(`[StandaloneSync] Update error for ${video.name}:`, updateError.message);
        } else {
          ordersUpdated++;
        }
      }
    }
    order++;
  }

  // Handle deletions: mark videos not in Drive as deleted (only non-hidden active videos)
  // SAFETY: Skip deletion entirely if Drive returned 0 videos (likely auth failure)
  const activeDriveIds = new Set(allActiveVideos.map(v => v.id));
  let deleted = 0;
  const nonHiddenExisting = [...existingMap.values()].filter(j => !j.is_hidden);
  const wouldDelete = nonHiddenExisting.filter(j => !activeDriveIds.has(j.drive_file_id));

  if (allActiveVideos.length === 0) {
    console.error('[StandaloneSync] SAFETY: Drive returned 0 videos — skipping deletion to prevent mass-delete');
  } else if (nonHiddenExisting.length > 5 && wouldDelete.length > nonHiddenExisting.length * 0.5) {
    console.error(`[StandaloneSync] SAFETY: Would delete ${wouldDelete.length}/${nonHiddenExisting.length} videos (>50%) — skipping deletion`);
  } else {
    for (const [driveFileId, job] of existingMap) {
      if (!activeDriveIds.has(driveFileId) && !job.is_hidden) {
        const { error: delError } = await supabase.from('video_ingest_jobs')
          .update({ status: 'deleted', updated_at: new Date().toISOString() })
          .eq('id', job.id);
        if (!delError) {
          deleted++;
          console.log(`[StandaloneSync] Marked deleted: ${job.video_title || driveFileId}`);
          // Also remove from RAG
          await supabase.from('rag_documents').delete().eq('source_id', `video_${job.id}`);
        }
      }
    }
  }

  console.log(`[StandaloneSync] COMPLETE: ${added} added, ${ordersUpdated} orders updated, ${deleted} deleted`);
  if (newVideos.length > 0) {
    console.log('[StandaloneSync] New videos:', newVideos.join(', '));
  }

  // Print final order for verification
  console.log('\n[StandaloneSync] Drive order (first 10):');
  allActiveVideos.slice(0, 10).forEach((v, i) => console.log(`  ${i + 1}. ${v.name}`));
}

main().catch(err => {
  console.error('[StandaloneSync] FATAL ERROR:', err.message);
  process.exit(1);
});
