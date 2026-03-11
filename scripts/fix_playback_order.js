#!/usr/bin/env node
/**
 * Fix Playback Order — One-time script
 *
 * Sets the exact playback_order for all 47 videos based on Hugo's handwritten notes.
 *
 * Usage:
 *   node scripts/fix_playback_order.js [--dry-run]
 */

const { createClient } = require('@supabase/supabase-js');

const DRY_RUN = process.argv.includes('--dry-run');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌  SUPABASE_URL of SUPABASE_SERVICE_ROLE_KEY ontbreekt');
  process.exit(1);
}

const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

// Hugo's exact 47-video order (transcribed from handwritten notes)
const HUGO_ORDER = [
  // Alg. Intro
  { mvi: 'MVI_0526', order: 1,  section: 'Alg. Intro',       label: 'Voorstelling van Mezelf' },
  { mvi: 'MVI_0519', order: 2,  section: 'Alg. Intro',       label: 'Klant' },
  { mvi: 'MVI_0568', order: 3,  section: 'Alg. Intro',       label: 'Soc. gedragsstijlen' },
  { mvi: 'MVI_0565', order: 4,  section: 'Alg. Intro',       label: 'Buyer clock' },
  { mvi: 'MVI_0569', order: 5,  section: 'Alg. Intro',       label: 'Wie bent u als verkoper?' },
  { mvi: 'MVI_0572', order: 6,  section: 'Alg. Intro',       label: 'Wie bent u als verkoper? (deel 2)' },
  // Fase 0 - Pre-contact
  { mvi: 'MVI_0464', order: 7,  section: 'Fase 0',           label: 'Verkoopproces' },
  { mvi: 'MVI_0538', order: 8,  section: 'Fase 0',           label: 'Desktop' },
  // Fase 1 - Opening
  { mvi: 'MVI_1028', order: 9,  section: 'Fase 1',           label: 'Creëren koopklimaat' },
  { mvi: 'MVI_1029', order: 10, section: 'Fase 1',           label: "Gentleman's Agreement" },
  { mvi: 'MVI_1031', order: 11, section: 'Fase 1',           label: 'POP' },
  { mvi: 'MVI_1033', order: 12, section: 'Fase 1',           label: 'POP (vervolg)' },
  // Fase 2 - Ontdekking
  { mvi: 'MVI_0932', order: 13, section: 'Fase 2',           label: 'Wat te doen' },
  { mvi: 'MVI_0936', order: 14, section: 'Fase 2',           label: 'E.P.I.C.' },
  { mvi: 'MVI_0937', order: 15, section: 'Fase 2',           label: 'Vraagstelling' },
  { mvi: 'MVI_0940', order: 16, section: 'Fase 2',           label: 'Feitgerichte vragen' },
  { mvi: 'MVI_0950', order: 17, section: 'Fase 2',           label: 'Meningsgerichte vragen' },
  { mvi: 'MVI_0951', order: 18, section: 'Fase 2',           label: 'Feitg. onder alt. vorm' },
  { mvi: 'MVI_0957', order: 19, section: 'Fase 2',           label: 'Terzijde schuiven' },
  { mvi: 'MVI_0960', order: 20, section: 'Fase 2',           label: 'Pingpong techniek' },
  { mvi: 'MVI_0963', order: 21, section: 'Fase 2',           label: 'Actief luisteren' },
  { mvi: 'MVI_0969', order: 22, section: 'Fase 2',           label: 'Probing' },
  { mvi: 'MVI_0971', order: 23, section: 'Fase 2',           label: 'Impact / Gevolg' },
  { mvi: 'MVI_0972', order: 24, section: 'Fase 2',           label: 'Commitment / Ombuigen' },
  // Overgang
  { mvi: 'MVI_0990', order: 25, section: 'Overgang',         label: 'Lijst te bespreken onderwerpen' },
  // Fase 3 - Aanbeveling
  { mvi: 'MVI_0987', order: 26, section: 'Fase 3',           label: 'Aanbeveling' },
  { mvi: 'MVI_0992', order: 27, section: 'Fase 3',           label: 'Best Practice (deel 1)' },
  { mvi: 'MVI_0993', order: 28, section: 'Fase 3',           label: 'Best Practice (deel 2)' },
  { mvi: 'MVI_0994', order: 29, section: 'Fase 3',           label: 'Best Practice (deel 3)' },
  { mvi: 'MVI_1006', order: 30, section: 'Fase 3',           label: 'Exploratievragen / Waarde' },
  { mvi: 'MVI_1011', order: 31, section: 'Fase 3',           label: 'Meerwaarde verwoorden' },
  { mvi: 'MVI_0997', order: 32, section: 'Fase 3',           label: 'Gespreksklimaat' },
  { mvi: 'MVI_0998', order: 33, section: 'Fase 3',           label: 'Exploratievragen verdieping' },
  { mvi: 'MVI_1000', order: 34, section: 'Fase 3',           label: 'Klantverwachtingen verkennen' },
  { mvi: 'MVI_1012', order: 35, section: 'Fase 3',           label: 'Alternatieven' },
  { mvi: 'MVI_1013', order: 36, section: 'Fase 3',           label: 'Budget & Timing' },
  // Fase 4 - Beslissing
  { mvi: 'MVI_0636', order: 37, section: 'Fase 4',           label: 'Proefafsluiting' },
  { mvi: 'MVI_0645', order: 38, section: 'Fase 4',           label: 'Definitieve afsluiting (1)' },
  { mvi: 'MVI_1015', order: 39, section: 'Fase 4',           label: 'Definitieve afsluiting (2)' },
  // Houdingen
  { mvi: 'MVI_0908', order: 40, section: 'Houdingen',        label: 'Afritten / Moetdoor' },
  { mvi: 'MVI_0915', order: 41, section: 'Houdingen',        label: 'Gestelde reactie' },
  { mvi: 'MVI_0916', order: 42, section: 'Houdingen',        label: 'Twijfel' },
  { mvi: 'MVI_0921', order: 43, section: 'Houdingen',        label: 'Uitstel' },
  { mvi: 'MVI_0927', order: 44, section: 'Houdingen',        label: 'Bezwaren' },
  { mvi: 'MVI_1039', order: 45, section: 'Houdingen',        label: 'Angst' },
  { mvi: 'MVI_1019', order: 46, section: 'Houdingen',        label: 'Leerproces' },
  { mvi: 'MVI_0672', order: 47, section: 'Houdingen',        label: 'Will, Skill & Drill' },
];

async function main() {
  console.log('🎬  HugoHerbots — Fix Playback Order');
  console.log('═'.repeat(50));
  if (DRY_RUN) console.log('⏸   DRY-RUN — geen wijzigingen\n');

  // Load all non-deleted videos from DB
  const { data: dbVideos, error } = await sb
    .from('video_ingest_jobs')
    .select('id, drive_file_name, video_title, playback_order, status')
    .neq('status', 'deleted');

  if (error) {
    console.error('❌  Supabase fout:', error.message);
    process.exit(1);
  }

  // Index by drive_file_name (MVI_XXXX.MP4)
  const byFileName = {};
  for (const v of dbVideos) {
    const key = (v.drive_file_name || '').replace(/\.(MP4|mp4|mov|MOV)$/i, '');
    if (key) byFileName[key] = v;
  }

  console.log(`📦  ${dbVideos.length} video's in DB, ${Object.keys(byFileName).length} met bestandsnaam\n`);

  // Compare and prepare updates
  console.log('═'.repeat(90));
  console.log(' #    MVI          Sectie              Oud → Nieuw  Status');
  console.log('─'.repeat(90));

  const updates = [];
  let matchCount = 0;
  let changeCount = 0;
  let notFoundCount = 0;

  for (const entry of HUGO_ORDER) {
    const dbVideo = byFileName[entry.mvi];
    if (!dbVideo) {
      console.log(` ${String(entry.order).padStart(2)}   ${entry.mvi.padEnd(12)} ${entry.section.padEnd(18)} — → ${String(entry.order).padStart(4)}  ⚠️  NIET GEVONDEN IN DB`);
      notFoundCount++;
      continue;
    }

    const oldOrder = dbVideo.playback_order;
    const changed = oldOrder !== entry.order;

    if (changed) {
      console.log(` ${String(entry.order).padStart(2)}   ${entry.mvi.padEnd(12)} ${entry.section.padEnd(18)} ${String(oldOrder ?? 'NULL').padStart(4)} → ${String(entry.order).padStart(4)}  ← WIJZIGING`);
      changeCount++;
    } else {
      console.log(` ${String(entry.order).padStart(2)}   ${entry.mvi.padEnd(12)} ${entry.section.padEnd(18)} ${String(oldOrder).padStart(4)} → ${String(entry.order).padStart(4)}  ✓`);
      matchCount++;
    }

    updates.push({ id: dbVideo.id, playback_order: entry.order });
  }

  console.log('═'.repeat(90));
  console.log(`\n✓ ${matchCount} correct, ← ${changeCount} wijzigingen, ⚠️  ${notFoundCount} niet gevonden\n`);

  if (DRY_RUN) {
    console.log('⏸   Dry-run klaar. Draai zonder --dry-run om de wijzigingen door te voeren.\n');
    return;
  }

  if (changeCount === 0 && notFoundCount === 0) {
    console.log('✅  Alle playback_order waarden zijn al correct!\n');
    return;
  }

  // Apply updates
  console.log('📝  Supabase updaten...');
  let success = 0;
  let fail = 0;

  for (const u of updates) {
    const { error: updateError } = await sb
      .from('video_ingest_jobs')
      .update({ playback_order: u.playback_order })
      .eq('id', u.id);

    if (updateError) {
      console.error(`  ❌  Fout bij ID ${u.id}: ${updateError.message}`);
      fail++;
    } else {
      success++;
    }
  }

  console.log(`\n✅  Klaar: ${success} bijgewerkt, ${fail} mislukt\n`);

  // Verify
  console.log('🔍  Verificatie...');
  const { data: verify } = await sb
    .from('video_ingest_jobs')
    .select('drive_file_name, playback_order')
    .neq('status', 'deleted')
    .eq('is_hidden', false)
    .order('playback_order', { ascending: true });

  const dupes = {};
  for (const v of verify) {
    if (v.playback_order != null) {
      if (!dupes[v.playback_order]) dupes[v.playback_order] = [];
      dupes[v.playback_order].push(v.drive_file_name);
    }
  }
  const dupEntries = Object.entries(dupes).filter(([, files]) => files.length > 1);
  if (dupEntries.length > 0) {
    console.log('⚠️  DUBBELE playback_order waarden:');
    for (const [order, files] of dupEntries) {
      console.log(`    Order ${order}: ${files.join(', ')}`);
    }
  } else {
    console.log('✅  Geen dubbele playback_order waarden');
  }

  // Check first 5 positions
  console.log('\nEerste 5 posities:');
  verify.slice(0, 5).forEach(v => {
    console.log(`  ${v.playback_order}: ${v.drive_file_name}`);
  });
  console.log('');
}

main().catch(err => {
  console.error('\n❌  Onverwachte fout:', err.message || err);
  process.exit(1);
});
