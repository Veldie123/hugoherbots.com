#!/usr/bin/env node
/**
 * Video Processing API Server
 * 
 * Simple server that triggers Python video processing jobs.
 * Also handles admin operations that need service role access.
 * Runs on port 3001 alongside the main Vite dev server.
 */

const http = require('http');
const { spawn } = require('child_process');
const url = require('url');
const { Pool } = require('pg');
const { createClient } = require('@supabase/supabase-js');

const PORT = 3001;
const AUTH_SECRET = process.env.VIDEO_PROCESSOR_SECRET || (() => { console.warn('VIDEO_PROCESSOR_SECRET not set, using generated fallback'); return require('crypto').randomBytes(32).toString('hex'); })();

const PYTHON_BIN = (() => {
  const candidates = [
    process.env.PYTHON_BIN,
    '/home/runner/workspace/.pythonlibs/bin/python3',
    '/usr/bin/python3',
    '/usr/local/bin/python3',
    'python3',
  ].filter(Boolean);
  const fs = require('fs');
  for (const p of candidates) {
    if (p === 'python3') return p;
    try { if (fs.existsSync(p)) return p; } catch {}
  }
  return 'python3';
})();

// Mux API for fetching video durations with persistent cache
const MUX_TOKEN_ID = process.env.MUX_TOKEN_ID;
const MUX_TOKEN_SECRET = process.env.MUX_TOKEN_SECRET;
const fs = require('fs');
const path = require('path');
const CACHE_FILE = path.join(__dirname, 'duration-cache.json');

// Rate limiting for timeline endpoint
let timelineRateLimit = {};

// Load cache from file on startup
let durationCache = new Map();
try {
  if (fs.existsSync(CACHE_FILE)) {
    const cacheData = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
    durationCache = new Map(Object.entries(cacheData));
    console.log(`[Mux] Loaded ${durationCache.size} cached durations`);
  }
} catch (e) {
  console.warn('[Mux] Failed to load duration cache:', e.message);
}

function saveDurationCache() {
  try {
    const cacheObj = Object.fromEntries(durationCache);
    fs.writeFileSync(CACHE_FILE, JSON.stringify(cacheObj, null, 2));
  } catch (e) {
    console.warn('[Mux] Failed to save duration cache:', e.message);
  }
}

async function getMuxAssetDuration(assetId) {
  if (!MUX_TOKEN_ID || !MUX_TOKEN_SECRET || !assetId) return null;
  
  // Check in-memory cache first
  if (durationCache.has(assetId)) {
    return durationCache.get(assetId);
  }
  
  try {
    const auth = Buffer.from(`${MUX_TOKEN_ID}:${MUX_TOKEN_SECRET}`).toString('base64');
    const response = await fetch(`https://api.mux.com/video/v1/assets/${assetId}`, {
      headers: { 'Authorization': `Basic ${auth}` }
    });
    if (!response.ok) {
      console.warn(`[Mux] Failed to fetch duration for ${assetId}: ${response.status}`);
      return null;
    }
    const data = await response.json();
    const duration = data?.data?.duration || null;
    if (duration) {
      durationCache.set(assetId, duration);
      saveDurationCache();
    }
    return duration;
  } catch (e) {
    console.warn(`[Mux] Error fetching duration for ${assetId}:`, e.message);
    return null;
  }
}

// Persist duration to Supabase database (handles both pipeline and manual videos)
async function saveDurationToDatabase(videoId, durationSeconds, source = 'pipeline') {
  if (!supabaseAdmin || !videoId || !durationSeconds) return false;
  try {
    const tableName = source === 'manual' ? 'videos' : 'video_ingest_jobs';
    const { error } = await supabaseAdmin
      .from(tableName)
      .update({ duration_seconds: Math.round(durationSeconds) })
      .eq('id', videoId);
    if (error) {
      console.warn(`[Mux] Failed to save duration to DB (${tableName}) for ${videoId}:`, error.message);
      return false;
    }
    console.log(`[Mux] Saved duration ${Math.round(durationSeconds)}s for ${videoId} in ${tableName}`);
    return true;
  } catch (e) {
    console.warn(`[Mux] Error saving duration to DB for ${videoId}:`, e.message);
    return false;
  }
}

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseAdmin = (supabaseUrl && supabaseServiceKey) ? createClient(supabaseUrl, supabaseServiceKey, {
  db: { schema: 'public' },
  auth: { persistSession: false }
}) : null;

let techniekenIndex = null;
try {
  techniekenIndex = JSON.parse(fs.readFileSync(path.join(__dirname, '../src/data/technieken_index.json'), 'utf8')).technieken;
} catch (e) {
  console.warn('[TechMatch] Could not load technieken_index.json:', e.message);
}

const HUGO_FOLDER_NUMBER_MAP = {
  '2.5': null, '2.6': null, '2.7': null, '2.8': null, '2.9': null, '2.10': null,
  '1.2.1': '1.3', '2.1.0': '2.1', '4.3.4': null, '4.3.3': null, '4.3.1': null,
};

function extractTechniqueNumberFromFolderName(text) {
  if (!text || !techniekenIndex) return null;
  const patterns = [/^(\d+\.\d+\.\d+\.\d+)/, /^(\d+\.\d+\.\d+)/, /^(\d+\.\d+)/, /^(\d+)/];
  for (const pattern of patterns) {
    const m = text.match(pattern);
    if (!m) continue;
    const num = m[1];
    if (num in HUGO_FOLDER_NUMBER_MAP) return HUGO_FOLDER_NUMBER_MAP[num];
    if (techniekenIndex[num]) return num;
  }
  return null;
}

function matchFolderNameToTechnique(folderName) {
  if (!folderName || !techniekenIndex) return null;
  const skipFolders = ['image.canon', 'archief', 'archief 2', 'dubbels', 'algemeen', 'intro',
    'mijn drive', 'professioneel', '00 - intro', 'klant', 'voorstelling van mezelf', 'verkoper',
    'equilux', 'aquafresh', 'ovezicht onderwerpen', 'universele houdingen metafoor'];
  if (skipFolders.includes(folderName.toLowerCase())) return null;

  const directNum = extractTechniqueNumberFromFolderName(folderName);
  if (directNum && techniekenIndex[directNum]) {
    return { techniek_id: directNum, score: 0.95, fase: techniekenIndex[directNum].fase || directNum.split('.')[0] };
  }

  const faseMatch = folderName.match(/^Fase\s+(\d+)/i);
  if (faseMatch && techniekenIndex[faseMatch[1]]) {
    return { techniek_id: faseMatch[1], score: 0.20, fase: faseMatch[1] };
  }

  const folderLower = folderName.toLowerCase();
  const folderNameOnly = folderLower.replace(/^\d+[\.\d]*\s*[-:]?\s*/, '').trim();
  let bestMatch = null;
  let bestScore = 0;

  for (const [tid, tech] of Object.entries(techniekenIndex)) {
    const techNaam = (tech.naam || '').toLowerCase();
    if (techNaam.length > 3 && (folderLower.includes(techNaam) || folderNameOnly.includes(techNaam))) {
      if (0.85 > bestScore) {
        bestScore = 0.85;
        bestMatch = { techniek_id: tid, score: 0.85, fase: tech.fase || tid.split('.')[0] };
      }
    }
    const techNameOnly = techNaam.replace(/^\d+[\.\d]*\s*[-:]?\s*/, '').trim();
    if (techNameOnly.length > 3 && folderNameOnly.length > 3 && (folderNameOnly.includes(techNameOnly) || techNameOnly.includes(folderNameOnly))) {
      if (0.80 > bestScore) {
        bestScore = 0.80;
        bestMatch = { techniek_id: tid, score: 0.80, fase: tech.fase || tid.split('.')[0] };
      }
    }
    if (tech.tags) {
      for (const tag of tech.tags) {
        if (tag.length > 3 && (folderLower.includes(tag.toLowerCase()) || folderNameOnly.includes(tag.toLowerCase()))) {
          if (0.4 > bestScore) {
            bestScore = 0.4;
            bestMatch = { techniek_id: tid, score: 0.4, fase: tech.fase || tid.split('.')[0] };
          }
        }
      }
    }
  }
  return bestMatch;
}

const folderNameCache = new Map();

async function resolveFolderInfoFromDrive(folderId) {
  if (folderNameCache.has(folderId)) return folderNameCache.get(folderId);

  try {
    const accessToken = await getGoogleDriveAccessToken();
    const resp = await fetch(`https://www.googleapis.com/drive/v3/files/${folderId}?fields=name,parents`, {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });
    if (!resp.ok) {
      folderNameCache.set(folderId, null);
      return null;
    }
    const data = await resp.json();
    const result = { name: data.name || null, parentId: (data.parents || [])[0] || null };
    folderNameCache.set(folderId, result);
    return result;
  } catch (e) {
    console.warn(`[TechMatch] Could not resolve folder for ${folderId}: ${e.message}`);
    folderNameCache.set(folderId, null);
    return null;
  }
}

async function matchFolderWithParentFallback(folderId) {
  const info = await resolveFolderInfoFromDrive(folderId);
  if (!info || !info.name) return null;

  const match = matchFolderNameToTechnique(info.name);
  if (match) return { ...match, folderName: info.name };

  if (info.parentId) {
    const parentInfo = await resolveFolderInfoFromDrive(info.parentId);
    if (parentInfo?.name) {
      const parentMatch = matchFolderNameToTechnique(parentInfo.name);
      if (parentMatch) {
        return { ...parentMatch, score: Math.min(parentMatch.score, 0.60), folderName: `${parentInfo.name} > ${info.name}` };
      }
      const fm = parentInfo.name.match(/^Fase\s+(\d+)/i);
      if (fm && techniekenIndex[fm[1]]) {
        return { techniek_id: fm[1], score: 0.15, fase: fm[1], folderName: `${parentInfo.name} > ${info.name}` };
      }
    }
  }
  return null;
}

let videoTechniekenTableReady = null;

async function checkVideoTechniekenTable() {
  if (!supabaseAdmin) return false;
  try {
    const { error } = await supabaseAdmin.from('video_technieken').select('video_id').limit(1);
    if (error && (error.code === 'PGRST205' || error.code === '42P01' || error.message?.includes('does not exist'))) {
      console.warn('[TechTag] video_technieken table does not exist, using JSONB fallback on video_ingest_jobs.detected_technieken');
      return false;
    }
    return !error;
  } catch (e) {
    return false;
  }
}

async function getVideoTechniekenReady() {
  if (videoTechniekenTableReady === null) {
    videoTechniekenTableReady = await checkVideoTechniekenTable();
  }
  return videoTechniekenTableReady;
}

async function detectMultipleTechniques(videoId, transcript, folderTechId) {
  const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
  if (!OPENAI_API_KEY || !transcript || !techniekenIndex) {
    return [];
  }

  try {
    const techniqueList = Object.entries(techniekenIndex)
      .filter(([id, t]) => !t.is_fase && id.includes('.'))
      .map(([id, t]) => `${id}: ${t.naam}${t.tags ? ' [' + t.tags.slice(0, 3).join(', ') + ']' : ''}`)
      .join('\n');

    const truncatedTranscript = transcript.length > 6000 ? transcript.slice(0, 6000) + '...' : transcript;

    const chatResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `Je bent een expert in het classificeren van sales training video's van Hugo Herbots.
Analyseer het transcript en bepaal ALLE verkooptechnieken die in deze video aan bod komen.
Eén video kan meerdere technieken bevatten — sommige als hoofdonderwerp, andere zijdelings.

TECHNIEKEN LIJST:
${techniqueList}

REGELS:
- Geef ALLEEN technieken terug die echt in het transcript besproken worden
- Gebruik het exacte techniek-ID (bijv. "2.1.3", "4.2.1")
- Geef een confidence score: 0.9+ = hoofdonderwerp, 0.6-0.89 = duidelijk besproken, 0.3-0.59 = zijdelings/kort
- Minimaal 1 techniek, maximaal 5 technieken per video
- Geef ALLEEN fase-nummers (bijv. "1", "2") als er echt GEEN specifiekere techniek past
- Antwoord UITSLUITEND in JSON format

ANTWOORD FORMAT (JSON object met "techniques" array):
{"techniques": [{"id": "2.1.3", "confidence": 0.92}, {"id": "1.2", "confidence": 0.65}]}`
          },
          {
            role: 'user',
            content: `Welke verkooptechnieken komen aan bod in dit transcript?\n\n${truncatedTranscript}`
          }
        ],
        max_tokens: 300,
        temperature: 0.2,
        response_format: { type: 'json_object' }
      }),
    });

    if (!chatResponse.ok) {
      const errText = await chatResponse.text();
      console.error(`[TechTag] OpenAI error for ${videoId}:`, errText);
      return [];
    }

    const chatData = await chatResponse.json();
    const content = chatData.choices?.[0]?.message?.content?.trim();
    if (!content) return [];

    let parsed;
    try {
      parsed = JSON.parse(content);
      if (parsed.techniques) parsed = parsed.techniques;
      if (parsed.technieken) parsed = parsed.technieken;
      if (!Array.isArray(parsed)) parsed = [parsed];
    } catch (e) {
      console.warn(`[TechTag] Failed to parse AI response for ${videoId}:`, content);
      return [];
    }

    const results = parsed
      .filter(t => t && t.id && techniekenIndex[t.id])
      .map(t => ({
        techniek_id: t.id,
        confidence: Math.min(Math.max(parseFloat(t.confidence) || 0.5, 0), 1),
        source: 'ai'
      }))
      .slice(0, 5);

    if (folderTechId && techniekenIndex[folderTechId]) {
      const existing = results.find(r => r.techniek_id === folderTechId);
      if (existing) {
        existing.confidence = Math.min(existing.confidence + 0.1, 0.99);
        existing.source = 'weighted';
      } else {
        results.push({ techniek_id: folderTechId, confidence: 0.6, source: 'folder' });
      }
    }

    results.sort((a, b) => b.confidence - a.confidence);
    if (results.length > 0) results[0].is_primary = true;

    console.log(`[TechTag] Detected ${results.length} techniques for ${videoId}: ${results.map(r => `${r.techniek_id}(${r.confidence.toFixed(2)})`).join(', ')}`);
    return results;
  } catch (err) {
    console.error(`[TechTag] Error detecting techniques for ${videoId}:`, err.message);
    return [];
  }
}

async function saveVideoTechnieken(videoId, techniques) {
  if (!supabaseAdmin || !techniques || techniques.length === 0) return false;

  try {
    const tableReady = await getVideoTechniekenReady();
    
    if (tableReady) {
      await supabaseAdmin
        .from('video_technieken')
        .delete()
        .eq('video_id', videoId);

      const rows = techniques.map(t => ({
        video_id: videoId,
        techniek_id: t.techniek_id,
        confidence: t.confidence,
        source: t.source || 'ai',
        is_primary: t.is_primary || false
      }));

      const { error } = await supabaseAdmin
        .from('video_technieken')
        .upsert(rows, { onConflict: 'video_id,techniek_id' });

      if (error) {
        console.error(`[TechTag] Junction table save failed, falling back to JSONB:`, error.message);
      } else {
        console.log(`[TechTag] Saved ${rows.length} techniques for ${videoId} (junction table)`);
        return true;
      }
    }

    const jsonData = techniques.map(t => ({
      techniek_id: t.techniek_id,
      confidence: t.confidence,
      source: t.source || 'ai',
      is_primary: t.is_primary || false
    }));

    const { error: jsonError } = await supabaseAdmin
      .from('video_ingest_jobs')
      .update({ detected_technieken: jsonData })
      .eq('id', videoId);

    if (jsonError) {
      if (jsonError.code === '42703') {
        console.warn('[TechTag] detected_technieken column does not exist yet. Add it with: ALTER TABLE video_ingest_jobs ADD COLUMN detected_technieken JSONB;');
        return false;
      }
      console.error(`[TechTag] JSONB save failed for ${videoId}:`, jsonError.message);
      return false;
    }

    console.log(`[TechTag] Saved ${jsonData.length} techniques for ${videoId} (JSONB fallback)`);
    return true;
  } catch (e) {
    console.error(`[TechTag] Error saving techniques for ${videoId}:`, e.message);
    return false;
  }
}

function computeWeightedTechnique(folderMatch, aiTechId, aiConfidence) {
  const FOLDER_WEIGHT = 0.50;
  const AI_WEIGHT = 0.50;

  if (folderMatch && !aiTechId) {
    return { techniek_id: folderMatch.techniek_id, confidence: folderMatch.score * FOLDER_WEIGHT, fase: folderMatch.fase };
  }
  if (!folderMatch && aiTechId) {
    return { techniek_id: aiTechId, confidence: (aiConfidence || 0.5) * AI_WEIGHT, fase: techniekenIndex?.[aiTechId]?.fase || null };
  }
  if (!folderMatch && !aiTechId) return null;

  const folderScore = folderMatch.score * FOLDER_WEIGHT;
  const aiScore = (aiConfidence || 0.5) * AI_WEIGHT;

  if (folderMatch.techniek_id === aiTechId) {
    return { techniek_id: aiTechId, confidence: Math.min(folderScore + aiScore, 0.99), fase: folderMatch.fase };
  }
  if (folderMatch.score >= 0.9 || folderScore >= aiScore) {
    return { techniek_id: folderMatch.techniek_id, confidence: folderScore, fase: folderMatch.fase };
  }
  return { techniek_id: aiTechId, confidence: aiScore, fase: techniekenIndex?.[aiTechId]?.fase || null };
}

async function generateAiSummary(videoId, title, transcript) {
  const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
  if (!OPENAI_API_KEY) {
    console.warn('[Summary] OpenAI API key niet geconfigureerd, samenvatting overgeslagen');
    return null;
  }
  if (!transcript) {
    return null;
  }
  
  try {
    const truncatedTranscript = transcript.length > 8000 ? transcript.slice(0, 8000) + '...' : transcript;
    const videoTitle = title || 'Onbekende video';
    
    const chatResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'Je bent een assistent die samenvattingen maakt van sales coaching video transcripten van Hugo Herbots. Maak een beknopte samenvatting in het Nederlands van maximaal 3-4 zinnen. Focus op de kernboodschap en de belangrijkste sales technieken die worden besproken. Schrijf in de derde persoon ("Hugo legt uit..." of "In deze video wordt besproken...").'
          },
          {
            role: 'user',
            content: `Maak een beknopte samenvatting van dit video transcript.\n\nVideo titel: ${videoTitle}\n\nTranscript:\n${truncatedTranscript}`
          }
        ],
        max_tokens: 300,
        temperature: 0.3,
      }),
    });
    
    if (!chatResponse.ok) {
      const errText = await chatResponse.text();
      console.error(`[Summary] OpenAI error for ${videoId}:`, errText);
      return null;
    }
    
    const chatData = await chatResponse.json();
    const summary = chatData.choices?.[0]?.message?.content?.trim();
    
    if (!summary) {
      console.warn(`[Summary] Geen samenvatting ontvangen voor ${videoId}`);
      return null;
    }
    
    if (supabaseAdmin) {
      const { error: updateError } = await supabaseAdmin
        .from('video_ingest_jobs')
        .update({ ai_summary: summary })
        .eq('id', videoId);
      
      if (updateError) {
        if (updateError.code === '42703') {
          console.warn('[Summary] ai_summary kolom bestaat nog niet in database');
        } else {
          console.error(`[Summary] Failed to save summary for ${videoId}:`, updateError.message);
        }
      }
    }
    
    console.log(`[Summary] Generated for ${videoId}: ${summary.slice(0, 80)}...`);
    return summary;
  } catch (err) {
    console.error(`[Summary] Error generating summary for ${videoId}:`, err.message);
    return null;
  }
}

async function generateAiTitle(videoId, title, transcript, techId, summary) {
  const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
  if (!OPENAI_API_KEY) {
    console.warn('[AITitle] OpenAI API key niet geconfigureerd, titel overgeslagen');
    return null;
  }
  if (!transcript && !summary) {
    console.warn(`[AITitle] Geen transcript of samenvatting voor ${videoId}, titel overgeslagen`);
    return null;
  }

  try {
    const originalTitle = title || 'Onbekende video';
    const transcriptSnippet = transcript ? transcript.slice(0, 3000) : '';
    const summaryText = summary || '';
    const techniqueId = techId || '';

    const chatResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `Je schrijft korte video titels in de stijl van Hugo Herbots, een Vlaamse sales trainer. Hugo spreekt direct, concreet en praktisch. Hij is een trainer, geen marketeer. Zijn taal is Vlaams Nederlands — nuchter, to-the-point, met vaktermen uit de verkoopwereld.

STIJLREGELS:
- Sentence case (alleen eerste woord + eigennamen met hoofdletter)
- 4 tot 8 woorden, NOOIT meer dan 8
- Direct en concreet: beschrijf WAT de techniek doet of WAT je leert
- Gebruik Hugo's eigen taalgebruik: "probing techniek", "pingpongtechniek", "exploratievragen", "OVB techniek", "afritten", "bezwaren behandelen"
- Varieer de structuren: soms een vraag, soms een constatatie, soms "hoe je...", soms een directe beschrijving
- Geen hashtags, geen nummers in de titel

VERBODEN WOORDEN (maximaal 5% van alle titels mag één van deze bevatten):
ontdek, de kracht van, de sleutel tot, creëer, transformeer, onweerstaanbaar, geheim, succesvol, meesterschap, ultieme, baanbrekend, revolutionair, onmisbaar, krachtige, perfecte

GOEDE VOORBEELDEN (dit is het niveau):
- "Waarom klanten 'ja' zeggen maar niet kopen"
- "De pingpongtechniek in de praktijk"
- "Zo stel je probing vragen die werken"
- "Wat is waarde eigenlijk voor jouw klant?"
- "Afritten behandelen zonder defensief te worden"
- "Bezwaren ombuigen in drie stappen"
- "Je eerste indruk bepaalt alles"
- "Hoe je een exploratiegesprek opbouwt"
- "Wanneer je beter kunt zwijgen"
- "De OVB techniek stap voor stap"

SLECHTE VOORBEELDEN (NOOIT zo schrijven):
- "Ontdek de Kracht van Effectieve Sales Technieken" (te lang, marketing, Title Case)
- "De Sleutel Tot Succesvol Verkopen" (cliché, Title Case)
- "Creëer Onweerstaanbare Verkoopgesprekken" (marketing-taal)
- "Het Ultieme Geheim van Topverkopers" (clickbait)

ANTWOORD: Geef ALLEEN de titel terug. Geen uitleg, geen aanhalingstekens.`
          },
          {
            role: 'user',
            content: `Schrijf een korte, directe video titel in Hugo's stijl.

Originele titel: ${originalTitle}
${techniqueId ? `Techniek: ${techniqueId}` : ''}
${summaryText ? `Samenvatting: ${summaryText}` : ''}
${transcriptSnippet ? `Transcript fragment: ${transcriptSnippet}` : ''}`
          }
        ],
        max_tokens: 40,
        temperature: 0.85,
      }),
    });

    if (!chatResponse.ok) {
      const errText = await chatResponse.text();
      console.error(`[AITitle] OpenAI error for ${videoId}:`, errText);
      return null;
    }

    const chatData = await chatResponse.json();
    let aiTitle = chatData.choices?.[0]?.message?.content?.trim();
    if (aiTitle) {
      aiTitle = aiTitle.split('\n')[0].trim();
      aiTitle = aiTitle.replace(/^["']|["']$/g, '');
      aiTitle = aiTitle.replace(/^[-–—•]\s*/, '');
      if (aiTitle.length > 80) {
        aiTitle = aiTitle.slice(0, 80).replace(/\s+\S*$/, '');
      }
    }

    if (!aiTitle) {
      console.warn(`[AITitle] Geen titel ontvangen voor ${videoId}`);
      return null;
    }

    if (supabaseAdmin) {
      const { error: updateError } = await supabaseAdmin
        .from('video_ingest_jobs')
        .update({ ai_attractive_title: aiTitle })
        .eq('id', videoId);

      if (updateError) {
        if (updateError.code === '42703') {
          console.warn('[AITitle] ai_attractive_title kolom bestaat nog niet — wordt automatisch aangemaakt bij volgende sync');
        } else {
          console.error(`[AITitle] Failed to save title for ${videoId}:`, updateError.message);
        }
        return aiTitle;
      }
    }

    console.log(`[AITitle] Generated for ${videoId}: "${originalTitle}" → "${aiTitle}"`);
    regenerateVideoMapping().catch(e => console.warn('[VideoMapping] bg update failed:', e.message));
    return aiTitle;
  } catch (err) {
    console.error(`[AITitle] Error generating title for ${videoId}:`, err.message);
    return null;
  }
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const stripePool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 3,
});

async function query(text, params) {
  const client = await pool.connect();
  try {
    const result = await client.query(text, params);
    return result;
  } finally {
    client.release();
  }
}

async function stripeQuery(text, params) {
  const client = await stripePool.connect();
  try {
    const result = await client.query(text, params);
    return result;
  } finally {
    client.release();
  }
}

const { register } = require('tsx/cjs/api');
register();
const stripeClientPath = path.resolve(__dirname, '../src/server/stripeClient.ts');
const { getStripeSync, getUncachableStripeClient, getStripePublishableKey } = require(stripeClientPath);
const { WebhookHandlers } = (() => {
  const _getStripeSync = getStripeSync;
  return {
    WebhookHandlers: {
      async processWebhook(payload, signature) {
        if (!Buffer.isBuffer(payload)) {
          throw new Error('Payload must be a Buffer');
        }
        const sync = await _getStripeSync();
        await sync.processWebhook(payload, signature);
      }
    }
  };
})();

async function initStripe() {
  try {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      console.warn('[Stripe] DATABASE_URL not set, skipping Stripe init');
      return;
    }

    const { runMigrations } = require('stripe-replit-sync');
    await runMigrations({ databaseUrl });
    console.log('[Stripe] Schema ready');

    const stripeSync = await getStripeSync();

    const domains = process.env.REPLIT_DOMAINS || '';
    const firstDomain = domains.split(',')[0];
    if (firstDomain) {
      try {
        const webhookBaseUrl = `https://${firstDomain}`;
        const result = await stripeSync.findOrCreateManagedWebhook(
          `${webhookBaseUrl}/api/stripe/webhook`
        );
        if (result?.webhook?.url) {
          console.log(`[Stripe] Webhook configured: ${result.webhook.url}`);
        } else {
          console.log('[Stripe] Webhook setup returned no URL, skipping (Stripe Sandbox may not support webhooks)');
        }
      } catch (webhookErr) {
        console.log(`[Stripe] Webhook setup skipped: ${webhookErr.message}`);
      }
    } else {
      console.log('[Stripe] REPLIT_DOMAINS not available, skipping webhook setup (dev mode)');
    }

    stripeSync.syncBackfill()
      .then(() => console.log('[Stripe] Data synced'))
      .catch((err) => console.error('[Stripe] Sync error:', err.message));
  } catch (err) {
    console.error('[Stripe] Init error:', err.message);
  }
}

let processingActive = false;
let lastOutput = [];

// Batch Queue System - Now delegates to Cloud Run for persistence
// Cloud Run handles the actual queue state and scheduling

async function getBatchStatus() {
  // Read batch state directly from Supabase (where Cloud Run worker stores it)
  // This avoids rate limiting issues with Cloud Run
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return {
      active: false,
      error: 'Supabase niet geconfigureerd',
      totalJobs: 0,
      remainingJobs: 0
    };
  }
  
  try {
    // Get batch state from Supabase video_batch_state table
    const stateResp = await fetch(`${SUPABASE_URL}/rest/v1/video_batch_state?select=*&order=updated_at.desc&limit=1`, {
      headers: { 
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`
      }
    });
    
    let batchActive = false;
    let processedJobs = 0;
    let failedJobs = 0;
    let totalInBatch = 0;
    let startedAt = null;
    
    if (stateResp.ok) {
      const stateData = await stateResp.json();
      if (stateData && stateData.length > 0) {
        // video_batch_state has flat columns, not nested state object
        const row = stateData[0];
        batchActive = row.batch_active || false;
        processedJobs = row.processed_jobs || 0;
        failedJobs = row.failed_jobs || 0;
        totalInBatch = row.total_jobs || 0;
        startedAt = row.started_at || null;
      }
    }
    
    // Get pending count from video_ingest_jobs (excluding archief folder)
    // Archief folder ID: 1E49dwl2hq_nhoe52bmK0DRn5ZhFdRGyq
    const ARCHIEF_FOLDER_ID = '1E49dwl2hq_nhoe52bmK0DRn5ZhFdRGyq';
    const pendingResp = await fetch(`${SUPABASE_URL}/rest/v1/video_ingest_jobs?select=id&status=eq.pending&drive_folder_id=neq.${ARCHIEF_FOLDER_ID}`, {
      headers: { 
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Prefer': 'count=exact'
      }
    });
    
    let pendingCount = 0;
    if (pendingResp.ok) {
      const countHeader = pendingResp.headers.get('content-range');
      if (countHeader) {
        const match = countHeader.match(/\/(\d+)/);
        if (match) pendingCount = parseInt(match[1], 10);
      }
    }
    
    // Get last completed video timestamp for health monitoring
    let lastCompletedAt = null;
    let minutesSinceLastCompletion = null;
    try {
      const lastCompletedResp = await fetch(
        `${SUPABASE_URL}/rest/v1/video_ingest_jobs?select=updated_at&status=eq.completed&order=updated_at.desc&limit=1`,
        {
          headers: { 
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`
          }
        }
      );
      if (lastCompletedResp.ok) {
        const lastCompletedData = await lastCompletedResp.json();
        if (lastCompletedData && lastCompletedData.length > 0) {
          lastCompletedAt = lastCompletedData[0].updated_at;
          const lastTime = new Date(lastCompletedAt).getTime();
          const now = Date.now();
          minutesSinceLastCompletion = Math.round((now - lastTime) / 60000);
        }
      }
    } catch (e) {
      console.error('[BatchQueue] Failed to get last completed:', e.message);
    }
    
    // Detect stalled worker: batch_active=true but no completions for 30+ mins with pending work
    const STALL_THRESHOLD_MINUTES = 30;
    const isStalled = batchActive && 
                      pendingCount > 0 && 
                      minutesSinceLastCompletion !== null && 
                      minutesSinceLastCompletion >= STALL_THRESHOLD_MINUTES;
    
    // If stalled for 6+ hours, consider the worker as effectively inactive
    const effectivelyInactive = isStalled && minutesSinceLastCompletion >= 360;
    
    return {
      active: effectivelyInactive ? false : batchActive, // Report inactive if stalled too long
      actualDbState: batchActive, // Keep the real DB state for debugging
      isStalled: isStalled,
      totalJobs: totalInBatch,
      remainingJobs: pendingCount,
      sentCount: processedJobs,
      errorCount: failedJobs,
      startedAt: startedAt,
      lastCompletedAt: lastCompletedAt,
      minutesSinceLastCompletion: minutesSinceLastCompletion,
      counters: {
        pending: pendingCount,
        processed_in_batch: processedJobs,
        failed_in_batch: failedJobs,
        total_in_batch: totalInBatch
      }
    };
  } catch (err) {
    console.error(`[BatchQueue] Supabase status failed: ${err.message}`);
    return { active: false, error: err.message };
  }
}

async function startBatchQueue(intervalMinutes = 15) {
  const CLOUD_RUN_URL = process.env.CLOUD_RUN_WORKER_URL;
  const WORKER_SECRET = process.env.CLOUD_RUN_WORKER_SECRET;
  
  console.log(`[BatchQueue] Config check - URL: ${CLOUD_RUN_URL ? 'SET' : 'MISSING'}, SECRET: ${WORKER_SECRET ? `SET (${WORKER_SECRET.length} chars)` : 'MISSING'}`);
  
  if (!CLOUD_RUN_URL || !WORKER_SECRET) {
    return { success: false, message: 'Cloud Run niet geconfigureerd' };
  }
  
  console.log(`[BatchQueue] Starting Cloud Run batch with ${intervalMinutes} min interval...`);
  
  try {
    const resp = await fetch(`${CLOUD_RUN_URL}/batch/start`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${WORKER_SECRET}` 
      },
      body: JSON.stringify({ interval_minutes: intervalMinutes })
    });
    
    const data = await resp.json();
    
    if (resp.ok && data.success) {
      console.log(`[BatchQueue] Cloud Run batch started: ${data.pending_jobs} jobs`);
      return { 
        success: true, 
        message: `Batch queue gestart met ${data.pending_jobs} jobs`,
        totalJobs: data.pending_jobs,
        estimatedDuration: `${Math.round(data.pending_jobs * intervalMinutes / 60)} uur`
      };
    } else {
      console.error(`[BatchQueue] Cloud Run start failed: ${data.error || data.message}`);
      return { success: false, message: data.error || data.message || 'Cloud Run error' };
    }
  } catch (err) {
    console.error(`[BatchQueue] Cloud Run start error: ${err.message}`);
    return { success: false, message: `Cloud Run error: ${err.message}` };
  }
}

async function stopBatchQueue() {
  const CLOUD_RUN_URL = process.env.CLOUD_RUN_WORKER_URL;
  const WORKER_SECRET = process.env.CLOUD_RUN_WORKER_SECRET;
  
  if (!CLOUD_RUN_URL || !WORKER_SECRET) {
    return { success: false, message: 'Cloud Run niet geconfigureerd' };
  }
  
  console.log(`[BatchQueue] Stopping Cloud Run batch...`);
  
  try {
    const resp = await fetch(`${CLOUD_RUN_URL}/batch/stop`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${WORKER_SECRET}` 
      }
    });
    
    const data = await resp.json();
    
    if (resp.ok && data.success) {
      console.log(`[BatchQueue] Cloud Run batch stopped`);
      return { 
        success: true, 
        message: data.message || 'Batch queue gestopt',
        cancelledTasks: data.cancelled_tasks || 0
      };
    } else {
      return { success: false, message: data.error || data.message || 'Cloud Run error' };
    }
  } catch (err) {
    console.error(`[BatchQueue] Cloud Run stop error: ${err.message}`);
    return { success: false, message: `Cloud Run error: ${err.message}` };
  }
}

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
  
  if (!hostname) {
    throw new Error('REPLIT_CONNECTORS_HOSTNAME niet beschikbaar');
  }
  
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
  
  if (!accessToken) {
    throw new Error('Google Drive niet verbonden - controleer connector in Replit');
  }
  
  return accessToken;
}

async function listDriveSubfolders(folderId, accessToken) {
  const folders = [];
  let pageToken = null;
  
  do {
    const query = `'${folderId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
    let url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=nextPageToken,files(id,name)&pageSize=1000&orderBy=name`;
    if (pageToken) url += `&pageToken=${pageToken}`;
    
    const response = await fetch(url, {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });
    
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Google Drive API fout: ${response.status} - ${text}`);
    }
    
    const data = await response.json();
    for (const folder of (data.files || [])) {
      folders.push({ id: folder.id, name: folder.name });
    }
    
    pageToken = data.nextPageToken || null;
  } while (pageToken);
  
  // Client-side natural sort as backup guarantee
  folders.sort((a, b) => a.name.localeCompare(b.name, 'nl', { numeric: true, sensitivity: 'base' }));
  return folders;
}

async function listDriveVideosInFolder(folderId, accessToken) {
  const videos = [];
  let pageToken = null;
  
  do {
    const query = `'${folderId}' in parents and mimeType contains 'video/' and trashed = false`;
    let url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=nextPageToken,files(id,name,mimeType,size,modifiedTime,parents)&pageSize=1000&orderBy=name`;
    if (pageToken) url += `&pageToken=${pageToken}`;
    
    const response = await fetch(url, {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });
    
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Google Drive API fout: ${response.status} - ${text}`);
    }
    
    const data = await response.json();
    
    for (const file of (data.files || [])) {
      videos.push({
        id: file.id,
        name: file.name,
        mimeType: file.mimeType,
        size: parseInt(file.size || '0'),
        modifiedTime: file.modifiedTime,
        folderId: (file.parents || [])[0]
      });
    }
    
    pageToken = data.nextPageToken || null;
  } while (pageToken);
  
  // Client-side natural sort as backup guarantee
  videos.sort((a, b) => a.name.localeCompare(b.name, 'nl', { numeric: true, sensitivity: 'base' }));
  return videos;
}

const ARCHIEF_FOLDER_ID = '1E49dwl2hq_nhoe52bmK0DRn5ZhFdRGyq';

// Original function that SKIPS archief - used for platform display
async function listDriveVideos(folderId, accessToken, depth = 0) {
  const indent = '  '.repeat(depth);
  
  // Skip archief folder and all its contents
  if (folderId === ARCHIEF_FOLDER_ID) {
    console.log(`${indent}[Drive] SKIPPING archief folder: ${folderId}`);
    return [];
  }
  
  console.log(`${indent}[Drive] Scanning folder: ${folderId}`);
  
  const videos = await listDriveVideosInFolder(folderId, accessToken);
  console.log(`${indent}[Drive] Found ${videos.length} videos in this folder`);
  
  const subfolders = await listDriveSubfolders(folderId, accessToken);
  console.log(`${indent}[Drive] Found ${subfolders.length} subfolders`);
  
  for (const subfolder of subfolders) {
    // Skip archief folder by name or ID
    if (subfolder.id === ARCHIEF_FOLDER_ID || subfolder.name.toLowerCase() === 'archief') {
      console.log(`${indent}[Drive] SKIPPING archief subfolder: ${subfolder.name}`);
      continue;
    }
    console.log(`${indent}[Drive] Recursing into: ${subfolder.name}`);
    const subVideos = await listDriveVideos(subfolder.id, accessToken, depth + 1);
    videos.push(...subVideos);
  }
  
  if (depth === 0) {
    console.log(`[Drive] Total videos found (excluding archief): ${videos.length}`);
  }
  
  return videos;
}

// NEW function that scans INCLUDING archief and marks which videos are in archief
// Returns { activeVideos: [...], archiefVideos: [...] }
async function listDriveVideosWithArchief(folderId, accessToken, depth = 0, isInArchief = false) {
  const indent = '  '.repeat(depth);
  const result = { activeVideos: [], archiefVideos: [] };
  
  // Check if this folder IS the archief folder — if so, SKIP entirely (rule: archief nooit verwerken)
  const currentIsArchief = isInArchief || folderId === ARCHIEF_FOLDER_ID;
  if (currentIsArchief) {
    console.log(`${indent}[Drive] SKIPPING archief folder: ${folderId}`);
    return result;
  }
  
  console.log(`${indent}[Drive] Scanning folder: ${folderId}`);
  
  const videos = await listDriveVideosInFolder(folderId, accessToken);
  console.log(`${indent}[Drive] Found ${videos.length} videos in this folder`);
  
  for (const video of videos) {
    video.isArchief = false;
    result.activeVideos.push(video);
  }
  
  const subfolders = await listDriveSubfolders(folderId, accessToken);
  console.log(`${indent}[Drive] Found ${subfolders.length} subfolders`);
  
  for (const subfolder of subfolders) {
    // Skip if this subfolder is archief (by ID or name)
    const subfolderIsArchief = subfolder.id === ARCHIEF_FOLDER_ID || subfolder.name.toLowerCase() === 'archief';
    if (subfolderIsArchief) {
      console.log(`${indent}[Drive] SKIPPING archief subfolder: ${subfolder.name}`);
      continue;
    }
    console.log(`${indent}[Drive] Recursing into: ${subfolder.name}`);
    
    const subResult = await listDriveVideosWithArchief(subfolder.id, accessToken, depth + 1, false);
    result.activeVideos.push(...subResult.activeVideos);
  }
  
  if (depth === 0) {
    console.log(`[Drive] Total active videos found: ${result.activeVideos.length}`);
  }
  
  return result;
}

async function listAllDriveFiles(folderId, accessToken) {
  const query = `'${folderId}' in parents and trashed = false`;
  const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name,mimeType,size)&pageSize=100`;
  
  console.log('[Drive Debug] Listing ALL files in folder:', folderId);
  
  const response = await fetch(url, {
    headers: { 'Authorization': `Bearer ${accessToken}` }
  });
  
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Google Drive API fout: ${response.status} - ${text}`);
  }
  
  return response.json();
}

// Accepts either a single folderId (string) or array of folderIds
async function syncVideosFromDrive(folderIdOrIds) {
  const folderIds = Array.isArray(folderIdOrIds) ? folderIdOrIds : [folderIdOrIds];
  
  const result = {
    success: true,
    added: [],
    unchanged: 0,
    archived: [],
    unarchived: [],
    deleted: [],
    errors: []
  };
  
  if (!supabaseAdmin) {
    throw new Error('Supabase niet geconfigureerd - controleer SUPABASE_URL en SUPABASE_SERVICE_ROLE_KEY');
  }
  
  console.log('[Sync] Getting Google Drive access token...');
  const accessToken = await getGoogleDriveAccessToken();
  console.log('[Sync] Access token obtained');
  
  console.log('[Sync] Listing videos from folders (including archief):', folderIds);
  
  // Scan ALL folders and combine results
  let allActiveVideos = [];
  let allArchiefVideos = [];
  
  for (const folderId of folderIds) {
    const { activeVideos, archiefVideos } = await listDriveVideosWithArchief(folderId, accessToken);
    allActiveVideos.push(...activeVideos);
    allArchiefVideos.push(...archiefVideos);
    console.log(`[Sync] Folder ${folderId}: ${activeVideos.length} active + ${archiefVideos.length} archief`);
  }
  
  const allDriveVideos = [...allActiveVideos, ...allArchiefVideos];
  console.log(`[Sync] Total: ${allActiveVideos.length} active + ${allArchiefVideos.length} archief = ${allDriveVideos.length} total`);
  
  // Create sets for quick lookup
  const activeFileIds = new Set(allActiveVideos.map(v => v.id));
  const archiefFileIds = new Set(allArchiefVideos.map(v => v.id));
  const allDriveFileIds = new Set(allDriveVideos.map(v => v.id));
  
  // Get only active (non-deleted) jobs — deduplicate by drive_file_id keeping the one with mux_playback_id
  const { data: existingJobs, error: fetchError } = await supabaseAdmin
    .from('video_ingest_jobs')
    .select('id, drive_file_id, drive_folder_id, drive_modified_time, status, mux_playback_id, video_title, is_hidden')
    .neq('status', 'deleted');
  
  if (fetchError) {
    throw new Error(`Fout bij ophalen bestaande jobs: ${fetchError.message}`);
  }
  
  // Deduplicate: per drive_file_id keep the row with mux_playback_id (or the latest)
  const existingMap = new Map();
  for (const job of (existingJobs || [])) {
    const existing = existingMap.get(job.drive_file_id);
    if (!existing || (job.mux_playback_id && !existing.mux_playback_id)) {
      existingMap.set(job.drive_file_id, job);
    }
  }
  console.log(`[Sync] Loaded ${existingJobs?.length || 0} jobs, deduplicated to ${existingMap.size} unique videos`);
  
  let skippedCopies = 0;
  
  // Process all videos from Drive
  for (const video of allDriveVideos) {
    if (video.name.startsWith('Kopie van ')) {
      skippedCopies++;
      continue;
    }
    
    const existing = existingMap.get(video.id);
    const shouldBeHidden = video.isArchief; // Video in archief = is_hidden true
    
    if (!existing) {
      // New video - add it
      try {
        const { error: insertError } = await supabaseAdmin
          .from('video_ingest_jobs')
          .insert({
            drive_file_id: video.id,
            drive_file_name: video.name,
            drive_folder_id: video.folderId,
            drive_file_size: video.size,
            drive_modified_time: video.modifiedTime,
            status: 'pending',
            video_title: video.name.replace(/\.[^/.]+$/, ''),
            is_hidden: shouldBeHidden
          });
        
        if (insertError) throw insertError;
        result.added.push({ name: video.name, id: video.id, isArchief: shouldBeHidden });
        console.log(`[Sync] Added: ${video.name}${shouldBeHidden ? ' (archief)' : ''}`);
      } catch (err) {
        result.errors.push(`Fout bij toevoegen ${video.name}: ${err.message}`);
      }
    } else if (existing.status === 'deleted') {
      // Restore previously deleted video
      try {
        const { error: restoreError } = await supabaseAdmin
          .from('video_ingest_jobs')
          .update({
            drive_file_name: video.name,
            drive_folder_id: video.folderId,
            drive_file_size: video.size,
            drive_modified_time: video.modifiedTime,
            status: 'pending',
            is_hidden: shouldBeHidden,
            error_message: null,
            retry_count: 0,
            updated_at: new Date().toISOString()
          })
          .eq('id', existing.id);
        
        if (restoreError) throw restoreError;
        result.added.push({ name: video.name, id: video.id, restored: true, isArchief: shouldBeHidden });
        console.log(`[Sync] Restored: ${video.name}${shouldBeHidden ? ' (archief)' : ''}`);
      } catch (err) {
        result.errors.push(`Fout bij herstellen ${video.name}: ${err.message}`);
      }
    } else {
      // Existing video - check if is_hidden status needs update
      if (existing.is_hidden !== shouldBeHidden) {
        try {
          await supabaseAdmin
            .from('video_ingest_jobs')
            .update({ is_hidden: shouldBeHidden, updated_at: new Date().toISOString() })
            .eq('id', existing.id);
          
          if (shouldBeHidden) {
            result.archived.push({ name: video.name, id: video.id });
            console.log(`[Sync] Archived: ${video.name} (moved to archief)`);
          } else {
            result.unarchived.push({ name: video.name, id: video.id });
            console.log(`[Sync] Unarchived: ${video.name} (moved out of archief)`);
          }
        } catch (err) {
          result.errors.push(`Fout bij archiveren ${video.name}: ${err.message}`);
        }
      } else {
        // Check for updates based on modified time
        const existingModified = new Date(existing.drive_modified_time || 0).getTime();
        const newModified = new Date(video.modifiedTime).getTime();
        
        if (newModified > existingModified && existing.status !== 'completed') {
          try {
            await supabaseAdmin
              .from('video_ingest_jobs')
              .update({
                drive_modified_time: video.modifiedTime,
                drive_file_size: video.size,
                status: 'pending',
                error_message: null,
                retry_count: 0
              })
              .eq('id', existing.id);
            
            result.added.push({ name: video.name, id: video.id, updated: true });
            console.log(`[Sync] Updated: ${video.name}`);
          } catch (err) {
            result.errors.push(`Fout bij updaten ${video.name}: ${err.message}`);
          }
        } else {
          result.unchanged++;
        }
      }
    }
  }
  
  if (skippedCopies > 0) {
    console.log(`[Sync] Skipped ${skippedCopies} backup copies (Kopie van...)`);
  }
  
  // STRUCTURAL FIX: Unhide videos that are is_hidden=true but NOT in the archief folder
  // This corrects historical data where videos were incorrectly marked as hidden
  const unhideCount = await autoFixHiddenVideos();
  if (unhideCount > 0) {
    result.unarchived = result.unarchived || [];
    console.log(`[Sync] Auto-fixed ${unhideCount} incorrectly hidden videos`);
  }
  
  // AUTO-ASSIGN playback_order based on Drive traversal order (Drive folder structure = correct order)
  // allActiveVideos is already in Drive folder order (orderBy=name, depth-first traversal)
  console.log(`[Sync] Assigning playback_order for ${allActiveVideos.length} active videos...`);
  const orderUpdates = [];
  for (let i = 0; i < allActiveVideos.length; i++) {
    const video = allActiveVideos[i];
    if (video.name.startsWith('Kopie van ')) continue;
    const job = existingMap.get(video.id);
    if (job) {
      orderUpdates.push({ id: job.id, playback_order: i + 1, drive_file_name: video.name });
    }
  }
  
  // Batch update playback_order in groups of 10
  const batchSize = 10;
  for (let i = 0; i < orderUpdates.length; i += batchSize) {
    const batch = orderUpdates.slice(i, i + batchSize);
    await Promise.all(batch.map(u =>
      supabaseAdmin.from('video_ingest_jobs')
        .update({ playback_order: u.playback_order, updated_at: new Date().toISOString() })
        .eq('id', u.id)
    ));
  }
  console.log(`[Sync] playback_order assigned for ${orderUpdates.length} videos`);
  result.ordersUpdated = orderUpdates.length;
  
  // DELETION LOGIC: Mark videos as deleted if they're NOT in Drive AT ALL (not active, not archief)
  // This means: if Hugo deletes a video from Drive completely, it gets deleted here + from RAG
  for (const [driveFileId, job] of existingMap) {
    // Only delete if video is NOT in active Drive AND not is_hidden (archief videos stay in DB even if not re-scanned)
    if (!allDriveFileIds.has(driveFileId) && job.status !== 'deleted' && !job.is_hidden) {
      try {
        // Mark job as deleted
        await supabaseAdmin
          .from('video_ingest_jobs')
          .update({ status: 'deleted', updated_at: new Date().toISOString() })
          .eq('id', job.id);
        
        // Remove from RAG documents (since video is completely gone)
        const sourceId = `video_${job.id}`;
        await supabaseAdmin
          .from('rag_documents')
          .delete()
          .eq('source_id', sourceId);
        
        result.deleted.push({ id: job.id, driveFileId, title: job.video_title });
        console.log(`[Sync] Deleted: ${job.video_title || driveFileId} (removed from Drive completely)`);
      } catch (err) {
        result.errors.push(`Fout bij verwijderen ${driveFileId}: ${err.message}`);
      }
    }
  }
  
  console.log(`[Sync] Complete: ${result.added.length} added/updated, ${result.unchanged} unchanged, ${result.archived.length} archived, ${result.unarchived.length} unarchived, ${result.deleted.length} deleted`);
  return result;
}

function checkAuth(req) {
  const authHeader = req.headers['authorization'] || req.headers['x-auth-token'];
  if (!authHeader) return false;
  const token = authHeader.replace('Bearer ', '');
  return token === AUTH_SECRET;
}

function runProcessing(jobId = null) {
  if (processingActive) {
    return { success: false, message: 'Verwerking is al bezig' };
  }
  
  processingActive = true;
  lastOutput = [];
  
  const args = ['scripts/process_videos.py'];
  if (jobId) {
    args.push('--job-id', jobId);
  }
  
  console.log(`[VideoProcessor] Starting: python3 ${args.join(' ')}`);
  
  const proc = spawn(PYTHON_BIN, args, {
    cwd: process.cwd(),
    env: process.env
  });
  
  proc.on('error', (err) => {
    console.error(`[VideoProcessor] Failed to start python process: ${err.message}`);
    processingActive = false;
    lastOutput.push(`ERROR: Python niet gevonden (${err.message})`);
  });

  proc.stdout.on('data', (data) => {
    const line = data.toString();
    console.log(`[Python] ${line}`);
    lastOutput.push(line);
    if (lastOutput.length > 100) lastOutput.shift();
  });
  
  proc.stderr.on('data', (data) => {
    const line = data.toString();
    console.error(`[Python Error] ${line}`);
    lastOutput.push(`ERROR: ${line}`);
    if (lastOutput.length > 100) lastOutput.shift();
  });
  
  proc.on('close', (code) => {
    console.log(`[VideoProcessor] Process exited with code ${code}`);
    processingActive = false;
    lastOutput.push(`\n--- Process afgerond (code: ${code}) ---`);
  });
  
  return { success: true, message: 'Verwerking gestart' };
}

const server = http.createServer((req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;
  
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Auth-Token');
  
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }
  
  if (pathname === '/api/video-processor/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', processing: processingActive }));
    return;
  }
  
  if (pathname === '/api/video-processor/start' && req.method === 'POST') {
    if (!checkAuth(req)) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, message: 'Niet geautoriseerd' }));
      return;
    }
    
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      let jobId = null;
      try {
        const data = JSON.parse(body || '{}');
        jobId = data.jobId;
      } catch (e) {}
      
      const result = runProcessing(jobId);
      res.writeHead(result.success ? 200 : 409, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(result));
    });
    return;
  }
  
  if (pathname === '/api/video-processor/status') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      processing: processingActive,
      output: lastOutput.slice(-20)
    }));
    return;
  }
  
  // Preview sync - shows what would happen without making changes
  if (pathname === '/api/video-processor/sync-preview' && req.method === 'POST') {
    if (!checkAuth(req)) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, message: 'Niet geautoriseerd' }));
      return;
    }
    
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const data = JSON.parse(body || '{}');
        const folderIds = data.folderIds || [];
        
        if (!folderIds.length) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, message: 'folderIds is vereist' }));
          return;
        }
        
        console.log('[VideoProcessor] Preview sync for folders:', folderIds);
        
        const accessToken = await getGoogleDriveAccessToken();
        
        let allActiveVideos = [];
        let allArchiefVideos = [];
        const folderResults = [];
        
        for (const folderId of folderIds) {
          // Use the new function that scans including archief
          const { activeVideos, archiefVideos } = await listDriveVideosWithArchief(folderId, accessToken);
          const nonCopyActive = activeVideos.filter(v => !v.name.startsWith('Kopie van '));
          const nonCopyArchief = archiefVideos.filter(v => !v.name.startsWith('Kopie van '));
          allActiveVideos.push(...nonCopyActive);
          allArchiefVideos.push(...nonCopyArchief);
          folderResults.push({
            folderId,
            activeVideos: nonCopyActive.length,
            archiefVideos: nonCopyArchief.length,
            copiesSkipped: (activeVideos.length - nonCopyActive.length) + (archiefVideos.length - nonCopyArchief.length)
          });
        }
        
        const allDriveVideos = [...allActiveVideos, ...allArchiefVideos];
        const allDriveFileIds = new Set(allDriveVideos.map(v => v.id));
        const archiefFileIds = new Set(allArchiefVideos.map(v => v.id));
        
        // Get existing jobs from database
        const { data: existingJobs } = await supabaseAdmin
          .from('video_ingest_jobs')
          .select('id, drive_file_id, status, video_title, drive_file_name, is_hidden');
        
        const existingActive = (existingJobs || []).filter(j => j.status !== 'deleted');
        const existingDeleted = (existingJobs || []).filter(j => j.status === 'deleted');
        
        // Calculate what would happen
        const wouldAdd = [];
        const wouldRestore = [];
        const wouldMarkDeleted = [];
        const wouldArchive = [];
        const wouldUnarchive = [];
        const unchanged = [];
        
        for (const job of existingActive) {
          if (!allDriveFileIds.has(job.drive_file_id)) {
            // Video not in Drive at all = would be deleted
            wouldMarkDeleted.push({
              id: job.id,
              name: job.video_title || job.drive_file_name
            });
          } else if (archiefFileIds.has(job.drive_file_id) && !job.is_hidden) {
            // Video in archief but not marked as hidden = would be archived
            wouldArchive.push({
              id: job.id,
              name: job.video_title || job.drive_file_name
            });
          } else if (!archiefFileIds.has(job.drive_file_id) && job.is_hidden) {
            // Video not in archief but marked as hidden = would be unarchived
            wouldUnarchive.push({
              id: job.id,
              name: job.video_title || job.drive_file_name
            });
          } else {
            unchanged.push(job.id);
          }
        }
        
        // Check for videos in Drive but not in DB (new or restored)
        const existingFileIds = new Set((existingJobs || []).map(j => j.drive_file_id));
        const deletedFileIds = new Set(existingDeleted.map(j => j.drive_file_id));
        
        for (const video of allDriveVideos) {
          if (!existingFileIds.has(video.id)) {
            wouldAdd.push({ id: video.id, name: video.name, isArchief: video.isArchief });
          } else if (deletedFileIds.has(video.id)) {
            const job = existingDeleted.find(j => j.drive_file_id === video.id);
            wouldRestore.push({
              id: job?.id,
              name: job?.video_title || job?.drive_file_name,
              isArchief: video.isArchief
            });
          }
        }
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: true,
          preview: true,
          folders: folderResults,
          summary: {
            activeInDrive: allActiveVideos.length,
            archiefInDrive: allArchiefVideos.length,
            totalInDrive: allDriveVideos.length,
            existingInDatabase: existingActive.length,
            wouldAdd: wouldAdd.length,
            wouldRestore: wouldRestore.length,
            wouldMarkDeleted: wouldMarkDeleted.length,
            wouldArchive: wouldArchive.length,
            wouldUnarchive: wouldUnarchive.length,
            unchanged: unchanged.length
          },
          details: {
            wouldMarkDeleted: wouldMarkDeleted.slice(0, 10),
            wouldArchive: wouldArchive.slice(0, 10),
            wouldUnarchive: wouldUnarchive.slice(0, 10),
            wouldRestore: wouldRestore.slice(0, 10)
          },
          explanation: {
            deleted: 'Video\'s die NIET meer in Drive staan worden verwijderd van platform EN uit RAG',
            archived: 'Video\'s in archief worden verborgen op platform maar BLIJVEN in RAG voor tone of voice',
            unarchived: 'Video\'s uit archief gehaald worden weer zichtbaar op platform'
          }
        }));
      } catch (err) {
        console.error('[VideoProcessor] Preview error:', err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, message: err.message }));
      }
    });
    return;
  }

  if (pathname === '/api/video-processor/sync' && req.method === 'POST') {
    if (!checkAuth(req)) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, message: 'Niet geautoriseerd' }));
      return;
    }
    
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const data = JSON.parse(body || '{}');
        const folderIds = data.folderIds || (data.folderId ? [data.folderId] : []);
        
        if (!folderIds.length) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, message: 'folderId of folderIds is vereist' }));
          return;
        }
        
        // Return 202 immediately — sync runs as a separate spawned process to avoid memory issues
        console.log('[VideoProcessor] Spawning standalone sync for folders:', folderIds);
        res.writeHead(202, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, message: 'Sync gestart op de achtergrond. Video\'s worden bijgewerkt, herlaad de pagina over ~35 seconden.' }));
        
        // Spawn as completely separate process (inherits env vars including REPLIT_CONNECTORS_HOSTNAME)
        const { spawn } = require('child_process');
        const child = spawn('node', ['scripts/sync_drive_order_standalone.js', ...folderIds], {
          detached: true,
          stdio: ['ignore', 'pipe', 'pipe'],
          env: process.env
        });
        child.stdout.on('data', d => process.stdout.write('[SyncChild] ' + d));
        child.stderr.on('data', d => process.stderr.write('[SyncChild] ' + d));
        child.on('close', code => console.log(`[VideoProcessor] Standalone sync exited with code ${code}`));
        child.unref();
        
      } catch (err) {
        console.error('[VideoProcessor] Sync parse error:', err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, message: err.message }));
      }
    });
    return;
  }
  
  // PATCH /api/admin/sessions/:id — update webinar title, date, description
  if (pathname.match(/^\/api\/admin\/sessions\/[^/]+$/) && req.method === 'PATCH') {
    const sessionId = pathname.replace('/api/admin/sessions/', '');
    if (!supabaseAdmin) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, message: 'Server niet correct geconfigureerd' }));
      return;
    }
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const patch = JSON.parse(body || '{}');
        const allowed = {};
        if (patch.title !== undefined) allowed.title = patch.title;
        if (patch.scheduledDate !== undefined) allowed.scheduled_date = patch.scheduledDate;
        if (patch.scheduled_date !== undefined) allowed.scheduled_date = patch.scheduled_date;
        if (patch.description !== undefined) allowed.description = patch.description;
        if (patch.topic !== undefined) allowed.topic = patch.topic;
        const { data, error } = await supabaseAdmin
          .from('live_sessions')
          .update(allowed)
          .eq('id', sessionId)
          .select()
          .single();
        if (error) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, message: error.message }));
        } else {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, session: data }));
        }
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, message: 'Server error' }));
      }
    });
    return;
  }

  // POST /api/admin/sessions — create new webinar
  if (pathname === '/api/admin/sessions' && req.method === 'POST') {
    if (!supabaseAdmin) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, message: 'Server niet correct geconfigureerd' }));
      return;
    }
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const { title, scheduledDate, scheduled_date, description, topic, level } = JSON.parse(body || '{}');
        const { data, error } = await supabaseAdmin
          .from('live_sessions')
          .insert({
            title: title || 'Nieuw Webinar',
            scheduled_date: scheduledDate || scheduled_date || new Date().toISOString(),
            description: description || '',
            topic: topic || '',
            level: level || 'intermediate',
            status: 'scheduled'
          })
          .select()
          .single();
        if (error) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, message: error.message }));
        } else {
          res.writeHead(201, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, session: data }));
        }
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, message: 'Server error' }));
      }
    });
    return;
  }

  if (pathname.startsWith('/api/admin/sessions/') && req.method === 'DELETE') {
    const sessionId = pathname.replace('/api/admin/sessions/', '');
    
    if (!supabaseAdmin) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, message: 'Server niet correct geconfigureerd' }));
      return;
    }
    
    (async () => {
      try {
        const { error } = await supabaseAdmin
          .from('live_sessions')
          .delete()
          .eq('id', sessionId);
        
        if (error) {
          console.error('[Admin] Delete failed:', error);
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, message: error.message }));
        } else {
          console.log('[Admin] Session deleted:', sessionId);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true }));
        }
      } catch (err) {
        console.error('[Admin] Delete error:', err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, message: 'Server error' }));
      }
    })();
    return;
  }
  
  // Start session endpoint - uses service role to bypass RLS
  if (pathname.match(/^\/api\/admin\/sessions\/[^/]+\/start$/) && req.method === 'POST') {
    const sessionId = pathname.split('/')[4];
    
    if (!supabaseAdmin) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, message: 'Server niet correct geconfigureerd' }));
      return;
    }
    
    const dailyApiKey = process.env.DAILY_API_KEY;
    if (!dailyApiKey) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, message: 'DAILY_API_KEY niet geconfigureerd' }));
      return;
    }
    
    (async () => {
      try {
        // First check if session already has a Daily room
        const { data: existingSession } = await supabaseAdmin
          .from('live_sessions')
          .select('daily_room_name, daily_room_url')
          .eq('id', sessionId)
          .single();
        
        let dailyRoomName = existingSession?.daily_room_name;
        let dailyRoomUrl = existingSession?.daily_room_url;
        
        // Create Daily room if not exists
        if (!dailyRoomName) {
          const roomName = `hugo-live-${sessionId.slice(0, 8)}-${Date.now()}`;
          console.log('[Daily] Creating room:', roomName);
          
          const dailyResponse = await fetch('https://api.daily.co/v1/rooms', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${dailyApiKey}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              name: roomName,
              privacy: 'public',
              properties: {
                enable_chat: true,
                enable_screenshare: true,
                enable_recording: 'cloud',
                enable_knocking: true,
                exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60) // 24 hours
              }
            })
          });
          
          if (!dailyResponse.ok) {
            const err = await dailyResponse.json();
            throw new Error(`Daily room aanmaken mislukt: ${err.error || dailyResponse.status}`);
          }
          
          const dailyRoom = await dailyResponse.json();
          dailyRoomName = dailyRoom.name;
          dailyRoomUrl = dailyRoom.url;
          console.log('[Daily] Room created:', dailyRoomUrl);
        }
        
        // Update session with Daily room and set status to live
        const { data: session, error } = await supabaseAdmin
          .from('live_sessions')
          .update({ 
            status: 'live',
            daily_room_name: dailyRoomName,
            daily_room_url: dailyRoomUrl,
            updated_at: new Date().toISOString()
          })
          .eq('id', sessionId)
          .select()
          .single();
        
        if (error) {
          console.error('[Admin] Start session failed:', error);
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, message: error.message }));
        } else {
          console.log('[Admin] Session started:', sessionId, 'Room:', dailyRoomUrl);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ 
            success: true, 
            session: {
              id: session.id,
              title: session.title,
              status: session.status,
              dailyRoomName: session.daily_room_name || '',
              dailyRoomUrl: session.daily_room_url || ''
            }
          }));
        }
      } catch (err) {
        console.error('[Admin] Start session error:', err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, message: err.message || 'Server error' }));
      }
    })();
    return;
  }
  
  // Get meeting token endpoint - generates Daily meeting token
  if (pathname.match(/^\/api\/admin\/sessions\/[^/]+\/token$/) && req.method === 'GET') {
    const sessionId = pathname.split('/')[4];
    
    if (!supabaseAdmin) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, message: 'Server niet correct geconfigureerd' }));
      return;
    }
    
    const dailyApiKey = process.env.DAILY_API_KEY;
    if (!dailyApiKey) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, message: 'DAILY_API_KEY niet geconfigureerd' }));
      return;
    }
    
    (async () => {
      try {
        const { data: session } = await supabaseAdmin
          .from('live_sessions')
          .select('daily_room_name, daily_room_url')
          .eq('id', sessionId)
          .single();
        
        if (!session?.daily_room_name) {
          throw new Error('Sessie heeft geen Daily room');
        }
        
        // Generate meeting token
        const tokenResponse = await fetch('https://api.daily.co/v1/meeting-tokens', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${dailyApiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            properties: {
              room_name: session.daily_room_name,
              is_owner: true,
              enable_screenshare: true,
              enable_recording: 'cloud',
              exp: Math.floor(Date.now() / 1000) + (4 * 60 * 60) // 4 hours
            }
          })
        });
        
        if (!tokenResponse.ok) {
          const err = await tokenResponse.json();
          throw new Error(`Token genereren mislukt: ${err.error || tokenResponse.status}`);
        }
        
        const tokenData = await tokenResponse.json();
        console.log('[Daily] Token generated for room:', session.daily_room_name);
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
          success: true, 
          token: tokenData.token,
          roomUrl: session.daily_room_url,
          roomName: session.daily_room_name,
          isHost: true
        }));
      } catch (err) {
        console.error('[Admin] Get token error:', err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, message: err.message || 'Server error' }));
      }
    })();
    return;
  }
  
  // End session endpoint - uses service role to bypass RLS
  // Also fetches Daily.co recording and schedules pipeline processing
  if (pathname.match(/^\/api\/admin\/sessions\/[^/]+\/end$/) && req.method === 'POST') {
    const sessionId = pathname.split('/')[4];
    
    if (!supabaseAdmin) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, message: 'Server niet correct geconfigureerd' }));
      return;
    }
    
    (async () => {
      try {
        // First get the session to check for Daily room
        const { data: existingSession } = await supabaseAdmin
          .from('live_sessions')
          .select('daily_room_name, recording_id')
          .eq('id', sessionId)
          .single();
        
        let recordingUrl = null;
        const dailyApiKey = process.env.DAILY_API_KEY;
        
        // Try to fetch recording from Daily.co if room exists
        if (existingSession?.daily_room_name && dailyApiKey) {
          try {
            console.log('[Daily] Fetching recordings for room:', existingSession.daily_room_name);
            
            // Stop any active recording first
            await fetch(`https://api.daily.co/v1/rooms/${existingSession.daily_room_name}/recordings/stop`, {
              method: 'POST',
              headers: { 'Authorization': `Bearer ${dailyApiKey}` }
            }).catch(() => {}); // Ignore errors if no active recording
            
            // Wait a moment for recording to finalize
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            // Fetch all recordings for this room
            const recordingsResponse = await fetch(
              `https://api.daily.co/v1/recordings?room_name=${existingSession.daily_room_name}`,
              {
                headers: { 'Authorization': `Bearer ${dailyApiKey}` }
              }
            );
            
            if (recordingsResponse.ok) {
              const recordingsData = await recordingsResponse.json();
              const recordings = recordingsData.data || [];
              
              // Get the most recent recording
              if (recordings.length > 0) {
                const latestRecording = recordings.sort((a, b) => 
                  new Date(b.start_ts).getTime() - new Date(a.start_ts).getTime()
                )[0];
                
                console.log('[Daily] Found recording:', latestRecording.id, 'status:', latestRecording.status);
                
                // Get access link for the recording
                if (latestRecording.status === 'finished' || latestRecording.status === 'saved') {
                  const accessResponse = await fetch(
                    `https://api.daily.co/v1/recordings/${latestRecording.id}/access-link`,
                    {
                      headers: { 'Authorization': `Bearer ${dailyApiKey}` }
                    }
                  );
                  
                  if (accessResponse.ok) {
                    const accessData = await accessResponse.json();
                    recordingUrl = accessData.download_link;
                    console.log('[Daily] Got recording URL:', recordingUrl ? 'success' : 'failed');
                  }
                } else {
                  console.log('[Daily] Recording not yet finished, status:', latestRecording.status);
                  // Schedule a delayed check for recording availability
                  // For now just save the recording_id for later retrieval
                }
              }
            }
          } catch (recordingErr) {
            console.error('[Daily] Error fetching recording:', recordingErr.message);
          }
        }
        
        // Update session with ended status and recording URL if available
        const updateData = { 
          status: 'ended',
          updated_at: new Date().toISOString()
        };
        
        if (recordingUrl) {
          updateData.video_url = recordingUrl;
        }
        
        const { data: session, error } = await supabaseAdmin
          .from('live_sessions')
          .update(updateData)
          .eq('id', sessionId)
          .select()
          .single();
        
        if (error) {
          console.error('[Admin] End session failed:', error);
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, message: error.message }));
        } else {
          console.log('[Admin] Session ended:', sessionId, 'Recording:', recordingUrl ? 'available' : 'pending');
          
          // Log if recording is available for future transcription pipeline
          if (recordingUrl) {
            console.log('[Admin] Recording available for session:', sessionId);
            console.log('[Admin] Recording URL stored in live_sessions.video_url');
            
            // Queue webinar recording for transcription pipeline
            try {
              const { error: queueError } = await supabaseAdmin
                .from('video_ingest_jobs')
                .insert({
                  source_type: 'webinar_recording',
                  source_url: recordingUrl,
                  title: session.title || `Webinar Recording ${sessionId}`,
                  status: 'queued',
                  skip_greenscreen: true,
                  skip_mux_upload: false, // Trigger Mux upload for streaming
                  metadata: {
                    session_id: sessionId,
                    session_title: session.title,
                    recorded_at: new Date().toISOString()
                  }
                });
              
              if (queueError) {
                console.error('[Admin] Failed to queue webinar for transcription:', queueError);
              } else {
                console.log('[Admin] Webinar recording queued for transcription pipeline');
              }
            } catch (queueErr) {
              console.error('[Admin] Error queueing webinar recording:', queueErr);
            }
          }
          
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ 
            success: true, 
            session,
            hasRecording: !!recordingUrl
          }));
        }
      } catch (err) {
        console.error('[Admin] End session error:', err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, message: 'Server error' }));
      }
    })();
    return;
  }
  
  if (pathname === '/api/video-processor/debug-folder' && req.method === 'POST') {
    if (!checkAuth(req)) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, message: 'Niet geautoriseerd' }));
      return;
    }
    
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const data = JSON.parse(body || '{}');
        const folderId = data.folderId;
        
        if (!folderId) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, message: 'folderId is vereist' }));
          return;
        }
        
        const accessToken = await getGoogleDriveAccessToken();
        const result = await listAllDriveFiles(folderId, accessToken);
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, files: result.files || [] }));
      } catch (err) {
        console.error('[VideoProcessor] Debug folder error:', err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, message: err.message }));
      }
    });
    return;
  }
  
  // Playback Order endpoint - returns ready videos sorted by playback_order
  if (pathname === '/api/videos/playback-order' && req.method === 'GET') {
    (async () => {
      try {
        if (!supabaseAdmin) {
          throw new Error('Supabase niet geconfigureerd');
        }

        let pipelineVideos = null;
        let pipelineError = null;
        let pbOrderAvailable = true;

        const pbResult = await supabaseAdmin
          .from('video_ingest_jobs')
          .select('id,video_title,drive_file_name,techniek_id,playback_order,mux_playback_id,duration_seconds,mux_asset_id')
          .neq('status', 'deleted')
          .in('status', ['completed', 'processed'])
          .not('mux_playback_id', 'is', null);

        if (pbResult.error && pbResult.error.code === '42703') {
          pbOrderAvailable = false;
          const fallback = await supabaseAdmin
            .from('video_ingest_jobs')
            .select('id,video_title,drive_file_name,techniek_id,mux_playback_id,duration_seconds,mux_asset_id')
            .neq('status', 'deleted')
            .in('status', ['completed', 'processed'])
            .not('mux_playback_id', 'is', null);
          pipelineVideos = fallback.data;
          pipelineError = fallback.error;
        } else {
          pipelineVideos = pbResult.data;
          pipelineError = pbResult.error;
        }

        if (pipelineError) throw pipelineError;

        const mappedPipeline = (pipelineVideos || []).map(job => ({
          id: job.id,
          title: job.video_title || job.drive_file_name,
          technique_id: job.techniek_id || null,
          playback_order: pbOrderAvailable && job.playback_order != null ? job.playback_order : null,
          mux_playback_id: job.mux_playback_id,
          duration: job.duration_seconds || null,
          thumbnail_url: `https://image.mux.com/${job.mux_playback_id}/thumbnail.jpg?time=5`,
          source: 'pipeline'
        }));

        let manualVideos = [];
        try {
          let manualData = null;
          let manualError = null;
          let manualHasPbOrder = pbOrderAvailable;

          const manualResult = await supabaseAdmin
            .from('videos')
            .select('id,title,technique_id,playback_order,mux_playback_id,duration_seconds,thumbnail_url,mux_asset_id')
            .is('deleted_at', null)
            .not('mux_playback_id', 'is', null)
            .in('status', ['ready', 'completed', 'processed']);

          if (manualResult.error && manualResult.error.code === '42703') {
            manualHasPbOrder = false;
            const fallback = await supabaseAdmin
              .from('videos')
              .select('id,title,technique_id,mux_playback_id,duration_seconds,thumbnail_url,mux_asset_id')
              .is('deleted_at', null)
              .not('mux_playback_id', 'is', null)
              .in('status', ['ready', 'completed', 'processed']);
            manualData = fallback.data;
            manualError = fallback.error;
          } else {
            manualData = manualResult.data;
            manualError = manualResult.error;
          }

          if (!manualError && manualData) {
            manualVideos = manualData.map(v => ({
              id: v.id,
              title: v.title,
              technique_id: v.technique_id || null,
              playback_order: manualHasPbOrder && v.playback_order != null ? v.playback_order : null,
              mux_playback_id: v.mux_playback_id,
              duration: v.duration_seconds || null,
              thumbnail_url: v.thumbnail_url || `https://image.mux.com/${v.mux_playback_id}/thumbnail.jpg?time=5`,
              source: 'manual'
            }));
          }
        } catch (e) {
          console.log('[VideoProcessor] Manual videos table not available for playback-order');
        }

        const allVideos = [...mappedPipeline, ...manualVideos];

        allVideos.sort((a, b) => {
          const aOrder = a.playback_order != null ? a.playback_order : Infinity;
          const bOrder = b.playback_order != null ? b.playback_order : Infinity;
          if (aOrder !== bOrder) return aOrder - bOrder;
          const aT = a.technique_id || '';
          const bT = b.technique_id || '';
          return aT.localeCompare(bT);
        });

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, videos: allVideos }));
      } catch (err) {
        console.error('[VideoProcessor] Playback order error:', err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, message: err.message }));
      }
    })();
    return;
  }

  // Reorder videos - update playback_order for multiple videos
  if (pathname === '/api/videos/reorder' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        if (!supabaseAdmin) {
          throw new Error('Supabase niet geconfigureerd');
        }

        const data = JSON.parse(body || '{}');
        const orders = data.orders;

        if (!Array.isArray(orders) || orders.length === 0) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, message: 'orders array is vereist' }));
          return;
        }

        let updated = 0;

        for (const item of orders) {
          const { id, playback_order, source } = item;
          if (!id || playback_order == null) continue;

          const tableName = source === 'manual' ? 'videos' : 'video_ingest_jobs';
          const { error } = await supabaseAdmin
            .from(tableName)
            .update({ playback_order })
            .eq('id', id);

          if (error) {
            console.warn(`[VideoProcessor] Failed to update playback_order for ${id} in ${tableName}:`, error.message);
          } else {
            updated++;
          }
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, updated }));
      } catch (err) {
        console.error('[VideoProcessor] Reorder error:', err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, message: err.message }));
      }
    });
    return;
  }

  // Auto-order videos based on Google Drive folder structure
  if (pathname === '/api/videos/auto-order-from-drive' && req.method === 'POST') {
    if (!checkAuth(req)) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, message: 'Niet geautoriseerd' }));
      return;
    }
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        if (!supabaseAdmin) {
          throw new Error('Supabase niet geconfigureerd');
        }

        const parsed = JSON.parse(body || '{}');
        const dryRun = parsed.dry_run === true;

        console.log(`[AutoOrder] Starting auto-order from Drive structure (dry_run: ${dryRun})`);

        const accessToken = await getGoogleDriveAccessToken();
        const HUGO_FOLDER_ID = '1Oaww3IMBcFZ1teFvSoqAUART2B6Q6VrT';
        const ARCHIEF_ID = '1E49dwl2hq_nhoe52bmK0DRn5ZhFdRGyq';

        async function scanFolderTree(folderId, path, depth) {
          if (folderId === ARCHIEF_ID) return [];
          const results = [];

          const videos = await listDriveVideosInFolder(folderId, accessToken);
          for (const v of videos) {
            results.push({ driveFileId: v.id, name: v.name, path: path || '(root)' });
          }

          const subfolders = await listDriveSubfolders(folderId, accessToken);
          for (const sf of subfolders) {
            if (sf.id === ARCHIEF_ID || sf.name.toLowerCase() === 'archief') continue;
            const subPath = path ? path + '/' + sf.name : sf.name;
            const subResults = await scanFolderTree(sf.id, subPath, depth + 1);
            results.push(...subResults);
          }

          return results;
        }

        console.log('[AutoOrder] Scanning Drive folder tree...');
        const driveTree = await scanFolderTree(HUGO_FOLDER_ID, '', 0);
        console.log(`[AutoOrder] Found ${driveTree.length} videos in Drive tree`);
        // The traversal order from scanFolderTree IS the correct playback order:
        // listDriveSubfolders and listDriveVideosInFolder both use orderBy=name
        // (Drive API) + client-side natural sort, so the depth-first traversal
        // already reflects the exact alphabetical/numerical folder structure.

        const { data: pipelineVideos } = await supabaseAdmin
          .from('video_ingest_jobs')
          .select('id,drive_file_id,video_title,drive_file_name,status')
          .neq('status', 'deleted');

        const { data: manualVideos } = await supabaseAdmin
          .from('videos')
          .select('id,drive_file_id,title,status');

        const driveIdToDbVideo = {};
        for (const v of (pipelineVideos || [])) {
          if (v.drive_file_id) {
            driveIdToDbVideo[v.drive_file_id] = { id: v.id, source: 'pipeline', title: v.video_title || v.drive_file_name };
          }
        }
        for (const v of (manualVideos || [])) {
          if (v.drive_file_id) {
            driveIdToDbVideo[v.drive_file_id] = { id: v.id, source: 'manual', title: v.title };
          }
        }

        const orderedUpdates = [];
        let order = 1;
        const unmatched = [];

        for (const driveVideo of driveTree) {
          const dbVideo = driveIdToDbVideo[driveVideo.driveFileId];
          if (dbVideo) {
            orderedUpdates.push({
              id: dbVideo.id,
              source: dbVideo.source,
              playback_order: order,
              title: dbVideo.title,
              drive_path: driveVideo.path,
              drive_name: driveVideo.name,
            });
            order++;
          } else {
            unmatched.push({ driveFileId: driveVideo.driveFileId, name: driveVideo.name, path: driveVideo.path });
          }
        }

        const dbDriveIds = new Set(driveTree.map(v => v.driveFileId));
        const orphanVideos = [];
        for (const v of (pipelineVideos || [])) {
          if (v.drive_file_id && !dbDriveIds.has(v.drive_file_id)) {
            orphanVideos.push({ id: v.id, title: v.video_title || v.drive_file_name, source: 'pipeline' });
          }
        }
        for (const v of (manualVideos || [])) {
          if (v.drive_file_id && !dbDriveIds.has(v.drive_file_id)) {
            orphanVideos.push({ id: v.id, title: v.title, source: 'manual' });
          }
        }
        for (const orphan of orphanVideos) {
          orderedUpdates.push({
            id: orphan.id,
            source: orphan.source,
            playback_order: order,
            title: orphan.title,
            drive_path: '(niet in Drive-mapstructuur)',
            drive_name: orphan.title,
          });
          order++;
        }

        console.log(`[AutoOrder] Matched: ${orderedUpdates.length}, Unmatched Drive files: ${unmatched.length}`);

        if (!dryRun) {
          let updated = 0;
          for (const item of orderedUpdates) {
            const tableName = item.source === 'manual' ? 'videos' : 'video_ingest_jobs';
            const { error } = await supabaseAdmin
              .from(tableName)
              .update({ playback_order: item.playback_order })
              .eq('id', item.id);
            if (error) {
              console.warn(`[AutoOrder] Failed to update ${item.id}: ${error.message}`);
            } else {
              updated++;
            }
          }
          console.log(`[AutoOrder] Updated ${updated} videos`);
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: true,
          dry_run: dryRun,
          total_drive_videos: driveTree.length,
          matched: orderedUpdates.length,
          unmatched_drive_files: unmatched.length,
          orphan_db_videos: orphanVideos.length,
          order: orderedUpdates.map(u => ({
            order: u.playback_order,
            title: u.title,
            drive_path: u.drive_path,
            drive_name: u.drive_name,
          })),
          unmatched: unmatched.slice(0, 20),
        }));
      } catch (err) {
        console.error('[AutoOrder] Error:', err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, message: err.message }));
      }
    });
    return;
  }

  // AI-powered video ordering endpoint
  if (pathname === '/api/videos/ai-order' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        if (!supabaseAdmin) {
          throw new Error('Supabase niet geconfigureerd');
        }
        const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
        if (!OPENAI_API_KEY) {
          throw new Error('OpenAI API key niet geconfigureerd');
        }

        console.log('[AI-Order] Fetching active videos from Supabase...');
        const { data: videos, error: fetchError } = await supabaseAdmin
          .from('video_ingest_jobs')
          .select('id, video_title, ai_attractive_title, drive_file_name, techniek_id, transcript, drive_folder_id, fase, detected_technieken, ai_summary')
          .eq('is_hidden', false)
          .is('deleted_at', null)
          .eq('status', 'completed');

        if (fetchError) throw new Error(`Supabase error: ${fetchError.message}`);
        if (!videos || videos.length === 0) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, order: [], total: 0, message: 'Geen voltooide video\'s gevonden' }));
          return;
        }

        console.log(`[AI-Order] Found ${videos.length} completed videos`);

        let techniekenIndex = {};
        try {
          const fs = require('fs');
          const path = require('path');
          const indexPath = path.join(__dirname, '..', 'config', 'ssot', 'technieken_index.json');
          techniekenIndex = JSON.parse(fs.readFileSync(indexPath, 'utf8'));
        } catch (e) {
          console.warn('[AI-Order] Could not load technieken_index.json:', e.message);
        }

        const videoSummaries = videos.map((v, i) => {
          const title = v.ai_attractive_title || v.video_title || v.drive_file_name || `Video ${i+1}`;
          const techniques = v.detected_technieken ? (Array.isArray(v.detected_technieken) ? v.detected_technieken.join(', ') : v.detected_technieken) : (v.techniek_id || 'onbekend');
          const transcript = v.transcript ? v.transcript.substring(0, 2000) : '';
          const summary = v.ai_summary || '';
          return `[ID: ${v.id}] Titel: "${title}" | Fase: ${v.fase || 'onbekend'} | Technieken: ${techniques} | Samenvatting: ${summary}${transcript ? ` | Transcript (fragment): ${transcript}` : ''}`;
        }).join('\n\n');

        const techStructure = JSON.stringify(techniekenIndex, null, 0).substring(0, 4000);

        const prompt = `Je bent een expert in sales training didactiek. Analyseer de volgende ${videos.length} trainingsvideo's en bepaal de optimale afspeelvolgorde voor een complete sales training.

TECHNIEKEN STRUCTUUR (SSOT):
${techStructure}

VIDEO'S OM TE ORDENEN:
${videoSummaries}

ORDERING CRITERIA:
1. Verkoopproces flow: Pre-contact → Opening → Ontdekking → EPIC (Explore, Probe, Impact, Commitment) → Bezwaren → Afsluiting
2. Didactische progressie: concepten worden eerst geïntroduceerd voordat ze worden toegepast
3. Fase-indeling: volg de fase-structuur (fase 0 → 1 → 2 → 3 → 4)
4. Techniek-nummering uit de SSOT index
5. Eenvoudige concepten voor complexe concepten
6. Theoretische video's voor praktijkvoorbeelden

Geef de optimale volgorde als een JSON array van video ID's. Antwoord ALLEEN met valid JSON, geen uitleg.
Format: ["id1", "id2", "id3", ...]`;

        console.log('[AI-Order] Calling OpenAI gpt-4.1...');
        const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${OPENAI_API_KEY}`,
          },
          body: JSON.stringify({
            model: 'gpt-4.1',
            messages: [
              { role: 'system', content: 'Je bent een didactisch expert die video\'s ordent voor optimale leerervaring in sales training. Antwoord altijd met alleen valid JSON.' },
              { role: 'user', content: prompt }
            ],
            temperature: 0.3,
            max_tokens: 4000,
          }),
        });

        if (!openaiResponse.ok) {
          const errText = await openaiResponse.text();
          throw new Error(`OpenAI API error: ${openaiResponse.status} - ${errText.substring(0, 200)}`);
        }

        const openaiResult = await openaiResponse.json();
        const aiContent = openaiResult.choices?.[0]?.message?.content?.trim();
        
        if (!aiContent) {
          throw new Error('Geen antwoord van OpenAI');
        }

        let orderedIds;
        try {
          const jsonMatch = aiContent.match(/\[[\s\S]*\]/);
          if (!jsonMatch) throw new Error('Geen JSON array gevonden in AI antwoord');
          orderedIds = JSON.parse(jsonMatch[0]);
        } catch (parseErr) {
          console.error('[AI-Order] Failed to parse AI response:', aiContent.substring(0, 500));
          throw new Error(`Kon AI antwoord niet parsen: ${parseErr.message}`);
        }

        const videoMap = {};
        for (const v of videos) {
          videoMap[v.id] = v;
        }

        const order = [];
        let position = 1;
        for (const id of orderedIds) {
          if (videoMap[id]) {
            order.push({
              id: id,
              title: videoMap[id].ai_attractive_title || videoMap[id].video_title || videoMap[id].drive_file_name,
              position: position,
            });
            position++;
            delete videoMap[id];
          }
        }
        for (const id of Object.keys(videoMap)) {
          order.push({
            id: id,
            title: videoMap[id].ai_attractive_title || videoMap[id].video_title || videoMap[id].drive_file_name,
            position: position,
          });
          position++;
        }

        console.log(`[AI-Order] Ordered ${order.length} videos (${orderedIds.length} from AI, ${Object.keys(videoMap).length} appended)`);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, order, total: order.length }));
      } catch (err) {
        console.error('[AI-Order] Error:', err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, message: err.message }));
      }
    });
    return;
  }

  // Unified Video Library endpoint - uses Supabase for correct database
  if (pathname === '/api/videos/library' && req.method === 'GET') {
    (async () => {
      try {
        if (!supabaseAdmin) {
          throw new Error('Supabase niet geconfigureerd');
        }
        
        // Parse query parameters
        const urlParams = new URLSearchParams(url.search);
        const includeHidden = urlParams.get('include_hidden') === 'true';
        
        // Get all pipeline videos from video_ingest_jobs
        // Try with playback_order first, fall back without it if column doesn't exist
        const baseColumns = 'id,video_title,drive_file_name,drive_file_id,drive_folder_id,drive_file_size,status,error_message,duration_seconds,fase,techniek_id,ai_suggested_techniek_id,ai_confidence,mux_asset_id,mux_playback_id,audio_url,rag_document_id,is_hidden,ai_summary,created_at,updated_at';
        
        const optionalColumns = ['detected_technieken', 'playback_order', 'ai_attractive_title'];
        let availableOptionalCols = [...optionalColumns];
        let pipelineVideos = null;
        let pipelineError = null;
        
        while (true) {
          const selectCols = baseColumns + (availableOptionalCols.length > 0 ? ',' + availableOptionalCols.join(',') : '');
          let q = supabaseAdmin
            .from('video_ingest_jobs')
            .select(selectCols)
            .neq('status', 'deleted');
          if (!includeHidden) {
            q = q.or('is_hidden.is.null,is_hidden.eq.false');
          }
          const result = await q.order('created_at', { ascending: false });
          
          if (result.error && result.error.code === '42703') {
            const missingCol = result.error.message.match(/column\s+\S+\.(\w+)\s+does not exist/)?.[1];
            if (missingCol && availableOptionalCols.includes(missingCol)) {
              console.log(`[VideoProcessor] Column ${missingCol} not found, retrying without it`);
              availableOptionalCols = availableOptionalCols.filter(c => c !== missingCol);
              continue;
            }
          }
          pipelineVideos = result.data;
          pipelineError = result.error;
          break;
        }
        
        if (pipelineError) throw pipelineError;
        
        // Map pipeline videos to library format
        // Status logic: only "ready" if has mux_playback_id (actually playable)
        const mappedPipeline = (pipelineVideos || []).map(job => {
          let status = 'pending';
          if (job.status === 'failed' || job.status === 'chromakey_failed') {
            // Check if disk quota error
            if (job.error_message && job.error_message.includes('disk quota')) {
              status = 'disk_quota';
            } else {
              status = 'error';
            }
          } else if (job.status === 'disk_quota') {
            status = 'disk_quota';
          } else if (job.status === 'external_processing') {
            status = 'external_processing';
          } else if ([
            'downloading', 'processing', 'extracting_audio', 'transcribing', 'embedding', 'uploading_mux',
            'cloud_downloading', 'cloud_chromakey', 'cloud_audio', 'cloud_transcribing', 'cloud_embedding', 'cloud_uploading', 'mux_processing'
          ].includes(job.status)) {
            status = 'processing';
          } else if ((job.status === 'completed' || job.status === 'processed') && job.mux_playback_id) {
            status = 'ready'; // Truly ready: has Mux playback
          } else if (job.rag_document_id && !job.mux_playback_id) {
            status = 'transcript_only'; // Has transcript/RAG but no streaming
          } else if (job.status === 'completed' || job.status === 'processed') {
            // "processed" means synced from Drive but NOT yet processed by Cloud Run worker
            // Show as pending since it still needs processing
            status = 'pending';
          }
          
          // Generate Mux thumbnail URL if playback_id exists
          const thumbnailUrl = job.mux_playback_id ? `https://image.mux.com/${job.mux_playback_id}/thumbnail.jpg?time=5` : null;
          
          return {
            id: job.id,
            title: job.ai_attractive_title || job.video_title || job.drive_file_name,
            original_title: job.video_title || job.drive_file_name,
            description: '',
            thumbnail_url: thumbnailUrl,
            mux_asset_id: job.mux_asset_id,
            mux_playback_id: job.mux_playback_id,
            status,
            raw_status: job.status,
            error_message: job.error_message,
            duration: job.duration_seconds,
            size_bytes: job.drive_file_size,
            course_module: job.fase,
            technique_id: job.techniek_id,
            ai_suggested_techniek_id: job.ai_suggested_techniek_id,
            ai_confidence: job.ai_confidence,
            has_transcript: !!job.rag_document_id || !!job.ai_summary, // rag_document_id OR ai_summary implies transcript exists
            has_audio: !!job.audio_url || !!job.rag_document_id,
            has_rag: !!job.rag_document_id,
            has_mux: !!job.mux_playback_id,
            transcript: null,
            ai_summary: job.ai_summary || null,
            ai_attractive_title: job.ai_attractive_title || null,
            drive_file_id: job.drive_file_id,
            drive_folder_id: job.drive_folder_id,
            playback_order: job.playback_order != null ? job.playback_order : null,
            source: 'pipeline',
            is_hidden: job.is_hidden || false,
            user_ready: !!(job.mux_playback_id && job.techniek_id && job.ai_attractive_title), // Fully processed for user view
            created_at: job.created_at,
            updated_at: job.updated_at
          };
        });
        
        // Get manual videos from videos table
        let manualVideos = [];
        try {
          const { data: manualData, error: manualError } = await supabaseAdmin
            .from('videos')
            .select('*')
            .is('deleted_at', null)
            .order('created_at', { ascending: false });
          
          if (!manualError && manualData) {
            manualVideos = manualData.map(v => {
              // Generate Mux thumbnail URL if playback_id exists
              const thumbnailUrl = v.thumbnail_url || 
                (v.mux_playback_id ? `https://image.mux.com/${v.mux_playback_id}/thumbnail.jpg?time=5` : null);
              
              return {
                id: v.id,
                title: v.title,
                description: v.description || '',
                thumbnail_url: thumbnailUrl,
                mux_asset_id: v.mux_asset_id,
                mux_playback_id: v.mux_playback_id,
                status: v.status,
                raw_status: v.status,
                duration: v.duration_seconds,
                course_module: v.course_module,
                technique_id: v.technique_id,
                has_transcript: false,
                has_audio: false,
                has_rag: false,
                has_mux: !!v.mux_playback_id,
                transcript: null,
                drive_file_id: null,
                playback_order: v.playback_order != null ? v.playback_order : null,
                source: 'manual',
                created_at: v.created_at,
                updated_at: v.updated_at
              };
            });
          }
        } catch (e) {
          console.log('[VideoProcessor] Manual videos table not found, skipping');
        }
        
        // Merge and dedupe by mux_asset_id
        const allVideos = [...mappedPipeline, ...manualVideos];
        const seenMuxIds = new Set();
        const dedupedVideos = allVideos.filter(v => {
          if (!v.mux_asset_id) return true;
          if (seenMuxIds.has(v.mux_asset_id)) return false;
          seenMuxIds.add(v.mux_asset_id);
          return true;
        });
        
        let techniekenMap = {};
        try {
          const tableReady = await getVideoTechniekenReady();
          if (tableReady) {
            const videoIds = dedupedVideos.map(v => v.id);
            if (videoIds.length > 0) {
              const { data: allTags } = await supabaseAdmin
                .from('video_technieken')
                .select('video_id, techniek_id, confidence, source, is_primary')
                .in('video_id', videoIds)
                .order('confidence', { ascending: false });
              if (allTags) {
                for (const tag of allTags) {
                  if (!techniekenMap[tag.video_id]) techniekenMap[tag.video_id] = [];
                  techniekenMap[tag.video_id].push({
                    techniek_id: tag.techniek_id,
                    confidence: tag.confidence,
                    source: tag.source,
                    is_primary: tag.is_primary
                  });
                }
              }
            }
          }
        } catch (e) {
          console.warn('[VideoProcessor] Could not load video_technieken:', e.message);
        }

        for (const v of dedupedVideos) {
          if (techniekenMap[v.id]) {
            v.technieken = techniekenMap[v.id];
          } else if (v.detected_technieken && Array.isArray(v.detected_technieken)) {
            v.technieken = v.detected_technieken;
          } else {
            v.technieken = [];
          }
        }

        // Fetch durations from Mux for ready videos without duration
        // Uses in-memory cache and persists to database
        const videosNeedingDuration = dedupedVideos.filter(v => 
          v.status === 'ready' && !v.duration && v.mux_asset_id
        );
        
        if (videosNeedingDuration.length > 0) {
          console.log(`[VideoProcessor] Fetching ${videosNeedingDuration.length} video durations from Mux`);
          const batchSize = 20;
          for (let i = 0; i < videosNeedingDuration.length; i += batchSize) {
            const batch = videosNeedingDuration.slice(i, i + batchSize);
            const durationPromises = batch.map(async v => {
              const duration = await getMuxAssetDuration(v.mux_asset_id);
              if (duration) {
                v.duration = Math.round(duration);
                // Persist to database (use correct table based on source)
                await saveDurationToDatabase(v.id, duration, v.source);
              }
            });
            await Promise.all(durationPromises);
          }
        }
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(dedupedVideos));
      } catch (err) {
        console.error('[VideoProcessor] Library error:', err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    })();
    return;
  }
  
  // Delete videos by criteria (for cleanup)
  if (pathname === '/api/videos/cleanup' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        if (!supabaseAdmin) {
          throw new Error('Supabase niet geconfigureerd');
        }
        
        const data = JSON.parse(body || '{}');
        const { maxWords, videoIds } = data;
        
        let deletedIds = [];
        
        if (videoIds && videoIds.length > 0) {
          // Delete specific videos by ID
          for (const id of videoIds) {
            await supabaseAdmin.from('video_ingest_jobs').update({ status: 'deleted' }).eq('id', id);
            // Also delete from RAG if exists
            await supabaseAdmin.from('rag_documents').delete().eq('source_id', id);
            deletedIds.push(id);
          }
        } else if (maxWords) {
          // Delete videos with transcript shorter than maxWords
          const { data: videos } = await supabaseAdmin
            .from('video_ingest_jobs')
            .select('id, transcript')
            .neq('status', 'deleted');
          
          for (const v of (videos || [])) {
            const words = (v.transcript || '').trim().split(/\s+/).filter(w => w).length;
            if (v.transcript && words < maxWords) {
              await supabaseAdmin.from('video_ingest_jobs').update({ status: 'deleted' }).eq('id', v.id);
              await supabaseAdmin.from('rag_documents').delete().eq('source_id', v.id);
              deletedIds.push(v.id);
            }
          }
        }
        
        console.log(`[VideoProcessor] Deleted ${deletedIds.length} videos`);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, deleted: deletedIds.length, ids: deletedIds }));
      } catch (err) {
        console.error('[VideoProcessor] Cleanup error:', err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, message: err.message }));
      }
    });
    return;
  }
  
  // Delete video (admin only - uses service role, soft delete by setting status to 'deleted')
  if (pathname === '/api/videos/delete' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        if (!supabaseAdmin) {
          throw new Error('Supabase niet geconfigureerd');
        }
        
        const data = JSON.parse(body || '{}');
        const { videoId, source } = data;
        
        if (!videoId) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, message: 'videoId is vereist' }));
          return;
        }
        
        if (source === 'manual') {
          const { error } = await supabaseAdmin
            .from('videos')
            .delete()
            .eq('id', videoId);
          if (error) throw error;
          console.log(`[VideoProcessor] Manual video ${videoId} permanently deleted`);
        } else {
          const { error } = await supabaseAdmin
            .from('video_ingest_jobs')
            .update({ status: 'deleted', updated_at: new Date().toISOString() })
            .eq('id', videoId);
          if (error) throw error;
          console.log(`[VideoProcessor] Pipeline video ${videoId} marked as deleted`);
        }
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, videoId }));
      } catch (err) {
        console.error('[VideoProcessor] Delete video error:', err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, message: err.message }));
      }
    });
    return;
  }
  
  // Toggle video hidden status (admin only - uses service role)
  if (pathname === '/api/videos/toggle-hidden' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        if (!supabaseAdmin) {
          throw new Error('Supabase niet geconfigureerd');
        }
        
        const data = JSON.parse(body || '{}');
        const { videoId, isHidden } = data;
        
        if (!videoId) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, message: 'videoId is vereist' }));
          return;
        }
        
        const { error } = await supabaseAdmin
          .from('video_ingest_jobs')
          .update({ is_hidden: isHidden })
          .eq('id', videoId);
        
        if (error) throw error;
        
        console.log(`[VideoProcessor] Video ${videoId} is_hidden set to ${isHidden}`);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, videoId, isHidden }));
      } catch (err) {
        console.error('[VideoProcessor] Toggle hidden error:', err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, message: err.message }));
      }
    });
    return;
  }
  
  // Update video title (admin)
  if (pathname === '/api/videos/update-title' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        if (!supabaseAdmin) {
          throw new Error('Supabase niet geconfigureerd');
        }
        
        const data = JSON.parse(body || '{}');
        const { videoId, title, attractiveTitle } = data;
        
        if (!videoId) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, message: 'videoId is vereist' }));
          return;
        }
        
        const updateFields = {};
        if (attractiveTitle !== undefined) {
          updateFields.ai_attractive_title = attractiveTitle ? String(attractiveTitle).trim() : null;
        } else if (title && typeof title === 'string' && title.trim().length > 0) {
          updateFields.ai_attractive_title = title.trim();
        }
        if (data.title !== undefined && attractiveTitle !== undefined) {
          updateFields.title = data.title ? String(data.title).trim() : null;
        }
        
        if (Object.keys(updateFields).length === 0) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, message: 'Geen velden om te updaten' }));
          return;
        }
        
        const { error } = await supabaseAdmin
          .from('video_ingest_jobs')
          .update(updateFields)
          .eq('id', videoId);
        
        if (error) throw error;
        
        console.log(`[VideoProcessor] Video ${videoId} updated:`, JSON.stringify(updateFields));
        regenerateVideoMapping().catch(e => console.warn('[VideoMapping] bg update failed:', e.message));
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, videoId, updated: updateFields }));
      } catch (err) {
        console.error('[VideoProcessor] Update title error:', err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, message: err.message }));
      }
    });
    return;
  }

  // Daily.co Cloud Recording - Start
  if (pathname === '/api/daily/recording/start' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const data = JSON.parse(body || '{}');
        const { roomName, sessionId } = data;
        
        if (!roomName) {
          throw new Error('roomName is vereist');
        }
        
        const dailyApiKey = process.env.DAILY_API_KEY;
        if (!dailyApiKey) {
          throw new Error('DAILY_API_KEY niet geconfigureerd');
        }
        
        console.log(`[Daily] Starting cloud recording for room: ${roomName}`);
        
        const response = await fetch(`https://api.daily.co/v1/rooms/${roomName}/recordings`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${dailyApiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            type: 'cloud'
          })
        });
        
        const result = await response.json();
        
        if (!response.ok) {
          console.error('[Daily] Recording start failed:', result);
          throw new Error(result.error || 'Recording starten mislukt');
        }
        
        console.log('[Daily] Recording started:', result);
        
        if (sessionId && supabaseAdmin) {
          await supabaseAdmin.from('live_sessions').update({
            recording_id: result.id,
            is_recording: true
          }).eq('id', sessionId);
        }
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
          success: true, 
          recording: { 
            id: result.id, 
            status: 'recording',
            roomName: roomName
          } 
        }));
      } catch (err) {
        console.error('[Daily] Recording start error:', err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, message: err.message }));
      }
    });
    return;
  }
  
  // Daily.co Cloud Recording - Stop
  if (pathname === '/api/daily/recording/stop' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const data = JSON.parse(body || '{}');
        const { roomName, sessionId } = data;
        
        if (!roomName) {
          throw new Error('roomName is vereist');
        }
        
        const dailyApiKey = process.env.DAILY_API_KEY;
        if (!dailyApiKey) {
          throw new Error('DAILY_API_KEY niet geconfigureerd');
        }
        
        console.log(`[Daily] Stopping cloud recording for room: ${roomName}`);
        
        // Daily.co uses POST to /recordings/stop to stop recording
        const response = await fetch(`https://api.daily.co/v1/rooms/${roomName}/recordings/stop`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${dailyApiKey}`,
            'Content-Type': 'application/json'
          }
        });
        
        if (!response.ok && response.status !== 404) {
          const result = await response.json();
          console.error('[Daily] Recording stop failed:', result);
          throw new Error(result.error || 'Recording stoppen mislukt');
        }
        
        console.log('[Daily] Recording stopped');
        
        if (sessionId && supabaseAdmin) {
          await supabaseAdmin.from('live_sessions').update({
            is_recording: false,
            recording_id: null
          }).eq('id', sessionId);
        }
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
      } catch (err) {
        console.error('[Daily] Recording stop error:', err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, message: err.message }));
      }
    });
    return;
  }
  
  // Daily.co Recordings - List for a room
  if (pathname === '/api/daily/recordings' && req.method === 'GET') {
    (async () => {
      try {
        const dailyApiKey = process.env.DAILY_API_KEY;
        if (!dailyApiKey) {
          throw new Error('DAILY_API_KEY niet geconfigureerd');
        }
        
        const roomName = parsedUrl.query.roomName;
        let url = 'https://api.daily.co/v1/recordings?limit=100';
        if (roomName) {
          url += `&room_name=${roomName}`;
        }
        
        const response = await fetch(url, {
          headers: {
            'Authorization': `Bearer ${dailyApiKey}`
          }
        });
        
        const result = await response.json();
        
        if (!response.ok) {
          throw new Error(result.error || 'Recordings ophalen mislukt');
        }
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
          success: true, 
          recordings: result.data || [],
          totalCount: result.total_count || 0
        }));
      } catch (err) {
        console.error('[Daily] List recordings error:', err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, message: err.message }));
      }
    })();
    return;
  }
  
  // Daily.co Recording - Get access link
  if (pathname.startsWith('/api/daily/recordings/') && pathname.endsWith('/access-link') && req.method === 'GET') {
    (async () => {
      try {
        const dailyApiKey = process.env.DAILY_API_KEY;
        if (!dailyApiKey) {
          throw new Error('DAILY_API_KEY niet geconfigureerd');
        }
        
        const recordingId = pathname.replace('/api/daily/recordings/', '').replace('/access-link', '');
        
        const response = await fetch(`https://api.daily.co/v1/recordings/${recordingId}/access-link`, {
          headers: {
            'Authorization': `Bearer ${dailyApiKey}`
          }
        });
        
        const result = await response.json();
        
        if (!response.ok) {
          throw new Error(result.error || 'Access link ophalen mislukt');
        }
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
          success: true, 
          downloadLink: result.download_link,
          expiresAt: result.expires
        }));
      } catch (err) {
        console.error('[Daily] Access link error:', err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, message: err.message }));
      }
    })();
    return;
  }
  
  // Admin Dashboard Stats - KPIs, recent activity, notifications, top content
  if (pathname === '/api/admin/dashboard-stats' && req.method === 'GET') {
    (async () => {
      try {
        if (!supabaseAdmin) {
          throw new Error('Supabase niet geconfigureerd');
        }

        const now = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
        const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();
        const prevMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59).toISOString();
        const sevenDaysAgo = new Date(now);
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        const fourteenDaysAgo = new Date(now);
        fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

        // --- KPI DATA ---
        let totalUsers = 0;
        let newSignupsThisMonth = 0;
        let newSignupsPrevMonth = 0;
        try {
          const profilesResult = await supabaseAdmin.from('profiles').select('id, created_at');
          const profiles = profilesResult.data || [];
          if (profiles.length > 0) {
            totalUsers = profiles.length;
            newSignupsThisMonth = profiles.filter(p => p.created_at >= monthStart).length;
            newSignupsPrevMonth = profiles.filter(p => p.created_at >= prevMonthStart && p.created_at <= prevMonthEnd).length;
          } else {
            try {
              const authResult = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
              const authUsers = authResult.data?.users || [];
              totalUsers = authUsers.length;
              newSignupsThisMonth = authUsers.filter(u => u.created_at >= monthStart).length;
              newSignupsPrevMonth = authUsers.filter(u => u.created_at >= prevMonthStart && u.created_at <= prevMonthEnd).length;
            } catch (e) { /* ignore */ }
          }
        } catch (e) { /* ignore */ }

        const [viewsThisWeek, viewsPrevWeek, viewsToday, viewsYesterday] = await Promise.all([
          supabaseAdmin.from('video_views').select('user_id, created_at').gte('created_at', sevenDaysAgo.toISOString()),
          supabaseAdmin.from('video_views').select('user_id, created_at').gte('created_at', fourteenDaysAgo.toISOString()).lt('created_at', sevenDaysAgo.toISOString()),
          supabaseAdmin.from('video_views').select('id', { count: 'exact', head: true }).gte('created_at', todayStart),
          supabaseAdmin.from('video_views').select('id', { count: 'exact', head: true }).gte('created_at', new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1).toISOString()).lt('created_at', todayStart),
        ]);

        const activeUsersThisWeek = new Set((viewsThisWeek.data || []).map(v => v.user_id).filter(Boolean)).size;
        const activeUsersPrevWeek = new Set((viewsPrevWeek.data || []).map(v => v.user_id).filter(Boolean)).size;

        const sessionsToday = viewsToday.count || 0;
        const sessionsYesterday = viewsYesterday.count || 0;

        // Revenue from Stripe
        let revenueThisMonth = 0;
        let revenuePrevMonth = 0;
        try {
          const chargesThis = await stripePool.query(
            `SELECT COALESCE(SUM(amount), 0) as total FROM stripe.charges WHERE status = 'succeeded' AND created >= $1`,
            [Math.floor(new Date(monthStart).getTime() / 1000)]
          );
          revenueThisMonth = parseInt(chargesThis.rows[0]?.total || '0') / 100;

          const chargesPrev = await stripePool.query(
            `SELECT COALESCE(SUM(amount), 0) as total FROM stripe.charges WHERE status = 'succeeded' AND created >= $1 AND created < $2`,
            [Math.floor(new Date(prevMonthStart).getTime() / 1000), Math.floor(new Date(monthStart).getTime() / 1000)]
          );
          revenuePrevMonth = parseInt(chargesPrev.rows[0]?.total || '0') / 100;
        } catch (e) {
          console.log('[Dashboard] Stripe revenue query failed (tables may be empty):', e.message);
        }

        // Active subscriptions count
        let activeSubscriptions = 0;
        try {
          const subsResult = await stripePool.query(
            `SELECT COUNT(*) as cnt FROM stripe.subscriptions WHERE status IN ('active', 'trialing')`
          );
          activeSubscriptions = parseInt(subsResult.rows[0]?.cnt || '0');
        } catch (e) { /* ignore */ }

        const calcChange = (current, previous) => {
          if (previous === 0 && current === 0) return '+0%';
          if (previous === 0) return current > 0 ? '+100%' : '+0%';
          const pct = Math.round(((current - previous) / previous) * 100);
          return pct >= 0 ? `+${pct}%` : `${pct}%`;
        };

        const displayActiveUsers = activeUsersThisWeek > 0 ? activeUsersThisWeek : totalUsers;
        const kpis = {
          activeUsers: { value: displayActiveUsers, change: calcChange(activeUsersThisWeek, activeUsersPrevWeek) },
          sessionsToday: { value: sessionsToday, change: calcChange(sessionsToday, sessionsYesterday) },
          newSignups: { value: newSignupsThisMonth, change: calcChange(newSignupsThisMonth, newSignupsPrevMonth) },
          revenue: { value: revenueThisMonth, change: calcChange(revenueThisMonth, revenuePrevMonth), subscriptions: activeSubscriptions },
        };

        // --- RECENT ACTIVITY ---
        let recentActivity = [];
        try {
          const [activityResult, recentViewsResult, recentSignups] = await Promise.all([
            supabaseAdmin.from('user_activity').select('id, user_id, activity_type, metadata, created_at').order('created_at', { ascending: false }).limit(20),
            supabaseAdmin.from('video_views').select('id, user_id, video_id, created_at').order('created_at', { ascending: false }).limit(20),
            supabaseAdmin.from('profiles').select('id, full_name, email, created_at, plan').order('created_at', { ascending: false }).limit(5),
          ]);

          const activities = activityResult.data || [];
          const recentViews = recentViewsResult.data || [];
          const signups = recentSignups.data || [];

          const userIds = new Set([
            ...activities.map(a => a.user_id),
            ...recentViews.map(v => v.user_id),
          ].filter(Boolean));

          let userNames = {};
          if (userIds.size > 0) {
            try {
              const profilesRes = await supabaseAdmin.from('profiles').select('id, full_name, email').in('id', [...userIds]);
              for (const p of (profilesRes.data || [])) {
                userNames[p.id] = p.full_name || p.email || 'Onbekend';
              }
            } catch (e) { /* ignore */ }
          }

          const videoIds = [...new Set(recentViews.map(v => v.video_id).filter(Boolean))];
          let videoTitles = {};
          if (videoIds.length > 0) {
            try {
              const videosRes = await supabaseAdmin.from('video_ingest_jobs').select('id, title').in('id', videoIds);
              for (const v of (videosRes.data || [])) {
                videoTitles[v.id] = v.title || 'Video';
              }
            } catch (e) { /* ignore */ }
          }

          const allEvents = [];

          for (const a of activities) {
            const userName = userNames[a.user_id] || 'Gebruiker';
            let action = 'was actief';
            let detail = '';
            let type = 'session';

            if (a.activity_type === 'chat_session' || a.activity_type === 'session_complete') {
              action = 'voltooide sessie';
              detail = a.metadata?.technique_name || a.metadata?.topic || '';
              type = 'session';
            } else if (a.activity_type === 'video_view') {
              action = 'bekeek video';
              detail = a.metadata?.video_title || '';
              type = 'video';
            } else if (a.activity_type === 'live_session') {
              action = 'startte live sessie';
              detail = a.metadata?.session_name || '';
              type = 'live';
            } else if (a.activity_type === 'roleplay') {
              action = 'deed rollenspel';
              detail = a.metadata?.scenario_name || '';
              type = 'session';
            }

            allEvents.push({
              id: `act-${a.id}`,
              type,
              user: userName,
              action,
              detail,
              time: a.created_at,
            });
          }

          for (const v of recentViews) {
            const userName = userNames[v.user_id] || 'Gebruiker';
            allEvents.push({
              id: `view-${v.id}`,
              type: 'video',
              user: userName,
              action: 'bekeek video',
              detail: videoTitles[v.video_id] || 'Video',
              time: v.created_at,
            });
          }

          for (const s of signups) {
            allEvents.push({
              id: `signup-${s.id}`,
              type: 'signup',
              user: s.full_name || s.email || 'Nieuwe gebruiker',
              action: 'nieuwe gebruiker',
              detail: s.plan || 'Free plan',
              time: s.created_at,
            });
          }

          allEvents.sort((a, b) => new Date(b.time) - new Date(a.time));

          const seen = new Set();
          recentActivity = allEvents.filter(e => {
            const key = `${e.type}-${e.user}-${e.action}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
          }).slice(0, 8);

          const formatTimeAgo = (dateStr) => {
            const diff = now - new Date(dateStr);
            const mins = Math.floor(diff / 60000);
            if (mins < 1) return 'Zojuist';
            if (mins < 60) return `${mins} min geleden`;
            const hours = Math.floor(mins / 60);
            if (hours < 24) return `${hours} uur geleden`;
            const days = Math.floor(hours / 24);
            return `${days} dag${days > 1 ? 'en' : ''} geleden`;
          };
          recentActivity = recentActivity.map(a => ({ ...a, time: formatTimeAgo(a.time) }));
        } catch (e) {
          console.log('[Dashboard] Recent activity error:', e.message);
        }

        // --- NOTIFICATIONS (from local DB) ---
        let notifications = [];
        try {
          const notifResult = await pool.query(
            `SELECT id, type, title, message, category, severity, related_page, read, created_at
             FROM admin_notifications
             ORDER BY created_at DESC
             LIMIT 10`
          );
          const formatTimeAgo = (dateStr) => {
            const diff = now - new Date(dateStr);
            const mins = Math.floor(diff / 60000);
            if (mins < 1) return 'Zojuist';
            if (mins < 60) return `${mins} min geleden`;
            const hours = Math.floor(mins / 60);
            if (hours < 24) return `${hours} uur geleden`;
            const days = Math.floor(hours / 24);
            return `${days} dag${days > 1 ? 'en' : ''} geleden`;
          };
          notifications = notifResult.rows.map(n => ({
            id: n.id,
            type: n.type || n.severity || 'info',
            category: n.category || 'system',
            title: n.title,
            message: n.message,
            timestamp: formatTimeAgo(n.created_at),
            read: n.read || false,
            relatedPage: n.related_page || null,
          }));
        } catch (e) {
          console.log('[Dashboard] Notifications error:', e.message);
        }
        const unreadCount = notifications.filter(n => !n.read).length;

        // --- TOP PERFORMING CONTENT ---
        let topContent = [];
        try {
          const [viewsResult, jobsResult] = await Promise.all([
            supabaseAdmin.from('video_views').select('video_id').limit(5000),
            supabaseAdmin.from('video_ingest_jobs').select('id, title, techniek_id, fase, detected_technieken').eq('status', 'completed').limit(1000),
          ]);

          const views = viewsResult.data || [];
          const jobs = jobsResult.data || [];

          const viewCounts = {};
          for (const v of views) {
            if (v.video_id) {
              viewCounts[v.video_id] = (viewCounts[v.video_id] || 0) + 1;
            }
          }

          const jobMap = {};
          for (const j of jobs) {
            jobMap[j.id] = j;
          }

          topContent = Object.entries(viewCounts)
            .map(([videoId, viewCount]) => {
              const job = jobMap[videoId];
              return {
                id: videoId,
                type: 'Video',
                title: job?.title || 'Onbekende video',
                views: viewCount,
                fase: job?.fase || job?.detected_technieken?.[0]?.techniek_id?.split('.')[0] || null,
              };
            })
            .sort((a, b) => b.views - a.views)
            .slice(0, 10);

          if (topContent.length === 0 && jobs.length > 0) {
            topContent = jobs.slice(0, 10).map(j => ({
              id: j.id,
              type: 'Video',
              title: j.title || 'Video',
              views: viewCounts[j.id] || 0,
              fase: j.fase || j.detected_technieken?.[0]?.techniek_id?.split('.')[0] || null,
            }));
          }
        } catch (e) {
          console.log('[Dashboard] Top content error:', e.message);
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          kpis,
          recentActivity,
          notifications,
          unreadNotifications: unreadCount,
          topContent,
          generatedAt: now.toISOString(),
        }));
      } catch (err) {
        console.error('[Dashboard] Stats error:', err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    })();
    return;
  }

  // Platform Analytics - Aggregated metrics (bypasses RLS with service role)
  if (pathname === '/api/analytics/platform' && req.method === 'GET') {
    (async () => {
      try {
        if (!supabaseAdmin) {
          throw new Error('Supabase niet geconfigureerd');
        }
        
        const now = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
        
        let usersCount = 0;
        const profilesCountResult = await supabaseAdmin.from('profiles').select('id', { count: 'exact' });
        if (profilesCountResult.count && profilesCountResult.count > 0) {
          usersCount = profilesCountResult.count;
        } else {
          const usersCountResult = await supabaseAdmin.from('users').select('id', { count: 'exact' });
          if (usersCountResult.count && usersCountResult.count > 0) {
            usersCount = usersCountResult.count;
          } else {
            try {
              const authResult = await supabaseAdmin.auth.admin.listUsers({ perPage: 1 });
              usersCount = authResult.data?.total || authResult.data?.users?.length || 0;
            } catch (e) { /* ignore */ }
          }
        }

        const [videosResult, viewsResult, sessionsResult, recentActivityResult] = await Promise.all([
          supabaseAdmin.from('video_ingest_jobs').select('id', { count: 'exact' }).eq('status', 'completed'),
          supabaseAdmin.from('video_views').select('id', { count: 'exact' }),
          supabaseAdmin.from('live_sessions').select('id, status', { count: 'exact' }),
          supabaseAdmin.from('video_views').select('user_id, created_at').gte('created_at', monthStart),
        ]);
        
        const totalUsers = usersCount;
        const totalVideos = videosResult.count || 0;
        const totalViews = viewsResult.count || 0;
        const totalSessions = sessionsResult.count || 0;
        const completedSessions = (sessionsResult.data || []).filter(s => s.status === 'completed').length;
        
        const recentViews = recentActivityResult.data || [];
        const todayViewUsers = new Set(recentViews.filter(v => v.created_at >= todayStart).map(v => v.user_id));
        const monthViewUsers = new Set(recentViews.map(v => v.user_id));
        
        let analysisScores = [];
        try {
          const analysisResult = await supabaseAdmin.from('conversation_analyses').select('score, created_at').gte('created_at', monthStart);
          analysisScores = analysisResult.data || [];
        } catch (e) { /* table may not exist */ }

        const weeklyEngagement = [];
        for (let i = 3; i >= 0; i--) {
          const weekStart = new Date(now);
          weekStart.setDate(weekStart.getDate() - (i * 7) - weekStart.getDay());
          const weekEnd = new Date(weekStart);
          weekEnd.setDate(weekEnd.getDate() + 7);
          
          const weekViews = recentViews.filter(v => {
            const viewDate = new Date(v.created_at);
            return viewDate >= weekStart && viewDate < weekEnd;
          });

          const weekScores = analysisScores.filter(a => {
            const d = new Date(a.created_at);
            return d >= weekStart && d < weekEnd && a.score != null;
          });
          const avgScore = weekScores.length > 0
            ? Math.round(weekScores.reduce((s, a) => s + (Number(a.score) || 0), 0) / weekScores.length)
            : 0;
          
          weeklyEngagement.push({
            week: `Week ${4 - i}`,
            sessions: weekViews.length,
            avgScore,
          });
        }
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          totalUsers,
          activeUsersToday: todayViewUsers.size,
          activeUsersMonth: monthViewUsers.size,
          totalVideoViews: totalViews,
          totalVideos,
          totalLiveSessions: totalSessions,
          completedSessions,
          weeklyEngagement,
        }));
      } catch (err) {
        console.error('[Analytics] Platform metrics error:', err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    })();
    return;
  }

  if (pathname === '/api/analytics/user' && req.method === 'GET') {
    (async () => {
      try {
        if (!supabaseAdmin) {
          throw new Error('Supabase niet geconfigureerd');
        }

        const userId = parsedUrl.query.user_id;
        if (!userId) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'user_id parameter is required' }));
          return;
        }

        const now = new Date();

        const [activityResult, viewsResult] = await Promise.all([
          supabaseAdmin.from('user_activity').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
          supabaseAdmin.from('video_views').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
        ]);

        const activities = activityResult.data || [];
        const views = viewsResult.data || [];

        const totalVideoViews = views.length;
        const totalVideoCompletes = views.filter(v => v.metadata?.completed || v.completed).length;

        let totalWatchTime = 0;
        for (const v of views) {
          const duration = v.metadata?.duration_watched || v.duration_watched || 0;
          totalWatchTime += Number(duration) || 0;
        }

        const techniquesMap = {};
        for (const v of views) {
          const techId = v.metadata?.techniek_id || v.techniek_id;
          if (techId) {
            if (!techniquesMap[techId]) {
              techniquesMap[techId] = { techniekId: techId, views: 0, watchTime: 0 };
            }
            techniquesMap[techId].views++;
            techniquesMap[techId].watchTime += Number(v.metadata?.duration_watched || v.duration_watched || 0) || 0;
          }
        }
        const techniquesProgress = Object.values(techniquesMap);

        let userAnalysisScores = [];
        try {
          const analysisRes = await supabaseAdmin.from('conversation_analyses').select('score, created_at').eq('user_id', userId);
          userAnalysisScores = analysisRes.data || [];
        } catch (e) { /* table may not exist */ }

        const weeklyActivity = [];
        for (let i = 3; i >= 0; i--) {
          const weekStart = new Date(now);
          weekStart.setDate(weekStart.getDate() - (i * 7) - weekStart.getDay());
          weekStart.setHours(0, 0, 0, 0);
          const weekEnd = new Date(weekStart);
          weekEnd.setDate(weekEnd.getDate() + 7);

          const weekViews = views.filter(v => {
            const d = new Date(v.created_at);
            return d >= weekStart && d < weekEnd;
          }).length;

          const weekActivities = activities.filter(a => {
            const d = new Date(a.created_at);
            return d >= weekStart && d < weekEnd;
          }).length;

          const weekScores = userAnalysisScores.filter(a => {
            const d = new Date(a.created_at);
            return d >= weekStart && d < weekEnd && a.score != null;
          });
          const avgScore = weekScores.length > 0
            ? Math.round(weekScores.reduce((s, a) => s + (Number(a.score) || 0), 0) / weekScores.length)
            : 0;

          weeklyActivity.push({
            week: `Week ${4 - i}`,
            views: weekViews,
            activities: weekActivities,
            avgScore,
          });
        }

        const recentActivity = activities.slice(0, 10).map(a => ({
          id: a.id,
          type: a.activity_type || a.type,
          createdAt: a.created_at,
          metadata: a.metadata || {},
        }));

        const activityCounts = {};
        for (const a of activities) {
          const type = a.activity_type || a.type || 'unknown';
          activityCounts[type] = (activityCounts[type] || 0) + 1;
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          userId,
          totalVideoViews,
          totalVideoCompletes,
          totalWatchTime,
          techniquesProgress,
          weeklyActivity,
          recentActivity,
          activityCounts,
        }));
      } catch (err) {
        console.error('[Analytics] User metrics error:', err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    })();
    return;
  }

  if (pathname === '/api/analytics/users' && req.method === 'GET') {
    (async () => {
      try {
        if (!supabaseAdmin) {
          throw new Error('Supabase niet geconfigureerd');
        }

        const now = new Date();
        const thirtyDaysAgo = new Date(now);
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        let usersResult = await supabaseAdmin.from('profiles').select('id, email, full_name, avatar_url, created_at, role, plan');
        if (!usersResult.data || usersResult.data.length === 0) {
          usersResult = await supabaseAdmin.from('users').select('id, email, full_name, avatar_url, created_at, role, plan');
        }
        if (!usersResult.data || usersResult.data.length === 0) {
          const authResult = await supabaseAdmin.auth.admin.listUsers();
          if (authResult.data?.users) {
            usersResult = { data: authResult.data.users.map(u => ({
              id: u.id,
              email: u.email,
              full_name: u.user_metadata?.full_name || u.user_metadata?.first_name ? `${u.user_metadata?.first_name || ''} ${u.user_metadata?.last_name || ''}`.trim() : null,
              avatar_url: u.user_metadata?.avatar_url || null,
              created_at: u.created_at,
              role: u.role || 'user',
              plan: u.user_metadata?.plan || 'free',
            })) };
          }
        }
        const [activityResult, viewsResult] = await Promise.all([
          supabaseAdmin.from('user_activity').select('user_id, activity_type, created_at'),
          supabaseAdmin.from('video_views').select('user_id, created_at'),
        ]);

        const users = usersResult.data || [];
        const allActivities = activityResult.data || [];
        const allViews = viewsResult.data || [];

        const activityByUser = {};
        for (const a of allActivities) {
          if (!activityByUser[a.user_id]) {
            activityByUser[a.user_id] = { count: 0, lastDate: null };
          }
          activityByUser[a.user_id].count++;
          if (!activityByUser[a.user_id].lastDate || a.created_at > activityByUser[a.user_id].lastDate) {
            activityByUser[a.user_id].lastDate = a.created_at;
          }
        }

        const viewsByUser = {};
        for (const v of allViews) {
          viewsByUser[v.user_id] = (viewsByUser[v.user_id] || 0) + 1;
          if (!activityByUser[v.user_id]) {
            activityByUser[v.user_id] = { count: 0, lastDate: null };
          }
          if (!activityByUser[v.user_id].lastDate || v.created_at > activityByUser[v.user_id].lastDate) {
            activityByUser[v.user_id].lastDate = v.created_at;
          }
        }

        const result = users.map(u => {
          const userActivity = activityByUser[u.id] || { count: 0, lastDate: null };
          const lastActive = userActivity.lastDate || u.created_at;
          const isActive = lastActive && new Date(lastActive) >= thirtyDaysAgo;

          return {
            id: u.id,
            email: u.email,
            name: u.full_name || u.email,
            avatarUrl: u.avatar_url || null,
            role: u.role || 'user',
            plan: u.plan || 'free',
            createdAt: u.created_at,
            lastActive,
            totalVideoViews: viewsByUser[u.id] || 0,
            totalActivities: userActivity.count,
            status: isActive ? 'active' : 'inactive',
          };
        });

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ users: result, total: result.length }));
      } catch (err) {
        console.error('[Analytics] Users list error:', err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    })();
    return;
  }

  if (pathname === '/api/analytics/content-performance' && req.method === 'GET') {
    (async () => {
      try {
        if (!supabaseAdmin) {
          throw new Error('Supabase niet geconfigureerd');
        }

        const [viewsResult, jobsResult] = await Promise.all([
          supabaseAdmin.from('video_views').select('video_id'),
          supabaseAdmin.from('video_ingest_jobs').select('id, title, techniek_id, fase, detected_technieken'),
        ]);

        let videosData = [];
        try {
          const videosResult = await supabaseAdmin.from('videos').select('id, title, techniek_id, fase');
          if (!videosResult.error) {
            videosData = videosResult.data || [];
          }
        } catch (e) {}

        const views = viewsResult.data || [];
        const jobs = jobsResult.data || [];
        const videos = videosData;

        const viewCounts = {};
        for (const v of views) {
          if (v.video_id) {
            viewCounts[v.video_id] = (viewCounts[v.video_id] || 0) + 1;
          }
        }

        const videoMeta = {};
        for (const j of jobs) {
          videoMeta[j.id] = {
            title: j.title,
            techniqueId: j.techniek_id || (j.detected_technieken?.[0]?.techniek_id) || null,
            fase: j.fase || (j.detected_technieken?.[0]?.techniek_id?.split('.')[0]) || null,
          };
        }
        for (const v of videos) {
          if (!videoMeta[v.id]) {
            videoMeta[v.id] = {
              title: v.title,
              techniqueId: v.techniek_id || null,
              fase: v.fase || null,
            };
          }
        }

        const result = Object.entries(viewCounts)
          .map(([videoId, viewCount]) => {
            const meta = videoMeta[videoId] || {};
            return {
              videoId,
              title: meta.title || 'Onbekende video',
              views: viewCount,
              techniqueId: meta.techniqueId || null,
              fase: meta.fase || null,
            };
          })
          .sort((a, b) => b.views - a.views);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ videos: result, total: result.length }));
      } catch (err) {
        console.error('[Analytics] Content performance error:', err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    })();
    return;
  }
  
  // Sync video durations from Mux
  if (pathname === '/api/videos/sync-durations' && req.method === 'POST') {
    (async () => {
      try {
        if (!supabaseAdmin) {
          throw new Error('Supabase niet geconfigureerd');
        }
        
        const { data: videos, error } = await supabaseAdmin
          .from('video_ingest_jobs')
          .select('id, mux_asset_id, video_title')
          .not('mux_asset_id', 'is', null)
          .eq('status', 'completed');
        
        if (error) throw error;
        
        let updated = 0;
        const results = [];
        
        for (const video of videos || []) {
          const duration = await getMuxAssetDuration(video.mux_asset_id);
          if (duration) {
            results.push({ id: video.id, title: video.video_title, duration });
            updated++;
          }
        }
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
          success: true, 
          updated, 
          total: (videos || []).length,
          durations: results 
        }));
      } catch (err) {
        console.error('[Videos] Sync durations error:', err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    })();
    return;
  }
  
  // Cloud Run worker callback - receives status updates from external processor
  if (pathname === '/api/worker-callback' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const data = JSON.parse(body || '{}');
        const { job_id, status, mux_playback_id, error } = data;
        
        console.log(`[WorkerCallback] Received callback for job ${job_id}: ${status}`);
        
        if (!job_id) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'job_id required' }));
          return;
        }
        
        if (status === 'completed' && mux_playback_id) {
          // Update database with all received data from Cloud Run
          const updateData = {
            status: 'completed',
            mux_playback_id: mux_playback_id,
            mux_asset_id: data.mux_asset_id || null,
            mux_status: 'ready',
            error_message: null
          };
          
          // Add transcript if provided
          if (data.transcript) {
            updateData.transcript = data.transcript;
          }
          
          // Add RAG document ID if provided
          if (data.rag_document_id) {
            updateData.rag_document_id = data.rag_document_id;
          }
          
          // Apply folder-weighted technique detection (50% folder + 50% AI)
          try {
            const { data: jobInfo } = supabaseAdmin ? await supabaseAdmin
              .from('video_ingest_jobs')
              .select('drive_folder_id')
              .eq('id', job_id)
              .single() : { data: null };
            
            let folderMatch = null;
            if (jobInfo?.drive_folder_id) {
              folderMatch = await matchFolderWithParentFallback(jobInfo.drive_folder_id);
              if (folderMatch) {
                console.log(`[WorkerCallback] Folder "${folderMatch.folderName}" => techniek ${folderMatch.techniek_id} (score: ${folderMatch.score})`);
              }
            }
            
            if (folderMatch || data.ai_suggested_techniek_id) {
              const weighted = computeWeightedTechnique(
                folderMatch,
                data.ai_suggested_techniek_id,
                data.ai_confidence
              );
              
              if (weighted) {
                updateData.ai_suggested_techniek_id = weighted.techniek_id;
                updateData.ai_confidence = weighted.confidence;
                if (weighted.fase) updateData.fase = weighted.fase;
                console.log(`[WorkerCallback] Weighted technique: ${weighted.techniek_id} (confidence: ${weighted.confidence?.toFixed(2)})`);
              }
            } else if (data.ai_suggested_techniek_id) {
              updateData.ai_suggested_techniek_id = data.ai_suggested_techniek_id;
              updateData.ai_confidence = data.ai_confidence || null;
            }
          } catch (techErr) {
            console.warn(`[WorkerCallback] Technique weighting failed, using AI only: ${techErr.message}`);
            if (data.ai_suggested_techniek_id) {
              updateData.ai_suggested_techniek_id = data.ai_suggested_techniek_id;
              updateData.ai_confidence = data.ai_confidence || null;
            }
          }
          
          // Update database
          if (supabaseAdmin) {
            await supabaseAdmin
              .from('video_ingest_jobs')
              .update(updateData)
              .eq('id', job_id);
            console.log(`[WorkerCallback] Database updated for job ${job_id}`);
          }
          
          // Fetch Mux duration
          const assetId = data.mux_asset_id;
          if (assetId) {
            const duration = await getMuxAssetDuration(assetId);
            if (duration) {
              await saveDurationToDatabase(job_id, duration, 'pipeline');
            }
          }
          
          // Auto-generate AI features if transcript available
          if (data.transcript) {
            const videoTitle = data.video_title || data.drive_file_name || null;
            let title = videoTitle;
            if (!title && supabaseAdmin) {
              const { data: jobData } = await supabaseAdmin
                .from('video_ingest_jobs')
                .select('video_title, drive_file_name')
                .eq('id', job_id)
                .single();
              title = jobData?.video_title || jobData?.drive_file_name;
            }

            const folderTechId = updateData.ai_suggested_techniek_id || data.ai_suggested_techniek_id || null;

            detectMultipleTechniques(job_id, data.transcript, folderTechId)
              .then(techniques => {
                if (techniques.length > 0) {
                  saveVideoTechnieken(job_id, techniques);
                  const primary = techniques.find(t => t.is_primary);
                  if (primary && supabaseAdmin) {
                    supabaseAdmin
                      .from('video_ingest_jobs')
                      .update({ ai_suggested_techniek_id: primary.techniek_id, ai_confidence: primary.confidence })
                      .eq('id', job_id)
                      .then(({ error }) => {
                        if (error) console.warn(`[TechTag] Failed to update primary technique: ${error.message}`);
                      });
                  }
                }
              })
              .catch(e => console.error(`[WorkerCallback] Multi-technique detection failed for ${job_id}:`, e.message));

            generateAiSummary(job_id, title, data.transcript)
              .then(summary => {
                if (summary) console.log(`[WorkerCallback] AI summary generated for ${job_id}`);
                const techId = data.ai_suggested_techniek_id || '';
                return generateAiTitle(job_id, title, data.transcript, techId, summary);
              })
              .then(aiTitle => {
                if (aiTitle) console.log(`[WorkerCallback] AI title generated for ${job_id}: "${aiTitle}"`);
              })
              .catch(e => console.error(`[WorkerCallback] AI summary/title failed for ${job_id}:`, e.message));
          }
          
          console.log(`[WorkerCallback] Job ${job_id} completed with playback_id ${mux_playback_id}`);
        } else if (status === 'failed') {
          // Update database with error
          if (supabaseAdmin) {
            await supabaseAdmin
              .from('video_ingest_jobs')
              .update({ 
                status: 'failed', 
                error_message: error || 'External processing failed' 
              })
              .eq('id', job_id);
          }
          console.log(`[WorkerCallback] Job ${job_id} failed: ${error}`);
        }
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, received: data }));
      } catch (err) {
        console.error('[WorkerCallback] Error:', err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }
  
  // Send large video to Cloud Run worker
  if (pathname === '/api/video-processor/external' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const data = JSON.parse(body || '{}');
        const { job_id, drive_file_id } = data;
        
        const CLOUD_RUN_URL = process.env.CLOUD_RUN_WORKER_URL;
        const WORKER_SECRET = process.env.CLOUD_RUN_WORKER_SECRET;
        
        if (!CLOUD_RUN_URL) {
          throw new Error('CLOUD_RUN_WORKER_URL niet geconfigureerd');
        }
        if (!WORKER_SECRET) {
          throw new Error('CLOUD_RUN_WORKER_SECRET niet geconfigureerd');
        }
        
        // Get fresh Google access token
        const accessToken = await getGoogleDriveAccessToken();
        
        // Get callback URL - MUST use public Replit domain, not localhost
        const replitDomain = process.env.REPLIT_DOMAINS?.split(',')[0];
        if (!replitDomain) {
          throw new Error('REPLIT_DOMAINS niet beschikbaar - kan geen callback URL maken');
        }
        const callbackUrl = `https://${replitDomain}/api/worker-callback`;
        console.log(`[External] Callback URL: ${callbackUrl}`);
        
        console.log(`[External] Sending job ${job_id} to Cloud Run: ${CLOUD_RUN_URL}`);
        
        // Update status to indicate external processing
        if (supabaseAdmin) {
          await supabaseAdmin
            .from('video_ingest_jobs')
            .update({ status: 'external_processing', error_message: null })
            .eq('id', job_id);
        }
        
        // FIRE-AND-FORGET: Send to Cloud Run but don't wait for response
        // Cloud Run v6.0 is synchronous and takes 5-30 minutes to process
        // It updates Supabase directly, so we don't need the response
        fetch(`${CLOUD_RUN_URL}/process`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${WORKER_SECRET}`
          },
          body: JSON.stringify({
            job_id,
            drive_file_id,
            access_token: accessToken,
            callback_url: callbackUrl
          })
        }).then(response => {
          console.log(`[External] Cloud Run responded for job ${job_id}: ${response.status}`);
        }).catch(err => {
          // Log but don't fail - Cloud Run may still be processing
          console.log(`[External] Cloud Run request ended for job ${job_id}: ${err.message}`);
        });
        
        // Respond immediately - don't wait for Cloud Run
        console.log(`[External] Job ${job_id} sent to Cloud Run (fire-and-forget)`);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
          success: true, 
          message: 'Job verzonden naar Cloud Run. Verwerking duurt 5-30 minuten. Status wordt automatisch bijgewerkt.',
          job_id
        }));
      } catch (err) {
        console.error('[External] Error:', err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }
  
  // Cloud Run Worker Deploy Endpoint - triggers deployment via Python script
  if (pathname === '/api/admin/cloud-run/deploy' && req.method === 'POST') {
    if (!checkAuth(req)) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, message: 'Niet geautoriseerd' }));
      return;
    }
    
    console.log('[Deploy] Starting Cloud Run worker deployment...');
    
    const deployScript = spawn(PYTHON_BIN, ['scripts/deploy_cloud_run.py'], {
      cwd: process.cwd(),
      env: process.env
    });
    
    let output = '';
    let errorOutput = '';
    
    deployScript.on('error', (err) => {
      console.error(`[Deploy] Failed to start deploy script: ${err.message}`);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, message: 'Python niet beschikbaar', error: err.message }));
    });

    deployScript.stdout.on('data', (data) => {
      const line = data.toString();
      output += line;
      console.log(`[Deploy] ${line.trim()}`);
    });
    
    deployScript.stderr.on('data', (data) => {
      const line = data.toString();
      errorOutput += line;
      console.error(`[Deploy Error] ${line.trim()}`);
    });
    
    deployScript.on('close', (code) => {
      if (code === 0) {
        console.log('[Deploy] Deployment script completed successfully');
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
          success: true, 
          message: 'Cloud Run deployment gestart! Dit duurt 3-5 minuten.',
          output: output
        }));
      } else {
        console.error(`[Deploy] Script failed with code ${code}`);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
          success: false, 
          message: 'Deployment mislukt',
          error: errorOutput || output
        }));
      }
    });
    
    return;
  }
  
  // Check Cloud Run credentials endpoint
  if (pathname === '/api/admin/cloud-run/check-credentials' && req.method === 'GET') {
    if (!checkAuth(req)) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, message: 'Niet geautoriseerd' }));
      return;
    }
    
    const checkScript = spawn(PYTHON_BIN, ['scripts/deploy_cloud_run.py', '--check'], {
      cwd: process.cwd(),
      env: process.env
    });
    
    let output = '';
    let checkRespondedAlready = false;

    checkScript.on('error', (err) => {
      if (checkRespondedAlready) return;
      checkRespondedAlready = true;
      console.warn(`[CloudRun] python3 niet beschikbaar: ${err.message}`);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ valid: false, message: 'Python niet beschikbaar', details: err.message }));
    });

    checkScript.stdout.on('data', (data) => {
      output += data.toString();
    });
    
    checkScript.stderr.on('data', (data) => {
      output += data.toString();
    });
    
    checkScript.on('close', (code) => {
      if (checkRespondedAlready) return;
      checkRespondedAlready = true;
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ 
        valid: code === 0,
        message: code === 0 ? 'Credentials zijn geldig' : 'Credentials ontbreken of zijn ongeldig',
        details: output.trim()
      }));
    });
    
    return;
  }
  
  // Batch Queue Endpoints
  if (pathname === '/api/video-processor/batch/start' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const data = JSON.parse(body || '{}');
        const intervalMinutes = data.intervalMinutes || 15;
        const result = await startBatchQueue(intervalMinutes);
        res.writeHead(result.success ? 200 : 400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, message: err.message }));
      }
    });
    return;
  }

  // Webinar Recording Processor Endpoint
  if (pathname === '/api/webinar-recordings/process' && req.method === 'POST') {
    (async () => {
      try {
        if (!supabaseAdmin) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, message: 'Database not configured' }));
          return;
        }

        // Fetch pending webinar ingest jobs
        const { data: jobs, error: fetchError } = await supabaseAdmin
          .from('video_ingest_jobs')
          .select('*')
          .eq('source_type', 'webinar_recording')
          .eq('status', 'queued');

        if (fetchError) throw fetchError;

        console.log(`[WebinarProcessor] Found ${jobs?.length || 0} pending webinar jobs`);
        const results = [];

        for (const job of jobs || []) {
          try {
            console.log(`[WebinarProcessor] Processing job ${job.id}: ${job.title}`);
            
            // 1. Update status to processing
            await supabaseAdmin.from('video_ingest_jobs').update({ status: 'processing' }).eq('id', job.id);

            // 2. Mux upload via URL
            const MUX_TOKEN_ID = process.env.MUX_TOKEN_ID;
            const MUX_TOKEN_SECRET = process.env.MUX_TOKEN_SECRET;
            let muxAssetId = null;
            let muxPlaybackId = null;

            if (MUX_TOKEN_ID && MUX_TOKEN_SECRET) {
              const auth = Buffer.from(`${MUX_TOKEN_ID}:${MUX_TOKEN_SECRET}`).toString('base64');
              const muxResponse = await fetch('https://api.mux.com/video/v1/assets', {
                method: 'POST',
                headers: {
                  'Authorization': `Basic ${auth}`,
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                  input: [{ url: job.source_url }],
                  playback_policy: ['public']
                })
              });

              if (muxResponse.ok) {
                const muxData = await muxResponse.json();
                muxAssetId = muxData.data.id;
                muxPlaybackId = muxData.data.playback_ids?.[0]?.id;
                console.log(`[WebinarProcessor] Mux asset created: ${muxAssetId}`);
              } else {
                console.error(`[WebinarProcessor] Mux upload failed for job ${job.id}:`, await muxResponse.text());
              }
            }

            // 3. Transcription via Whisper (OpenAI)
            // As noted, Whisper requires a file. Since we have a URL, we'll use a temporary file.
            const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
            let transcript = null;
            if (OPENAI_API_KEY) {
              console.log(`[WebinarProcessor] Requesting transcription for ${job.source_url}`);
              try {
                // Download the file to a temporary location
                const tempFile = path.join('/tmp', `webinar_${job.id}.mp4`);
                const response = await fetch(job.source_url);
                const buffer = await response.arrayBuffer();
                fs.writeFileSync(tempFile, Buffer.from(buffer));

                // Send to Whisper
                const formData = new FormData();
                formData.append('file', new Blob([fs.readFileSync(tempFile)]), `webinar_${job.id}.mp4`);
                formData.append('model', 'whisper-1');

                const whisperResponse = await fetch('https://api.openai.com/v1/audio/transcriptions', {
                  method: 'POST',
                  headers: {
                    'Authorization': `Bearer ${OPENAI_API_KEY}`
                  },
                  body: formData
                });

                if (whisperResponse.ok) {
                  const whisperData = await whisperResponse.json();
                  transcript = whisperData.text;
                  console.log(`[WebinarProcessor] Transcription complete (${transcript.length} chars)`);
                } else {
                  console.error(`[WebinarProcessor] Whisper failed:`, await whisperResponse.text());
                }

                // Cleanup
                fs.unlinkSync(tempFile);
              } catch (transErr) {
                console.error(`[WebinarProcessor] Transcription error:`, transErr);
              }
            }

            // 4. Samenvatting
            let summary = null;
            if (transcript) {
              summary = await generateAiSummary(job.id, job.title, transcript);
            }

            // 5. Technique detection
            let detectedTechniques = [];
            if (transcript) {
              detectedTechniques = await detectMultipleTechniques(job.id, transcript);
              await saveVideoTechnieken(job.id, detectedTechniques);
            }

            // 6. RAG embedding
            let ragDocumentId = null;
            if (transcript && OPENAI_API_KEY) {
              console.log(`[WebinarProcessor] Generating RAG embedding...`);
              
              // Correct chunking for long transcripts (max 1000 tokens ≈ 4000 chars)
              const chunkSize = 4000;
              const chunks = [];
              for (let i = 0; i < transcript.length; i += chunkSize) {
                chunks.push(transcript.slice(i, i + chunkSize));
              }

              for (let i = 0; i < chunks.length; i++) {
                const chunk = chunks[i];
                const embeddingResponse = await fetch('https://api.openai.com/v1/embeddings', {
                  method: 'POST',
                  headers: {
                    'Authorization': `Bearer ${OPENAI_API_KEY}`,
                    'Content-Type': 'application/json'
                  },
                  body: JSON.stringify({
                    model: 'text-embedding-3-small',
                    input: chunk
                  })
                });

                if (embeddingResponse.ok) {
                  const embeddingData = await embeddingResponse.json();
                  const embedding = embeddingData.data[0].embedding;

                  const { data: ragDoc, error: ragError } = await supabaseAdmin
                    .from('rag_documents')
                    .insert({
                      content: chunk,
                      embedding: embedding,
                      title: chunks.length > 1 ? `${job.title} (Deel ${i + 1})` : job.title,
                      source_id: `webinar_${job.id}_${i}`,
                      doc_type: 'webinar',
                      metadata: {
                        session_id: job.metadata?.session_id,
                        session_title: job.metadata?.session_title,
                        session_date: job.metadata?.recorded_at || new Date().toISOString(),
                        source_type: 'webinar',
                        techniek_ids: detectedTechniques.map(t => t.techniek_id),
                        chunk_index: i,
                        total_chunks: chunks.length
                      }
                    })
                    .select()
                    .single();

                  if (!ragError && i === 0) {
                    ragDocumentId = ragDoc.id;
                    console.log(`[WebinarProcessor] RAG document created: ${ragDocumentId}`);
                  } else if (ragError) {
                    console.error(`[WebinarProcessor] RAG insertion failed for chunk ${i}:`, ragError);
                  }
                }
              }
            }

            // 7. Update live_sessions
            if (job.metadata?.session_id) {
              await supabaseAdmin
                .from('live_sessions')
                .update({
                  mux_playback_id: muxPlaybackId,
                  transcript: transcript,
                  ai_summary: summary,
                  processed_at: new Date().toISOString()
                })
                .eq('id', job.metadata.session_id);
            }

            // 8. Update video_ingest_jobs
            await supabaseAdmin.from('video_ingest_jobs').update({ 
              status: 'completed',
              mux_asset_id: muxAssetId,
              mux_playback_id: muxPlaybackId,
              transcript: transcript,
              ai_summary: summary,
              rag_document_id: ragDocumentId,
              processed_at: new Date().toISOString()
            }).eq('id', job.id);

            results.push({ id: job.id, success: true });
          } catch (jobErr) {
            console.error(`[WebinarProcessor] Job ${job.id} failed:`, jobErr);
            await supabaseAdmin.from('video_ingest_jobs').update({ 
              status: 'failed', 
              error_message: jobErr.message 
            }).eq('id', job.id);
            results.push({ id: job.id, success: false, error: jobErr.message });
          }
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, processed: results.length, results }));
      } catch (err) {
        console.error('[WebinarProcessor] General error:', err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, message: err.message }));
      }
    })();
    return;
  }

  // Manual Trigger Endpoint for Admin
  if (pathname === '/api/webinar-recordings/trigger-process' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const data = JSON.parse(body || '{}');
        const { sessionId, recordingUrl, title } = data;

        if (!sessionId || !recordingUrl) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, message: 'sessionId and recordingUrl are required' }));
          return;
        }

        if (!supabaseAdmin) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, message: 'Database not configured' }));
          return;
        }

        // Queue the job
        const { error: queueError } = await supabaseAdmin
          .from('video_ingest_jobs')
          .insert({
            source_type: 'webinar_recording',
            source_url: recordingUrl,
            title: title || `Webinar Recording ${sessionId}`,
            status: 'queued',
            skip_greenscreen: true,
            skip_mux_upload: false,
            metadata: {
              session_id: sessionId,
              session_title: title,
              recorded_at: new Date().toISOString()
            }
          });

        if (queueError) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, message: queueError.message }));
          return;
        }

        console.log(`[WebinarProcessor] Manually queued webinar for session ${sessionId}`);
        
        // Optionally trigger the processor immediately
        // (could be done via a separate call or here)

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, message: 'Webinar processing job queued' }));
      } catch (err) {
        console.error('[WebinarProcessor] Trigger error:', err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, message: err.message }));
      }
    });
    return;
  }

  // Polling mechanism: Check for finished recordings
  if (pathname === '/api/webinar-recordings/check-pending' && req.method === 'GET') {
    (async () => {
      try {
        if (!supabaseAdmin) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, message: 'Database not configured' }));
          return;
        }

        // Find sessions that ended but don't have a video_url yet
        const { data: sessions, error } = await supabaseAdmin
          .from('live_sessions')
          .select('id, daily_room_name, title')
          .eq('status', 'ended')
          .is('video_url', null)
          .not('daily_room_name', 'is', null);

        if (error) throw error;

        console.log(`[WebinarPolling] Checking ${sessions?.length || 0} sessions for recordings`);
        const dailyApiKey = process.env.DAILY_API_KEY;
        const results = [];

        if (dailyApiKey) {
          for (const session of sessions || []) {
            try {
              const recordingsResponse = await fetch(
                `https://api.daily.co/v1/recordings?room_name=${session.daily_room_name}`,
                { headers: { 'Authorization': `Bearer ${dailyApiKey}` } }
              );

              if (recordingsResponse.ok) {
                const recordingsData = await recordingsResponse.json();
                const latest = (recordingsData.data || []).sort((a, b) => 
                  new Date(b.start_ts).getTime() - new Date(a.start_ts).getTime()
                )[0];

                if (latest && (latest.status === 'finished' || latest.status === 'saved')) {
                  const accessResp = await fetch(
                    `https://api.daily.co/v1/recordings/${latest.id}/access-link`,
                    { headers: { 'Authorization': `Bearer ${dailyApiKey}` } }
                  );

                  if (accessResp.ok) {
                    const { download_link } = await accessResp.json();
                    
                    // Update session
                    await supabaseAdmin.from('live_sessions').update({ video_url: download_link }).eq('id', session.id);

                    // Queue ingest job
                    await supabaseAdmin.from('video_ingest_jobs').insert({
                      source_type: 'webinar_recording',
                      source_url: download_link,
                      title: session.title || `Webinar Recording ${session.id}`,
                      status: 'queued',
                      skip_greenscreen: true,
                      skip_mux_upload: false,
                      metadata: {
                        session_id: session.id,
                        session_title: session.title,
                        recorded_at: new Date().toISOString()
                      }
                    });
                    
                    results.push({ id: session.id, found: true });
                    console.log(`[WebinarPolling] Found recording for session ${session.id}`);
                  }
                }
              }
            } catch (sessErr) {
              console.error(`[WebinarPolling] Error checking session ${session.id}:`, sessErr);
            }
          }
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, results }));
      } catch (err) {
        console.error('[WebinarPolling] Global error:', err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, message: err.message }));
      }
    })();
    return;
  }
  
  if (pathname === '/api/video-processor/batch/stop' && req.method === 'POST') {
    (async () => {
      try {
        const result = await stopBatchQueue();
        res.writeHead(result.success ? 200 : 400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, message: err.message }));
      }
    })();
    return;
  }
  
  if (pathname === '/api/video-processor/batch/status' && req.method === 'GET') {
    (async () => {
      try {
        const status = await getBatchStatus();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(status));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ active: false, error: err.message }));
      }
    })();
    return;
  }
  
  // RAG Search Endpoint - Semantic search with video metadata
  if (pathname === '/api/rag/search' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const { query, limit = 5, techniek_filter = null } = JSON.parse(body || '{}');
        
        if (!query) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Query is required' }));
          return;
        }
        
        if (!supabaseAdmin) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Database not configured' }));
          return;
        }
        
        // Generate embedding for query using OpenAI
        const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
        if (!OPENAI_API_KEY) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'OpenAI API key not configured' }));
          return;
        }
        
        const embeddingResponse = await fetch('https://api.openai.com/v1/embeddings', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${OPENAI_API_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: 'text-embedding-3-small',
            input: query
          })
        });
        
        if (!embeddingResponse.ok) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Failed to generate embedding' }));
          return;
        }
        
        const embeddingData = await embeddingResponse.json();
        const queryEmbedding = embeddingData.data[0].embedding;
        
        // Search rag_documents with pgvector similarity using direct SQL
        // First try the RPC function, fallback to simple keyword search
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
            // Fallback: Simple content search if RPC fails or returns nothing
            console.log('[RAG] RPC returned no results, falling back to keyword search');
            const { data: keywordResults } = await supabaseAdmin
              .from('rag_documents')
              .select('id, title, content, doc_type, techniek_id, fase')
              .or(`content.ilike.%${query.split(' ').join('%')},title.ilike.%${query}%`)
              .limit(limit * 2);
            
            ragResults = (keywordResults || []).map(doc => ({
              ...doc,
              similarity: 0.5 // Approximate similarity for keyword matches
            }));
          }
        } catch (rpcErr) {
          console.warn('[RAG] RPC failed:', rpcErr.message, '- using keyword fallback');
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
        
        // Join with video_ingest_jobs to get video metadata
        const enrichedResults = [];
        for (const doc of ragResults || []) {
          // Find matching video by rag_document_id
          const { data: videoData } = await supabaseAdmin
            .from('video_ingest_jobs')
            .select('id, video_title, drive_file_name, techniek_id, ai_suggested_techniek_id, fase, mux_playback_id, duration_seconds')
            .eq('rag_document_id', doc.id)
            .is('deleted_at', null)
            .limit(1);
          
          const video = videoData?.[0];
          const effectiveTechniek = video?.techniek_id || video?.ai_suggested_techniek_id;
          
          // Apply techniek filter if specified
          if (techniek_filter && effectiveTechniek !== techniek_filter) {
            continue;
          }
          
          // Build a user-friendly title
          let displayTitle = doc.title;
          if (doc.doc_type === 'video_transcript' && video) {
            // Use video title with techniek prefix if available
            const videoTitle = video.video_title || video.drive_file_name;
            if (effectiveTechniek && videoTitle) {
              displayTitle = `${effectiveTechniek} - ${videoTitle}`;
            } else {
              displayTitle = videoTitle || doc.title;
            }
          } else if (doc.doc_type === 'hugo_training' && video) {
            // Same for training content
            const videoTitle = video.video_title || video.drive_file_name;
            if (effectiveTechniek && videoTitle) {
              displayTitle = `${effectiveTechniek} - ${videoTitle}`;
            } else {
              displayTitle = videoTitle || doc.title;
            }
          }
          
          enrichedResults.push({
            rag_id: doc.id,
            title: displayTitle,
            content_preview: doc.content?.substring(0, 300) + '...',
            similarity: doc.similarity,
            techniek_id: effectiveTechniek || doc.techniek_id,
            fase: video?.fase || doc.fase,
            doc_type: doc.doc_type,
            source_id: video?.id || doc.source_id,
            video: video ? {
              id: video.id,
              title: video.video_title || video.drive_file_name,
              file_name: video.drive_file_name,
              techniek: effectiveTechniek,
              techniek_source: video.techniek_id ? 'manual' : (video.ai_suggested_techniek_id ? 'ai' : 'none'),
              fase: video.fase,
              mux_playback_id: video.mux_playback_id,
              duration_seconds: video.duration_seconds,
              watch_url: video.mux_playback_id ? `https://stream.mux.com/${video.mux_playback_id}.m3u8` : null
            } : null
          });
          
          if (enrichedResults.length >= limit) break;
        }
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          query,
          results: enrichedResults,
          total: enrichedResults.length
        }));
        
      } catch (err) {
        console.error('[RAG] Search error:', err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }
  
  // Get videos by techniek endpoint
  if (pathname === '/api/rag/videos-by-techniek' && req.method === 'GET') {
    (async () => {
      try {
        const techniekId = parsedUrl.query.techniek;
        
        if (!techniekId) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'techniek parameter is required' }));
          return;
        }
        
        if (!supabaseAdmin) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Database not configured' }));
          return;
        }
        
        // Find videos with this techniek (manual or AI suggested)
        const { data: videos, error } = await supabaseAdmin
          .from('video_ingest_jobs')
          .select('id, video_title, drive_file_name, techniek_id, ai_suggested_techniek_id, ai_confidence, fase, mux_playback_id, duration_seconds')
          .is('deleted_at', null)
          .or(`techniek_id.eq.${techniekId},ai_suggested_techniek_id.eq.${techniekId}`)
          .order('ai_confidence', { ascending: false, nullsFirst: false });
        
        if (error) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: error.message }));
          return;
        }
        
        const result = (videos || []).map(v => ({
          id: v.id,
          title: v.video_title || v.drive_file_name,
          file_name: v.drive_file_name,
          techniek: v.techniek_id || v.ai_suggested_techniek_id,
          techniek_source: v.techniek_id ? 'manual' : 'ai',
          ai_confidence: v.ai_confidence,
          fase: v.fase,
          mux_playback_id: v.mux_playback_id,
          duration_seconds: v.duration_seconds,
          watch_url: v.mux_playback_id ? `https://stream.mux.com/${v.mux_playback_id}.m3u8` : null
        }));
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          techniek: techniekId,
          videos: result,
          total: result.length
        }));
        
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    })();
    return;
  }
  
  // Config Review - Approve technique changes and update SSOT
  if (pathname === '/api/config-review/approve' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const { techniqueNumber, changes } = JSON.parse(body || '{}');
        
        if (!techniqueNumber || !changes) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: 'techniqueNumber en changes zijn verplicht' }));
          return;
        }
        
        // Read current technieken_index.json
        const ssotPath = path.join(__dirname, '..', 'src', 'data', 'technieken_index.json');
        
        if (!fs.existsSync(ssotPath)) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: 'technieken_index.json niet gevonden' }));
          return;
        }
        
        const ssotData = JSON.parse(fs.readFileSync(ssotPath, 'utf8'));
        
        // Find and update the technique in the flat technieken object
        let found = false;
        
        // The structure is: { technieken: { "0": {...}, "1.1": {...}, ... } }
        if (ssotData.technieken && ssotData.technieken[techniqueNumber]) {
          // Direct match by nummer key
          const techniek = ssotData.technieken[techniqueNumber];
          Object.keys(changes).forEach(key => {
            if (key !== 'nummer' && key !== 'fase') { // Never change nummer or fase
              techniek[key] = changes[key];
            }
          });
          found = true;
        } else if (ssotData.technieken) {
          // Search through all technieken for a matching nummer field
          for (const key of Object.keys(ssotData.technieken)) {
            const techniek = ssotData.technieken[key];
            if (techniek && techniek.nummer === techniqueNumber) {
              Object.keys(changes).forEach(changeKey => {
                if (changeKey !== 'nummer' && changeKey !== 'fase') {
                  techniek[changeKey] = changes[changeKey];
                }
              });
              found = true;
              break;
            }
          }
        }
        
        if (!found) {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: `Techniek ${techniqueNumber} niet gevonden` }));
          return;
        }
        
        // Write updated SSOT
        fs.writeFileSync(ssotPath, JSON.stringify(ssotData, null, 2));
        
        console.log(`[ConfigReview] Techniek ${techniqueNumber} bijgewerkt in SSOT`);
        
        // Optionally trigger RAG sync (async, don't wait)
        const syncProcess = spawn(PYTHON_BIN, ['scripts/sync_ssot_to_rag.py'], {
          cwd: path.join(__dirname, '..'),
          detached: true,
          stdio: 'ignore'
        });
        syncProcess.on('error', (err) => {
          console.warn(`[ConfigReview] RAG sync kon niet starten: ${err.message}`);
        });
        syncProcess.unref();
        console.log(`[ConfigReview] RAG sync gestart voor techniek ${techniqueNumber}`);
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
          success: true, 
          message: `Techniek ${techniqueNumber} bijgewerkt`,
          syncStarted: true 
        }));
        
      } catch (err) {
        console.error('[ConfigReview] Error:', err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
    });
    return;
  }
  
  // Generate or get AI summary for a single video
  if (pathname.match(/^\/api\/videos\/[^/]+\/summary$/) && req.method === 'POST') {
    if (!checkAuth(req)) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, message: 'Niet geautoriseerd' }));
      return;
    }
    const videoId = pathname.split('/')[3];
    const forceRegenerate = parsedUrl.query.force === 'true';
    
    (async () => {
      try {
        if (!supabaseAdmin) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Database niet geconfigureerd' }));
          return;
        }

        const { data: video, error: fetchError } = await supabaseAdmin
          .from('video_ingest_jobs')
          .select('id, video_title, drive_file_name, transcript, ai_summary')
          .eq('id', videoId)
          .single();

        if (fetchError || !video) {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Video niet gevonden' }));
          return;
        }

        if (!video.transcript) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Video heeft geen transcript om samen te vatten' }));
          return;
        }

        if (video.ai_summary && !forceRegenerate) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ summary: video.ai_summary, cached: true }));
          return;
        }

        const title = video.video_title || video.drive_file_name || 'Onbekende video';
        const summary = await generateAiSummary(videoId, title, video.transcript);

        if (!summary) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Samenvatting genereren mislukt' }));
          return;
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ summary, cached: false }));

      } catch (err) {
        console.error('[Summary] Error:', err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    })();
    return;
  }
  
  // Batch generate AI summaries for all videos with transcripts
  if (pathname === '/api/videos/batch-summaries' && req.method === 'POST') {
    if (!checkAuth(req)) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, message: 'Niet geautoriseerd' }));
      return;
    }
    
    (async () => {
      try {
        if (!supabaseAdmin) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Database niet geconfigureerd' }));
          return;
        }

        const forceAll = parsedUrl.query.force === 'true';
        
        let query = supabaseAdmin
          .from('video_ingest_jobs')
          .select('id, video_title, drive_file_name, transcript, ai_summary')
          .not('transcript', 'is', null)
          .neq('transcript', '');
        
        if (!forceAll) {
          query = query.is('ai_summary', null);
        }
        
        const { data: videos, error: fetchError } = await query;

        if (fetchError) {
          if (fetchError.code === '42703') {
            const { data: videosNoCol } = await supabaseAdmin
              .from('video_ingest_jobs')
              .select('id, video_title, drive_file_name, transcript')
              .not('transcript', 'is', null)
              .neq('transcript', '');
            
            if (!videosNoCol || videosNoCol.length === 0) {
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ success: true, total: 0, message: 'Geen videos met transcript gevonden. ai_summary kolom moet nog toegevoegd worden.' }));
              return;
            }
            
            console.log(`[BatchSummary] Starting batch for ${videosNoCol.length} videos (ai_summary kolom ontbreekt nog)`);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ 
              success: true, 
              total: videosNoCol.length, 
              message: `Batch gestart voor ${videosNoCol.length} videos. ai_summary kolom ontbreekt - samenvattingen worden gegenereerd maar niet opgeslagen tot de kolom is aangemaakt.`,
              started: true
            }));
            
            let generated = 0;
            let failed = 0;
            for (const v of videosNoCol) {
              const title = v.video_title || v.drive_file_name;
              const result = await generateAiSummary(v.id, title, v.transcript);
              if (result) generated++; else failed++;
              await new Promise(r => setTimeout(r, 500));
            }
            console.log(`[BatchSummary] Completed: ${generated} generated, ${failed} failed out of ${videosNoCol.length}`);
            return;
          }
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: fetchError.message }));
          return;
        }

        if (!videos || videos.length === 0) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, total: 0, message: 'Alle videos hebben al een samenvatting' }));
          return;
        }

        console.log(`[BatchSummary] Starting batch for ${videos.length} videos...`);
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
          success: true, 
          total: videos.length, 
          message: `Batch samenvatting gestart voor ${videos.length} videos. Dit draait op de achtergrond.`,
          started: true
        }));

        let generated = 0;
        let failed = 0;
        for (const video of videos) {
          const title = video.video_title || video.drive_file_name;
          const result = await generateAiSummary(video.id, title, video.transcript);
          if (result) generated++; else failed++;
          await new Promise(r => setTimeout(r, 500));
        }
        console.log(`[BatchSummary] Completed: ${generated} generated, ${failed} failed out of ${videos.length}`);
      } catch (err) {
        console.error('[BatchSummary] Error:', err);
        if (!res.writableEnded) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: err.message }));
        }
      }
    })();
    return;
  }

  // Get video transcript by ID
  if (pathname.match(/^\/api\/videos\/[^/]+\/transcript$/) && req.method === 'GET') {
    const videoId = pathname.split('/')[3];
    
    (async () => {
      try {
        if (!supabaseAdmin) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Database niet geconfigureerd' }));
          return;
        }
        
        // Try pipeline videos first
        const { data: pipelineVideo, error: pipelineError } = await supabaseAdmin
          .from('video_ingest_jobs')
          .select('id, video_title, drive_file_name, transcript, rag_document_id, ai_summary')
          .eq('id', videoId)
          .single();
        
        if (pipelineVideo) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            id: pipelineVideo.id,
            title: pipelineVideo.video_title || pipelineVideo.drive_file_name,
            transcript: pipelineVideo.transcript || null,
            ai_summary: pipelineVideo.ai_summary || null,
            has_transcript: !!pipelineVideo.transcript || !!pipelineVideo.rag_document_id
          }));
          return;
        }
        
        // Try manual videos
        const { data: manualVideo, error: manualError } = await supabaseAdmin
          .from('videos')
          .select('id, title, transcript')
          .eq('id', videoId)
          .single();
        
        if (manualVideo) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            id: manualVideo.id,
            title: manualVideo.title,
            transcript: manualVideo.transcript || null,
            has_transcript: !!manualVideo.transcript
          }));
          return;
        }
        
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Video niet gevonden' }));
        
      } catch (err) {
        console.error('[VideoProcessor] Transcript fetch error:', err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    })();
    return;
  }
  
  // Check if ai_attractive_title column exists
  if (pathname === '/api/videos/ensure-title-column' && req.method === 'POST') {
    (async () => {
      try {
        if (!supabaseAdmin) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Database niet geconfigureerd' }));
          return;
        }

        const { data, error } = await supabaseAdmin
          .from('video_ingest_jobs')
          .select('ai_attractive_title')
          .limit(1);

        if (error && error.code === '42703') {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ 
            exists: false, 
            message: 'Kolom bestaat nog niet. Voer dit uit in de Supabase SQL Editor:',
            sql: 'ALTER TABLE video_ingest_jobs ADD COLUMN IF NOT EXISTS ai_attractive_title TEXT;'
          }));
        } else {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ exists: true, message: 'Kolom ai_attractive_title bestaat al' }));
        }
      } catch (err) {
        console.error('[EnsureColumn] Error:', err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    })();
    return;
  }

  // Generate attractive AI titles for videos
  if (pathname === '/api/videos/generate-titles' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        if (!supabaseAdmin) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Database niet geconfigureerd' }));
          return;
        }
        if (!process.env.OPENAI_API_KEY) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'OpenAI API key niet geconfigureerd' }));
          return;
        }

        const { limit: batchLimit, force, offset: batchOffset, ids: specificIds } = JSON.parse(body || '{}');
        const maxBatch = Math.min(batchLimit || 10, 200);

        let columnExists = true;
        const testQuery = await supabaseAdmin
          .from('video_ingest_jobs')
          .select('ai_attractive_title')
          .limit(1);
        if (testQuery.error && testQuery.error.code === '42703') {
          columnExists = false;
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ 
            error: 'Kolom ai_attractive_title bestaat nog niet. Voer uit in Supabase SQL Editor:',
            sql: 'ALTER TABLE video_ingest_jobs ADD COLUMN IF NOT EXISTS ai_attractive_title TEXT;'
          }));
          return;
        }

        let query = supabaseAdmin
          .from('video_ingest_jobs')
          .select('id, video_title, drive_file_name, transcript, ai_summary, ai_suggested_techniek_id, status')
          .eq('status', 'completed')
          .not('transcript', 'is', null);

        if (specificIds && Array.isArray(specificIds) && specificIds.length > 0) {
          query = query.in('id', specificIds.slice(0, maxBatch));
        } else {
          if (!force && columnExists) {
            query = query.is('ai_attractive_title', null);
          }
          query = query.order('created_at', { ascending: true });
          if (batchOffset !== undefined && batchOffset !== null) {
            query = query.range(batchOffset, batchOffset + maxBatch - 1);
          } else {
            query = query.limit(maxBatch);
          }
        }

        const { data: videos, error: fetchErr } = await query;

        if (fetchErr) throw fetchErr;
        if (!videos || videos.length === 0) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ message: 'Geen videos om te verwerken', processed: 0 }));
          return;
        }

        console.log(`[AITitles] Generating titles for ${videos.length} videos...`);
        const results = [];

        for (const video of videos) {
          try {
            const techId = video.ai_suggested_techniek_id || '';
            const originalTitle = video.video_title || video.drive_file_name || 'Onbekende video';
            const summaryText = video.ai_summary || '';

            const aiTitle = await generateAiTitle(video.id, originalTitle, video.transcript, techId, summaryText);

            if (aiTitle) {
              results.push({ id: video.id, status: 'ok', originalTitle, aiTitle });
            } else {
              results.push({ id: video.id, status: 'no_title', title: null });
            }

            await new Promise(r => setTimeout(r, 200));
          } catch (videoErr) {
            console.error(`[AITitles] Error processing ${video.id}:`, videoErr.message);
            results.push({ id: video.id, status: 'error', error: videoErr.message });
          }
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          processed: results.length,
          success: results.filter(r => r.status === 'ok').length,
          results
        }));
      } catch (err) {
        console.error('[AITitles] Error:', err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  if (pathname === '/api/videos/detect-techniques' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        if (!supabaseAdmin) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Database niet geconfigureerd' }));
          return;
        }
        if (!process.env.OPENAI_API_KEY) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'OpenAI API key niet geconfigureerd' }));
          return;
        }

        const { limit: batchLimit, offset: batchOffset, ids: specificIds, force } = JSON.parse(body || '{}');
        const maxBatch = Math.min(batchLimit || 10, 50);

        let query = supabaseAdmin
          .from('video_ingest_jobs')
          .select('id, video_title, drive_file_name, transcript, ai_suggested_techniek_id, detected_technieken, status')
          .eq('status', 'completed')
          .not('transcript', 'is', null);

        if (specificIds && Array.isArray(specificIds) && specificIds.length > 0) {
          query = query.in('id', specificIds.slice(0, maxBatch));
        } else {
          query = query.order('created_at', { ascending: true });
          if (batchOffset !== undefined && batchOffset !== null) {
            query = query.range(batchOffset, batchOffset + maxBatch - 1);
          } else {
            query = query.limit(maxBatch);
          }
        }

        let { data: videos, error: fetchErr } = await query;
        if (fetchErr && fetchErr.code === '42703') {
          query = supabaseAdmin
            .from('video_ingest_jobs')
            .select('id, video_title, drive_file_name, transcript, ai_suggested_techniek_id, status')
            .eq('status', 'completed')
            .not('transcript', 'is', null);
          if (specificIds && Array.isArray(specificIds) && specificIds.length > 0) {
            query = query.in('id', specificIds.slice(0, maxBatch));
          } else {
            query = query.order('created_at', { ascending: true });
            if (batchOffset !== undefined && batchOffset !== null) {
              query = query.range(batchOffset, batchOffset + maxBatch - 1);
            } else {
              query = query.limit(maxBatch);
            }
          }
          const fallback = await query;
          videos = fallback.data;
          fetchErr = fallback.error;
        }
        if (fetchErr) throw fetchErr;

        if (!videos || videos.length === 0) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ message: 'Geen videos om te verwerken', processed: 0 }));
          return;
        }

        if (!force) {
          const tableReady = await getVideoTechniekenReady();
          let taggedIds = new Set();
          
          if (tableReady) {
            const { data: existing } = await supabaseAdmin
              .from('video_technieken')
              .select('video_id')
              .in('video_id', videos.map(v => v.id));
            taggedIds = new Set((existing || []).map(e => e.video_id));
          } else {
            const taggedFromJsonb = videos.filter(v => {
              const dt = v.detected_technieken;
              return dt && Array.isArray(dt) && dt.length > 0;
            });
            taggedIds = new Set(taggedFromJsonb.map(v => v.id));
          }
          
          const untagged = videos.filter(v => !taggedIds.has(v.id));
          if (untagged.length === 0 && videos.length > 0) {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ message: 'Alle videos in deze batch zijn al getagd. Gebruik force=true om opnieuw te detecteren.', processed: 0 }));
            return;
          }
          videos.splice(0, videos.length, ...untagged);
        }

        console.log(`[TechTag] Detecting techniques for ${videos.length} videos...`);
        const results = [];

        for (const video of videos) {
          try {
            const techniques = await detectMultipleTechniques(
              video.id,
              video.transcript,
              video.ai_suggested_techniek_id
            );

            if (techniques.length > 0) {
              await saveVideoTechnieken(video.id, techniques);
              const primary = techniques.find(t => t.is_primary);
              if (primary) {
                await supabaseAdmin
                  .from('video_ingest_jobs')
                  .update({ ai_suggested_techniek_id: primary.techniek_id, ai_confidence: primary.confidence })
                  .eq('id', video.id);
              }
              results.push({
                id: video.id,
                status: 'ok',
                title: video.video_title || video.drive_file_name,
                techniques: techniques.map(t => ({ id: t.techniek_id, confidence: t.confidence, source: t.source, primary: !!t.is_primary }))
              });
            } else {
              results.push({ id: video.id, status: 'no_match', title: video.video_title || video.drive_file_name });
            }

            await new Promise(r => setTimeout(r, 300));
          } catch (videoErr) {
            console.error(`[TechTag] Error processing ${video.id}:`, videoErr.message);
            results.push({ id: video.id, status: 'error', error: videoErr.message });
          }
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          processed: results.length,
          success: results.filter(r => r.status === 'ok').length,
          results
        }));
      } catch (err) {
        console.error('[TechTag] Batch error:', err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  if (pathname === '/api/videos/timeline' && req.method === 'GET') {
    (async () => {
      const videoId = parsedUrl.query.video_id;
      if (!videoId) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'video_id is verplicht' }));
        return;
      }

      if (!timelineRateLimit) timelineRateLimit = {};
      const now = Date.now();
      const clientKey = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown';
      const lastCall = timelineRateLimit[clientKey] || 0;
      if (now - lastCall < 2000) {
        res.writeHead(429, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Te veel verzoeken, wacht even' }));
        return;
      }
      timelineRateLimit[clientKey] = now;

      try {
        if (!supabaseAdmin) throw new Error('Database niet geconfigureerd');

        const cacheCol = 'technique_timeline';
        let cached = null;
        try {
          const { data } = await supabaseAdmin
            .from('video_ingest_jobs')
            .select(cacheCol)
            .eq('id', videoId)
            .single();
          if (data && data[cacheCol]) {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ video_id: videoId, timeline: data[cacheCol], cached: true }));
            return;
          }
        } catch (e) {
          // Column might not exist yet, continue to generate
        }

        const { data: job, error: jobErr } = await supabaseAdmin
          .from('video_ingest_jobs')
          .select('id, transcript, duration_seconds, techniek_id, detected_technieken')
          .eq('id', videoId)
          .single();

        if (jobErr || !job) {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Video niet gevonden' }));
          return;
        }

        if (!job.transcript) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ video_id: videoId, timeline: [], error: 'Geen transcript beschikbaar' }));
          return;
        }

        const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
        if (!OPENAI_API_KEY) throw new Error('OpenAI API key ontbreekt');

        const knownTechniques = [];
        if (job.detected_technieken && Array.isArray(job.detected_technieken)) {
          job.detected_technieken.forEach(t => {
            const tech = techniekenIndex?.[t.techniek_id];
            if (tech) knownTechniques.push({ id: t.techniek_id, naam: tech.naam });
          });
        }
        if (knownTechniques.length === 0 && job.techniek_id && techniekenIndex?.[job.techniek_id]) {
          knownTechniques.push({ id: job.techniek_id, naam: techniekenIndex[job.techniek_id].naam });
        }

        const techniqueListStr = knownTechniques.length > 0
          ? knownTechniques.map(t => `${t.id}: ${t.naam}`).join('\n')
          : Object.entries(techniekenIndex || {})
              .filter(([id, t]) => !t.is_fase && id.includes('.'))
              .map(([id, t]) => `${id}: ${t.naam}`)
              .join('\n');

        const durationSec = job.duration_seconds || 0;
        const transcriptForAI = job.transcript.length > 10000 ? job.transcript.slice(0, 10000) + '...' : job.transcript;

        const chatResponse = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${OPENAI_API_KEY}`,
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: [
              {
                role: 'system',
                content: `Je bent een expert in het analyseren van sales training transcripten van Hugo Herbots.
Segmenteer het transcript in tijdsblokken en bepaal welke verkooptechniek er in elk blok besproken wordt.

BESCHIKBARE TECHNIEKEN:
${techniqueListStr}

REGELS:
- Verdeel het transcript in logische segmenten van 30-120 seconden
- Elk segment moet een start_seconds en end_seconds bevatten
- De video duurt ${durationSec} seconden totaal — zorg dat segmenten deze duur niet overschrijden
- Als een stuk transcript geen specifieke techniek bevat, gebruik techniek_id "intro" of "outro"
- Schat de tijden in op basis van de positie in het transcript (begin = 0, einde = ${durationSec})
- Geef een korte beschrijving (max 15 woorden) van wat Hugo in elk segment bespreekt
- Antwoord UITSLUITEND in JSON format

ANTWOORD FORMAT:
{"segments": [{"start_seconds": 0, "end_seconds": 45, "techniek_id": "2.1", "label": "Introductie van de SPIN techniek"}, ...]}`
              },
              {
                role: 'user',
                content: `Segmenteer dit transcript in tijdsblokken met technieken.\n\nTranscript:\n${transcriptForAI}`
              }
            ],
            max_tokens: 2000,
            temperature: 0.2,
            response_format: { type: 'json_object' }
          }),
        });

        if (!chatResponse.ok) {
          const errText = await chatResponse.text();
          console.error(`[Timeline] OpenAI error for ${videoId}:`, errText);
          throw new Error('OpenAI API fout');
        }

        const chatData = await chatResponse.json();
        const content = chatData.choices?.[0]?.message?.content?.trim();
        if (!content) throw new Error('Geen antwoord van AI');

        let parsed;
        try {
          parsed = JSON.parse(content);
        } catch (e) {
          console.warn(`[Timeline] Parse error for ${videoId}:`, content);
          throw new Error('Kan AI antwoord niet verwerken');
        }

        let segments = parsed.segments || parsed.timeline || [];
        segments = segments
          .filter(s => s && typeof s.start_seconds === 'number' && typeof s.end_seconds === 'number')
          .map(s => ({
            start_seconds: Math.max(0, Math.round(s.start_seconds)),
            end_seconds: Math.min(durationSec || 9999, Math.round(s.end_seconds)),
            techniek_id: s.techniek_id || s.technique_id || 'intro',
            label: s.label || s.description || '',
          }))
          .sort((a, b) => a.start_seconds - b.start_seconds);

        // Cache in database (best effort — column may not exist)
        try {
          await supabaseAdmin
            .from('video_ingest_jobs')
            .update({ technique_timeline: segments })
            .eq('id', videoId);
        } catch (e) {
          console.warn(`[Timeline] Could not cache timeline for ${videoId}:`, e.message);
        }

        console.log(`[Timeline] Generated ${segments.length} segments for ${videoId}`);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ video_id: videoId, timeline: segments, cached: false }));
      } catch (err) {
        console.error(`[Timeline] Error for ${videoId}:`, err.message);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    })();
    return;
  }

  if (pathname === '/api/videos/technieken' && req.method === 'GET') {
    (async () => {
      const videoId = parsedUrl.query.video_id;
      try {
        if (!supabaseAdmin) throw new Error('Database niet geconfigureerd');
        
        let query = supabaseAdmin
          .from('video_technieken')
          .select('*')
          .order('confidence', { ascending: false });

        if (videoId) {
          query = query.eq('video_id', videoId);
        }

        const { data, error } = await query;
        if (error) throw error;

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(data || []));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    })();
    return;
  }

  // Platform Sync - Send message to .ai platform
  if (pathname === '/api/platform-sync/send' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const { target, type, title, content } = JSON.parse(body);
        
        const { data, error } = await supabaseAdmin
          .from('platform_sync')
          .insert({
            source_platform: 'com',
            target_platform: target || 'ai',
            message_type: type || 'notification',
            title: title || 'Message from .com',
            content: content || {},
          })
          .select()
          .single();
        
        if (error) throw error;
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, message: data }));
      } catch (err) {
        console.error('[PlatformSync] Send error:', err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }
  
  // Platform Sync - Get messages for this platform
  if (pathname === '/api/platform-sync/messages' && req.method === 'GET') {
    (async () => {
      try {
        const { data, error } = await supabaseAdmin
          .from('platform_sync')
          .select('*')
          .or('target_platform.eq.com,target_platform.eq.both')
          .order('created_at', { ascending: false })
          .limit(50);
        
        if (error) throw error;
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ messages: data }));
      } catch (err) {
        console.error('[PlatformSync] Get messages error:', err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    })();
    return;
  }
  
  // Platform Sync - Sync API spec to .ai platform
  if (pathname === '/api/platform-sync/sync-api-spec' && req.method === 'POST') {
    (async () => {
      try {
        const apiSpec = {
          endpoints: [
            {
              method: 'POST',
              path: '/api/v2/chat',
              description: 'Chat with Hugo AI',
              request: {
                message: 'string - user message',
                userId: 'string (optional) - Supabase user UUID',
                conversationHistory: 'array of {role, content}',
                techniqueContext: 'string (optional) - current technique being practiced',
                sourceApp: "'com' | 'ai' - which platform sent the request",
              },
              response: {
                message: 'string - Hugo response',
                technique: 'string (optional) - suggested technique number',
                sources: 'array (optional) - video sources used',
              },
            },
            {
              method: 'GET',
              path: '/api/v2/user/activity-summary',
              description: 'Get user activity summary for personalization',
              params: { userId: 'string - Supabase user UUID' },
              response: {
                summary: {
                  videos_watched: 'number',
                  videos_completed: 'number',
                  webinars_attended: 'number',
                  chat_sessions: 'number',
                  total_activities: 'number',
                  last_activity: 'ISO timestamp or null',
                  welcomeMessage: 'string (optional) - personalized greeting',
                },
              },
            },
          ],
          cors: {
            requiredOrigins: [
              'https://hugoherbots-com.replit.app',
              'https://hugoherbots.com',
            ],
          },
          database: {
            supabaseProjectId: 'pckctmojjrrgzuufsqoo',
            sharedTables: ['user_activity', 'platform_sync', 'video_embeddings'],
          },
          activityQuery: `
            SELECT 
              COUNT(*) FILTER (WHERE activity_type = 'video_view') as videos_watched,
              COUNT(*) FILTER (WHERE activity_type = 'video_complete') as videos_completed,
              COUNT(*) FILTER (WHERE activity_type = 'webinar_attend') as webinars_attended,
              COUNT(*) as total_activities,
              MAX(created_at) as last_activity
            FROM user_activity
            WHERE user_id = $1
              AND created_at > NOW() - INTERVAL '30 days';
          `,
        };
        
        const { data, error } = await supabaseAdmin
          .from('platform_sync')
          .insert({
            source_platform: 'com',
            target_platform: 'ai',
            message_type: 'api_spec',
            title: 'API Specification for .com ↔ .ai Integration',
            content: apiSpec,
          })
          .select()
          .single();
        
        if (error) throw error;
        
        console.log('[PlatformSync] API spec synced to .ai platform');
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
          success: true, 
          message: 'API spec synced to .ai platform',
          syncId: data.id 
        }));
      } catch (err) {
        console.error('[PlatformSync] Sync API spec error:', err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    })();
    return;
  }
  
  // SSO Handoff - Generate a handoff token for cross-platform auth
  if (pathname === '/api/sso/generate-handoff' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const { userId, targetPlatform, targetPath } = JSON.parse(body);
        
        if (!userId) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'userId is required' }));
          return;
        }
        
        const { data: token, error } = await supabaseAdmin.rpc('generate_sso_handoff_token', {
          p_user_id: userId,
          p_source_platform: 'com',
          p_target_platform: targetPlatform || 'ai',
          p_target_path: targetPath || '/',
          p_ttl_seconds: 60,
        });
        
        if (error) throw error;
        
        const aiPlatformUrl = process.env.HUGO_AI_URL || 'https://hugoherbots-ai-chat.replit.app';
        const handoffUrl = `${aiPlatformUrl}/auth/handoff?token=${token}${targetPath ? '&redirect=' + encodeURIComponent(targetPath) : ''}`;
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
          success: true, 
          token,
          handoffUrl,
        }));
      } catch (err) {
        console.error('[SSO] Generate handoff error:', err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }
  
  // SSO Handoff - Validate a handoff token (for incoming handoffs from .ai)
  if (pathname === '/api/sso/validate-handoff' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const { token } = JSON.parse(body);
        
        if (!token) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'token is required' }));
          return;
        }
        
        const { data, error } = await supabaseAdmin.rpc('validate_sso_handoff_token', {
          p_token: token,
        });
        
        if (error) throw error;
        
        if (!data || data.length === 0 || !data[0].valid) {
          res.writeHead(401, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ valid: false, error: 'Invalid or expired token' }));
          return;
        }
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
          valid: true,
          userId: data[0].user_id,
          targetPath: data[0].target_path,
        }));
      } catch (err) {
        console.error('[SSO] Validate handoff error:', err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }
  
  if (pathname === '/api/stripe/webhook' && req.method === 'POST') {
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', async () => {
      try {
        const rawBody = Buffer.concat(chunks);
        const signature = req.headers['stripe-signature'];
        if (!signature) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Missing stripe-signature' }));
          return;
        }
        const sig = Array.isArray(signature) ? signature[0] : signature;
        await WebhookHandlers.processWebhook(rawBody, sig);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ received: true }));
      } catch (err) {
        console.error('[Stripe] Webhook error:', err.message);
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Webhook processing error' }));
      }
    });
    return;
  }

  if (pathname === '/api/stripe/products' && req.method === 'GET') {
    (async () => {
      try {
        const result = await stripeQuery(`
          SELECT 
            p.id as product_id,
            p.name as product_name,
            p.description as product_description,
            p.active as product_active,
            p.metadata as product_metadata,
            pr.id as price_id,
            pr.unit_amount,
            pr.currency,
            pr.recurring,
            pr.active as price_active,
            pr.metadata as price_metadata
          FROM stripe.products p
          LEFT JOIN stripe.prices pr ON pr.product = p.id AND pr.active = true
          WHERE p.active = true
          ORDER BY p.id, pr.unit_amount
        `);

        const productsMap = new Map();
        for (const row of result.rows) {
          if (!productsMap.has(row.product_id)) {
            productsMap.set(row.product_id, {
              id: row.product_id,
              name: row.product_name,
              description: row.product_description,
              active: row.product_active,
              metadata: row.product_metadata,
              prices: []
            });
          }
          if (row.price_id) {
            productsMap.get(row.product_id).prices.push({
              id: row.price_id,
              unit_amount: row.unit_amount,
              currency: row.currency,
              recurring: row.recurring,
              active: row.price_active,
              metadata: row.price_metadata,
            });
          }
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ data: Array.from(productsMap.values()) }));
      } catch (err) {
        console.error('[Stripe] Products error:', err.message);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    })();
    return;
  }

  if (pathname === '/api/stripe/checkout' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const { priceId, successUrl, cancelUrl, customerEmail } = JSON.parse(body);
        if (!priceId) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'priceId is verplicht' }));
          return;
        }

        const stripe = await getUncachableStripeClient();
        const sessionParams = {
          payment_method_types: ['card'],
          line_items: [{ price: priceId, quantity: 1 }],
          mode: 'subscription',
          success_url: successUrl || `https://${(process.env.REPLIT_DOMAINS || '').split(',')[0]}/pricing?success=true`,
          cancel_url: cancelUrl || `https://${(process.env.REPLIT_DOMAINS || '').split(',')[0]}/pricing?canceled=true`,
        };

        if (customerEmail) {
          sessionParams.customer_email = customerEmail;
        }

        const session = await stripe.checkout.sessions.create(sessionParams);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ url: session.url }));
      } catch (err) {
        console.error('[Stripe] Checkout error:', err.message);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  if (pathname === '/api/stripe/portal' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const { customerId, returnUrl } = JSON.parse(body);
        if (!customerId) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'customerId is verplicht' }));
          return;
        }
        const stripe = await getUncachableStripeClient();
        const session = await stripe.billingPortal.sessions.create({
          customer: customerId,
          return_url: returnUrl || `https://${(process.env.REPLIT_DOMAINS || '').split(',')[0]}/pricing`,
        });
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ url: session.url }));
      } catch (err) {
        console.error('[Stripe] Portal error:', err.message);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  if (pathname === '/api/stripe/subscription' && req.method === 'GET') {
    (async () => {
      try {
        const queryParams = new URL(req.url, `http://localhost`).searchParams;
        const email = queryParams.get('email');
        if (!email) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'email parameter is verplicht' }));
          return;
        }

        const result = await stripeQuery(`
          SELECT 
            s.id as subscription_id,
            s.status,
            s.current_period_end,
            s.current_period_start,
            s.cancel_at_period_end,
            s.cancel_at,
            s.items,
            c.id as customer_id,
            c.email as customer_email,
            c.name as customer_name,
            p.id as product_id,
            p.name as product_name,
            pr.unit_amount,
            pr.currency,
            pr.recurring
          FROM stripe.subscriptions s
          JOIN stripe.customers c ON s.customer = c.id
          LEFT JOIN stripe.subscription_items si ON si.id = (s.items->'data'->0->>'id')
          LEFT JOIN stripe.prices pr ON pr.id = (s.items->'data'->0->'price'->>'id')
          LEFT JOIN stripe.products p ON p.id = (s.items->'data'->0->'price'->>'product')
          WHERE LOWER(c.email) = LOWER($1)
            AND s.status IN ('active', 'trialing', 'past_due')
          ORDER BY s.current_period_end DESC
          LIMIT 1
        `, [email]);

        if (result.rows.length === 0) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ subscription: null }));
          return;
        }

        const row = result.rows[0];
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          subscription: {
            id: row.subscription_id,
            status: row.status,
            currentPeriodEnd: row.current_period_end,
            currentPeriodStart: row.current_period_start,
            cancelAtPeriodEnd: row.cancel_at_period_end,
            cancelAt: row.cancel_at,
            customerId: row.customer_id,
            customerEmail: row.customer_email,
            customerName: row.customer_name,
            product: {
              id: row.product_id,
              name: row.product_name,
            },
            price: {
              unitAmount: row.unit_amount,
              currency: row.currency,
              recurring: row.recurring,
            },
          }
        }));
      } catch (err) {
        console.error('[Stripe] Subscription lookup error:', err.message);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    })();
    return;
  }

  if (pathname === '/api/stripe/publishable-key' && req.method === 'GET') {
    (async () => {
      try {
        const key = await getStripePublishableKey();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ publishableKey: key }));
      } catch (err) {
        console.error('[Stripe] Publishable key error:', err.message);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    })();
    return;
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found' }));
});

async function regenerateVideoMapping() {
  if (!supabaseAdmin) return;
  try {
    // Fetch all jobs (same minimal SQL as AutoHeal), all filtering done in JS
    const { data: rawJobs, error: jobsError } = await supabaseAdmin
      .from('video_ingest_jobs')
      .select('id, video_title, drive_file_name, drive_folder_id, fase, techniek_id, ai_suggested_techniek_id, ai_confidence, duration_seconds, mux_playback_id, ai_attractive_title, is_hidden, status, rag_document_id, ai_summary');

    if (jobsError) throw jobsError;

    // Also get video_technieken join table (may be empty — that's OK)
    const { data: techMappings } = await supabaseAdmin
      .from('video_technieken')
      .select('video_id, techniek_id, is_primary');

    const techByVideoId = {};
    for (const m of (techMappings || [])) {
      if (!techByVideoId[m.video_id] || m.is_primary) {
        techByVideoId[m.video_id] = m.techniek_id;
      }
    }

    // Load techniek names from SSOT
    let techniekNamen = {};
    try {
      const techData = JSON.parse(fs.readFileSync(path.join(__dirname, '../config/ssot/technieken_index.json'), 'utf-8'));
      for (const t of (techData.technieken || [])) techniekNamen[t.nummer] = t.naam || '';
    } catch (_) {}

    // Exclude archief folder and hidden; include all other videos
    const jobs = (rawJobs || []).filter(v =>
      v.drive_folder_id !== ARCHIEF_FOLDER_ID &&
      !v.is_hidden &&
      v.status !== 'deleted'
    );

    const videoEntries = {};
    let userReadyCount = 0;
    for (const v of jobs) {
      const fileName = v.drive_file_name || v.video_title || `video_${v.id}`;
      const title = v.ai_attractive_title || v.video_title || fileName;
      // Techniek: prefer explicit id, then join table, then AI suggestion
      const techniek = v.techniek_id || techByVideoId[v.id] || v.ai_suggested_techniek_id || null;
      const hasMux = !!v.mux_playback_id;
      const userReady = hasMux && !!techniek;
      if (userReady) userReadyCount++;

      videoEntries[fileName] = {
        id: v.id,
        title,
        file_name: fileName,
        fase: v.fase || (techniek ? parseInt(techniek.split('.')[0]) || 0 : 0),
        techniek,
        techniek_naam: techniekNamen[techniek] || '',
        techniek_source: v.techniek_id ? 'manual' : (techByVideoId[v.id] ? 'join' : 'ai'),
        ai_confidence: v.ai_confidence || null,
        duration_seconds: v.duration_seconds || null,
        status: v.status || null,
        has_transcript: !!(v.rag_document_id || v.ai_summary),
        has_mux: hasMux,
        mux_playback_id: v.mux_playback_id || null,
        is_hidden: !!v.is_hidden,
        user_ready: userReady,
      };
    }

    console.log(`[VideoMapping] Total jobs: ${(rawJobs || []).length}, mapped: ${jobs.length}, user_ready: ${userReadyCount}`);

    const mapping = {
      _meta: { updated: new Date().toISOString().split('T')[0], total_videos: Object.keys(videoEntries).length },
      videos: videoEntries,
    };

    const configPath = path.join(__dirname, '../config/video_mapping.json');
    fs.writeFileSync(configPath, JSON.stringify(mapping, null, 2), 'utf-8');
    console.log(`[VideoMapping] Regenerated: ${Object.keys(videoEntries).length} user-ready videos`);
  } catch (err) {
    console.error('[VideoMapping] Regenerate failed:', err.message);
  }
}

async function autoBatchPendingJobs() {
  const CLOUD_RUN_URL = process.env.CLOUD_RUN_WORKER_URL;
  const WORKER_SECRET = process.env.CLOUD_RUN_WORKER_SECRET;
  if (!CLOUD_RUN_URL || !WORKER_SECRET || !supabaseAdmin) return;

  try {
    const { data: batchRows } = await supabaseAdmin
      .from('video_batch_state')
      .select('batch_active')
      .limit(1);
    const batchActive = batchRows && batchRows[0] && batchRows[0].batch_active;
    if (batchActive) {
      console.log('[AutoBatch] Batch already active, skipping auto-trigger');
      return;
    }

    const { count } = await supabaseAdmin
      .from('video_ingest_jobs')
      .select('id', { count: 'exact', head: true })
      .in('status', ['pending', 'failed'])
      .neq('drive_folder_id', ARCHIEF_FOLDER_ID);

    if (!count || count === 0) return;

    console.log(`[AutoBatch] Found ${count} pending/failed jobs — auto-starting batch queue`);
    await startBatchQueue();
  } catch (err) {
    console.warn('[AutoBatch] Auto-batch check failed:', err.message);
  }
}

async function autoFixHiddenVideos() {
  if (!supabaseAdmin) return 0;
  try {
    const { data: wronglyHidden, error } = await supabaseAdmin
      .from('video_ingest_jobs')
      .select('id, drive_file_name, drive_folder_id, status')
      .eq('is_hidden', true)
      .neq('drive_folder_id', ARCHIEF_FOLDER_ID)
      .neq('status', 'deleted');

    if (error) throw error;
    if (!wronglyHidden || wronglyHidden.length === 0) {
      console.log('[AutoFix] No incorrectly hidden videos found');
      return 0;
    }

    console.log(`[AutoFix] Found ${wronglyHidden.length} videos marked is_hidden=true but NOT in archief folder — fixing...`);

    const batchSize = 50;
    for (let i = 0; i < wronglyHidden.length; i += batchSize) {
      const batch = wronglyHidden.slice(i, i + batchSize);
      const ids = batch.map(v => v.id);
      const { error: updateError } = await supabaseAdmin
        .from('video_ingest_jobs')
        .update({ is_hidden: false, updated_at: new Date().toISOString() })
        .in('id', ids);
      if (updateError) console.warn(`[AutoFix] Batch update error:`, updateError.message);
    }

    console.log(`[AutoFix] Successfully unhid ${wronglyHidden.length} videos`);
    return wronglyHidden.length;
  } catch (err) {
    console.warn('[AutoFix] Failed:', err.message);
    return 0;
  }
}

async function autoHealMissingAiFields() {
  if (!supabaseAdmin) {
    console.log('[AutoHeal] Supabase niet geconfigureerd, overgeslagen');
    return;
  }
  if (!process.env.OPENAI_API_KEY) {
    console.log('[AutoHeal] OpenAI API key niet geconfigureerd, overgeslagen');
    return;
  }

  try {
    console.log('[AutoHeal] Checking for ready videos missing AI summary or title...');

    let videos;
    const { data: fullData, error: fullError } = await supabaseAdmin
      .from('video_ingest_jobs')
      .select('id, video_title, drive_file_name, transcript, ai_summary, ai_attractive_title, ai_suggested_techniek_id, status, mux_playback_id')
      .in('status', ['completed', 'processed']);

    if (fullError) {
      console.log(`[AutoHeal] Full query failed (${fullError.code}), trying without ai_attractive_title...`);
      const { data: fallbackData, error: fallbackError } = await supabaseAdmin
        .from('video_ingest_jobs')
        .select('id, video_title, drive_file_name, transcript, ai_summary, ai_suggested_techniek_id, status, mux_playback_id')
        .in('status', ['completed', 'processed']);

      if (fallbackError) {
        console.error('[AutoHeal] Fallback query also failed:', fallbackError.message);
        return;
      }
      videos = (fallbackData || []).filter(v => v.mux_playback_id);
    } else {
      videos = (fullData || []).filter(v => v.mux_playback_id);
    }

    console.log(`[AutoHeal] Gevonden: ${videos.length} completed videos met Mux playback`);

    if (videos.length === 0) {
      console.log('[AutoHeal] Geen completed videos met Mux playback gevonden');
      return;
    }

    const needsSummary = videos.filter(v => v.transcript && !v.ai_summary);
    const needsTitle = videos.filter(v => (v.transcript || v.ai_summary) && !v.ai_attractive_title);

    console.log(`[AutoHeal] Ready videos: ${videos.length}, missing summary: ${needsSummary.length}, missing title: ${needsTitle.length}`);

    if (needsSummary.length === 0 && needsTitle.length === 0) {
      console.log('[AutoHeal] Alle ready videos hebben AI summary + title. Niets te doen.');
      await regenerateVideoMapping();
      return;
    }

    let summariesGenerated = 0;
    let titlesGenerated = 0;

    for (const video of needsSummary) {
      const title = video.video_title || video.drive_file_name || 'Onbekende video';
      try {
        const summary = await generateAiSummary(video.id, title, video.transcript);
        if (summary) {
          summariesGenerated++;
          console.log(`[AutoHeal] Summary generated for "${title}" (${video.id.slice(0, 8)})`);

          if (!video.ai_attractive_title) {
            const techId = video.ai_suggested_techniek_id || '';
            const aiTitle = await generateAiTitle(video.id, title, video.transcript, techId, summary);
            if (aiTitle) {
              titlesGenerated++;
              console.log(`[AutoHeal] Title generated: "${aiTitle}" for ${video.id.slice(0, 8)}`);
            }
          }
        }
      } catch (e) {
        console.error(`[AutoHeal] Failed for ${video.id.slice(0, 8)}:`, e.message);
      }
      await new Promise(r => setTimeout(r, 500));
    }

    const titleOnly = needsTitle.filter(v => v.ai_summary && !v.ai_attractive_title);
    for (const video of titleOnly) {
      if (needsSummary.find(ns => ns.id === video.id)) continue;
      const title = video.video_title || video.drive_file_name || 'Onbekende video';
      try {
        const techId = video.ai_suggested_techniek_id || '';
        const aiTitle = await generateAiTitle(video.id, title, video.transcript, techId, video.ai_summary);
        if (aiTitle) {
          titlesGenerated++;
          console.log(`[AutoHeal] Title generated: "${aiTitle}" for ${video.id.slice(0, 8)}`);
        }
      } catch (e) {
        console.error(`[AutoHeal] Title failed for ${video.id.slice(0, 8)}:`, e.message);
      }
      await new Promise(r => setTimeout(r, 500));
    }

    console.log(`[AutoHeal] Klaar! ${summariesGenerated} summaries + ${titlesGenerated} titles gegenereerd.`);
    await regenerateVideoMapping();
  } catch (err) {
    console.error('[AutoHeal] Unexpected error:', err.message);
  }
}

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[VideoProcessor] API server running on port ${PORT}`);
  console.log(`[VideoProcessor] Endpoints:`);
  console.log(`  GET  /api/video-processor/health`);
  console.log(`  POST /api/video-processor/start`);
  console.log(`  GET  /api/video-processor/status`);
  console.log(`  POST /api/daily/recording/start`);
  console.log(`  POST /api/daily/recording/stop`);
  console.log(`  GET  /api/daily/recordings`);
  console.log(`  POST /api/rag/search`);
  console.log(`  GET  /api/rag/videos-by-techniek?techniek=X.X`);
  console.log(`  POST /api/config-review/approve`);
  console.log(`  GET  /api/videos/:id/transcript`);
  console.log(`  POST /api/videos/:id/summary`);
  console.log(`  POST /api/videos/batch-summaries`);
  console.log(`  POST /api/platform-sync/send`);
  console.log(`  GET  /api/platform-sync/messages`);
  console.log(`  POST /api/platform-sync/sync-api-spec`);
  console.log(`  POST /api/sso/generate-handoff`);
  console.log(`  POST /api/sso/validate-handoff`);
  console.log(`  POST /api/stripe/webhook`);
  console.log(`  GET  /api/stripe/products`);
  console.log(`  POST /api/stripe/checkout`);
  console.log(`  POST /api/stripe/portal`);
  console.log(`  GET  /api/stripe/publishable-key`);

  initStripe().catch(err => console.error('[Stripe] Init failed:', err.message));

  setTimeout(async () => {
    console.log('[AutoFix] Running initial hidden-video fix (15s after startup)...');
    const fixed = await autoFixHiddenVideos();
    if (fixed > 0) await regenerateVideoMapping();
  }, 15000);

  setTimeout(() => {
    console.log('[AutoHeal] Running initial auto-heal check (30s after startup)...');
    autoHealMissingAiFields();
  }, 30000);

  setInterval(async () => {
    console.log('[AutoHeal] Running periodic auto-heal check...');
    autoHealMissingAiFields();
    const fixed = await autoFixHiddenVideos();
    if (fixed > 0) await regenerateVideoMapping();
  }, 30 * 60 * 1000);

  // Auto-batch: check every 15 minutes for pending jobs and auto-start Cloud Run
  setTimeout(() => autoBatchPendingJobs(), 2 * 60 * 1000);
  setInterval(() => {
    console.log('[AutoBatch] Checking for pending jobs...');
    autoBatchPendingJobs();
  }, 15 * 60 * 1000);

  // Periodic webinar recording polling (every 2 minutes)
  const pollWebinarRecordings = async () => {
    if (!supabaseAdmin) return;
    try {
      // 1. Find ended sessions without a processed recording, check Daily.co for available recordings
      const { data: pendingSessions } = await supabaseAdmin
        .from('live_sessions')
        .select('id, daily_room_name, title')
        .eq('status', 'ended')
        .is('video_url', null)
        .not('daily_room_name', 'is', null);

      const dailyApiKey = process.env.DAILY_API_KEY;
      if (dailyApiKey && pendingSessions?.length > 0) {
        for (const session of pendingSessions) {
          try {
            const recordingsResp = await fetch(
              `https://api.daily.co/v1/recordings?room_name=${session.daily_room_name}`,
              { headers: { 'Authorization': `Bearer ${dailyApiKey}` } }
            );
            if (!recordingsResp.ok) continue;
            const recordingsData = await recordingsResp.json();
            const latest = (recordingsData.data || []).sort((a, b) =>
              new Date(b.start_ts).getTime() - new Date(a.start_ts).getTime()
            )[0];

            if (latest && (latest.status === 'finished' || latest.status === 'saved')) {
              const accessResp = await fetch(
                `https://api.daily.co/v1/recordings/${latest.id}/access-link`,
                { headers: { 'Authorization': `Bearer ${dailyApiKey}` } }
              );
              if (!accessResp.ok) continue;
              const { download_link } = await accessResp.json();

              await supabaseAdmin.from('live_sessions').update({ video_url: download_link }).eq('id', session.id);
              const { error: qErr } = await supabaseAdmin.from('video_ingest_jobs').insert({
                source_type: 'webinar_recording',
                source_url: download_link,
                title: session.title || `Webinar Recording ${session.id}`,
                status: 'queued',
                skip_greenscreen: true,
                skip_mux_upload: false,
                metadata: { session_id: session.id, session_title: session.title, recorded_at: new Date().toISOString() }
              });
              if (!qErr) console.log(`[WebinarPoll] Queued recording for session ${session.id}`);
            }
          } catch (e) { /* ignore per-session errors */ }
        }
      }

      // 2. Process any queued webinar jobs
      const { data: queuedJobs } = await supabaseAdmin
        .from('video_ingest_jobs')
        .select('id')
        .eq('source_type', 'webinar_recording')
        .eq('status', 'queued')
        .limit(1);

      if (queuedJobs?.length > 0) {
        console.log(`[WebinarPoll] Found ${queuedJobs.length} queued jobs, triggering processor...`);
        fetch(`http://localhost:3001/api/webinar-recordings/process`, { method: 'POST' }).catch(() => {});
      }
    } catch (e) {
      console.error('[WebinarPoll] Error:', e.message);
    }
  };

  setInterval(pollWebinarRecordings, 2 * 60 * 1000);
  // Run once after 60s on startup
  setTimeout(pollWebinarRecordings, 60 * 1000);
});
