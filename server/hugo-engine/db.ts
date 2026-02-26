/**
 * Database connection using Replit's PostgreSQL integration
 * 
 * TODO: DATABASE-SCHEMA-CHECK
 * ---------------------------
 * Issue: Verifieer dat alle V2 tabellen aanwezig zijn
 * Status: Done (januari 2026)
 * 
 * Bron: hugo-engine_(4).zip → hugo-engine-export/shared/schema.ts
 * Schema is al geëxtraheerd naar shared/schema.ts en tabellen zijn aangemaakt.
 * 
 * Aangemaakte tabellen (20 totaal):
 * - users, sessions, turns, lock_events
 * - v2_sessions, technique_sessions, user_context
 * - technique_mastery, user_training_profile, persona_history
 * - videos, video_progress, user_stats, activity_log
 * - live_sessions, live_session_attendees, live_chat_messages
 * - live_polls, live_poll_options, live_poll_votes
 * - rag_documents (met pgvector)
 * 
 * Frontend koppeling: N/A - database layer
 */
import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "@shared/schema";

neonConfig.webSocketConstructor = ws;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

export const pool = new Pool({ connectionString: process.env.DATABASE_URL });
export const db = drizzle({ client: pool, schema });

// Ensure config_proposals table exists for Hugo Agent
pool.query(`
  CREATE TABLE IF NOT EXISTS config_proposals (
    id SERIAL PRIMARY KEY,
    proposed_by TEXT DEFAULT 'hugo',
    type TEXT NOT NULL,
    field TEXT,
    current_value TEXT,
    proposed_value TEXT NOT NULL,
    reason TEXT,
    status TEXT DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT now(),
    reviewed_at TIMESTAMPTZ,
    reviewed_by TEXT
  )
`).catch((err: Error) => console.warn('[DB] config_proposals table check failed:', err.message));
