-- Multi-Technique Detection Setup
-- Run this in Supabase SQL Editor

-- 1. Add detected_technieken JSONB column to video_ingest_jobs
ALTER TABLE video_ingest_jobs ADD COLUMN IF NOT EXISTS detected_technieken JSONB;

-- 2. Create video_technieken junction table for many-to-many relationships
CREATE TABLE IF NOT EXISTS video_technieken (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  video_id UUID NOT NULL REFERENCES video_ingest_jobs(id) ON DELETE CASCADE,
  techniek_id TEXT NOT NULL,
  confidence DECIMAL(3,2) DEFAULT 0.5,
  source TEXT DEFAULT 'ai',
  is_primary BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(video_id, techniek_id)
);

-- 3. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_video_technieken_video_id ON video_technieken(video_id);
CREATE INDEX IF NOT EXISTS idx_video_technieken_techniek_id ON video_technieken(techniek_id);
CREATE INDEX IF NOT EXISTS idx_video_technieken_confidence ON video_technieken(confidence DESC);

-- 4. Enable RLS
ALTER TABLE video_technieken ENABLE ROW LEVEL SECURITY;

-- 5. RLS policies (drop first to avoid duplicates, then recreate)
DROP POLICY IF EXISTS "Allow read access for authenticated users" ON video_technieken;
CREATE POLICY "Allow read access for authenticated users" ON video_technieken
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Allow service role full access" ON video_technieken;
CREATE POLICY "Allow service role full access" ON video_technieken
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 6. Add technique_timeline JSONB column for real-time sidebar tracking
ALTER TABLE video_ingest_jobs ADD COLUMN IF NOT EXISTS technique_timeline JSONB;

-- Done! Now run batch detection via: POST /api/videos/batch-techtag
