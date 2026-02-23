const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY || !OPENAI_API_KEY) {
  console.error('Missing SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, or OPENAI_API_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function generateSummary(title, transcript) {
  const truncated = transcript.length > 8000 ? transcript.slice(0, 8000) + '...' : transcript;
  const resp = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${OPENAI_API_KEY}` },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'Je bent een assistent die samenvattingen maakt van sales coaching video transcripten van Hugo Herbots. Maak een beknopte samenvatting in het Nederlands van maximaal 3-4 zinnen. Focus op de kernboodschap en de belangrijkste sales technieken die worden besproken. Schrijf in de derde persoon ("Hugo legt uit..." of "In deze video wordt besproken...").' },
        { role: 'user', content: `Maak een beknopte samenvatting van dit video transcript.\n\nVideo titel: ${title || 'Onbekende video'}\n\nTranscript:\n${truncated}` }
      ],
      max_tokens: 300,
      temperature: 0.3,
    }),
  });
  if (!resp.ok) { console.error('OpenAI error:', await resp.text()); return null; }
  const data = await resp.json();
  return data.choices?.[0]?.message?.content?.trim() || null;
}

async function main() {
  // Get all videos with RAG documents but no AI summary
  const { data: jobs, error } = await supabase
    .from('video_ingest_jobs')
    .select('id, video_title, drive_file_name, rag_document_id, ai_summary')
    .not('rag_document_id', 'is', null)
    .is('ai_summary', null)
    .order('created_at', { ascending: true });

  if (error) { console.error('Failed to fetch jobs:', error.message); return; }
  console.log(`Found ${jobs.length} videos needing AI summaries`);

  let success = 0, failed = 0;
  for (let i = 0; i < jobs.length; i++) {
    const job = jobs[i];
    const title = job.video_title || job.drive_file_name;
    
    // Fetch transcript from RAG documents
    const { data: ragDoc } = await supabase
      .from('rag_documents')
      .select('content')
      .eq('id', job.rag_document_id)
      .single();

    if (!ragDoc?.content) {
      console.log(`[${i+1}/${jobs.length}] SKIP ${title} - no transcript content`);
      continue;
    }

    const summary = await generateSummary(title, ragDoc.content);
    if (!summary) {
      console.log(`[${i+1}/${jobs.length}] FAIL ${title}`);
      failed++;
      continue;
    }

    const { error: updateErr } = await supabase
      .from('video_ingest_jobs')
      .update({ ai_summary: summary })
      .eq('id', job.id);

    if (updateErr) {
      console.error(`[${i+1}/${jobs.length}] UPDATE FAIL ${title}: ${updateErr.message}`);
      failed++;
    } else {
      console.log(`[${i+1}/${jobs.length}] OK ${title.substring(0, 40)}`);
      success++;
    }

    // Rate limit: 200ms between requests
    await new Promise(r => setTimeout(r, 200));
  }

  console.log(`\nDone! Success: ${success}, Failed: ${failed}`);
}

main().catch(console.error);
