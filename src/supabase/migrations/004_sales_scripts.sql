-- ============================================================================
-- Migration 004: Sales Scripts (Script Builder for Hugo V3 Agent)
--
-- Stores AI-generated personalized sales scripts per seller.
-- Scripts are built iteratively per EPIC phase and reviewed by Hugo.
--
-- Run in Supabase Dashboard → SQL Editor → New Query → Paste → Run
-- ============================================================================

CREATE TABLE IF NOT EXISTS sales_scripts (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  user_id TEXT NOT NULL,
  version INTEGER DEFAULT 1,
  parent_id TEXT,
  title TEXT,
  script JSONB NOT NULL DEFAULT '{}',
  context JSONB DEFAULT '{}',
  status TEXT DEFAULT 'draft',
  review_status TEXT DEFAULT 'pending',
  reviewed_by TEXT,
  review_feedback TEXT,
  techniques_used TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_scripts_user ON sales_scripts(user_id);
CREATE INDEX IF NOT EXISTS idx_scripts_status ON sales_scripts(status);
CREATE INDEX IF NOT EXISTS idx_scripts_created ON sales_scripts(created_at DESC);

-- Comments
COMMENT ON TABLE sales_scripts IS 'AI-generated personalized sales scripts per seller, built iteratively per EPIC phase.';
COMMENT ON COLUMN sales_scripts.script IS 'JSONB with phases: opening, explore, probe, impact, commit, objection_handling. Each phase has steps with actions, example lines, and technique IDs.';
COMMENT ON COLUMN sales_scripts.context IS 'Snapshot of seller context used to generate this script version.';
COMMENT ON COLUMN sales_scripts.status IS 'draft, active, archived';
COMMENT ON COLUMN sales_scripts.review_status IS 'pending, approved, needs_revision';
COMMENT ON COLUMN sales_scripts.techniques_used IS 'Array of SSOT technique IDs used in this script.';

-- RLS
ALTER TABLE sales_scripts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on sales_scripts"
  ON sales_scripts FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Users can read own scripts"
  ON sales_scripts FOR SELECT
  USING (auth.uid()::TEXT = user_id);
