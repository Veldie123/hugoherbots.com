-- ============================================================
-- HugoHerbots.ai — Migratie naar Supabase
-- ============================================================
-- Dit script maakt alle benodigde tabellen aan in Supabase.
-- Tabellen die al bestaan (rag_documents, video_ingest_jobs) worden NIET aangeraakt.
-- Voer dit uit in de Supabase SQL Editor.
-- ============================================================

-- 1. conversation_analyses
CREATE TABLE IF NOT EXISTS conversation_analyses (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'transcribing',
  error TEXT,
  result JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ,
  storage_key TEXT
);
CREATE INDEX IF NOT EXISTS idx_ca_user_id ON conversation_analyses (user_id);
CREATE INDEX IF NOT EXISTS idx_ca_status ON conversation_analyses (status);
CREATE INDEX IF NOT EXISTS idx_ca_created_at ON conversation_analyses (created_at DESC);

-- 2. admin_corrections
CREATE TABLE IF NOT EXISTS admin_corrections (
  id SERIAL PRIMARY KEY,
  analysis_id VARCHAR(255),
  type VARCHAR(100) NOT NULL,
  field VARCHAR(100) NOT NULL,
  original_value TEXT,
  new_value TEXT NOT NULL,
  context TEXT,
  submitted_by VARCHAR(100) DEFAULT 'admin',
  status VARCHAR(20) DEFAULT 'pending',
  reviewed_by VARCHAR(100),
  reviewed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT now(),
  source VARCHAR(100) DEFAULT 'analysis',
  target_file VARCHAR(255),
  target_key VARCHAR(255),
  original_json TEXT,
  new_json TEXT
);

-- 3. admin_notifications
CREATE TABLE IF NOT EXISTS admin_notifications (
  id SERIAL PRIMARY KEY,
  type VARCHAR(100) NOT NULL,
  title VARCHAR(500) NOT NULL,
  message TEXT,
  category VARCHAR(100) DEFAULT 'content',
  severity VARCHAR(20) DEFAULT 'info',
  related_id INTEGER,
  related_page VARCHAR(100),
  read BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT now()
);

-- 4. config_proposals
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
);

-- 5. admin_onboarding_progress
CREATE TABLE IF NOT EXISTS admin_onboarding_progress (
  id SERIAL PRIMARY KEY,
  admin_user_id TEXT,
  module TEXT,
  item_key TEXT,
  item_name TEXT,
  status TEXT DEFAULT 'pending',
  feedback_text TEXT,
  correction_id INTEGER,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(admin_user_id, module, item_key)
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_onboarding_user_module_key
  ON admin_onboarding_progress (admin_user_id, module, item_key);

-- 6. user_training_profile
CREATE TABLE IF NOT EXISTS user_training_profile (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id TEXT NOT NULL UNIQUE,
  current_difficulty INTEGER NOT NULL DEFAULT 1,
  success_streak INTEGER NOT NULL DEFAULT 0,
  total_sessions INTEGER NOT NULL DEFAULT 0,
  total_successes INTEGER NOT NULL DEFAULT 0,
  struggle_patterns JSONB DEFAULT '{}'::jsonb,
  recent_personas JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP NOT NULL DEFAULT now()
);

-- 7. live_sessions
CREATE TABLE IF NOT EXISTS live_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR NOT NULL,
  description TEXT,
  scheduled_date TIMESTAMPTZ NOT NULL,
  duration_minutes INTEGER DEFAULT 90,
  topic VARCHAR,
  phase_id INTEGER,
  status VARCHAR DEFAULT 'upcoming',
  daily_room_name VARCHAR,
  daily_room_url VARCHAR,
  video_url VARCHAR,
  thumbnail_url VARCHAR,
  viewer_count INTEGER DEFAULT 0,
  host_id UUID,
  recording_id VARCHAR,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  daily_recording_id VARCHAR,
  daily_recording_url TEXT,
  recording_ready INTEGER DEFAULT 0,
  mux_playback_id VARCHAR,
  transcript TEXT,
  ai_summary TEXT,
  processed_at TIMESTAMPTZ,
  max_attendees INTEGER DEFAULT 50,
  host_name VARCHAR,
  host_avatar VARCHAR,
  tags JSONB DEFAULT '[]'::jsonb,
  features JSONB DEFAULT '[]'::jsonb,
  access_level VARCHAR DEFAULT 'all'
);
CREATE INDEX IF NOT EXISTS idx_live_sessions_scheduled_date ON live_sessions (scheduled_date);
CREATE INDEX IF NOT EXISTS idx_live_sessions_status ON live_sessions (status);

-- 8. live_session_attendees
CREATE TABLE IF NOT EXISTS live_session_attendees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES live_sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  joined_at TIMESTAMPTZ DEFAULT now(),
  reminder_set BOOLEAN DEFAULT false,
  UNIQUE(session_id, user_id)
);

-- 9. live_chat_messages
CREATE TABLE IF NOT EXISTS live_chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL,
  user_id UUID NOT NULL,
  message TEXT NOT NULL,
  is_host BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_live_chat_messages_session ON live_chat_messages (session_id, created_at);

-- 10. live_polls
CREATE TABLE IF NOT EXISTS live_polls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL,
  question TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 11. live_poll_options
CREATE TABLE IF NOT EXISTS live_poll_options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id UUID NOT NULL,
  option_text VARCHAR NOT NULL,
  vote_count INTEGER DEFAULT 0
);

-- 12. live_poll_votes
CREATE TABLE IF NOT EXISTS live_poll_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id UUID NOT NULL,
  option_id UUID NOT NULL,
  user_id UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(poll_id, user_id)
);

-- 13. live_session_reminders
CREATE TABLE IF NOT EXISTS live_session_reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES live_sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(session_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_live_session_reminders_user ON live_session_reminders (user_id);

-- 14. chat_feedback
CREATE TABLE IF NOT EXISTS chat_feedback (
  id SERIAL PRIMARY KEY,
  session_id TEXT,
  turn_index INTEGER,
  rating INTEGER,
  comment TEXT,
  user_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- Openstaande migratie: word_timestamps op rag_documents
-- ============================================================
ALTER TABLE rag_documents
ADD COLUMN IF NOT EXISTS word_timestamps JSONB DEFAULT NULL;

COMMENT ON COLUMN rag_documents.word_timestamps IS 'Word-level timestamps from ElevenLabs STT. Array of {word, start, end} objects for technique shorts.';

-- ============================================================
-- Row Level Security (RLS) — basisbeleid voor alle tabellen
-- ============================================================
ALTER TABLE conversation_analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_corrections ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE config_proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_onboarding_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_training_profile ENABLE ROW LEVEL SECURITY;
ALTER TABLE live_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE live_session_attendees ENABLE ROW LEVEL SECURITY;
ALTER TABLE live_chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE live_polls ENABLE ROW LEVEL SECURITY;
ALTER TABLE live_poll_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE live_poll_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE live_session_reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_feedback ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'conversation_analyses' AND policyname = 'service_role_full_access') THEN
    CREATE POLICY service_role_full_access ON conversation_analyses FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'admin_corrections' AND policyname = 'service_role_full_access') THEN
    CREATE POLICY service_role_full_access ON admin_corrections FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'admin_notifications' AND policyname = 'service_role_full_access') THEN
    CREATE POLICY service_role_full_access ON admin_notifications FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'config_proposals' AND policyname = 'service_role_full_access') THEN
    CREATE POLICY service_role_full_access ON config_proposals FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'admin_onboarding_progress' AND policyname = 'service_role_full_access') THEN
    CREATE POLICY service_role_full_access ON admin_onboarding_progress FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'user_training_profile' AND policyname = 'service_role_full_access') THEN
    CREATE POLICY service_role_full_access ON user_training_profile FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'live_sessions' AND policyname = 'service_role_full_access') THEN
    CREATE POLICY service_role_full_access ON live_sessions FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'live_session_attendees' AND policyname = 'service_role_full_access') THEN
    CREATE POLICY service_role_full_access ON live_session_attendees FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'live_chat_messages' AND policyname = 'service_role_full_access') THEN
    CREATE POLICY service_role_full_access ON live_chat_messages FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'live_polls' AND policyname = 'service_role_full_access') THEN
    CREATE POLICY service_role_full_access ON live_polls FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'live_poll_options' AND policyname = 'service_role_full_access') THEN
    CREATE POLICY service_role_full_access ON live_poll_options FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'live_poll_votes' AND policyname = 'service_role_full_access') THEN
    CREATE POLICY service_role_full_access ON live_poll_votes FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'live_session_reminders' AND policyname = 'service_role_full_access') THEN
    CREATE POLICY service_role_full_access ON live_session_reminders FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'chat_feedback' AND policyname = 'service_role_full_access') THEN
    CREATE POLICY service_role_full_access ON chat_feedback FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
  END IF;
END $$;

-- Publieke leestoegang voor live_sessions (webinars zijn publiek zichtbaar)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'live_sessions' AND policyname = 'public_read_access') THEN
    CREATE POLICY public_read_access ON live_sessions FOR SELECT USING (true);
  END IF;
END $$;
