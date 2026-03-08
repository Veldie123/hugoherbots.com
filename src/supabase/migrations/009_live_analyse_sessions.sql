-- Live Analyse sessions: real-time in-call coaching data
CREATE TABLE IF NOT EXISTS live_analyse_sessions (
  id TEXT PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  status TEXT NOT NULL DEFAULT 'active',
  transcript JSONB NOT NULL DEFAULT '[]',
  tips JSONB NOT NULL DEFAULT '[]',
  phase_history JSONB NOT NULL DEFAULT '[]',
  final_phase INTEGER DEFAULT 1,
  duration_seconds INTEGER,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_la_sessions_user ON live_analyse_sessions(user_id);
