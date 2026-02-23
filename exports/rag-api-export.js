// ============================================
// RAG SEARCH API ENDPOINTS
// Export voor andere Replit (AI Chat module)
// ============================================
// 
// Vereisten:
// - @supabase/supabase-js geïnstalleerd
// - SUPABASE_URL en SUPABASE_SERVICE_ROLE_KEY in secrets
// - OPENAI_API_KEY in secrets
//
// Supabase tabellen benodigd:
// - rag_documents (met embedding vector column)
// - video_ingest_jobs
// - RPC functie: match_rag_documents (optioneel, fallback naar keyword search)

const { createClient } = require('@supabase/supabase-js');

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// ============================================
// ENDPOINT 1: POST /api/rag/search
// Semantische zoek op transcripts met video metadata
// ============================================
async function handleRagSearch(req, res) {
  const { query, limit = 5, techniek_filter = null } = req.body;
  
  if (!query) {
    return res.status(400).json({ error: 'Query is required' });
  }

  const embeddingResponse = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'text-embedding-3-small',
      input: query
    })
  });

  const embeddingData = await embeddingResponse.json();
  const queryEmbedding = embeddingData.data[0].embedding;

  let ragResults = [];
  
  try {
    const { data: rpcResults, error: ragError } = await supabaseAdmin.rpc('match_rag_documents', {
      query_embedding: queryEmbedding,
      match_threshold: 0.1,
      match_count: limit * 2
    });
    
    if (!ragError && rpcResults && rpcResults.length > 0) {
      ragResults = rpcResults;
    } else {
      console.log('[RAG] RPC returned no results, falling back to keyword search');
      const { data: keywordResults } = await supabaseAdmin
        .from('rag_documents')
        .select('id, title, content, doc_type, techniek_id, fase')
        .or(`content.ilike.%${query.split(' ').join('%')},title.ilike.%${query}%`)
        .limit(limit * 2);
      
      ragResults = (keywordResults || []).map(doc => ({
        ...doc,
        similarity: 0.5
      }));
    }
  } catch (rpcErr) {
    console.warn('[RAG] RPC failed:', rpcErr.message);
    const { data: keywordResults } = await supabaseAdmin
      .from('rag_documents')
      .select('id, title, content, doc_type, techniek_id, fase')
      .or(`content.ilike.%${query.split(' ').join('%')},title.ilike.%${query}%`)
      .limit(limit * 2);
    
    ragResults = (keywordResults || []).map(doc => ({
      ...doc,
      similarity: 0.5
    }));
  }

  const enrichedResults = [];
  for (const doc of ragResults || []) {
    let videoData = null;
    
    const { data: videoJob } = await supabaseAdmin
      .from('video_ingest_jobs')
      .select('id, title, file_name, techniek_id, ai_suggested_techniek_id, ai_confidence, fase, mux_playback_id, duration_seconds')
      .eq('rag_document_id', doc.id)
      .single();
    
    if (videoJob) {
      videoData = {
        id: videoJob.id,
        title: videoJob.title,
        file_name: videoJob.file_name,
        techniek: videoJob.techniek_id || videoJob.ai_suggested_techniek_id,
        techniek_source: videoJob.techniek_id ? 'manual' : 'ai',
        fase: videoJob.fase,
        mux_playback_id: videoJob.mux_playback_id,
        duration_seconds: videoJob.duration_seconds,
        watch_url: videoJob.mux_playback_id 
          ? `https://stream.mux.com/${videoJob.mux_playback_id}.m3u8`
          : null
      };
    }
    
    enrichedResults.push({
      rag_id: doc.id,
      title: doc.title,
      content_preview: doc.content?.substring(0, 300) + '...',
      similarity: doc.similarity,
      techniek_id: doc.techniek_id,
      doc_type: doc.doc_type,
      video: videoData
    });
  }

  let filtered = enrichedResults;
  if (techniek_filter) {
    filtered = filtered.filter(r => 
      r.techniek_id === techniek_filter || r.video?.techniek === techniek_filter
    );
  }
  
  filtered.sort((a, b) => b.similarity - a.similarity);
  const final = filtered.slice(0, limit);

  return res.json({
    query,
    results: final,
    total: final.length
  });
}

// ============================================
// ENDPOINT 2: GET /api/rag/videos-by-techniek?techniek=3.4
// Directe lookup van video's per techniek
// ============================================
async function handleVideosByTechniek(req, res) {
  const techniek = req.query.techniek;
  
  if (!techniek) {
    return res.status(400).json({ error: 'techniek parameter is required' });
  }

  const { data: videos, error } = await supabaseAdmin
    .from('video_ingest_jobs')
    .select('id, title, file_name, techniek_id, ai_suggested_techniek_id, ai_confidence, fase, mux_playback_id, duration_seconds')
    .or(`techniek_id.eq.${techniek},ai_suggested_techniek_id.eq.${techniek}`)
    .order('ai_confidence', { ascending: false });

  if (error) {
    return res.status(500).json({ error: 'Database query failed', details: error.message });
  }

  const results = (videos || []).map(v => ({
    id: v.id,
    title: v.title,
    file_name: v.file_name,
    techniek: v.techniek_id || v.ai_suggested_techniek_id,
    techniek_source: v.techniek_id ? 'manual' : 'ai',
    ai_confidence: v.ai_confidence,
    fase: v.fase,
    mux_playback_id: v.mux_playback_id,
    duration_seconds: v.duration_seconds,
    watch_url: v.mux_playback_id 
      ? `https://stream.mux.com/${v.mux_playback_id}.m3u8`
      : null
  }));

  return res.json({
    techniek,
    videos: results,
    total: results.length
  });
}

module.exports = { handleRagSearch, handleVideosByTechniek };
