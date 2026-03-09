-- Business plan bi-weekly review & distribution workflow
-- Applied automatically via db.ts on server startup

-- Add audience column to admin_notifications for superadmin/hugo/all filtering
ALTER TABLE admin_notifications ADD COLUMN IF NOT EXISTS audience VARCHAR(50) DEFAULT 'all';

-- Track business plan review cycles
CREATE TABLE IF NOT EXISTS business_plan_reviews (
  id SERIAL PRIMARY KEY,
  review_notification_id INTEGER,
  status VARCHAR(20) DEFAULT 'pending',  -- pending | approved | skipped
  approved_at TIMESTAMPTZ,
  email_sent BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
