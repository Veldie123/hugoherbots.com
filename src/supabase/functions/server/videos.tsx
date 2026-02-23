import { Hono } from "npm:hono";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { requireAuth, logError } from "./middleware.tsx";

const videosApp = new Hono();

const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const MUX_TOKEN_ID = Deno.env.get('MUX_TOKEN_ID') || '';
const MUX_TOKEN_SECRET = Deno.env.get('MUX_TOKEN_SECRET') || '';

function getSupabaseAdmin() {
  return createClient(supabaseUrl, supabaseServiceKey);
}

async function checkIsAdmin(userId: string): Promise<boolean> {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.auth.admin.getUserById(userId);
    if (error || !data?.user?.email) return false;
    return data.user.email.endsWith('@hugoherbots.com');
  } catch {
    return false;
  }
}

async function createMuxUpload(): Promise<{ uploadUrl: string; uploadId: string }> {
  const credentials = btoa(`${MUX_TOKEN_ID}:${MUX_TOKEN_SECRET}`);
  
  const response = await fetch('https://api.mux.com/video/v1/uploads', {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${credentials}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      cors_origin: '*',
      new_asset_settings: {
        playback_policy: ['public'],
        video_quality: 'plus',
      },
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Mux upload creation failed: ${error}`);
  }

  const data = await response.json();
  return {
    uploadUrl: data.data.url,
    uploadId: data.data.id,
  };
}

videosApp.get('/', requireAuth, async (c) => {
  try {
    const supabase = getSupabaseAdmin();
    const status = c.req.query('status');
    const module = c.req.query('module');
    
    let query = supabase.from('videos').select('*').order('sort_order', { ascending: true });
    
    if (status) {
      query = query.eq('status', status);
    }
    if (module) {
      query = query.eq('course_module', module);
    }
    
    const { data, error } = await query;
    
    if (error) {
      logError(c, `Failed to fetch videos: ${error.message}`, 'VIDEOS_FETCH_ERROR');
      return c.json({ error: 'Failed to fetch videos' }, 500);
    }
    
    return c.json(data || []);
  } catch (err: any) {
    logError(c, `Videos fetch error: ${err?.message}`, 'VIDEOS_FETCH_ERROR');
    return c.json({ error: 'Internal server error' }, 500);
  }
});

videosApp.get('/module/:module', requireAuth, async (c) => {
  try {
    const supabase = getSupabaseAdmin();
    const module = c.req.param('module');
    
    const { data, error } = await supabase
      .from('videos')
      .select('*')
      .eq('course_module', module)
      .eq('status', 'ready')
      .order('sort_order', { ascending: true });
    
    if (error) {
      logError(c, `Failed to fetch videos by module: ${error.message}`, 'VIDEOS_MODULE_ERROR');
      return c.json({ error: 'Failed to fetch videos' }, 500);
    }
    
    return c.json(data || []);
  } catch (err: any) {
    logError(c, `Videos module fetch error: ${err?.message}`, 'VIDEOS_MODULE_ERROR');
    return c.json({ error: 'Internal server error' }, 500);
  }
});

videosApp.get('/library', requireAuth, async (c) => {
  try {
    const supabase = getSupabaseAdmin();
    const status = c.req.query('status');
    const fase = c.req.query('fase');
    
    // Fetch from video_ingest_jobs (Google Drive pipeline)
    let jobsQuery = supabase
      .from('video_ingest_jobs')
      .select('id, drive_file_id, drive_file_name, video_title, techniek_id, fase, status, mux_asset_id, mux_playback_id, mux_status, thumbnail_url, duration_seconds, transcript, created_at, updated_at')
      .is('deleted_at', null)
      .order('created_at', { ascending: false });
    
    if (status) {
      jobsQuery = jobsQuery.eq('status', status);
    }
    if (fase) {
      jobsQuery = jobsQuery.eq('fase', fase);
    }
    
    // Fetch from videos table (manual uploads)
    let videosQuery = supabase
      .from('videos')
      .select('id, title, description, thumbnail_url, mux_asset_id, mux_playback_id, status, duration, course_module, technique_id, created_at, updated_at')
      .order('created_at', { ascending: false });
    
    if (status) {
      videosQuery = videosQuery.eq('status', status);
    }
    if (fase) {
      videosQuery = videosQuery.eq('course_module', fase);
    }
    
    const [jobsResult, videosResult] = await Promise.all([
      jobsQuery,
      videosQuery,
    ]);
    
    if (jobsResult.error) {
      logError(c, `Failed to fetch jobs: ${jobsResult.error.message}`, 'LIBRARY_JOBS_ERROR');
    }
    if (videosResult.error) {
      logError(c, `Failed to fetch videos: ${videosResult.error.message}`, 'LIBRARY_VIDEOS_ERROR');
    }
    
    // Map video_ingest_jobs
    const jobVideos = (jobsResult.data || []).map(job => ({
      id: job.id,
      title: job.video_title || job.drive_file_name || 'Naamloze video',
      description: job.transcript ? job.transcript.substring(0, 200) + '...' : null,
      thumbnail_url: job.thumbnail_url,
      mux_asset_id: job.mux_asset_id,
      mux_playback_id: job.mux_playback_id,
      status: job.mux_status || job.status,
      duration: job.duration_seconds,
      course_module: job.fase,
      technique_id: job.techniek_id,
      has_transcript: !!job.transcript,
      drive_file_id: job.drive_file_id,
      source: 'pipeline' as const,
      created_at: job.created_at,
      updated_at: job.updated_at,
    }));
    
    // Map manual videos (exclude those already in pipeline by mux_asset_id)
    const pipelineAssetIds = new Set(jobVideos.map(v => v.mux_asset_id).filter(Boolean));
    const manualVideos = (videosResult.data || [])
      .filter(v => !pipelineAssetIds.has(v.mux_asset_id))
      .map(video => ({
        id: video.id,
        title: video.title || 'Naamloze video',
        description: video.description,
        thumbnail_url: video.thumbnail_url,
        mux_asset_id: video.mux_asset_id,
        mux_playback_id: video.mux_playback_id,
        status: video.status,
        duration: video.duration,
        course_module: video.course_module,
        technique_id: video.technique_id,
        has_transcript: false,
        drive_file_id: null,
        source: 'manual' as const,
        created_at: video.created_at,
        updated_at: video.updated_at,
      }));
    
    // Combine and sort by created_at descending
    const allVideos = [...jobVideos, ...manualVideos].sort((a, b) => 
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
    
    return c.json(allVideos);
  } catch (err: any) {
    logError(c, `Video library error: ${err?.message}`, 'LIBRARY_ERROR');
    return c.json({ error: 'Internal server error' }, 500);
  }
});

videosApp.get('/library/:id', requireAuth, async (c) => {
  try {
    const supabase = getSupabaseAdmin();
    const jobId = c.req.param('id');
    
    const { data: job, error } = await supabase
      .from('video_ingest_jobs')
      .select('*')
      .eq('id', jobId)
      .is('deleted_at', null)
      .single();
    
    if (error || !job) {
      return c.json({ error: 'Video niet gevonden' }, 404);
    }
    
    return c.json({
      id: job.id,
      title: job.video_title || job.drive_file_name || 'Naamloze video',
      description: job.transcript ? job.transcript.substring(0, 500) : null,
      full_transcript: job.transcript,
      thumbnail_url: job.thumbnail_url,
      mux_asset_id: job.mux_asset_id,
      mux_playback_id: job.mux_playback_id,
      status: job.mux_status || job.status,
      duration: job.duration_seconds,
      course_module: job.fase,
      technique_id: job.techniek_id,
      drive_file_id: job.drive_file_id,
      created_at: job.created_at,
      updated_at: job.updated_at,
    });
  } catch (err: any) {
    logError(c, `Video library detail error: ${err?.message}`, 'LIBRARY_DETAIL_ERROR');
    return c.json({ error: 'Internal server error' }, 500);
  }
});

videosApp.put('/library/:id', requireAuth, async (c) => {
  try {
    const userId = c.get('userId');
    if (!userId) {
      return c.json({ error: 'Unauthorized' }, 401);
    }
    
    const isAdmin = await checkIsAdmin(userId);
    if (!isAdmin) {
      return c.json({ error: 'Admin toegang vereist' }, 403);
    }
    
    const jobId = c.req.param('id');
    const body = await c.req.json();
    const { title, techniek_id, fase } = body;
    
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('video_ingest_jobs')
      .update({
        video_title: title,
        techniek_id: techniek_id || null,
        fase: fase || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', jobId)
      .is('deleted_at', null)
      .select()
      .single();
    
    if (error) {
      logError(c, `Failed to update video: ${error.message}`, 'LIBRARY_UPDATE_ERROR');
      return c.json({ error: 'Video bijwerken mislukt' }, 500);
    }
    
    return c.json({
      id: data.id,
      title: data.video_title,
      technique_id: data.techniek_id,
      course_module: data.fase,
    });
  } catch (err: any) {
    logError(c, `Video library update error: ${err?.message}`, 'LIBRARY_UPDATE_ERROR');
    return c.json({ error: 'Internal server error' }, 500);
  }
});

videosApp.delete('/library/:id', requireAuth, async (c) => {
  try {
    const userId = c.get('userId');
    if (!userId) {
      return c.json({ error: 'Unauthorized' }, 401);
    }
    
    const isAdmin = await checkIsAdmin(userId);
    if (!isAdmin) {
      return c.json({ error: 'Admin toegang vereist' }, 403);
    }
    
    const jobId = c.req.param('id');
    const source = c.req.query('source') || 'pipeline';
    
    const supabase = getSupabaseAdmin();
    
    if (source === 'manual') {
      // Delete from videos table (hard delete with Mux cleanup)
      const { data: video } = await supabase
        .from('videos')
        .select('mux_asset_id')
        .eq('id', jobId)
        .single();
      
      if (video?.mux_asset_id && MUX_TOKEN_ID && MUX_TOKEN_SECRET) {
        try {
          const credentials = btoa(`${MUX_TOKEN_ID}:${MUX_TOKEN_SECRET}`);
          await fetch(`https://api.mux.com/video/v1/assets/${video.mux_asset_id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Basic ${credentials}` },
          });
        } catch (muxError) {
          console.warn('Failed to delete Mux asset:', muxError);
        }
      }
      
      const { error } = await supabase
        .from('videos')
        .delete()
        .eq('id', jobId);
      
      if (error) {
        logError(c, `Failed to delete video: ${error.message}`, 'LIBRARY_DELETE_ERROR');
        return c.json({ error: 'Video verwijderen mislukt' }, 500);
      }
    } else {
      // Soft delete from video_ingest_jobs (set deleted_at)
      const { data: job } = await supabase
        .from('video_ingest_jobs')
        .select('mux_asset_id')
        .eq('id', jobId)
        .single();
      
      if (job?.mux_asset_id && MUX_TOKEN_ID && MUX_TOKEN_SECRET) {
        try {
          const credentials = btoa(`${MUX_TOKEN_ID}:${MUX_TOKEN_SECRET}`);
          await fetch(`https://api.mux.com/video/v1/assets/${job.mux_asset_id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Basic ${credentials}` },
          });
        } catch (muxError) {
          console.warn('Failed to delete Mux asset:', muxError);
        }
      }
      
      const { error } = await supabase
        .from('video_ingest_jobs')
        .update({ 
          deleted_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', jobId);
      
      if (error) {
        logError(c, `Failed to delete job: ${error.message}`, 'LIBRARY_DELETE_ERROR');
        return c.json({ error: 'Video verwijderen mislukt' }, 500);
      }
    }
    
    return c.json({ success: true });
  } catch (err: any) {
    logError(c, `Video library delete error: ${err?.message}`, 'LIBRARY_DELETE_ERROR');
    return c.json({ error: 'Internal server error' }, 500);
  }
});

videosApp.get('/stats', requireAuth, async (c) => {
  try {
    const userId = c.get('userId');
    if (!userId) {
      return c.json({ error: 'Unauthorized' }, 401);
    }
    
    const supabase = getSupabaseAdmin();
    
    const { data: videos } = await supabase
      .from('videos')
      .select('id')
      .eq('status', 'ready');
    
    const { data: progress } = await supabase
      .from('video_progress')
      .select('*')
      .eq('user_id', userId);
    
    const totalVideos = videos?.length || 0;
    const completedVideos = progress?.filter(p => p.completed)?.length || 0;
    const totalWatchTime = progress?.reduce((sum, p) => sum + (p.watched_seconds || 0), 0) || 0;
    
    return c.json({ totalVideos, completedVideos, totalWatchTime });
  } catch (err: any) {
    logError(c, `Video stats error: ${err?.message}`, 'VIDEO_STATS_ERROR');
    return c.json({ error: 'Internal server error' }, 500);
  }
});

videosApp.get('/:id', requireAuth, async (c) => {
  try {
    const userId = c.get('userId');
    const supabase = getSupabaseAdmin();
    const videoId = c.req.param('id');
    
    const { data: video, error } = await supabase
      .from('videos')
      .select('*')
      .eq('id', videoId)
      .single();
    
    if (error || !video) {
      return c.json({ error: 'Video not found' }, 404);
    }
    
    let progress = null;
    if (userId) {
      const { data: progressData, error: progressError } = await supabase
        .from('video_progress')
        .select('*')
        .eq('video_id', videoId)
        .eq('user_id', userId)
        .single();
      
      if (!progressError || progressError.code === 'PGRST116') {
        progress = progressData || null;
      }
    }
    
    return c.json({ ...video, progress });
  } catch (err: any) {
    logError(c, `Video fetch error: ${err?.message}`, 'VIDEO_FETCH_ERROR');
    return c.json({ error: 'Internal server error' }, 500);
  }
});

videosApp.post('/upload', requireAuth, async (c) => {
  try {
    const userId = c.get('userId');
    if (!userId) {
      return c.json({ error: 'Unauthorized' }, 401);
    }
    
    const isAdmin = await checkIsAdmin(userId);
    if (!isAdmin) {
      return c.json({ error: 'Admin access required' }, 403);
    }
    
    const body = await c.req.json();
    const { title, description, course_module, technique_id } = body;
    
    if (!title) {
      return c.json({ error: 'Title is required' }, 400);
    }
    
    const { uploadUrl, uploadId } = await createMuxUpload();
    
    const supabase = getSupabaseAdmin();
    const { data: video, error } = await supabase
      .from('videos')
      .insert({
        title,
        description: description || null,
        course_module: course_module || null,
        technique_id: technique_id || null,
        mux_upload_id: uploadId,
        status: 'pending',
        sort_order: 0,
      })
      .select()
      .single();
    
    if (error) {
      logError(c, `Failed to create video: ${error.message}`, 'VIDEO_CREATE_ERROR');
      return c.json({ error: 'Failed to create video record' }, 500);
    }
    
    return c.json({
      upload_url: uploadUrl,
      upload_id: uploadId,
      video_id: video.id,
    });
  } catch (err: any) {
    logError(c, `Video upload error: ${err?.message}`, 'VIDEO_UPLOAD_ERROR');
    return c.json({ error: 'Internal server error' }, 500);
  }
});

videosApp.put('/:id', requireAuth, async (c) => {
  try {
    const userId = c.get('userId');
    if (!userId) {
      return c.json({ error: 'Unauthorized' }, 401);
    }
    
    const isAdmin = await checkIsAdmin(userId);
    if (!isAdmin) {
      return c.json({ error: 'Admin access required' }, 403);
    }
    
    const videoId = c.req.param('id');
    const body = await c.req.json();
    
    const supabase = getSupabaseAdmin();
    const { data: video, error } = await supabase
      .from('videos')
      .update({
        ...body,
        updated_at: new Date().toISOString(),
      })
      .eq('id', videoId)
      .select()
      .single();
    
    if (error) {
      logError(c, `Failed to update video: ${error.message}`, 'VIDEO_UPDATE_ERROR');
      return c.json({ error: 'Failed to update video' }, 500);
    }
    
    return c.json(video);
  } catch (err: any) {
    logError(c, `Video update error: ${err?.message}`, 'VIDEO_UPDATE_ERROR');
    return c.json({ error: 'Internal server error' }, 500);
  }
});

videosApp.delete('/:id', requireAuth, async (c) => {
  try {
    const userId = c.get('userId');
    if (!userId) {
      return c.json({ error: 'Unauthorized' }, 401);
    }
    
    const isAdmin = await checkIsAdmin(userId);
    if (!isAdmin) {
      return c.json({ error: 'Admin access required' }, 403);
    }
    
    const videoId = c.req.param('id');
    const supabase = getSupabaseAdmin();
    
    const { data: video } = await supabase
      .from('videos')
      .select('mux_asset_id')
      .eq('id', videoId)
      .single();
    
    if (video?.mux_asset_id && MUX_TOKEN_ID && MUX_TOKEN_SECRET) {
      try {
        const credentials = btoa(`${MUX_TOKEN_ID}:${MUX_TOKEN_SECRET}`);
        await fetch(`https://api.mux.com/video/v1/assets/${video.mux_asset_id}`, {
          method: 'DELETE',
          headers: { 'Authorization': `Basic ${credentials}` },
        });
      } catch (muxError) {
        console.warn('Failed to delete Mux asset:', muxError);
      }
    }
    
    const { error } = await supabase
      .from('videos')
      .delete()
      .eq('id', videoId);
    
    if (error) {
      logError(c, `Failed to delete video: ${error.message}`, 'VIDEO_DELETE_ERROR');
      return c.json({ error: 'Failed to delete video' }, 500);
    }
    
    return c.json({ success: true });
  } catch (err: any) {
    logError(c, `Video delete error: ${err?.message}`, 'VIDEO_DELETE_ERROR');
    return c.json({ error: 'Internal server error' }, 500);
  }
});

videosApp.get('/:id/progress', requireAuth, async (c) => {
  try {
    const userId = c.get('userId');
    if (!userId) {
      return c.json({ error: 'Unauthorized' }, 401);
    }
    
    const videoId = c.req.param('id');
    const supabase = getSupabaseAdmin();
    
    const { data, error } = await supabase
      .from('video_progress')
      .select('*')
      .eq('video_id', videoId)
      .eq('user_id', userId)
      .single();
    
    if (error?.code === 'PGRST116') {
      return c.json({ error: 'Progress not found' }, 404);
    }
    
    if (error) {
      logError(c, `Failed to fetch progress: ${error.message}`, 'PROGRESS_FETCH_ERROR');
      return c.json({ error: 'Failed to fetch progress' }, 500);
    }
    
    return c.json(data);
  } catch (err: any) {
    logError(c, `Progress fetch error: ${err?.message}`, 'PROGRESS_FETCH_ERROR');
    return c.json({ error: 'Internal server error' }, 500);
  }
});

videosApp.post('/:id/progress', requireAuth, async (c) => {
  try {
    const userId = c.get('userId');
    if (!userId) {
      return c.json({ error: 'Unauthorized' }, 401);
    }
    
    const videoId = c.req.param('id');
    const body = await c.req.json();
    const { watched_seconds, last_position, completed } = body;
    
    const supabase = getSupabaseAdmin();
    
    const { data: existing } = await supabase
      .from('video_progress')
      .select('id, watched_seconds')
      .eq('video_id', videoId)
      .eq('user_id', userId)
      .single();
    
    if (existing) {
      const newWatchedSeconds = Math.max(existing.watched_seconds || 0, watched_seconds || 0);
      const { data, error } = await supabase
        .from('video_progress')
        .update({
          watched_seconds: newWatchedSeconds,
          last_position: last_position ?? 0,
          completed: completed ?? false,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id)
        .select()
        .single();
      
      if (error) {
        logError(c, `Failed to update progress: ${error.message}`, 'PROGRESS_UPDATE_ERROR');
        return c.json({ error: 'Failed to update progress' }, 500);
      }
      
      return c.json(data);
    } else {
      const { data, error } = await supabase
        .from('video_progress')
        .insert({
          video_id: videoId,
          user_id: userId,
          watched_seconds: watched_seconds || 0,
          last_position: last_position || 0,
          completed: completed || false,
        })
        .select()
        .single();
      
      if (error) {
        logError(c, `Failed to create progress: ${error.message}`, 'PROGRESS_CREATE_ERROR');
        return c.json({ error: 'Failed to create progress' }, 500);
      }
      
      return c.json(data);
    }
  } catch (err: any) {
    logError(c, `Progress update error: ${err?.message}`, 'PROGRESS_UPDATE_ERROR');
    return c.json({ error: 'Internal server error' }, 500);
  }
});

videosApp.post('/webhook', async (c) => {
  try {
    const body = await c.req.text();
    const event = JSON.parse(body);
    
    const supabase = getSupabaseAdmin();
    
    if (event.type === 'video.upload.asset_created') {
      const uploadId = event.data.id;
      const assetId = event.data.asset_id;
      
      // Update videos table (manual uploads)
      await supabase
        .from('videos')
        .update({ mux_asset_id: assetId, status: 'processing' })
        .eq('mux_upload_id', uploadId);
    }
    
    if (event.type === 'video.asset.ready') {
      const assetId = event.data.id;
      const playbackIds = event.data.playback_ids || [];
      const duration = Math.round(event.data.duration || 0);
      const playbackId = playbackIds[0]?.id;
      
      if (playbackId) {
        const thumbnailUrl = `https://image.mux.com/${playbackId}/thumbnail.jpg?time=5`;
        
        // Update videos table (manual uploads)
        await supabase
          .from('videos')
          .update({
            mux_playback_id: playbackId,
            status: 'ready',
            duration,
            thumbnail_url: thumbnailUrl,
          })
          .eq('mux_asset_id', assetId);
        
        // Update video_ingest_jobs table (Google Drive pipeline)
        await supabase
          .from('video_ingest_jobs')
          .update({
            mux_playback_id: playbackId,
            mux_status: 'ready',
            duration_seconds: duration,
            thumbnail_url: thumbnailUrl,
            updated_at: new Date().toISOString(),
          })
          .eq('mux_asset_id', assetId);
      }
    }
    
    if (event.type === 'video.asset.errored') {
      const assetId = event.data.id;
      
      // Update videos table
      await supabase
        .from('videos')
        .update({ status: 'error' })
        .eq('mux_asset_id', assetId);
      
      // Update video_ingest_jobs table
      await supabase
        .from('video_ingest_jobs')
        .update({ 
          mux_status: 'error',
          updated_at: new Date().toISOString(),
        })
        .eq('mux_asset_id', assetId);
    }
    
    return c.json({ received: true });
  } catch (err: any) {
    logError(c, `Webhook error: ${err?.message}`, 'WEBHOOK_ERROR');
    return c.json({ error: 'Webhook processing failed' }, 500);
  }
});

export { videosApp };
