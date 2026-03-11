-- Preflight Brain Cache: stores pre-computed coaching "brain" documents per user
-- Generated at login by Sonnet + extended thinking, used during sessions

CREATE TABLE IF NOT EXISTS user_brain_cache (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  brain_document TEXT NOT NULL,
  template_version INT NOT NULL DEFAULT 1,
  context_hash VARCHAR(64) NOT NULL,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'
);

-- Brain templates: versioned prompt templates for brain generation
-- Evolves via Hugo's meta-feedback through config review flow

CREATE TABLE IF NOT EXISTS brain_templates (
  id SERIAL PRIMARY KEY,
  version INT NOT NULL UNIQUE,
  template TEXT NOT NULL,
  description TEXT,
  created_by TEXT DEFAULT 'system',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  active BOOLEAN NOT NULL DEFAULT false
);

-- Ensure only one active template
CREATE UNIQUE INDEX IF NOT EXISTS idx_brain_templates_active
  ON brain_templates (active) WHERE active = true;
