#!/usr/bin/env node
/**
 * Bulk Rename Webinars
 *
 * Genereert commerciële Nederlandstalige titels voor alle 42 live_sessions
 * in Supabase. Gebruikt EPIC-technieken uit technieken_index.json als
 * inspiratiebron per fase, en de huidige sessietitel om het onderwerp te
 * bepalen.
 *
 * Gebruik:
 *   node scripts/bulk_rename_webinars.js [--dry-run] [--force]
 *
 * Flags:
 *   --dry-run   Alleen preview tonen, niets opslaan
 *   --force     Hergenereert ook sessies die al een gegenereerde titel hebben
 */

const { createClient } = require('@supabase/supabase-js');
const OpenAI = require('openai');
const readline = require('readline');
const path = require('path');
const fs = require('fs');

// ─── Config ───────────────────────────────────────────────────────────────────

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
// Kies de beste beschikbare OpenAI key + bijbehorende base URL
// Echte sk-proj sleutels werken met de standaard OpenAI API (geen custom base URL)
// _DUMMY_API_KEY_ sleutels werken via de Replit model farm proxy op localhost:1106
const _integKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
const _realKey = process.env.OPENAI_API_KEY;
const _useReal = _realKey && _realKey.startsWith('sk-');
const OPENAI_KEY = _useReal ? _realKey : (_integKey || _realKey);
const OPENAI_BASE = _useReal ? undefined : process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;
const DRY_RUN = process.argv.includes('--dry-run');
const FORCE = process.argv.includes('--force');

const TECHNIEKEN_PATH = path.join(__dirname, '../config/ssot/technieken_index.json');

// Voorbeeldtitels als stijlgids (uit de video-bibliotheek)
const STYLE_EXAMPLES = [
  'De EPIC Sales Engine in de praktijk',
  'Van informatieverkoper naar waarde-architect',
  'Wie is jouw klant echt?',
  'De pre-contactfase: cruciaal voor sales succes',
  'Herkennen van sociale gedragsstijlen in verkoopgesprekken',
  'Hoe je de motivatie van de prospect achterhaalt',
  'Bezwaren analyseren en isoleren',
  'Proefafsluiting en vragen effectief sturen',
];

// EPIC fase-namen voor context
const FASE_NAMEN = {
  null: 'Cross-sectioneel / Algemeen',
  0: 'Pre-contactfase',
  1: 'Koopklimaat (Opening)',
  2: 'Ontdekkingsfase (Explore-Probe-Impact-Commit)',
  3: 'Aanbevelingsfase',
  4: 'Beslissingsfase (Closing)',
};

// ─── Clients ──────────────────────────────────────────────────────────────────

function initClients() {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('❌  SUPABASE_URL of SUPABASE_SERVICE_ROLE_KEY ontbreekt');
    process.exit(1);
  }
  if (!OPENAI_KEY) {
    console.error('❌  OPENAI_API_KEY ontbreekt');
    process.exit(1);
  }
  const sb = createClient(SUPABASE_URL, SUPABASE_KEY);
  const aiOpts = { apiKey: OPENAI_KEY };
  if (OPENAI_BASE) aiOpts.baseURL = OPENAI_BASE;
  const ai = new OpenAI(aiOpts);
  return { sb, ai };
}

// ─── Data ophalen ─────────────────────────────────────────────────────────────

async function fetchSessions(sb) {
  const { data, error } = await sb
    .from('live_sessions')
    .select('id, title, phase_id, description')
    .order('scheduled_date', { ascending: true });

  if (error) {
    console.error('❌  Sessies ophalen mislukt:', error.message);
    process.exit(1);
  }
  console.log(`✓  ${data.length} webinar-sessies geladen`);
  return data;
}

function loadTechnieken() {
  const raw = JSON.parse(fs.readFileSync(TECHNIEKEN_PATH, 'utf8'));
  const techs = raw.technieken || raw;

  // Groepeer per fase: { "0": [...], "1": [...], ... }
  const byFase = {};
  for (const [, t] of Object.entries(techs)) {
    const fase = String(t.fase ?? 'null');
    if (!byFase[fase]) byFase[fase] = [];
    byFase[fase].push({
      nummer: t.nummer,
      naam: t.naam,
      doel: (t.doel || '').substring(0, 120),
      hoe: Array.isArray(t.hoe) ? t.hoe.slice(0, 2).join(' | ') : (t.hoe || '').substring(0, 100),
    });
  }

  const total = Object.values(byFase).reduce((s, a) => s + a.length, 0);
  console.log(`✓  ${total} technieken geladen uit technieken_index.json`);
  return byFase;
}

// ─── Prompt bouwen ────────────────────────────────────────────────────────────

function buildPrompt(sessions, techByFase) {
  // Compacte sessielijst voor GPT
  const sessionList = sessions.map((s) => ({
    id: s.id,
    huidige_titel: s.title,
    fase: s.phase_id,
    fase_naam: FASE_NAMEN[s.phase_id] ?? FASE_NAMEN[null],
  }));

  // Gecomprimeerde technieken per fase (alleen wat GPT nodig heeft)
  const techContext = {};
  for (const [fase, techs] of Object.entries(techByFase)) {
    techContext[fase] = techs.map((t) => `${t.naam} — ${t.doel}`);
  }

  return `Je bent een expert in B2B-verkooptraining en schrijft commerciële, pakkende titels voor live webinars van Hugo Herbots.

STIJLGIDS — zo klinken goede HugoHerbots titels:
${STYLE_EXAMPLES.map((t) => `  • ${t}`).join('\n')}

Kenmerken van deze stijl:
- Maximaal 65 tekens
- Nederlands, direct en krachtig
- Geen "Live Coaching:" prefix
- Resultaatgericht: wat leert de verkoper / welk voordeel krijgt hij?
- Spreek de verkoper aan: "Hoe je...", "Van X naar Y", "De kunst van...", "Waarom..."
- Concreet, geen generieke buzzwords zoals "excelleren" of "optimaliseren"
- Mag een cluster van meerdere gerelateerde technieken samenvatten

EPIC-TECHNIEKEN PER FASE (inspiratiebron):
${JSON.stringify(techContext, null, 2)}

WEBINAR-SESSIES (42 stuks — genereer voor elk een nieuwe titel):
${JSON.stringify(sessionList, null, 2)}

OPDRACHT:
Genereer voor elke sessie een commerciële Nederlandse webinar-titel.
Gebruik de huidige sessietitel als indicatie van het onderwerp én de bijbehorende fase-technieken als inspiratie.
Sessies met fase=null zijn ofwel algemene intro-sessies (id's bovenaan) of cross-sectionele thema's (id's onderaan) — behandel ze apart.

Antwoord ALLEEN als JSON array zonder markdown code-blokken:
[
  { "id": "...", "new_title": "..." },
  ...
]

Geef precies ${sessions.length} resultaten terug, één per sessie.`;
}

// ─── OpenAI aanroepen ─────────────────────────────────────────────────────────

async function generateTitles(ai, sessions, techByFase) {
  console.log('\n🤖  OpenAI GPT-4o aanroepen...');

  const prompt = buildPrompt(sessions, techByFase);

  const response = await ai.chat.completions.create({
    model: 'gpt-4o',
    messages: [{ role: 'user', content: prompt }],
    max_tokens: 3000,
    temperature: 0.7,
  });

  let content = response.choices[0].message.content.trim();

  // Strip eventuele ```json ... ``` wrapper
  if (content.startsWith('```')) {
    const lines = content.split('\n');
    const end = lines[lines.length - 1].trim() === '```' ? lines.length - 1 : lines.length;
    content = lines.slice(1, end).join('\n');
  }

  let results;
  try {
    results = JSON.parse(content);
  } catch (e) {
    console.error('❌  JSON parse fout:', e.message);
    console.error('Raw response:', content.substring(0, 600));
    process.exit(1);
  }

  console.log(`✓  ${results.length} titels gegenereerd`);
  return results;
}

// ─── Preview tabel ────────────────────────────────────────────────────────────

function showPreview(sessions, results) {
  const byId = Object.fromEntries(sessions.map((s) => [s.id, s]));

  console.log('\n' + '═'.repeat(110));
  console.log('PREVIEW — Webinar titels: Oud → Nieuw');
  console.log('═'.repeat(110));
  console.log(
    ' #   ' +
    'FASE '.padEnd(7) +
    'HUIDIG'.padEnd(52) +
    'NIEUW'
  );
  console.log('─'.repeat(110));

  results.forEach((r, i) => {
    const session = byId[r.id] || {};
    const fase = session.phase_id != null ? String(session.phase_id) : '—';
    const oud = (session.title || '?').replace('Live Coaching: ', '').substring(0, 50);
    const nieuw = (r.new_title || '?').substring(0, 65);
    const num = String(i + 1).padStart(3);
    const tooLong = (r.new_title || '').length > 65 ? ' ⚠️ ' : '';
    console.log(` ${num}  ${fase.padEnd(6)} ${oud.padEnd(51)} ${nieuw}${tooLong}`);
  });

  console.log('═'.repeat(110));
  const tooLong = results.filter((r) => (r.new_title || '').length > 65).length;
  if (tooLong > 0) {
    console.log(`\n⚠️   ${tooLong} titel(s) zijn langer dan 65 tekens (gemarkeerd met ⚠️)`);
  }
  console.log(`\n${results.length} sessies worden bijgewerkt in Supabase.`);
}

// ─── Supabase updaten ─────────────────────────────────────────────────────────

async function updateSupabase(sb, sessions, results) {
  const byId = Object.fromEntries(sessions.map((s) => [s.id, s]));
  let updated = 0;
  let failed = 0;

  for (const r of results) {
    if (!r.id || !r.new_title) {
      console.error(`  ⚠️  Ongeldig resultaat overgeslagen:`, r);
      failed++;
      continue;
    }

    const { error } = await sb
      .from('live_sessions')
      .update({ title: r.new_title.trim() })
      .eq('id', r.id);

    if (error) {
      console.error(`  ❌  Fout bij sessie ${r.id}: ${error.message}`);
      failed++;
    } else {
      const oud = (byId[r.id]?.title || '').replace('Live Coaching: ', '');
      console.log(`  ✓  "${r.new_title.trim()}"`);
      updated++;
    }
  }

  console.log(`\n${'═'.repeat(60)}`);
  console.log(`✅  Klaar: ${updated} bijgewerkt, ${failed} mislukt`);
  return updated;
}

// ─── Confirm prompt ───────────────────────────────────────────────────────────

function confirm(message) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(message, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('🎬  HugoHerbots — Webinar Bulk Rename');
  console.log('═'.repeat(40));
  if (DRY_RUN) console.log('⏸   DRY-RUN modus actief — geen updates\n');

  const { sb, ai } = initClients();

  const sessions = await fetchSessions(sb);
  const techByFase = loadTechnieken();

  const results = await generateTitles(ai, sessions, techByFase);

  showPreview(sessions, results);

  if (DRY_RUN) {
    console.log('\n⏸   Dry-run — niets opgeslagen. Verwijder --dry-run om te updaten.\n');
    return;
  }

  await confirm('\nDruk Enter om alle titels op te slaan in Supabase, of Ctrl+C om te annuleren: ');

  console.log('\n📝  Supabase updaten...\n');
  await updateSupabase(sb, sessions, results);

  console.log('\n🔄  De webinar-pagina toont nu de nieuwe titels na refresh.\n');
}

main().catch((err) => {
  console.error('\n❌  Onverwachte fout:', err.message || err);
  process.exit(1);
});
