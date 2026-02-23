import { google, drive_v3 } from 'googleapis';
import { supabase } from '../utils/supabase/client';

interface VideoIngestJob {
  id: string;
  drive_file_id: string;
  drive_modified_time: string;
  status: string;
  rag_document_id?: string;
}

let connectionSettings: any;

async function getAccessToken(): Promise<string> {
  if (connectionSettings && connectionSettings.settings.expires_at && 
      new Date(connectionSettings.settings.expires_at).getTime() > Date.now()) {
    return connectionSettings.settings.access_token;
  }
  
  const hostname = (import.meta as any).env?.VITE_REPLIT_CONNECTORS_HOSTNAME || 
                   (typeof process !== 'undefined' ? process.env.REPLIT_CONNECTORS_HOSTNAME : null);
  const xReplitToken = typeof process !== 'undefined' 
    ? (process.env.REPL_IDENTITY ? 'repl ' + process.env.REPL_IDENTITY 
       : process.env.WEB_REPL_RENEWAL ? 'depl ' + process.env.WEB_REPL_RENEWAL : null)
    : null;

  if (!xReplitToken || !hostname) {
    throw new Error('Replit connector credentials niet beschikbaar');
  }

  const response = await fetch(
    'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=google-drive',
    {
      headers: {
        'Accept': 'application/json',
        'X_REPLIT_TOKEN': xReplitToken
      }
    }
  );

  const data = await response.json();
  connectionSettings = data.items?.[0];

  const accessToken = connectionSettings?.settings?.access_token || 
                      connectionSettings?.settings?.oauth?.credentials?.access_token;

  if (!connectionSettings || !accessToken) {
    throw new Error('Google Drive niet verbonden');
  }
  return accessToken;
}

async function getGoogleDriveClient(): Promise<drive_v3.Drive> {
  const accessToken = await getAccessToken();
  const oauth2Client = new google.auth.OAuth2();
  oauth2Client.setCredentials({ access_token: accessToken });
  return google.drive({ version: 'v3', auth: oauth2Client });
}

export interface VideoFile {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  modifiedTime: string;
  folderId?: string;
  folderPath?: string;
}

export interface SyncResult {
  added: VideoFile[];
  deleted: string[];
  unchanged: number;
  errors: string[];
}

async function listSubfolders(drive: drive_v3.Drive, folderId: string): Promise<{id: string, name: string}[]> {
  const folders: {id: string, name: string}[] = [];
  let pageToken: string | undefined;
  
  do {
    const response = await drive.files.list({
      q: `'${folderId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
      fields: 'nextPageToken, files(id, name)',
      pageSize: 100,
      pageToken
    });
    
    if (response.data.files) {
      for (const file of response.data.files) {
        folders.push({ id: file.id!, name: file.name! });
      }
    }
    
    pageToken = response.data.nextPageToken || undefined;
  } while (pageToken);
  
  return folders;
}

export async function listVideosInFolder(folderId: string, recursive: boolean = true): Promise<VideoFile[]> {
  const drive = await getGoogleDriveClient();
  
  const videos: VideoFile[] = [];
  
  async function scanFolder(currentFolderId: string, folderPath: string = '') {
    let pageToken: string | undefined;
    
    do {
      const response = await drive.files.list({
        q: `'${currentFolderId}' in parents and mimeType contains 'video/' and trashed = false`,
        fields: 'nextPageToken, files(id, name, mimeType, size, modifiedTime, parents)',
        pageSize: 100,
        pageToken
      });
      
      if (response.data.files) {
        for (const file of response.data.files) {
          videos.push({
            id: file.id!,
            name: file.name!,
            mimeType: file.mimeType!,
            size: parseInt(file.size || '0'),
            modifiedTime: file.modifiedTime!,
            folderId: file.parents?.[0],
            folderPath: folderPath || undefined
          });
        }
      }
      
      pageToken = response.data.nextPageToken || undefined;
    } while (pageToken);
    
    if (recursive) {
      const subfolders = await listSubfolders(drive, currentFolderId);
      for (const subfolder of subfolders) {
        const newPath = folderPath ? `${folderPath}/${subfolder.name}` : subfolder.name;
        await scanFolder(subfolder.id, newPath);
      }
    }
  }
  
  await scanFolder(folderId);
  
  console.log(`[GoogleDrive] Gevonden: ${videos.length} video's${recursive ? ' (recursief)' : ''}`);
  return videos;
}

export async function syncVideosFromFolder(folderId: string): Promise<SyncResult> {
  const result: SyncResult = {
    added: [],
    deleted: [],
    unchanged: 0,
    errors: []
  };
  
  try {
    const driveVideos = await listVideosInFolder(folderId);
    
    const { data: existingJobs, error: fetchError } = await supabase
      .from('video_ingest_jobs')
      .select('id, drive_file_id, drive_modified_time, status')
      .neq('status', 'deleted');
    
    if (fetchError) {
      result.errors.push(`Fout bij ophalen bestaande jobs: ${fetchError.message}`);
      return result;
    }
    
    const existingMap = new Map(
      (existingJobs || []).map(job => [job.drive_file_id, job])
    );
    
    const driveFileIds = new Set(driveVideos.map(v => v.id));
    
    for (const video of driveVideos) {
      const existing = existingMap.get(video.id);
      
      if (!existing) {
        // Extract techniek nummer from folder path (e.g., "Fase 2 - .../2.1.5 Pingpong" -> "2.1.5")
        let detectedTechniek: string | null = null;
        if (video.folderPath) {
          // Match deepest techniek number (e.g., "2.1.5" from "Fase 2 - .../2.1 Explore/2.1.5 Pingpong")
          const parts = video.folderPath.split('/');
          for (let i = parts.length - 1; i >= 0; i--) {
            const match = parts[i].match(/^(\d+(?:\.\d+)+)\s+/);
            if (match) {
              detectedTechniek = match[1];
              break;
            }
          }
        }
        
        const { error: insertError } = await supabase
          .from('video_ingest_jobs')
          .insert({
            drive_file_id: video.id,
            drive_file_name: video.name,
            drive_folder_id: video.folderId,
            drive_file_size: video.size,
            drive_modified_time: video.modifiedTime,
            status: 'pending',
            video_title: video.name.replace(/\.[^/.]+$/, ''),
            techniek_id: detectedTechniek
          });
        
        if (insertError) {
          result.errors.push(`Fout bij toevoegen ${video.name}: ${insertError.message}`);
        } else {
          result.added.push(video);
        }
      } else {
        const existingModified = new Date(existing.drive_modified_time).getTime();
        const newModified = new Date(video.modifiedTime).getTime();
        
        if (newModified > existingModified) {
          const { error: updateError } = await supabase
            .from('video_ingest_jobs')
            .update({
              drive_modified_time: video.modifiedTime,
              drive_file_size: video.size,
              status: 'pending',
              error_message: null,
              retry_count: 0
            })
            .eq('id', existing.id);
          
          if (updateError) {
            result.errors.push(`Fout bij updaten ${video.name}: ${updateError.message}`);
          } else {
            result.added.push(video);
          }
        } else {
          result.unchanged++;
        }
      }
    }
    
    for (const [driveFileId, job] of existingMap) {
      if (!driveFileIds.has(driveFileId)) {
        const { error: deleteError } = await supabase
          .from('video_ingest_jobs')
          .update({ 
            status: 'deleted',
            deleted_at: new Date().toISOString()
          })
          .eq('id', job.id);
        
        if (deleteError) {
          result.errors.push(`Fout bij verwijderen job: ${deleteError.message}`);
        } else {
          result.deleted.push(driveFileId);
          
          const { data: jobData } = await supabase
            .from('video_ingest_jobs')
            .select('rag_document_id')
            .eq('id', job.id)
            .single();
          
          if (jobData?.rag_document_id) {
            await supabase
              .from('rag_documents')
              .delete()
              .eq('id', jobData.rag_document_id);
          }
        }
      }
    }
    
  } catch (error) {
    result.errors.push(`Sync fout: ${error instanceof Error ? error.message : 'Onbekende fout'}`);
  }
  
  return result;
}

export async function getVideoJobStats(): Promise<{
  total: number;
  pending: number;
  processing: number;
  completed: number;
  failed: number;
}> {
  const { data, error } = await supabase
    .from('video_ingest_jobs')
    .select('status')
    .neq('status', 'deleted');
  
  if (error || !data) {
    return { total: 0, pending: 0, processing: 0, completed: 0, failed: 0 };
  }
  
  const stats = {
    total: data.length,
    pending: 0,
    processing: 0,
    completed: 0,
    failed: 0
  };
  
  for (const job of data) {
    switch (job.status) {
      case 'pending':
        stats.pending++;
        break;
      case 'downloading':
      case 'processing':
      case 'extracting_audio':
      case 'transcribing':
      case 'embedding':
        stats.processing++;
        break;
      case 'completed':
        stats.completed++;
        break;
      case 'failed':
        stats.failed++;
        break;
    }
  }
  
  return stats;
}

export async function getRecentJobs(limit: number = 20): Promise<any[]> {
  const { data, error } = await supabase
    .from('video_ingest_jobs')
    .select('*')
    .neq('status', 'deleted')
    .order('created_at', { ascending: false })
    .limit(limit);
  
  if (error) {
    console.error('Fout bij ophalen jobs:', error);
    return [];
  }
  
  return data || [];
}
