-- ============================================
-- MULTI-TENANT ARCHITECTURE - Phase 2
-- HugoHerbots.ai Workspace Schema
-- ============================================
-- 
-- EXECUTE THIS IN SUPABASE SQL EDITOR
-- Dashboard → SQL Editor → New Query → Paste → Run
--
-- This creates the workspace + membership model for team accounts
-- ============================================

-- ============================================
-- 1. WORKSPACES TABLE
-- ============================================
-- Every company/team gets a workspace
-- Workspace contains: name, slug, plan, owner

CREATE TABLE IF NOT EXISTS workspaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  
  -- Subscription/Plan
  plan_tier TEXT NOT NULL DEFAULT 'starter' CHECK (plan_tier IN ('starter', 'pro', 'team')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'canceled')),
  
  -- Billing (for later integration)
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  
  -- Ownership
  owner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  
  -- Settings
  settings JSONB DEFAULT '{}'::jsonb,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT workspace_name_length CHECK (char_length(name) >= 2 AND char_length(name) <= 100),
  CONSTRAINT workspace_slug_format CHECK (slug ~ '^[a-z0-9-]+$')
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_workspaces_slug ON workspaces(slug);
CREATE INDEX IF NOT EXISTS idx_workspaces_owner ON workspaces(owner_id);
CREATE INDEX IF NOT EXISTS idx_workspaces_status ON workspaces(status);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_workspaces_updated_at 
  BEFORE UPDATE ON workspaces
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 2. WORKSPACE MEMBERSHIPS TABLE
-- ============================================
-- Defines who has access to which workspace + their role

CREATE TABLE IF NOT EXISTS workspace_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Role (owner > admin > member)
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
  
  -- Status
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'invited', 'suspended')),
  
  -- Invitation metadata
  invited_by UUID REFERENCES auth.users(id),
  invited_at TIMESTAMPTZ,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- One user can only be in workspace once
  UNIQUE(workspace_id, user_id)
);

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_memberships_workspace ON workspace_memberships(workspace_id);
CREATE INDEX IF NOT EXISTS idx_memberships_user ON workspace_memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_memberships_role ON workspace_memberships(role);

CREATE TRIGGER update_memberships_updated_at 
  BEFORE UPDATE ON workspace_memberships
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 3. FEATURE FLAGS TABLE
-- ============================================
-- Per-workspace feature access (for plan tiers)

CREATE TABLE IF NOT EXISTS workspace_features (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE UNIQUE,
  
  -- Features (enabled/disabled per plan)
  video_avatar_enabled BOOLEAN NOT NULL DEFAULT false,
  team_sessions_enabled BOOLEAN NOT NULL DEFAULT false,
  scenario_builder_enabled BOOLEAN NOT NULL DEFAULT true,
  live_coaching_enabled BOOLEAN NOT NULL DEFAULT false,
  analytics_enabled BOOLEAN NOT NULL DEFAULT false,
  custom_branding_enabled BOOLEAN NOT NULL DEFAULT false,
  
  -- Quotas (limits per workspace)
  max_monthly_minutes INTEGER DEFAULT 100,
  max_team_members INTEGER DEFAULT 1,
  max_scenarios INTEGER DEFAULT 10,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_features_workspace ON workspace_features(workspace_id);

CREATE TRIGGER update_features_updated_at 
  BEFORE UPDATE ON workspace_features
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 4. USAGE TRACKING TABLE
-- ============================================
-- Track resource usage per workspace (for quotas)

CREATE TABLE IF NOT EXISTS workspace_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  
  -- Resource type
  resource_type TEXT NOT NULL CHECK (resource_type IN (
    'recording_minutes',
    'avatar_messages',
    'scenarios_created',
    'sessions_completed',
    'storage_bytes'
  )),
  
  -- Amount used
  amount INTEGER NOT NULL DEFAULT 0,
  
  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,
  
  -- Timestamp
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for aggregation queries
CREATE INDEX IF NOT EXISTS idx_usage_workspace ON workspace_usage(workspace_id);
CREATE INDEX IF NOT EXISTS idx_usage_resource ON workspace_usage(resource_type);
CREATE INDEX IF NOT EXISTS idx_usage_created ON workspace_usage(created_at);

-- ============================================
-- 5. UPDATE KV_STORE TO BE WORKSPACE-SCOPED
-- ============================================
-- Add workspace_id column to existing kv_store table

ALTER TABLE kv_store_b9a572ea 
ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE;

-- Index for workspace-scoped queries
CREATE INDEX IF NOT EXISTS idx_kv_workspace ON kv_store_b9a572ea(workspace_id);

-- Composite index for workspace + key lookups
CREATE INDEX IF NOT EXISTS idx_kv_workspace_key ON kv_store_b9a572ea(workspace_id, key);

-- ============================================
-- 6. HELPER FUNCTIONS
-- ============================================

-- Function to get user's workspaces
CREATE OR REPLACE FUNCTION get_user_workspaces(user_uuid UUID)
RETURNS TABLE (
  workspace_id UUID,
  workspace_name TEXT,
  workspace_slug TEXT,
  user_role TEXT,
  plan_tier TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    w.id,
    w.name,
    w.slug,
    wm.role,
    w.plan_tier
  FROM workspaces w
  INNER JOIN workspace_memberships wm ON w.id = wm.workspace_id
  WHERE wm.user_id = user_uuid 
    AND wm.status = 'active'
    AND w.status = 'active'
  ORDER BY wm.created_at ASC;
END;
$$ LANGUAGE plpgsql;

-- Function to check if user is member of workspace
CREATE OR REPLACE FUNCTION is_workspace_member(
  user_uuid UUID,
  workspace_uuid UUID
)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM workspace_memberships
    WHERE user_id = user_uuid 
      AND workspace_id = workspace_uuid
      AND status = 'active'
  );
END;
$$ LANGUAGE plpgsql;

-- Function to get user's role in workspace
CREATE OR REPLACE FUNCTION get_workspace_role(
  user_uuid UUID,
  workspace_uuid UUID
)
RETURNS TEXT AS $$
DECLARE
  user_role TEXT;
BEGIN
  SELECT role INTO user_role
  FROM workspace_memberships
  WHERE user_id = user_uuid 
    AND workspace_id = workspace_uuid
    AND status = 'active';
  
  RETURN user_role;
END;
$$ LANGUAGE plpgsql;

-- Function to check feature access
CREATE OR REPLACE FUNCTION has_feature_access(
  workspace_uuid UUID,
  feature_name TEXT
)
RETURNS BOOLEAN AS $$
DECLARE
  has_access BOOLEAN;
BEGIN
  EXECUTE format(
    'SELECT %I FROM workspace_features WHERE workspace_id = $1',
    feature_name
  ) INTO has_access USING workspace_uuid;
  
  RETURN COALESCE(has_access, false);
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 7. DEFAULT DATA SETUP
-- ============================================

-- Function to create default workspace for new user
CREATE OR REPLACE FUNCTION create_default_workspace_for_user()
RETURNS TRIGGER AS $$
DECLARE
  new_workspace_id UUID;
  user_email TEXT;
  workspace_slug TEXT;
BEGIN
  -- Get user email
  user_email := NEW.email;
  
  -- Generate workspace slug from email
  workspace_slug := LOWER(REGEXP_REPLACE(
    SPLIT_PART(user_email, '@', 1),
    '[^a-z0-9]',
    '-',
    'g'
  )) || '-' || SUBSTRING(NEW.id::text, 1, 8);
  
  -- Create workspace
  INSERT INTO workspaces (name, slug, owner_id, plan_tier)
  VALUES (
    COALESCE(NEW.raw_user_meta_data->>'first_name', 'Personal') || '''s Workspace',
    workspace_slug,
    NEW.id,
    'starter'
  )
  RETURNING id INTO new_workspace_id;
  
  -- Create membership (owner)
  INSERT INTO workspace_memberships (workspace_id, user_id, role, status)
  VALUES (new_workspace_id, NEW.id, 'owner', 'active');
  
  -- Create feature flags (starter plan defaults)
  INSERT INTO workspace_features (
    workspace_id,
    video_avatar_enabled,
    team_sessions_enabled,
    scenario_builder_enabled,
    live_coaching_enabled,
    analytics_enabled,
    max_monthly_minutes,
    max_team_members,
    max_scenarios
  ) VALUES (
    new_workspace_id,
    false,  -- video avatar: Pro+
    false,  -- team sessions: Team only
    true,   -- scenario builder: all plans
    false,  -- live coaching: Pro+
    false,  -- analytics: Pro+
    100,    -- starter: 100 min/month
    1,      -- starter: 1 member
    10      -- starter: 10 scenarios
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to auto-create workspace on signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION create_default_workspace_for_user();

-- ============================================
-- 8. ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================

-- Enable RLS on all tables
ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_features ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_usage ENABLE ROW LEVEL SECURITY;

-- Workspaces: Users can see workspaces they're members of
CREATE POLICY "Users can view their workspaces"
  ON workspaces FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM workspace_memberships
      WHERE workspace_id = workspaces.id
        AND user_id = auth.uid()
        AND status = 'active'
    )
  );

-- Workspaces: Owners can update their workspace
CREATE POLICY "Owners can update workspace"
  ON workspaces FOR UPDATE
  TO authenticated
  USING (owner_id = auth.uid());

-- Memberships: Users can see memberships in their workspaces
CREATE POLICY "Users can view workspace memberships"
  ON workspace_memberships FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM workspace_memberships wm
      WHERE wm.workspace_id = workspace_memberships.workspace_id
        AND wm.user_id = auth.uid()
        AND wm.status = 'active'
    )
  );

-- Features: Users can view features for their workspaces
CREATE POLICY "Users can view workspace features"
  ON workspace_features FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM workspace_memberships
      WHERE workspace_id = workspace_features.workspace_id
        AND user_id = auth.uid()
        AND status = 'active'
    )
  );

-- Usage: Users can view usage for their workspaces
CREATE POLICY "Users can view workspace usage"
  ON workspace_usage FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM workspace_memberships
      WHERE workspace_id = workspace_usage.workspace_id
        AND user_id = auth.uid()
        AND status = 'active'
    )
  );

-- ============================================
-- 9. VERIFICATION QUERIES
-- ============================================

-- Check tables exist
SELECT 
  table_name,
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = t.table_name) as column_count
FROM information_schema.tables t
WHERE table_schema = 'public'
  AND table_name IN ('workspaces', 'workspace_memberships', 'workspace_features', 'workspace_usage')
ORDER BY table_name;

-- Check functions exist
SELECT 
  routine_name,
  routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name LIKE '%workspace%'
ORDER BY routine_name;

-- ============================================
-- 10. SAMPLE DATA (optional - for testing)
-- ============================================

-- Uncomment to create test workspace
/*
INSERT INTO workspaces (name, slug, plan_tier, owner_id)
VALUES ('Test Workspace', 'test-workspace', 'pro', NULL);

INSERT INTO workspace_features (
  workspace_id,
  video_avatar_enabled,
  team_sessions_enabled,
  max_monthly_minutes,
  max_team_members
)
SELECT id, true, true, 500, 10
FROM workspaces WHERE slug = 'test-workspace';
*/

-- ============================================
-- ✅ MIGRATION COMPLETE
-- ============================================
-- Next steps:
-- 1. Verify tables created: Run verification queries above
-- 2. Test user signup: Should auto-create workspace
-- 3. Update backend: Add workspace middleware
-- 4. Update frontend: Pass workspace_id in API calls
