#!/usr/bin/env node
/**
 * Lookup all activity for hugo@herbots.com
 *
 * Usage: node --env-file=.env scripts/lookup-hugo-activity.js
 */
const { Pool } = require('pg');
const { createClient } = require('@supabase/supabase-js');

const TARGET_EMAIL = 'hugo@herbots.com';

function buildConnectionString() {
  const connStr = process.env.PostgreSQL_connection_string_supabase;
  const password = process.env.SUPABASE_YOUR_PASSWORD;
  if (!connStr) throw new Error('PostgreSQL_connection_string_supabase not set');
  let resolved = connStr;
  if (password && resolved.includes('[YOUR-PASSWORD]')) {
    resolved = resolved.replace('[YOUR-PASSWORD]', password);
  }
  if (resolved.includes('[YOUR-PASSWORD]')) throw new Error('SUPABASE_YOUR_PASSWORD not set');
  try {
    const url = new URL(resolved);
    const hostMatch = url.hostname.match(/^db\.([a-z0-9]+)\.supabase\.co$/);
    if (hostMatch) {
      const projectRef = hostMatch[1];
      const pw = decodeURIComponent(url.password);
      const region = process.env.SUPABASE_DB_REGION || 'aws-1-eu-west-3';
      return `postgresql://postgres.${projectRef}:${encodeURIComponent(pw)}@${region}.pooler.supabase.com:5432/postgres`;
    }
  } catch {}
  return resolved;
}

async function main() {
  const connStr = buildConnectionString();
  const pool = new Pool({ connectionString: connStr, ssl: { rejectUnauthorized: false } });

  const supabaseUrl = process.env.SUPABASE_URL || 'https://pckctmojjrrgzuufsqoo.supabase.co';
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseKey) {
    console.warn('⚠ SUPABASE_SERVICE_ROLE_KEY not set — cannot query auth.users');
  }

  let userId = null;

  // 1. Find user via Supabase Auth
  if (supabaseKey) {
    const supabase = createClient(supabaseUrl, supabaseKey);
    const { data: allUsers } = await supabase.auth.admin.listUsers({ perPage: 1000 });
    const hugo = allUsers?.users?.find(u => u.email === TARGET_EMAIL);
    if (hugo) {
      userId = hugo.id;
      console.log('\n═══════════════════════════════════════════════');
      console.log('  ACCOUNT INFO — hugo@herbots.com');
      console.log('═══════════════════════════════════════════════');
      console.log(`  User ID:         ${hugo.id}`);
      console.log(`  Email:           ${hugo.email}`);
      console.log(`  Email confirmed: ${hugo.email_confirmed_at || 'NOT CONFIRMED'}`);
      console.log(`  Created:         ${hugo.created_at}`);
      console.log(`  Last sign-in:    ${hugo.last_sign_in_at || 'NEVER'}`);
      console.log(`  Updated at:      ${hugo.updated_at}`);
      console.log(`  Provider:        ${hugo.app_metadata?.provider || 'unknown'}`);
      console.log(`  Metadata:        ${JSON.stringify(hugo.user_metadata, null, 2)}`);
    } else {
      console.log(`\n❌ User ${TARGET_EMAIL} NOT FOUND in auth.users`);
      // Try to find by partial match
      const similar = allUsers?.users?.filter(u => u.email?.includes('hugo') || u.email?.includes('herbots'));
      if (similar?.length) {
        console.log('\n  Similar accounts found:');
        similar.forEach(u => console.log(`    - ${u.email} (id: ${u.id})`));
      }
    }
  }

  // 2. Check profiles table
  if (userId) {
    try {
      const { rows } = await pool.query('SELECT * FROM profiles WHERE id = $1 OR email = $2', [userId, TARGET_EMAIL]);
      if (rows.length) {
        console.log('\n───────────────────────────────────────────────');
        console.log('  PROFILE');
        console.log('───────────────────────────────────────────────');
        rows.forEach(r => console.log('  ', JSON.stringify(r, null, 2)));
      }
    } catch (e) { console.log('  [profiles query skipped]', e.message); }
  }

  // 3. V2 Sessions (AI coaching)
  const userFilter = userId ? `user_id = '${userId}'` : `user_id IN (SELECT id FROM auth.users WHERE email = '${TARGET_EMAIL}')`;

  try {
    const { rows } = await pool.query(
      `SELECT id, technique_id, is_active, total_score, turn_number, epic_phase, created_at,
              jsonb_array_length(COALESCE(conversation_history, '[]'::jsonb)) as message_count
       FROM v2_sessions
       WHERE ${userFilter}
       ORDER BY created_at DESC
       LIMIT 20`
    );
    console.log('\n───────────────────────────────────────────────');
    console.log(`  V2 SESSIONS (AI Coaching) — ${rows.length} found`);
    console.log('───────────────────────────────────────────────');
    if (rows.length === 0) console.log('  (geen sessies gevonden)');
    rows.forEach(r => {
      console.log(`  ${r.created_at} | Techniek: ${r.technique_id || 'general'} | Score: ${r.total_score || '-'} | Berichten: ${r.message_count} | Fase: ${r.epic_phase || '-'} | Actief: ${r.is_active}`);
    });
  } catch (e) { console.log('  [v2_sessions query error]', e.message); }

  // 4. V3 Sessions
  try {
    const { rows } = await pool.query(
      `SELECT id, mode, created_at, updated_at,
              jsonb_array_length(COALESCE(messages, '[]'::jsonb)) as message_count,
              metadata
       FROM v3_sessions
       WHERE ${userFilter}
       ORDER BY created_at DESC
       LIMIT 20`
    );
    console.log('\n───────────────────────────────────────────────');
    console.log(`  V3 SESSIONS — ${rows.length} found`);
    console.log('───────────────────────────────────────────────');
    if (rows.length === 0) console.log('  (geen sessies gevonden)');
    rows.forEach(r => {
      console.log(`  ${r.created_at} | Mode: ${r.mode} | Berichten: ${r.message_count} | Metadata: ${JSON.stringify(r.metadata)}`);
    });
  } catch (e) { console.log('  [v3_sessions query error]', e.message); }

  // 5. Conversation analyses (uploaded recordings)
  try {
    const { rows } = await pool.query(
      `SELECT id, title, status, created_at,
              COALESCE((result->'insights'->>'overallScore')::numeric, (result->>'overallScore')::numeric) as score
       FROM conversation_analyses
       WHERE ${userFilter}
       ORDER BY created_at DESC
       LIMIT 20`
    );
    console.log('\n───────────────────────────────────────────────');
    console.log(`  CONVERSATION ANALYSES — ${rows.length} found`);
    console.log('───────────────────────────────────────────────');
    if (rows.length === 0) console.log('  (geen analyses gevonden)');
    rows.forEach(r => {
      console.log(`  ${r.created_at} | ${r.title || 'Untitled'} | Status: ${r.status} | Score: ${r.score || '-'}`);
    });
  } catch (e) { console.log('  [conversation_analyses query error]', e.message); }

  // 6. Activity log
  try {
    const { rows } = await pool.query(
      `SELECT event_type, entity_type, entity_id, score, metadata, created_at
       FROM activity_log
       WHERE ${userFilter}
       ORDER BY created_at DESC
       LIMIT 30`
    );
    console.log('\n───────────────────────────────────────────────');
    console.log(`  ACTIVITY LOG — ${rows.length} found`);
    console.log('───────────────────────────────────────────────');
    if (rows.length === 0) console.log('  (geen activiteit gevonden)');
    rows.forEach(r => {
      console.log(`  ${r.created_at} | ${r.event_type} | ${r.entity_type} | Score: ${r.score || '-'} | ${JSON.stringify(r.metadata || {})}`);
    });
  } catch (e) { console.log('  [activity_log query error]', e.message); }

  // 7. Live session attendance
  try {
    const { rows } = await pool.query(
      `SELECT lsa.session_id, lsa.joined_at, lsa.left_at, ls.title, ls.scheduled_date, ls.status
       FROM live_session_attendees lsa
       JOIN live_sessions ls ON ls.id = lsa.session_id
       WHERE lsa.${userFilter.replace('user_id', 'user_id')}
       ORDER BY lsa.joined_at DESC
       LIMIT 10`
    );
    console.log('\n───────────────────────────────────────────────');
    console.log(`  LIVE SESSION ATTENDANCE — ${rows.length} found`);
    console.log('───────────────────────────────────────────────');
    if (rows.length === 0) console.log('  (geen live sessie deelnames gevonden)');
    rows.forEach(r => {
      console.log(`  ${r.joined_at} | ${r.title} | Status: ${r.status} | Left: ${r.left_at || 'still active'}`);
    });
  } catch (e) { console.log('  [live_session_attendees query error]', e.message); }

  // 8. User training profile
  try {
    const { rows } = await pool.query(
      `SELECT * FROM user_training_profile WHERE ${userFilter}`
    );
    console.log('\n───────────────────────────────────────────────');
    console.log(`  TRAINING PROFILE — ${rows.length} found`);
    console.log('───────────────────────────────────────────────');
    if (rows.length === 0) console.log('  (geen training profiel)');
    rows.forEach(r => console.log('  ', JSON.stringify(r, null, 2)));
  } catch (e) { console.log('  [user_training_profile query error]', e.message); }

  // 9. User stats
  try {
    const { rows } = await pool.query(
      `SELECT * FROM user_stats WHERE ${userFilter}`
    );
    console.log('\n───────────────────────────────────────────────');
    console.log(`  USER STATS — ${rows.length} found`);
    console.log('───────────────────────────────────────────────');
    if (rows.length === 0) console.log('  (geen stats)');
    rows.forEach(r => console.log('  ', JSON.stringify(r, null, 2)));
  } catch (e) { console.log('  [user_stats query error]', e.message); }

  // 10. User memories
  try {
    const { rows } = await pool.query(
      `SELECT id, memory_type, content, technique_id, created_at
       FROM user_memories
       WHERE ${userFilter}
       ORDER BY created_at DESC
       LIMIT 20`
    );
    console.log('\n───────────────────────────────────────────────');
    console.log(`  USER MEMORIES — ${rows.length} found`);
    console.log('───────────────────────────────────────────────');
    if (rows.length === 0) console.log('  (geen herinneringen)');
    rows.forEach(r => {
      console.log(`  ${r.created_at} | ${r.memory_type} | ${r.content?.substring(0, 100)}...`);
    });
  } catch (e) { console.log('  [user_memories query error]', e.message); }

  // 11. Sales scripts
  try {
    const { rows } = await pool.query(
      `SELECT id, status, review_status, techniques_used, created_at, updated_at
       FROM sales_scripts
       WHERE ${userFilter}
       ORDER BY created_at DESC
       LIMIT 10`
    );
    console.log('\n───────────────────────────────────────────────');
    console.log(`  SALES SCRIPTS — ${rows.length} found`);
    console.log('───────────────────────────────────────────────');
    if (rows.length === 0) console.log('  (geen scripts)');
    rows.forEach(r => {
      console.log(`  ${r.created_at} | Status: ${r.status} | Review: ${r.review_status} | Technieken: ${JSON.stringify(r.techniques_used)}`);
    });
  } catch (e) { console.log('  [sales_scripts query error]', e.message); }

  // 12. Technique mastery
  try {
    const { rows } = await pool.query(
      `SELECT technique_id, attempt_count, success_count, average_score, mastery_level
       FROM technique_mastery
       WHERE ${userFilter}
       ORDER BY average_score DESC`
    );
    console.log('\n───────────────────────────────────────────────');
    console.log(`  TECHNIQUE MASTERY — ${rows.length} found`);
    console.log('───────────────────────────────────────────────');
    if (rows.length === 0) console.log('  (geen mastery data)');
    rows.forEach(r => {
      console.log(`  ${r.technique_id} | Pogingen: ${r.attempt_count} | Succes: ${r.success_count} | Gem. score: ${r.average_score} | Level: ${r.mastery_level}`);
    });
  } catch (e) { console.log('  [technique_mastery query error]', e.message); }

  // 13. Video progress
  try {
    const { rows } = await pool.query(
      `SELECT vp.video_id, v.title, vp.progress, vp.completed, vp.updated_at
       FROM video_progress vp
       JOIN videos v ON v.id = vp.video_id
       WHERE vp.${userFilter.replace('user_id', 'user_id')}
       ORDER BY vp.updated_at DESC
       LIMIT 20`
    );
    console.log('\n───────────────────────────────────────────────');
    console.log(`  VIDEO PROGRESS — ${rows.length} found`);
    console.log('───────────────────────────────────────────────');
    if (rows.length === 0) console.log('  (geen video voortgang)');
    rows.forEach(r => {
      console.log(`  ${r.updated_at} | ${r.title} | Voortgang: ${Math.round(r.progress * 100)}% | Voltooid: ${r.completed}`);
    });
  } catch (e) { console.log('  [video_progress query error]', e.message); }

  // 14. Frontend errors
  try {
    const { rows } = await pool.query(
      `SELECT error_message, component, url, created_at
       FROM frontend_errors
       WHERE ${userFilter}
       ORDER BY created_at DESC
       LIMIT 10`
    );
    console.log('\n───────────────────────────────────────────────');
    console.log(`  FRONTEND ERRORS — ${rows.length} found`);
    console.log('───────────────────────────────────────────────');
    if (rows.length === 0) console.log('  (geen frontend errors)');
    rows.forEach(r => {
      console.log(`  ${r.created_at} | ${r.component || '-'} | ${r.error_message?.substring(0, 100)} | URL: ${r.url}`);
    });
  } catch (e) { console.log('  [frontend_errors query error]', e.message); }

  // 15. Platform feedback / NPS
  try {
    const { rows } = await pool.query(
      `SELECT type, rating, comment, created_at FROM platform_feedback WHERE ${userFilter} ORDER BY created_at DESC LIMIT 10`
    );
    console.log('\n───────────────────────────────────────────────');
    console.log(`  PLATFORM FEEDBACK — ${rows.length} found`);
    console.log('───────────────────────────────────────────────');
    if (rows.length === 0) console.log('  (geen feedback)');
    rows.forEach(r => console.log(`  ${r.created_at} | ${r.type} | Rating: ${r.rating} | ${r.comment}`));
  } catch (e) { console.log('  [platform_feedback query error]', e.message); }

  // 16. Admin onboarding progress (if Hugo is an admin)
  try {
    const { rows } = await pool.query(
      `SELECT module, item_key, status, feedback_text, updated_at
       FROM admin_onboarding_progress
       WHERE admin_user_id = $1
       ORDER BY updated_at DESC`, [userId]
    );
    console.log('\n───────────────────────────────────────────────');
    console.log(`  ADMIN ONBOARDING PROGRESS — ${rows.length} found`);
    console.log('───────────────────────────────────────────────');
    if (rows.length === 0) console.log('  (geen admin onboarding)');
    rows.forEach(r => {
      console.log(`  ${r.updated_at} | ${r.module} > ${r.item_key} | Status: ${r.status} | ${r.feedback_text || ''}`);
    });
  } catch (e) { console.log('  [admin_onboarding_progress query error]', e.message); }

  console.log('\n═══════════════════════════════════════════════');
  console.log('  DONE');
  console.log('═══════════════════════════════════════════════\n');

  await pool.end();
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
