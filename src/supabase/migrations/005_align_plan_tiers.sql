-- ============================================
-- PLAN TIER ALIGNMENT
-- Align plan_tier values with Stripe product tiers
-- Old: starter, pro, team
-- New: free, pro, founder, inner_circle
-- ============================================

-- 1. Drop old CHECK constraint
ALTER TABLE workspaces DROP CONSTRAINT IF EXISTS workspaces_plan_tier_check;

-- 2. Migrate existing data
UPDATE workspaces SET plan_tier = 'free' WHERE plan_tier = 'starter';
UPDATE workspaces SET plan_tier = 'founder' WHERE plan_tier = 'team';

-- 3. Add new CHECK constraint with correct tier names
ALTER TABLE workspaces ADD CONSTRAINT workspaces_plan_tier_check
  CHECK (plan_tier IN ('free', 'pro', 'founder', 'inner_circle'));

-- 4. Update the default for new workspaces
ALTER TABLE workspaces ALTER COLUMN plan_tier SET DEFAULT 'free';

-- 5. Update the auto-create workspace trigger to use 'free' instead of 'starter'
CREATE OR REPLACE FUNCTION create_default_workspace_for_user()
RETURNS TRIGGER AS $$
DECLARE
  new_workspace_id UUID;
  user_email TEXT;
  workspace_slug TEXT;
BEGIN
  user_email := NEW.email;
  workspace_slug := LOWER(REGEXP_REPLACE(
    SPLIT_PART(user_email, '@', 1),
    '[^a-z0-9]',
    '-',
    'g'
  )) || '-' || SUBSTRING(NEW.id::text, 1, 8);

  INSERT INTO workspaces (name, slug, owner_id, plan_tier)
  VALUES (
    COALESCE(NEW.raw_user_meta_data->>'first_name', 'Personal') || '''s Workspace',
    workspace_slug,
    NEW.id,
    'free'
  )
  RETURNING id INTO new_workspace_id;

  INSERT INTO workspace_memberships (workspace_id, user_id, role, status)
  VALUES (new_workspace_id, NEW.id, 'owner', 'active');

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
    false,
    false,
    true,
    false,
    false,
    100,
    1,
    10
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Verification
SELECT plan_tier, COUNT(*) FROM workspaces GROUP BY plan_tier ORDER BY plan_tier;
