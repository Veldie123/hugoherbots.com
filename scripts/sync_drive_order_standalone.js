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
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const replIdentity = process.env.REPL_IDENTITY;
  const webRenewal = process.env.WEB_REPL_RENEWAL;

  let xReplitToken;
  if (replIdentity) {
    xReplitToken = `repl ${replIdentity}`;
  } else if (webRenewal) {
    xReplitToken = `depl ${webRenewal}`;
  } else {
    throw new Error('Replit connector credentials niet beschikbaar');
  }

  if (!hostname) throw new Error('REPLIT_CONNECTORS_HOSTNAME niet beschikbaar');

  const response = await fetch(
    `https://${hostname}/api/v2/connection?include_secrets=true&connector_names=google-drive`,
    {
      headers: {
        'Accept': 'application/json',
        'X_REPLIT_TOKEN': xReplitToken
      }
    }
  );

  const data = await response.json();
  const connection = (data.items || [])[0] || {};
  const settings = connection.settings || {};
  const accessToken = settings.access_token ||
    (settings.oauth && settings.oauth.credentials && settings.oauth.credentials.access_token);

  if (!accessToken) throw new Error('Google Drive niet verbonden');
  return accessToken;
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

  return folders.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));
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

  return videos.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));
}

async function scanFolder(folderId, accessToken, depth = 0) {
  // Skip archief entirely
  if (folderId === ARCHIEF_FOLDER_ID) {
    console.log(`${'  '.repeat(depth)}[Scan] SKIPPING archief folder`);
    return [];
  }

  const indent = '  '.repeat(depth);
  const videos = await listDriveVideosInFolder(folderId, accessToken);
  const subfolders = await listDriveSubfolders(folderId, accessToken);

  console.log(`${indent}[Scan] ${videos.length} videos, ${subfolders.length} subfolders in ${folderId}`);

  let allVideos = [...videos];
  for (const sf of subfolders) {
    const isArchief = sf.id === ARCHIEF_FOLDER_ID || sf.name.toLowerCase() === 'archief';
    if (isArchief) {
      console.log(`${indent}[Scan] SKIPPING archief subfolder: ${sf.name}`);
      continue;
    }
    const sub = await scanFolder(sf.id, accessToken, depth + 1);
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
    const videos = await scanFolder(folderId, accessToken);
    allActiveVideos = allActiveVideos.concat(videos);
    console.log(`[StandaloneSync] Folder ${folderId}: ${videos.length} active videos`);
  }

  console.log(`[StandaloneSync] Total active videos from Drive: ${allActiveVideos.length}`);

  // Load existing non-deleted jobs from Supabase, deduplicate by drive_file_id
  const { data: existingJobs, error } = await supabase
    .from('video_ingest_jobs')
    .select('id, drive_file_id, drive_folder_id, drive_modified_time, status, mux_playback_id, video_title, is_hidden')
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

  let added = 0, unchanged = 0, ordersUpdated = 0;
  const newVideos = [];

  // Process Drive videos: add new ones, update order
  for (let i = 0; i < allActiveVideos.length; i++) {
    const video = allActiveVideos[i];
    if (video.name.startsWith('Kopie van ')) continue;

    const existing = existingMap.get(video.id);
    const playback_order = i + 1;

    if (!existing) {
      // New video
      const { error: insertError } = await supabase.from('video_ingest_jobs').insert({
        drive_file_id: video.id,
        drive_file_name: video.name,
        drive_folder_id: video.folderId,
        drive_file_size: video.size,
        drive_modified_time: video.modifiedTime,
        status: 'pending',
        video_title: video.name.replace(/\.[^/.]+$/, ''),
        is_hidden: false,
        playback_order
      });
      if (insertError) {
        console.error(`[StandaloneSync] Insert error for ${video.name}:`, insertError.message);
      } else {
        added++;
        newVideos.push(video.name);
        console.log(`[StandaloneSync] Added: ${video.name} (order ${playback_order})`);
      }
    } else {
      // Update playback_order
      const { error: updateError } = await supabase.from('video_ingest_jobs')
        .update({ playback_order, updated_at: new Date().toISOString() })
        .eq('id', existing.id);
      if (updateError) {
        console.error(`[StandaloneSync] Update error for ${video.name}:`, updateError.message);
      } else {
        ordersUpdated++;
        unchanged++;
      }
    }
  }

  // Handle deletions: mark videos not in Drive as deleted (only non-hidden active videos)
  const activeDriveIds = new Set(allActiveVideos.map(v => v.id));
  let deleted = 0;
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
