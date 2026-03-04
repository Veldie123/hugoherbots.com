/**
 * Admin Stats — extracted from api.ts route handler
 * Direct DB queries instead of localhost HTTP self-calls
 */

import { pool } from './db';
import { supabase } from './supabase-client';
import { getTechnique } from './ssot-loader';

export async function getAdminStats() {
  const { data: allUsers } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  const users = (allUsers as any)?.users || [];
  const totalUsers = users.length || 0;

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const activeUsers = users.filter((u: any) =>
    u.last_sign_in_at && new Date(u.last_sign_in_at) > new Date(thirtyDaysAgo)
  ).length || 0;

  const newUsersThisWeek = users.filter((u: any) =>
    u.created_at && new Date(u.created_at) > new Date(sevenDaysAgo)
  ).length || 0;

  const { data: allSessions } = await supabase
    .from('v2_sessions')
    .select('id, total_score, technique_id, created_at, user_id, conversation_history')
    .eq('is_active', 1)
    .order('created_at', { ascending: false })
    .limit(500);

  const totalSessions = allSessions?.length || 0;
  const recentSessions = allSessions?.filter(s =>
    s.created_at && new Date(s.created_at) > new Date(sevenDaysAgo)
  ).length || 0;

  let totalAnalyses = 0;
  let completedAnalyses = 0;
  let avgAnalysisScore = 0;
  let pendingReviews = 0;
  try {
    const uploadResult = await pool.query(
      "SELECT COUNT(*) as total, COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed FROM conversation_analyses WHERE id NOT LIKE 'session-%'"
    );
    totalAnalyses = parseInt(uploadResult.rows[0]?.total || '0');
    completedAnalyses = parseInt(uploadResult.rows[0]?.completed || '0');

    const scoreResult = await pool.query(
      "SELECT AVG(COALESCE((result->'insights'->>'overallScore')::numeric, (result->>'overallScore')::numeric)) as avg_score FROM conversation_analyses WHERE id NOT LIKE 'session-%' AND status = 'completed' AND (result->'insights'->>'overallScore' IS NOT NULL OR result->>'overallScore' IS NOT NULL)"
    );
    avgAnalysisScore = Math.round(parseFloat(scoreResult.rows[0]?.avg_score || '0'));

    const pendingResult = await pool.query("SELECT COUNT(*) as count FROM admin_corrections WHERE status = 'pending'");
    pendingReviews = parseInt(pendingResult.rows[0]?.count || '0');
  } catch (e) {
    console.log('[Admin Stats] DB query error:', (e as any)?.message);
  }

  const topAnalyses: Array<{id: string; title: string; score: number | null; userName: string}> = [];
  try {
    const { rows } = await pool.query(
      `SELECT id, title, user_id, COALESCE((result->'insights'->>'overallScore')::numeric, (result->>'overallScore')::numeric) as score
       FROM conversation_analyses
       WHERE status = 'completed' AND id NOT LIKE 'session-%'
       ORDER BY created_at DESC LIMIT 3`
    );
    const userIds = [...new Set(rows.map(r => r.user_id).filter(Boolean))];
    let userMap: Record<string, string> = {};
    if (userIds.length > 0 && allUsers?.users) {
      for (const u of allUsers.users) {
        const name = [u.user_metadata?.first_name, u.user_metadata?.last_name].filter(Boolean).join(' ') || u.email?.split('@')[0] || 'Onbekend';
        userMap[u.id] = name;
      }
    }
    for (const row of rows) {
      topAnalyses.push({
        id: row.id,
        title: row.title || 'Untitled',
        score: row.score !== null && row.score !== undefined ? Math.round(row.score) : null,
        userName: userMap[row.user_id] || 'Anoniem',
      });
    }
  } catch (e) {
    console.log('[Admin Stats] Top analyses query error:', (e as any)?.message);
  }

  const topChatSessions: Array<{id: string; technique: string; userName: string; score: number}> = [];
  if (allSessions && allSessions.length > 0) {
    for (const s of allSessions.slice(0, 3)) {
      const technique = getTechnique(s.technique_id);
      const userName = users.find((u: any) => u.id === s.user_id);
      const name = userName ? [userName.user_metadata?.first_name, userName.user_metadata?.last_name].filter(Boolean).join(' ') || userName.email?.split('@')[0] || 'Anoniem' : 'Anoniem';
      topChatSessions.push({
        id: s.id,
        technique: technique?.naam || s.technique_id || 'general',
        userName: name,
        score: Math.min(100, Math.round(50 + (s.conversation_history?.length || 0) * 2.5)),
      });
    }
  }

  return {
    platform: {
      totalUsers,
      activeUsers,
      newUsersThisWeek,
    },
    sessions: {
      total: totalSessions,
      recentWeek: recentSessions,
    },
    analyses: {
      total: totalAnalyses,
      completed: completedAnalyses,
      avgScore: avgAnalysisScore,
    },
    pendingReviews,
    topAnalyses,
    topChatSessions,
  };
}
