-- Add recording approval gate for webinar recordings
-- Recordings must be approved by superadmin before appearing in user-facing "Opgenomen Webinars"
ALTER TABLE live_sessions ADD COLUMN IF NOT EXISTS recording_approved BOOLEAN DEFAULT FALSE;
