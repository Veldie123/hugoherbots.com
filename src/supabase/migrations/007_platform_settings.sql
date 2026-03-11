-- ============================================
-- PLATFORM SETTINGS TABLE
-- Key-value store for admin-configurable settings
-- ============================================

CREATE TABLE IF NOT EXISTS platform_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID REFERENCES auth.users(id)
);

-- Seed default settings
INSERT INTO platform_settings (key, value) VALUES
  ('branding', '{"platformName": "HugoHerbots.ai", "tagline": "40 jaar salesgeheimen, nu jouw dagelijkse coach.", "supportEmail": "support@hugoherbots.ai"}'::jsonb),
  ('platform', '{"allowNewUsers": true, "trialDays": 14, "maintenanceMode": false}'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- ============================================
-- PROFILES TABLE
-- Mirrors auth.users with app-specific fields
-- ============================================

CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  first_name TEXT,
  last_name TEXT,
  avatar_url TEXT,
  admin_role TEXT CHECK (admin_role IN ('super_admin', 'content_manager', 'support_agent')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed profiles from existing auth.users
INSERT INTO profiles (id, email, created_at)
SELECT id, email, created_at FROM auth.users
ON CONFLICT (id) DO NOTHING;

-- Set Hugo as super admin
UPDATE profiles SET admin_role = 'super_admin' WHERE email = 'hugo@hugoherbots.com';

-- Auto-create profile on new user signup
CREATE OR REPLACE FUNCTION create_profile_for_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, email, first_name, last_name)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'first_name',
    NEW.raw_user_meta_data->>'last_name'
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    first_name = COALESCE(EXCLUDED.first_name, profiles.first_name),
    last_name = COALESCE(EXCLUDED.last_name, profiles.last_name);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created_profile ON auth.users;
CREATE TRIGGER on_auth_user_created_profile
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION create_profile_for_user();

-- RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view profiles"
  ON profiles FOR SELECT
  TO authenticated
  USING (true);

-- Verification
SELECT * FROM platform_settings;
SELECT id, email, admin_role FROM profiles WHERE admin_role IS NOT NULL;
