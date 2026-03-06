-- V3 Session Persistence
CREATE TABLE IF NOT EXISTS v3_sessions (
  id TEXT PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  mode TEXT NOT NULL CHECK (mode IN ('coaching', 'admin')),
  messages JSONB NOT NULL DEFAULT '[]',
  user_profile JSONB,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_v3_sessions_user ON v3_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_v3_sessions_updated ON v3_sessions(updated_at);

-- V3 Access Control
CREATE TABLE IF NOT EXISTS v3_access (
  user_email TEXT PRIMARY KEY,
  admin_v3 BOOLEAN DEFAULT false,
  coaching_v3 BOOLEAN DEFAULT false,
  enabled_at TIMESTAMPTZ DEFAULT now(),
  enabled_by TEXT
);

-- Seed: superadmin altijd toegang
INSERT INTO v3_access (user_email, admin_v3, coaching_v3, enabled_by)
VALUES ('stephane@hugoherbots.com', true, true, 'system')
ON CONFLICT (user_email) DO NOTHING;
