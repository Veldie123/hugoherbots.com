# 🏢 Phase 2: Multi-Tenant Architecture - Implementation Guide

**Status:** ✅ IMPLEMENTED - Ready to Execute

---

## 📦 What's Been Implemented

### 1. ✅ Database Schema (`/supabase/migrations/002_multi_tenant_schema.sql`)
- **workspaces** table - Companies/teams
- **workspace_memberships** table - User access + roles
- **workspace_features** table - Feature flags per workspace
- **workspace_usage** table - Usage tracking for quotas
- **Updated kv_store** - Added workspace_id column

### 2. ✅ Backend Middleware (`/supabase/functions/server/middleware.tsx`)
- `requireWorkspace` - Enforce workspace membership
- `requireRole` - Check user role (owner/admin/member)
- `requireFeature` - Feature access control

### 3. ✅ Backend Routes (`/supabase/functions/server/index.tsx`)
- GET `/workspaces` - List user's workspaces
- GET `/workspaces/:id` - Workspace details
- GET `/workspaces/:id/members` - List workspace members
- POST `/workspaces` - Create new workspace

### 4. ✅ Helper Functions (SQL)
- `get_user_workspaces(user_id)` - Get all workspaces for user
- `is_workspace_member(user_id, workspace_id)` - Check membership
- `get_workspace_role(user_id, workspace_id)` - Get user's role
- `has_feature_access(workspace_id, feature)` - Check feature enabled

### 5. ✅ Auto-Provisioning
- **Trigger**: `on_auth_user_created` - Auto-creates workspace on signup
- **Default workspace**: `{FirstName}'s Workspace` with starter plan
- **Default features**: Scenario builder enabled, basic quotas

---

## 🚀 Execution Steps

### STEP 1: Execute Database Migration (15 min)

1. Open **Supabase Dashboard** → SQL Editor
2. Click **"New query"**
3. Copy entire contents of `/supabase/migrations/002_multi_tenant_schema.sql`
4. Paste into SQL editor
5. Click **"Run"** (green button)

**Expected output:**
- ✅ Tables created: 4 new tables
- ✅ Functions created: 5 helper functions
- ✅ Trigger created: Auto-create workspace on signup
- ✅ RLS policies created: 4 policies
- ✅ kv_store updated: workspace_id column added

---

### STEP 2: Verify Schema

Run these verification queries:

```sql
-- Check tables exist (should return 4 rows)
SELECT table_name, 
       (SELECT COUNT(*) FROM information_schema.columns 
        WHERE table_name = t.table_name) as column_count
FROM information_schema.tables t
WHERE table_schema = 'public'
  AND table_name IN ('workspaces', 'workspace_memberships', 'workspace_features', 'workspace_usage')
ORDER BY table_name;

-- Check functions exist (should return 4-5 rows)
SELECT routine_name
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name LIKE '%workspace%'
ORDER BY routine_name;

-- Check kv_store has workspace_id column (should return 1 row)
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'kv_store_b9a572ea'
  AND column_name = 'workspace_id';
```

**All queries should return data. If empty, migration failed!**

---

### STEP 3: Test Auto-Provisioning

**Create a new test user to verify workspace auto-creation:**

1. Go to your Signup page
2. Create new account: `workspace-test@hugoherbots.test`
3. Complete signup

**Verify in Supabase Dashboard:**

```sql
-- Get workspaces for test user
SELECT 
  w.name,
  w.slug,
  w.plan_tier,
  wm.role
FROM workspaces w
INNER JOIN workspace_memberships wm ON w.id = wm.workspace_id
WHERE wm.user_id = (
  SELECT id FROM auth.users 
  WHERE email = 'workspace-test@hugoherbots.test'
);

-- Should return 1 row with:
-- name: "{Name}'s Workspace"
-- plan_tier: starter
-- role: owner
```

**If no results:** Trigger didn't fire. Check trigger exists:
```sql
SELECT trigger_name FROM information_schema.triggers 
WHERE event_object_table = 'users' 
  AND trigger_name = 'on_auth_user_created';
```

---

### STEP 4: Update Frontend - Add Workspace Context

**A) Create Workspace Context Hook**

Create `/utils/useWorkspace.ts`:

```typescript
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface Workspace {
  id: string;
  name: string;
  slug: string;
  planTier: string;
  role: string;
}

interface WorkspaceStore {
  currentWorkspace: Workspace | null;
  workspaces: Workspace[];
  setWorkspace: (workspace: Workspace) => void;
  setWorkspaces: (workspaces: Workspace[]) => void;
}

export const useWorkspace = create<WorkspaceStore>()(
  persist(
    (set) => ({
      currentWorkspace: null,
      workspaces: [],
      setWorkspace: (workspace) => set({ currentWorkspace: workspace }),
      setWorkspaces: (workspaces) => {
        set({ workspaces });
        // Auto-select first workspace if none selected
        if (workspaces.length > 0 && !set.currentWorkspace) {
          set({ currentWorkspace: workspaces[0] });
        }
      },
    }),
    {
      name: 'hugoherbots-workspace',
    }
  )
);
```

**B) Fetch Workspaces on Login**

In your auth flow (after successful login):

```typescript
import { useWorkspace } from './utils/useWorkspace';

// After login success
const fetchWorkspaces = async (accessToken: string) => {
  const res = await fetch('/api/workspaces', {
    headers: { 'Authorization': `Bearer ${accessToken}` }
  });
  const { workspaces } = await res.json();
  
  useWorkspace.setState({ 
    workspaces,
    currentWorkspace: workspaces[0] // Auto-select first
  });
};
```

**C) Pass Workspace ID in API Calls**

Update your API calls to include workspace:

```typescript
const { currentWorkspace } = useWorkspace();

const uploadAvatar = async (file: File) => {
  const formData = new FormData();
  formData.append('file', file);
  
  await fetch('/api/storage/avatar', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'X-Workspace-Id': currentWorkspace.id, // ← Add this!
    },
    body: formData
  });
};
```

---

### STEP 5: Test Workspace Middleware

**Test 1: List Workspaces**
```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
  https://pckctmojjrrgzuufsqoo.supabase.co/functions/v1/make-server-b9a572ea/workspaces

# Expected: Array of workspaces user belongs to
```

**Test 2: Get Workspace Details** (requires X-Workspace-Id header)
```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
  -H "X-Workspace-Id: WORKSPACE_ID" \
  https://pckctmojjrrgzuufsqoo.supabase.co/functions/v1/make-server-b9a572ea/workspaces/WORKSPACE_ID

# Expected: Workspace details with member count, features
```

**Test 3: Access Denied (wrong workspace)**
```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
  -H "X-Workspace-Id: OTHER_WORKSPACE_ID" \
  https://pckctmojjrrgzuufsqoo.supabase.co/functions/v1/make-server-b9a572ea/workspaces/OTHER_WORKSPACE_ID

# Expected: 403 NOT_WORKSPACE_MEMBER
```

---

## 📊 Feature Flags & Plan Tiers

### Default Features Per Plan

**Starter (Free):**
- ✅ Scenario builder
- ❌ Video avatar
- ❌ Team sessions
- ❌ Live coaching
- ❌ Analytics
- Limits: 100 min/month, 1 member, 10 scenarios

**Pro (€149/month):**
- ✅ All Starter features
- ✅ Video avatar
- ✅ Live coaching
- ✅ Analytics
- Limits: 500 min/month, 1 member, unlimited scenarios

**Team (€299/month):**
- ✅ All Pro features
- ✅ Team sessions
- ✅ Team analytics
- Limits: 1000 min/month, 10 members, unlimited scenarios

### How to Check Features in Code

**Backend (in route):**
```typescript
app.post("/api/roleplay/start", 
  requireAuth, 
  requireWorkspace,
  requireFeature('video_avatar_enabled'), // ← Add this
  async (c) => {
    // Only runs if feature is enabled
  }
);
```

**Frontend:**
```typescript
const { currentWorkspace } = useWorkspace();
const { features } = await fetchWorkspaceDetails(currentWorkspace.id);

if (!features.video_avatar_enabled) {
  // Show upgrade modal
  showUpgradeModal('video_avatar');
}
```

---

## 🔐 Role-Based Access Control

### Roles Hierarchy

```
owner > admin > member
```

**Owner can:**
- Update workspace settings
- Invite/remove members
- Change member roles
- Delete workspace
- Upgrade/downgrade plan

**Admin can:**
- Invite/remove members (not owner)
- View team analytics
- Manage scenarios

**Member can:**
- Use the platform
- View their own data
- Cannot invite or manage

### Enforce Roles in Backend

```typescript
app.delete("/api/workspaces/:id/members/:memberId",
  requireAuth,
  requireWorkspace,
  requireRole('owner', 'admin'), // ← Only owner or admin
  async (c) => {
    // Remove member
  }
);
```

---

## 🧪 Testing Checklist

### Scenario 1: Single User (Starter Plan)
- [ ] User signs up
- [ ] Workspace auto-created
- [ ] User is owner of workspace
- [ ] Scenario builder enabled
- [ ] Video avatar disabled
- [ ] Team sessions disabled

### Scenario 2: Team Account (Team Plan)
- [ ] Owner creates workspace
- [ ] Owner invites member
- [ ] Member accepts invite
- [ ] Member joins workspace
- [ ] Both see workspace in list
- [ ] Both can access team features
- [ ] Member cannot invite others
- [ ] Owner can remove member

### Scenario 3: Multiple Workspaces
- [ ] User is member of 2 workspaces
- [ ] GET /workspaces returns both
- [ ] User can switch between workspaces
- [ ] Data isolated per workspace
- [ ] User A cannot access User B's workspace

### Scenario 4: Feature Access
- [ ] Starter user tries video avatar → 402 error
- [ ] Pro user accesses video avatar → Success
- [ ] Team user accesses team sessions → Success

---

## 📈 Migration Checklist

**Before deploying to production:**

- [ ] Backup current database
- [ ] Run migration in staging first
- [ ] Test with existing users
- [ ] Verify existing data not affected
- [ ] Test new signup flow
- [ ] Test workspace switching
- [ ] Monitor error logs
- [ ] Have rollback plan ready

---

## 🚨 Troubleshooting

### Issue: "relation workspaces does not exist"

**Cause:** Migration didn't run successfully  
**Solution:** Re-run migration SQL script

---

### Issue: Workspace not auto-created on signup

**Cause:** Trigger not firing  
**Solution:**
```sql
-- Check trigger exists
SELECT * FROM information_schema.triggers 
WHERE trigger_name = 'on_auth_user_created';

-- If missing, recreate trigger (from migration script)
```

---

### Issue: "workspace_id column does not exist" in kv_store

**Cause:** kv_store update failed  
**Solution:**
```sql
-- Manually add column
ALTER TABLE kv_store_b9a572ea 
ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_kv_workspace ON kv_store_b9a572ea(workspace_id);
```

---

### Issue: requireWorkspace returns 400 "X-Workspace-Id required"

**Cause:** Frontend not passing header  
**Solution:** Add header to all API calls:
```typescript
headers: {
  'X-Workspace-Id': currentWorkspace.id
}
```

---

## 🎯 Success Criteria

**Phase 2 is complete when:**

✅ Migration executed successfully  
✅ New signups auto-create workspace  
✅ User can list their workspaces  
✅ User can switch between workspaces  
✅ Workspace middleware enforces membership  
✅ Feature flags work (starter vs pro vs team)  
✅ Role-based access enforced  
✅ Data isolated per workspace  
✅ Two test users cannot access each other's workspace

---

## 📞 Next Steps

**After Phase 2:**
1. ✅ Test team invites flow
2. ✅ Implement team member management UI
3. ✅ Add workspace switcher to app header
4. ✅ Update all API calls to include workspace_id
5. ✅ Proceed to Phase 3: Direct uploads for recordings

---

**Questions?**
- `/PRODUCTION_READINESS_ASSESSMENT.md` - Full roadmap
- `/PHASE_1_SUMMARY.md` - Security implementation
- `/ENVIRONMENT_SETUP_GUIDE.md` - Multi-env setup

---

**Status: ✅ Implementation Complete → Ready for Testing**

Execute the SQL migration and start testing! 🚀
