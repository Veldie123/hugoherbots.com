-- 007: Feedback & Error Tracking Tables
-- Platform feedback (session ratings, bug reports, general feedback)
CREATE TABLE IF NOT EXISTS platform_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  session_id TEXT,
  rating INTEGER CHECK (rating BETWEEN 1 AND 5),
  comment TEXT,
  feedback_type TEXT DEFAULT 'session_rating' CHECK (feedback_type IN ('session_rating', 'bug_report', 'suggestion', 'general')),
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_platform_feedback_user ON platform_feedback (user_id);
CREATE INDEX IF NOT EXISTS idx_platform_feedback_type ON platform_feedback (feedback_type);

-- NPS surveys (periodic)
CREATE TABLE IF NOT EXISTS platform_nps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  score INTEGER CHECK (score BETWEEN 0 AND 10),
  comment TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_platform_nps_user ON platform_nps (user_id);

-- Frontend error logs (automatic)
CREATE TABLE IF NOT EXISTS frontend_errors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  error_message TEXT NOT NULL,
  error_stack TEXT,
  url TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_frontend_errors_created ON frontend_errors (created_at);

-- RLS
ALTER TABLE platform_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_nps ENABLE ROW LEVEL SECURITY;
ALTER TABLE frontend_errors ENABLE ROW LEVEL SECURITY;

-- Users can insert their own feedback
CREATE POLICY feedback_insert ON platform_feedback FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY feedback_read_own ON platform_feedback FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- Users can insert their own NPS
CREATE POLICY nps_insert ON platform_nps FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY nps_read_own ON platform_nps FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- Anyone can log errors (including anonymous)
CREATE POLICY errors_insert ON frontend_errors FOR INSERT TO anon, authenticated
  WITH CHECK (true);

-- Service role has full access (for admin dashboard)
CREATE POLICY service_feedback ON platform_feedback FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
CREATE POLICY service_nps ON platform_nps FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
CREATE POLICY service_errors ON frontend_errors FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
