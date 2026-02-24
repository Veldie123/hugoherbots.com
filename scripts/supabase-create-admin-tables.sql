-- =============================================
-- Supabase Migration: admin_corrections & admin_notifications
-- Run this in Supabase SQL Editor (https://supabase.com/dashboard)
-- =============================================

-- Table 1: admin_corrections
-- Stores technique edits, video edits, and other correction proposals
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
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  source VARCHAR(100) DEFAULT 'analysis',
  target_file VARCHAR(255),
  target_key VARCHAR(255),
  original_json TEXT,
  new_json TEXT
);

-- Table 2: admin_notifications
-- Stores notifications for superadmin when corrections are submitted
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
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS (Row Level Security) but allow service role full access
ALTER TABLE admin_corrections ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_notifications ENABLE ROW LEVEL SECURITY;

-- Policy: service role can do everything
CREATE POLICY "Service role full access corrections" ON admin_corrections
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access notifications" ON admin_notifications
  FOR ALL USING (true) WITH CHECK (true);
