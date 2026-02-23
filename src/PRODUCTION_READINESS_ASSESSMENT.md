# 🎯 Production Readiness Assessment - HugoHerbots.ai

**Status:** Pre-MVP → Production Gap Analysis

---

## 📊 Overall Status

| Category | Status | Priority | Notes |
|----------|--------|----------|-------|
| **Auth & Identity** | 🟡 60% | 🔴 CRITICAL | Missing JWT middleware + multi-tenant |
| **Storage Security** | 🟡 40% | 🔴 CRITICAL | Missing RLS, direct uploads, lifecycle |
| **Product Controls** | 🔴 0% | 🟠 HIGH | No seat enforcement, billing, quotas |
| **Ops & Hygiene** | 🔴 20% | 🟠 HIGH | No environments, backups, observability |

---

## 1️⃣ AUTH & IDENTITY

### ✅ **What You HAVE:**

```
✓ Supabase Auth enabled
✓ Email/password signup (client.ts)
✓ OAuth providers (Google + Microsoft) - configured but not tested
✓ Password reset helper (auth.resetPassword)
✓ Session management (auth.getSession, onAuthStateChange)
✓ User metadata support (first_name, last_name, company)
✓ Frontend auth helpers (/utils/supabase/client.ts)
```

### ❌ **What You're MISSING:**

#### **1.1 Backend JWT Verification Middleware** 🔴 CRITICAL

**Current state:**
- ❌ NO JWT verification in Express server
- ❌ Anyone can fake userId in requests
- ❌ No `req.user` extraction

**What you need:**
```typescript
// /supabase/functions/server/middleware/auth.ts
import { supabase } from '../supabase.ts';

export async function requireAuth(c: Context, next: Next) {
  const token = c.req.header('Authorization')?.replace('Bearer ', '');
  
  if (!token) {
    return c.json({ error: 'Unauthorized' }, 401);
  }
  
  // Verify JWT signature + issuer + audience
  const { data: { user }, error } = await supabase.auth.getUser(token);
  
  if (error || !user) {
    return c.json({ error: 'Invalid token' }, 401);
  }
  
  // Attach to request context
  c.set('user', user);
  c.set('userId', user.id);
  
  await next();
}
```

**Impact:** 🔴 **CRITICAL** - Without this, your API is completely insecure!

---

#### **1.2 Multi-Tenant Architecture** 🔴 CRITICAL

**Current state:**
- ❌ NO workspace/organization model
- ❌ NO team membership concept
- ❌ Data isolation only at user level (not team level)

**What you need:**

**Database schema:**
```sql
-- Workspaces (companies/teams using HugoHerbots)
CREATE TABLE workspaces (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  plan_tier TEXT DEFAULT 'starter', -- starter/pro/team
  created_at TIMESTAMPTZ DEFAULT NOW(),
  owner_id UUID REFERENCES auth.users(id)
);

-- Workspace memberships (who has access)
CREATE TABLE workspace_memberships (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL, -- owner/admin/member
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(workspace_id, user_id)
);

-- Sessions now belong to workspace
ALTER TABLE kv_store_b9a572ea 
  ADD COLUMN workspace_id UUID REFERENCES workspaces(id);
```

**Middleware:**
```typescript
export async function requireWorkspace(c: Context, next: Next) {
  const userId = c.get('userId');
  const workspaceId = c.req.header('X-Workspace-Id');
  
  // Verify user is member of workspace
  const membership = await checkMembership(userId, workspaceId);
  
  if (!membership) {
    return c.json({ error: 'Not a member of this workspace' }, 403);
  }
  
  c.set('workspace', { id: workspaceId, role: membership.role });
  await next();
}
```

**Impact:** 🔴 **CRITICAL for B2B SaaS** - Without this:
- ❌ No team accounts
- ❌ No workspace isolation
- ❌ Can't sell to companies (only individuals)

---

#### **1.3 Email Verification** 🟡 MEDIUM

**Current state:**
- ⚠️ Supabase auto-confirms emails (you disabled verification)
- ⚠️ Anyone can signup with fake emails

**What you need:**
```typescript
// In signup flow
const { data, error } = await supabase.auth.signUp({
  email,
  password,
  options: {
    emailRedirectTo: `${window.location.origin}/auth/verify`,
    // Don't auto-confirm in production!
  }
});
```

**Supabase Settings:**
- Authentication → Email → Enable email confirmation
- Configure email templates

**Impact:** 🟡 **MEDIUM** - Prevents fake signups, improves deliverability

---

#### **1.4 User Lifecycle** 🟢 LOW

**Current state:**
- ✅ Password reset exists
- ❌ No team invites
- ❌ No user deactivation
- ❌ No account deletion flow

**What you need:**
- Team invite workflow (send magic link)
- Deactivate user (soft delete)
- Delete user + all data (GDPR compliance)

**Impact:** 🟢 **LOW** - Nice to have, not blocking MVP

---

## 2️⃣ STORAGE SECURITY & PERFORMANCE

### ✅ **What You HAVE:**

```
✓ 4 buckets defined (avatars, scenarios, recordings, resources)
✓ Storage helper functions (/supabase/functions/server/storage.tsx)
✓ Frontend utilities (/utils/storage.ts)
✓ AvatarUpload component
```

### ❌ **What You're MISSING:**

#### **2.1 RLS Policies & Security** 🔴 CRITICAL

**Current state:**
- ❌ NO RLS policies configured (you have instructions but not executed)
- ❌ Buckets publicly accessible OR completely locked
- ❌ No path traversal protection

**What you need (from STORAGE_SETUP.md):**

**Execute these policies in Supabase Dashboard:**
```sql
-- Avatars: User can only read/write their own
CREATE POLICY "Users can upload their own avatar"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'make-b9a572ea-avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can read any avatar"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'make-b9a572ea-avatars');

-- Recordings: User can only access their own
CREATE POLICY "Users can upload their own recordings"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'make-b9a572ea-recordings' AND auth.uid()::text = (storage.foldername(name))[1]);

-- etc. (see STORAGE_SETUP.md)
```

**Backend validation:**
```typescript
// Prevent path traversal
function sanitizePath(path: string): string {
  if (path.includes('../') || path.includes('..\\')) {
    throw new Error('Invalid path');
  }
  return path.replace(/[^a-zA-Z0-9._/-]/g, '');
}

// Ensure user can only access their folder
function validateUserPath(userId: string, filePath: string): boolean {
  return filePath.startsWith(`${userId}/`);
}
```

**Impact:** 🔴 **CRITICAL** - Without this:
- ❌ Users can access each other's files
- ❌ Users can overwrite system files
- ❌ Path traversal attacks possible

---

#### **2.2 Direct-to-Storage Uploads** 🔴 CRITICAL (for recordings)

**Current state:**
- ❌ All uploads proxied through Express server
- ❌ Will fail for large recordings (timeouts, memory)
- ❌ Bandwidth cost on your server

**Problem:**
```
Recording (50MB) → Express server → Supabase Storage
                   ↑ bottleneck, timeout, crash
```

**What you need:**
```typescript
// Backend: Generate signed upload URL
app.post('/api/recordings/upload-url', requireAuth, async (c) => {
  const userId = c.get('userId');
  const { filename, contentType } = await c.req.json();
  
  const filePath = `${userId}/${Date.now()}-${filename}`;
  
  // Create signed URL (valid for 5 minutes)
  const { data, error } = await supabase.storage
    .from('make-b9a572ea-recordings')
    .createSignedUploadUrl(filePath);
  
  if (error) return c.json({ error: error.message }, 500);
  
  return c.json({ 
    uploadUrl: data.signedUrl,
    path: data.path,
    token: data.token
  });
});

// Frontend: Upload directly to Supabase
async function uploadRecording(file: File) {
  // 1. Get signed URL from backend
  const { uploadUrl, path, token } = await fetch('/api/recordings/upload-url', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${accessToken}` },
    body: JSON.stringify({ 
      filename: file.name,
      contentType: file.type
    })
  }).then(r => r.json());
  
  // 2. Upload DIRECTLY to Supabase (bypasses Express)
  const response = await fetch(uploadUrl, {
    method: 'PUT',
    headers: {
      'Content-Type': file.type,
      'Authorization': `Bearer ${token}`
    },
    body: file
  });
  
  if (!response.ok) throw new Error('Upload failed');
  
  // 3. Confirm with backend
  await fetch('/api/recordings/confirm', {
    method: 'POST',
    body: JSON.stringify({ path, sessionId })
  });
}
```

**Impact:** 🔴 **CRITICAL for recordings** - Without this:
- ❌ Recordings will timeout (>10MB)
- ❌ Server memory crashes
- ❌ Poor user experience
- ✅ Avatars can stay proxied (small files)

---

#### **2.3 File Lifecycle Management** 🟡 MEDIUM

**Current state:**
- ❌ No retention rules
- ❌ Files never deleted (storage costs grow forever)
- ❌ Orphaned files (user deletes session, file stays)

**What you need:**

**Cleanup jobs:**
```typescript
// Cron job: Delete orphaned files
async function cleanupOrphanedRecordings() {
  // Find recordings not linked to any session
  const orphans = await findOrphanedFiles();
  
  for (const file of orphans) {
    await supabase.storage
      .from('make-b9a572ea-recordings')
      .remove([file.path]);
  }
}

// On session delete: cascade delete files
app.delete('/api/sessions/:id', requireAuth, async (c) => {
  const sessionId = c.req.param('id');
  const userId = c.get('userId');
  
  // Get recording path
  const session = await getSession(sessionId);
  
  // Delete from storage
  if (session.recording_path) {
    await supabase.storage
      .from('make-b9a572ea-recordings')
      .remove([session.recording_path]);
  }
  
  // Delete session record
  await deleteSession(sessionId);
  
  return c.json({ success: true });
});
```

**Retention policies:**
```typescript
// Delete raw recordings after 90 days, keep transcripts forever
const RECORDING_RETENTION_DAYS = 90;

async function enforceRetention() {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - RECORDING_RETENTION_DAYS);
  
  // Find old recordings
  const oldRecordings = await findRecordingsOlderThan(cutoffDate);
  
  for (const recording of oldRecordings) {
    // Keep transcript, delete audio
    await deleteRecordingAudio(recording.path);
  }
}
```

**Impact:** 🟡 **MEDIUM** - Prevents runaway storage costs

---

#### **2.4 Virus/Malware Scanning** 🟢 LOW (for now)

**Current state:**
- ❌ No scanning
- ⚠️ Risk if users upload malicious "scenario PDFs" or "resources"

**What you need:**
- ClamAV integration
- Or: Cloudflare Stream (for video) with auto-scanning
- Or: Third-party service (VirusTotal API)

**Impact:** 🟢 **LOW for MVP** - Add later if allowing arbitrary uploads

---

## 3️⃣ PRODUCT CONTROLS

### ✅ **What You HAVE:**

```
✓ Pricing page UI (3 tiers: Starter/Pro/Team)
✓ Settings page with subscription section
```

### ❌ **What You're MISSING:**

#### **3.1 Seat Enforcement (Anti-Sharing)** 🟠 HIGH

**Current state:**
- ❌ 1 login = unlimited devices
- ❌ Users can share accounts freely
- ❌ No "max active sessions" limit

**What you need:**

**Database:**
```sql
CREATE TABLE active_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id),
  workspace_id UUID REFERENCES workspaces(id),
  refresh_token_id TEXT UNIQUE,
  device_fingerprint TEXT,
  ip_address INET,
  user_agent TEXT,
  last_active TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_active_sessions_user ON active_sessions(user_id);
```

**Middleware:**
```typescript
export async function enforceSessionLimit(c: Context, next: Next) {
  const userId = c.get('userId');
  const workspace = c.get('workspace');
  
  // Check active sessions
  const activeSessions = await getActiveSessionsForUser(userId);
  
  // Get plan's session limit
  const maxSessions = workspace.plan_tier === 'starter' ? 1 
                    : workspace.plan_tier === 'pro' ? 2 
                    : 5; // team
  
  if (activeSessions.length >= maxSessions) {
    // Force logout oldest session
    await revokeOldestSession(userId);
    
    return c.json({ 
      error: 'Session limit reached. Logged out oldest device.',
      code: 'SESSION_LIMIT_EXCEEDED'
    }, 403);
  }
  
  await next();
}
```

**Frontend handling:**
```typescript
// Track session heartbeat
setInterval(async () => {
  await fetch('/api/session/heartbeat', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` }
  });
}, 60000); // Every minute
```

**Impact:** 🟠 **HIGH for revenue** - Without this:
- ❌ Users share 1 account across team
- ❌ You lose Team plan revenue
- ❌ Can't enforce seat-based pricing

---

#### **3.2 Billing + Entitlement** 🟠 HIGH

**Current state:**
- ❌ NO plan enforcement
- ❌ NO feature flags
- ❌ NO usage quotas
- ❌ NO Stripe/Mollie integration

**What you need:**

**Database:**
```sql
CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID REFERENCES workspaces(id),
  plan_tier TEXT NOT NULL, -- starter/pro/team
  status TEXT NOT NULL, -- active/canceled/past_due
  stripe_subscription_id TEXT,
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE feature_flags (
  workspace_id UUID REFERENCES workspaces(id),
  video_avatar_enabled BOOLEAN DEFAULT false,
  max_monthly_minutes INTEGER DEFAULT 100,
  team_sessions_enabled BOOLEAN DEFAULT false,
  scenario_builder_enabled BOOLEAN DEFAULT true,
  live_coaching_enabled BOOLEAN DEFAULT false
);

CREATE TABLE usage_tracking (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID REFERENCES workspaces(id),
  user_id UUID REFERENCES auth.users(id),
  resource_type TEXT, -- 'recording_minutes', 'avatar_messages', 'scenarios'
  amount INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Entitlement middleware:**
```typescript
export function requireFeature(feature: string) {
  return async (c: Context, next: Next) => {
    const workspace = c.get('workspace');
    
    const flags = await getFeatureFlags(workspace.id);
    
    if (!flags[feature]) {
      return c.json({ 
        error: 'Feature not available on your plan',
        upgrade_url: '/pricing'
      }, 402); // Payment Required
    }
    
    await next();
  };
}

// Usage
app.post('/api/roleplay/start', 
  requireAuth, 
  requireWorkspace,
  requireFeature('video_avatar_enabled'),
  async (c) => {
    // Start roleplay with avatar
  }
);
```

**Quota enforcement:**
```typescript
async function checkQuota(workspaceId: string, resource: string): Promise<boolean> {
  const usage = await getMonthlyUsage(workspaceId, resource);
  const limit = await getQuotaLimit(workspaceId, resource);
  
  return usage < limit;
}

// Before recording
if (!await checkQuota(workspaceId, 'recording_minutes')) {
  return c.json({ error: 'Monthly quota exceeded. Upgrade your plan.' }, 402);
}
```

**Impact:** 🟠 **HIGH for monetization** - Without this:
- ❌ Can't charge users
- ❌ Can't tier features
- ❌ Can't enforce limits

---

## 4️⃣ OPS & ENVIRONMENT HYGIENE

### ✅ **What You HAVE:**

```
✓ SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY in env
✓ Separation: Anon key in frontend, Service Role only in backend
```

### ❌ **What You're MISSING:**

#### **4.1 Separate Environments** 🔴 CRITICAL

**Current state:**
- ❌ Only 1 Supabase project (production)
- ❌ Development uses same database as "production"
- ❌ No staging environment

**What you need:**

**3 Supabase projects:**
```
1. hugoherbots-dev      → Local development
2. hugoherbots-staging  → Pre-release testing
3. hugoherbots-prod     → Live users
```

**Environment variables per env:**
```bash
# .env.development
SUPABASE_URL=https://dev-project.supabase.co
SUPABASE_ANON_KEY=eyJ...dev
SUPABASE_SERVICE_ROLE_KEY=eyJ...dev

# .env.staging
SUPABASE_URL=https://staging-project.supabase.co
SUPABASE_ANON_KEY=eyJ...staging
SUPABASE_SERVICE_ROLE_KEY=eyJ...staging

# .env.production
SUPABASE_URL=https://prod-project.supabase.co
SUPABASE_ANON_KEY=eyJ...prod
SUPABASE_SERVICE_ROLE_KEY=eyJ...prod
```

**Impact:** 🔴 **CRITICAL** - Without this:
- ❌ Dev bugs corrupt production data
- ❌ No safe testing environment
- ❌ Can't test migrations

---

#### **4.2 Secret Management** 🟠 HIGH

**Current state:**
- ✅ PARTIALLY GOOD: Anon key in frontend, Service Role only backend
- ⚠️ Service Role key in plaintext env file

**What you need:**

**For production:**
- Vercel/Netlify environment variables (encrypted)
- Or: AWS Secrets Manager / GCP Secret Manager
- Or: Doppler / Infisical

**NEVER commit:**
```
.env
.env.local
.env.production
```

**Always commit:**
```
.env.example  (with placeholder values)
```

**Impact:** 🟠 **HIGH** - Leaked Service Role = full database access

---

#### **4.3 Backups & Disaster Recovery** 🟡 MEDIUM

**Current state:**
- ⚠️ Supabase auto-backups (7 days free tier, 30 days Pro)
- ❌ No custom backup strategy
- ❌ No restore testing

**What you need:**

**Supabase automatic backups:**
- Enable Point-in-Time Recovery (PITR) for Pro plan
- Test restore procedure

**Custom backups:**
```bash
# Backup script (weekly)
pg_dump $SUPABASE_DB_URL > backup-$(date +%Y%m%d).sql
aws s3 cp backup-*.sql s3://hugoherbots-backups/
```

**Impact:** 🟡 **MEDIUM** - Supabase handles basic backups

---

#### **4.4 Observability** 🟠 HIGH

**Current state:**
- ❌ No request IDs
- ❌ No error tracking
- ❌ No upload failure monitoring
- ❌ No correlation between storage objects and sessions

**What you need:**

**Request IDs:**
```typescript
app.use('*', async (c, next) => {
  const requestId = crypto.randomUUID();
  c.set('requestId', requestId);
  c.header('X-Request-Id', requestId);
  
  console.log(`[${requestId}] ${c.req.method} ${c.req.url}`);
  
  await next();
});
```

**Error tracking (Sentry):**
```typescript
import * as Sentry from '@sentry/node';

Sentry.init({ dsn: SENTRY_DSN });

app.onError((err, c) => {
  Sentry.captureException(err, {
    tags: {
      requestId: c.get('requestId'),
      userId: c.get('userId'),
    }
  });
  
  return c.json({ error: 'Internal server error' }, 500);
});
```

**Upload tracking:**
```typescript
// Track all uploads
async function trackUpload(params: {
  userId: string;
  filePath: string;
  fileSize: number;
  sessionId?: string;
  status: 'success' | 'failed';
  error?: string;
}) {
  await db.insert('upload_logs', params);
}
```

**Impact:** 🟠 **HIGH for debugging** - Without this:
- ❌ Can't debug user issues
- ❌ No visibility into failures
- ❌ Can't optimize performance

---

## 📋 PRIORITIZED ROADMAP

### **Phase 1: Security Essentials** (Week 1) 🔴 BLOCKING

**Must-have before ANY real users:**
1. ✅ JWT verification middleware
2. ✅ Storage RLS policies (execute STORAGE_SETUP.md)
3. ✅ Path traversal protection
4. ✅ Separate dev/prod Supabase projects
5. ✅ Request ID logging

**Deliverable:** Secure API that can't be bypassed

---

### **Phase 2: Multi-Tenant Foundation** (Week 2) 🔴 BLOCKING for B2B

**Required for team accounts:**
1. ✅ Workspaces table
2. ✅ Workspace memberships
3. ✅ Workspace middleware
4. ✅ Update all queries to filter by workspace_id

**Deliverable:** Team accounts work

---

### **Phase 3: Recordings at Scale** (Week 3) 🟠 HIGH

**Before beta users upload recordings:**
1. ✅ Direct-to-storage uploads
2. ✅ File lifecycle cleanup
3. ✅ Upload failure tracking

**Deliverable:** Recordings don't crash server

---

### **Phase 4: Monetization** (Week 4-5) 🟠 HIGH

**Before charging money:**
1. ✅ Stripe/Mollie integration
2. ✅ Subscription table
3. ✅ Feature flags
4. ✅ Quota tracking
5. ✅ Seat enforcement

**Deliverable:** Can charge users + enforce limits

---

### **Phase 5: Production Polish** (Week 6) 🟡 MEDIUM

**Nice to have:**
1. ✅ Email verification
2. ✅ Sentry error tracking
3. ✅ Backup strategy
4. ✅ Team invites

**Deliverable:** Professional product

---

## 🎯 YOUR NEXT STEPS

### **Immediate (Today):**
1. ✅ Execute RLS policies from `/STORAGE_SETUP.md`
2. ✅ Add JWT middleware to Express routes
3. ✅ Test storage with `/TEST_STORAGE.md` checklist

### **This Week:**
1. ✅ Create dev/staging Supabase projects
2. ✅ Implement workspace model (database + middleware)
3. ✅ Add request ID logging

### **Next 2 Weeks:**
1. ✅ Direct upload URLs for recordings
2. ✅ Basic feature flags
3. ✅ Seat tracking table

---

## 💡 RECOMMENDATIONS

**For MVP (next 30 days):**
- ✅ Do: Auth, Storage, Multi-tenant
- ⏸️ Skip: Billing (manual invoices OK for first 10 customers)
- ⏸️ Skip: Advanced quotas (monitor manually)

**For Beta (30-60 days):**
- ✅ Do: Billing, quotas, seat enforcement
- ⏸️ Skip: Virus scanning, advanced retention

**For Production (60-90 days):**
- ✅ Do: Everything green/yellow above
- ✅ Add: Monitoring, alerting, SLAs

---

**Wil je dat ik start met Phase 1 (Security Essentials)?** 🚀

Ik kan beginnen met:
1. JWT middleware maken
2. RLS policies script genereren
3. Path validation helpers

Zeg maar waar je wilt beginnen! 💪
