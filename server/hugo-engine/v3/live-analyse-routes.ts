/**
 * Live Analyse REST Routes
 *
 * Session management for real-time in-call coaching.
 * WebSocket handles the real-time flow; these routes handle CRUD.
 */

import { Router, type Request, type Response } from "express";
import { requireAuth } from "../auth-middleware";
import { pool } from "../db";

const router = Router();

// All routes require authentication
router.use(requireAuth);

// POST /api/v3/live-analyse/session — Create new session (pre-allocate ID)
router.post("/session", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const sessionId = `la-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    await pool.query(
      `INSERT INTO live_analyse_sessions (id, user_id, status) VALUES ($1, $2, 'active')`,
      [sessionId, userId]
    );

    res.json({ sessionId });
  } catch (e: any) {
    console.error("[LiveAnalyse] Create session error:", e.message);
    res.status(500).json({ error: "Sessie aanmaken mislukt" });
  }
});

// POST /api/v3/live-analyse/session/:id/complete — Mark session as completed
router.post("/session/:id/complete", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { id } = req.params;

    const result = await pool.query(
      `UPDATE live_analyse_sessions
       SET status = 'completed', completed_at = now(), updated_at = now()
       WHERE id = $1 AND user_id = $2
       RETURNING id`,
      [id, userId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Sessie niet gevonden" });
    }

    res.json({ success: true });
  } catch (e: any) {
    console.error("[LiveAnalyse] Complete session error:", e.message);
    res.status(500).json({ error: "Sessie afsluiten mislukt" });
  }
});

// GET /api/v3/live-analyse/session/:id — Get a specific session
router.get("/session/:id", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { id } = req.params;

    const result = await pool.query(
      `SELECT id, status, transcript, tips, phase_history, final_phase,
              duration_seconds, created_at, completed_at
       FROM live_analyse_sessions
       WHERE id = $1 AND user_id = $2`,
      [id, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Sessie niet gevonden" });
    }

    const row = result.rows[0];
    res.json({
      id: row.id,
      status: row.status,
      transcript: row.transcript,
      tips: row.tips,
      phaseHistory: row.phase_history,
      finalPhase: row.final_phase,
      durationSeconds: row.duration_seconds,
      createdAt: row.created_at,
      completedAt: row.completed_at,
    });
  } catch (e: any) {
    console.error("[LiveAnalyse] Get session error:", e.message);
    res.status(500).json({ error: "Sessie ophalen mislukt" });
  }
});

// GET /api/v3/live-analyse/sessions — List sessions for current user
router.get("/sessions", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const limit = Math.min(Number(req.query.limit) || 20, 50);

    const result = await pool.query(
      `SELECT id, status, final_phase, duration_seconds,
              created_at, completed_at,
              jsonb_array_length(tips) as tip_count
       FROM live_analyse_sessions
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [userId, limit]
    );

    res.json({
      sessions: result.rows.map((row) => ({
        id: row.id,
        status: row.status,
        finalPhase: row.final_phase,
        durationSeconds: row.duration_seconds,
        tipCount: row.tip_count,
        createdAt: row.created_at,
        completedAt: row.completed_at,
      })),
    });
  } catch (e: any) {
    console.error("[LiveAnalyse] List sessions error:", e.message);
    res.status(500).json({ error: "Sessies ophalen mislukt" });
  }
});

export const liveAnalyseRoutes = router;
