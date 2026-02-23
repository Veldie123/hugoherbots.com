#!/usr/bin/env node
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const technieken = JSON.parse(fs.readFileSync(path.join(__dirname, '../src/data/technieken_index.json'), 'utf8')).technieken;

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

  const response = await fetch(
    `https://${hostname}/api/v2/connection?include_secrets=true&connector_names=google-drive`,
    { headers: { 'Accept': 'application/json', 'X_REPLIT_TOKEN': xReplitToken } }
  );

  const data = await response.json();
  const connection = (data.items || [])[0] || {};
  const settings = connection.settings || {};
  const accessToken = settings.access_token || 
    (settings.oauth && settings.oauth.credentials && settings.oauth.credentials.access_token);

  if (!accessToken) throw new Error('Google Drive niet verbonden');
  return accessToken;
}

async function getFolderName(folderId, accessToken) {
  const url = `https://www.googleapis.com/drive/v3/files/${folderId}?fields=name,parents`;
  const resp = await fetch(url, { headers: { 'Authorization': `Bearer ${accessToken}` } });
  if (!resp.ok) {
    console.warn(`  Could not resolve folder ${folderId}: ${resp.status}`);
    return null;
  }
  const data = await resp.json();
  return { name: data.name, parentId: (data.parents || [])[0] || null };
}

async function getFolderPath(folderId, accessToken, cache = {}) {
  if (cache[folderId]) return cache[folderId];
  
  const info = await getFolderName(folderId, accessToken);
  if (!info) {
    cache[folderId] = { name: 'unknown', path: 'unknown' };
    return cache[folderId];
  }
  
  if (!info.parentId) {
    cache[folderId] = { name: info.name, path: info.name };
    return cache[folderId];
  }

  const parent = await getFolderPath(info.parentId, accessToken, cache);
  cache[folderId] = { name: info.name, path: `${parent.path} > ${info.name}` };
  return cache[folderId];
}

const HUGO_FOLDER_NUMBER_MAP = {
  '2.5': null,
  '2.6': null,
  '2.7': null,
  '2.8': null,
  '2.9': null,
  '2.10': null,
  '1.2.1': '1.3',
  '2.1.0': '2.1',
  '4.3.4': null,
  '4.3.3': null,
  '4.3.1': null,
};

function extractTechniqueNumberFromText(text) {
  if (!text) return null;
  
  const patterns = [
    /^(\d+\.\d+\.\d+\.\d+)/,
    /^(\d+\.\d+\.\d+)/,
    /^(\d+\.\d+)/,
    /^(\d+)/,
  ];
  
  for (const pattern of patterns) {
    const m = text.match(pattern);
    if (!m) continue;
    const num = m[1];
    
    if (num in HUGO_FOLDER_NUMBER_MAP) {
      return HUGO_FOLDER_NUMBER_MAP[num];
    }
    
    if (technieken[num]) {
      return num;
    }
  }
  
  return null;
}

function matchFolderToTechnique(folderName, folderPath) {
  if (!folderName) return null;
  
  const normalizedFolder = folderName.trim();
  const normalizedPath = (folderPath || '').trim();
  
  const skipFolders = [
    'image.canon', 'archief', 'archief 2', 'dubbels', 'algemeen',
    'intro', 'mijn drive', 'professioneel', 'groep stéphane',
    'hugo herbots', 'door hugo geordende videos', '00 - intro',
    'klant', 'voorstelling van mezelf', 'verkoper', 'equilux', 'aquafresh',
    'ovezicht onderwerpen', 'universele houdingen metafoor'
  ];
  if (skipFolders.includes(normalizedFolder.toLowerCase())) {
    return null;
  }
  
  const directNum = extractTechniqueNumberFromText(normalizedFolder);
  if (directNum && technieken[directNum]) {
    return {
      techniek_id: directNum,
      naam: technieken[directNum].naam,
      score: 0.95,
      fase: technieken[directNum].fase || directNum.split('.')[0],
      method: 'direct_number'
    };
  }
  
  const faseMatch = normalizedFolder.match(/^Fase\s+(\d+)/i);
  if (faseMatch) {
    const faseNum = faseMatch[1];
    if (technieken[faseNum]) {
      return {
        techniek_id: faseNum,
        naam: technieken[faseNum].naam,
        score: 0.20,
        fase: faseNum,
        method: 'fase_level'
      };
    }
  }
  
  const folderLower = normalizedFolder.toLowerCase();
  const folderNameOnly = folderLower.replace(/^\d+[\.\d]*\s*[-:]?\s*/, '').trim();
  let bestMatch = null;
  let bestScore = 0;
  
  for (const [tid, tech] of Object.entries(technieken)) {
    const techNaam = (tech.naam || '').toLowerCase();
    
    if (techNaam.length > 3 && (folderLower.includes(techNaam) || folderNameOnly.includes(techNaam))) {
      const score = 0.85;
      if (score > bestScore) {
        bestScore = score;
        bestMatch = { techniek_id: tid, naam: tech.naam, score, fase: tech.fase || tid.split('.')[0], method: 'name_match' };
      }
    }
    
    const techNameOnly = techNaam.replace(/^\d+[\.\d]*\s*[-:]?\s*/, '').trim();
    if (techNameOnly.length > 3 && folderNameOnly.length > 3) {
      if (folderNameOnly.includes(techNameOnly) || techNameOnly.includes(folderNameOnly)) {
        const score = 0.80;
        if (score > bestScore) {
          bestScore = score;
          bestMatch = { techniek_id: tid, naam: tech.naam, score, fase: tech.fase || tid.split('.')[0], method: 'name_fuzzy_match' };
        }
      }
    }
    
    if (tech.tags) {
      for (const tag of tech.tags) {
        if (tag.length > 3 && (folderLower.includes(tag.toLowerCase()) || folderNameOnly.includes(tag.toLowerCase()))) {
          const score = 0.4;
          if (score > bestScore) {
            bestScore = score;
            bestMatch = { techniek_id: tid, naam: tech.naam, score, fase: tech.fase || tid.split('.')[0], method: 'tag_match' };
          }
        }
      }
    }
  }
  
  if (bestMatch) return bestMatch;
  
  const pathSegments = normalizedPath.split(' > ').reverse();
  for (const segment of pathSegments.slice(1)) {
    const segNum = extractTechniqueNumberFromText(segment.trim());
    if (segNum && technieken[segNum]) {
      return {
        techniek_id: segNum,
        naam: technieken[segNum].naam,
        score: 0.60,
        fase: technieken[segNum].fase || segNum.split('.')[0],
        method: 'parent_folder_number'
      };
    }
  }
  
  for (const segment of pathSegments.slice(1)) {
    const fm = segment.match(/^Fase\s+(\d+)/i);
    if (fm && technieken[fm[1]]) {
      return {
        techniek_id: fm[1],
        naam: technieken[fm[1]].naam,
        score: 0.15,
        fase: fm[1],
        method: 'parent_fase_level'
      };
    }
  }
  
  return null;
}

function computeWeightedTechnique(folderMatch, aiTechId, aiConfidence) {
  const FOLDER_WEIGHT = 0.50;
  const AI_WEIGHT = 0.50;
  
  if (folderMatch && !aiTechId) {
    return {
      techniek_id: folderMatch.techniek_id,
      confidence: folderMatch.score * FOLDER_WEIGHT,
      source: 'folder_only',
      fase: folderMatch.fase
    };
  }
  
  if (!folderMatch && aiTechId) {
    return {
      techniek_id: aiTechId,
      confidence: (aiConfidence || 0.5) * AI_WEIGHT,
      source: 'ai_only',
      fase: technieken[aiTechId]?.fase || null
    };
  }
  
  if (!folderMatch && !aiTechId) {
    return null;
  }
  
  const folderScore = folderMatch.score * FOLDER_WEIGHT;
  const aiScore = (aiConfidence || 0.5) * AI_WEIGHT;
  
  if (folderMatch.techniek_id === aiTechId) {
    return {
      techniek_id: aiTechId,
      confidence: Math.min(folderScore + aiScore, 0.99),
      source: 'both_agree',
      fase: folderMatch.fase || technieken[aiTechId]?.fase
    };
  }
  
  if (folderMatch.method === 'direct_number' && folderMatch.score >= 0.9) {
    return {
      techniek_id: folderMatch.techniek_id,
      confidence: folderScore,
      source: 'folder_wins_strong',
      fase: folderMatch.fase,
      ai_alternative: aiTechId,
      ai_alt_score: aiScore
    };
  }
  
  if (folderScore >= aiScore) {
    return {
      techniek_id: folderMatch.techniek_id,
      confidence: folderScore,
      source: 'folder_wins',
      fase: folderMatch.fase,
      ai_alternative: aiTechId,
      ai_alt_score: aiScore
    };
  }
  
  return {
    techniek_id: aiTechId,
    confidence: aiScore,
    source: 'ai_wins',
    fase: technieken[aiTechId]?.fase || null,
    folder_alternative: folderMatch.techniek_id,
    folder_alt_score: folderScore
  };
}

async function main() {
  console.log('=== Folder-Based Technique Detection (50/50 Weighting) ===\n');
  
  let accessToken;
  try {
    accessToken = await getGoogleDriveAccessToken();
    console.log('[OK] Google Drive access token obtained\n');
  } catch (err) {
    console.error('Failed to get Drive token:', err.message);
    process.exit(1);
  }
  
  const { data: jobs, error } = await supabase
    .from('video_ingest_jobs')
    .select('id, video_title, drive_file_name, drive_folder_id, ai_suggested_techniek_id, ai_confidence, techniek_id, fase, status')
    .neq('status', 'deleted')
    .order('created_at', { ascending: true });
  
  if (error) {
    console.error('DB error:', error.message);
    process.exit(1);
  }
  
  console.log(`Found ${jobs.length} videos to process\n`);
  
  const uniqueFolders = [...new Set(jobs.map(j => j.drive_folder_id).filter(Boolean))];
  console.log(`Resolving ${uniqueFolders.length} unique folder IDs...\n`);
  
  const folderCache = {};
  for (const fid of uniqueFolders) {
    const info = await getFolderPath(fid, accessToken, folderCache);
    console.log(`  ${fid.substring(0, 15)}... => ${info.name} (${info.path.split(' > ').slice(-3).join(' > ')})`);
    await new Promise(r => setTimeout(r, 100));
  }
  
  console.log('\n--- Folder-to-Technique Matching ---\n');
  
  const folderTechniqueMap = {};
  for (const fid of uniqueFolders) {
    const info = folderCache[fid];
    if (!info) continue;
    const match = matchFolderToTechnique(info.name, info.path);
    folderTechniqueMap[fid] = { folderName: info.name, folderPath: info.path, match };
    if (match) {
      console.log(`  [MATCH] "${info.name}" => ${match.techniek_id} ${match.naam} (score: ${match.score.toFixed(2)}, method: ${match.method})`);
    } else {
      console.log(`  [NONE]  "${info.name}" => no technique match`);
    }
  }
  
  console.log('\n--- Computing Weighted Techniques ---\n');
  
  let updated = 0;
  let skippedManual = 0;
  let unchanged = 0;
  let noMatch = 0;
  const changes = [];
  
  for (const job of jobs) {
    if (job.techniek_id) {
      skippedManual++;
      continue;
    }
    
    const folderInfo = job.drive_folder_id ? folderTechniqueMap[job.drive_folder_id] : null;
    const folderMatch = folderInfo?.match || null;
    
    const weighted = computeWeightedTechnique(
      folderMatch,
      job.ai_suggested_techniek_id,
      job.ai_confidence
    );
    
    if (!weighted) {
      noMatch++;
      continue;
    }
    
    if (weighted.techniek_id === job.ai_suggested_techniek_id && 
        Math.abs((weighted.confidence || 0) - (job.ai_confidence || 0)) < 0.01) {
      unchanged++;
      continue;
    }
    
    changes.push({
      id: job.id,
      title: job.video_title || job.drive_file_name,
      old_tech: job.ai_suggested_techniek_id,
      old_conf: job.ai_confidence,
      new_tech: weighted.techniek_id,
      new_conf: weighted.confidence,
      source: weighted.source,
      fase: weighted.fase,
      folder: folderInfo?.folderName || '-',
      ai_alt: weighted.ai_alternative || null,
      folder_alt: weighted.folder_alternative || null
    });
  }
  
  console.log(`Summary:`);
  console.log(`  Total videos: ${jobs.length}`);
  console.log(`  Manual techniek (skipped): ${skippedManual}`);
  console.log(`  No match possible: ${noMatch}`);
  console.log(`  Unchanged: ${unchanged}`);
  console.log(`  To update: ${changes.length}`);
  
  const sourceCounts = {};
  for (const c of changes) {
    sourceCounts[c.source] = (sourceCounts[c.source] || 0) + 1;
  }
  console.log(`\n  By source:`);
  for (const [src, cnt] of Object.entries(sourceCounts)) {
    console.log(`    ${src}: ${cnt}`);
  }
  
  if (changes.length > 0) {
    console.log(`\n--- Changes Preview (first 40) ---\n`);
    for (const c of changes.slice(0, 40)) {
      const oldT = c.old_tech || '-';
      const newT = c.new_tech;
      const changed = oldT !== newT ? ' ***' : '';
      const alt = c.ai_alt ? ` (ai said: ${c.ai_alt})` : (c.folder_alt ? ` (folder said: ${c.folder_alt})` : '');
      console.log(`  ${(c.title || '?').substring(0, 25).padEnd(25)} | map: ${c.folder.substring(0, 25).padEnd(25)} | ${oldT.padEnd(6)} => ${newT.padEnd(6)} (${c.new_conf.toFixed(2)}) [${c.source}]${alt}${changed}`);
    }
  }
  
  const DRY_RUN = process.argv.includes('--dry-run');
  
  if (DRY_RUN) {
    console.log('\n[DRY RUN] No changes written. Run without --dry-run to apply.');
    return;
  }
  
  console.log(`\n--- Applying ${changes.length} updates ---\n`);
  
  let successCount = 0;
  let errorCount = 0;
  
  for (const c of changes) {
    const updateData = {
      ai_suggested_techniek_id: c.new_tech,
      ai_confidence: parseFloat(c.new_conf.toFixed(4)),
      updated_at: new Date().toISOString()
    };
    
    if (c.fase) {
      updateData.fase = c.fase;
    }
    
    const { error: updateErr } = await supabase
      .from('video_ingest_jobs')
      .update(updateData)
      .eq('id', c.id);
    
    if (updateErr) {
      console.error(`  [ERROR] ${c.title}: ${updateErr.message}`);
      errorCount++;
    } else {
      successCount++;
    }
  }
  
  console.log(`\nDone! Updated: ${successCount}, Errors: ${errorCount}`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
