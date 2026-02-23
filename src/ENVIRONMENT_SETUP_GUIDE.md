# 🌍 Environment Setup Guide - Dev/Staging/Prod Separation

**Phase 1.5: Multi-Environment Architecture**

This guide helps you separate development, staging, and production environments for HugoHerbots.ai.

---

## 🎯 Why Separate Environments?

**Current Risk (Single Environment):**
- ❌ Development bugs corrupt production data
- ❌ No safe testing environment for new features
- ❌ Can't test migrations without risk
- ❌ All developers share same database

**With 3 Environments:**
- ✅ Safe testing without affecting users
- ✅ Staging mirrors production for final validation
- ✅ Production stays stable
- ✅ Can rollback safely

---

## 📦 Environment Structure

```
hugoherbots-dev      → Local development + feature testing
hugoherbots-staging  → Pre-release validation + QA
hugoherbots-prod     → Live users + production data
```

---

## 🚀 Step-by-Step Setup

### Step 1: Create 3 Supabase Projects

**Create in Supabase Dashboard:**

1. **Development Project**
   - Name: `hugoherbots-dev`
   - Region: Same as prod (for consistency)
   - Plan: Free tier (OK for dev)

2. **Staging Project**
   - Name: `hugoherbots-staging`
   - Region: Same as prod
   - Plan: Free tier (upgrade if needed for load testing)

3. **Production Project** (already exists)
   - Name: `hugoherbots-prod` (or your current project)
   - Region: (current)
   - Plan: Pro (recommended for production)

---

### Step 2: Configure Each Project

**For EACH project, do these steps:**

#### A. Enable Auth Providers

**Supabase Dashboard → Authentication → Providers:**

1. **Email**
   - ✅ Enable email provider
   - ⚠️ **DEV/STAGING:** Disable email confirmation (for easier testing)
   - ✅ **PROD:** Enable email confirmation

2. **Google OAuth** (optional for now)
   - Copy Client ID & Secret from Google Console
   - Set redirect URI: `https://[PROJECT-REF].supabase.co/auth/v1/callback`
   - ⚠️ In Google Console, add all 3 redirect URIs (dev, staging, prod)

3. **Microsoft OAuth** (optional for now)
   - Copy Client ID & Secret from Azure Portal
   - Set redirect URI: `https://[PROJECT-REF].supabase.co/auth/v1/callback`
   - ⚠️ In Azure Portal, add all 3 redirect URIs

#### B. Create Storage Buckets

**Run this for EACH project:**

```sql
-- Create 4 buckets
INSERT INTO storage.buckets (id, name, public)
VALUES 
  ('make-b9a572ea-avatars', 'make-b9a572ea-avatars', false),
  ('make-b9a572ea-scenarios', 'make-b9a572ea-scenarios', false),
  ('make-b9a572ea-recordings', 'make-b9a572ea-recordings', false),
  ('make-b9a572ea-resources', 'make-b9a572ea-resources', false);
```

Or use your storage initialization script (it's idempotent).

#### C. Apply RLS Policies

**For EACH project:**

1. Open SQL Editor
2. Paste contents of `/supabase/migrations/001_storage_rls_policies.sql`
3. Run

**Verify:**
```sql
SELECT COUNT(*) FROM pg_policies 
WHERE schemaname = 'storage' 
  AND tablename = 'objects'
  AND policyname LIKE '%make-b9a572ea%';
-- Should return: 16
```

---

### Step 3: Set Up Environment Variables

#### A. Get Credentials from Each Project

**For each project, get from Supabase Dashboard → Settings → API:**

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY` (public)
- `SUPABASE_SERVICE_ROLE_KEY` (secret!)

#### B. Create Environment Files

**In your project root:**

**`.env.development`**
```bash
# Development Environment
SUPABASE_URL=https://xxx-dev.supabase.co
SUPABASE_ANON_KEY=eyJ...dev-anon-key
SUPABASE_SERVICE_ROLE_KEY=eyJ...dev-service-role-key

# Optional: Different API endpoints for dev
API_BASE_URL=http://localhost:54321/functions/v1
```

**`.env.staging`**
```bash
# Staging Environment
SUPABASE_URL=https://xxx-staging.supabase.co
SUPABASE_ANON_KEY=eyJ...staging-anon-key
SUPABASE_SERVICE_ROLE_KEY=eyJ...staging-service-role-key

API_BASE_URL=https://xxx-staging.supabase.co/functions/v1
```

**`.env.production`**
```bash
# Production Environment
SUPABASE_URL=https://pckctmojjrrgzuufsqoo.supabase.co
SUPABASE_ANON_KEY=eyJ...prod-anon-key
SUPABASE_SERVICE_ROLE_KEY=eyJ...prod-service-role-key

API_BASE_URL=https://pckctmojjrrgzuufsqoo.supabase.co/functions/v1
```

**⚠️ IMPORTANT:**
```bash
# .gitignore (make sure these are ignored!)
.env
.env.local
.env.development
.env.staging
.env.production
.env*.local
```

**✅ DO COMMIT:**
```bash
# .env.example (template without real values)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
```

---

### Step 4: Update Supabase Edge Function Secrets

**For EACH Supabase project:**

**Supabase Dashboard → Edge Functions → Settings:**

Add these secrets:
- `SUPABASE_URL` (project's URL)
- `SUPABASE_SERVICE_ROLE_KEY` (project's key)
- Any other API keys (OpenAI, etc.)

**Or use Supabase CLI:**
```bash
# Development
supabase secrets set SUPABASE_URL="https://xxx-dev.supabase.co" --project-ref xxx-dev
supabase secrets set SUPABASE_SERVICE_ROLE_KEY="eyJ..." --project-ref xxx-dev

# Staging
supabase secrets set SUPABASE_URL="https://xxx-staging.supabase.co" --project-ref xxx-staging
supabase secrets set SUPABASE_SERVICE_ROLE_KEY="eyJ..." --project-ref xxx-staging

# Production
supabase secrets set SUPABASE_URL="https://pckctmojjrrgzuufsqoo.supabase.co" --project-ref pckctmojjrrgzuufsqoo
supabase secrets set SUPABASE_SERVICE_ROLE_KEY="eyJ..." --project-ref pckctmojjrrgzuufsqoo
```

---

### Step 5: Deploy to Each Environment

#### A. Deploy Edge Functions

**Install Supabase CLI:**
```bash
npm install -g supabase
supabase login
```

**Deploy to Development:**
```bash
supabase functions deploy make-server-b9a572ea --project-ref xxx-dev
```

**Deploy to Staging:**
```bash
supabase functions deploy make-server-b9a572ea --project-ref xxx-staging
```

**Deploy to Production:**
```bash
supabase functions deploy make-server-b9a572ea --project-ref pckctmojjrrgzuufsqoo
```

#### B. Update Frontend Environment Config

**In your frontend build process:**

**Development:**
```bash
# .env.development is automatically loaded
npm run dev
```

**Staging:**
```bash
# Load staging environment
npm run build -- --mode staging
# Or
export NODE_ENV=staging && npm run build
```

**Production:**
```bash
# Load production environment
export NODE_ENV=production && npm run build
```

---

### Step 6: Configure Deployment Platforms

#### Option A: Vercel

**Vercel Dashboard → Project → Settings → Environment Variables:**

**Development:**
- Environment: `Development`
- Add: `SUPABASE_URL`, `SUPABASE_ANON_KEY`
- Values: From `.env.development`

**Preview (Staging):**
- Environment: `Preview`
- Add: `SUPABASE_URL`, `SUPABASE_ANON_KEY`
- Values: From `.env.staging`

**Production:**
- Environment: `Production`
- Add: `SUPABASE_URL`, `SUPABASE_ANON_KEY`
- Values: From `.env.production`

**⚠️ NEVER add `SUPABASE_SERVICE_ROLE_KEY` to frontend env vars!**

#### Option B: Netlify

**Similar process:**
1. Site Settings → Build & Deploy → Environment
2. Add variables per environment
3. Service Role Key stays in backend only

---

### Step 7: Update OAuth Redirect URIs

**If using Google/Microsoft OAuth:**

#### Google Cloud Console

**Credentials → OAuth 2.0 Client → Authorized redirect URIs:**

Add all 3:
```
https://xxx-dev.supabase.co/auth/v1/callback
https://xxx-staging.supabase.co/auth/v1/callback
https://pckctmojjrrgzuufsqoo.supabase.co/auth/v1/callback
```

#### Azure Portal (Microsoft)

**App Registrations → Authentication → Redirect URIs:**

Add all 3:
```
https://xxx-dev.supabase.co/auth/v1/callback
https://xxx-staging.supabase.co/auth/v1/callback
https://pckctmojjrrgzuufsqoo.supabase.co/auth/v1/callback
```

---

## 🧪 Testing Each Environment

### Development Tests

**Goal:** Fast iteration, breaking changes OK

```bash
# 1. Signup test user
# 2. Upload avatar
# 3. Create scenario
# 4. Test new features
# 5. Break things (it's dev!)
```

### Staging Tests

**Goal:** Mirror production, validate before release

```bash
# 1. Deploy latest code to staging
# 2. Run full test suite
# 3. Test with realistic data
# 4. Load testing (if needed)
# 5. Get QA/stakeholder approval
```

### Production Monitoring

**Goal:** Zero downtime, monitor closely

```bash
# 1. Deploy only after staging approval
# 2. Monitor error rates
# 3. Watch Supabase logs
# 4. Have rollback plan ready
```

---

## 📊 Environment Comparison Table

| Feature | Development | Staging | Production |
|---------|-------------|---------|------------|
| **Purpose** | Feature dev | Pre-release | Live users |
| **Data** | Fake/test | Realistic sample | Real user data |
| **Uptime SLA** | None | 95% | 99.9% |
| **Breaking changes** | ✅ OK | ⚠️ Careful | ❌ Never |
| **Email confirm** | ❌ Disabled | ⚠️ Optional | ✅ Enabled |
| **Supabase Plan** | Free | Free/Pro | Pro |
| **Monitoring** | Basic logs | Basic + alerts | Full observability |
| **Backups** | Not needed | Daily | Hourly + PITR |
| **Deploy frequency** | Constantly | Weekly | After staging approval |

---

## 🔐 Security Best Practices

### Secret Management

**✅ DO:**
- Store secrets in Supabase Dashboard (per project)
- Use Vercel/Netlify environment variables
- Keep `.env.production` out of Git
- Rotate service role keys quarterly

**❌ DON'T:**
- Commit any `.env` files with real values
- Share service role keys in Slack/email
- Use production keys in development
- Hardcode any secrets in code

### Access Control

**Development:**
- Accessible to all developers
- No sensitive data
- Can be reset anytime

**Staging:**
- Accessible to devs + QA + stakeholders
- Sample data only (GDPR-safe)
- Reset monthly

**Production:**
- Limited access (lead dev, ops)
- Real user data (GDPR compliance required)
- Never reset without backup

---

## 🚨 Troubleshooting

### Issue: "Wrong Supabase project" errors

**Symptom:** Connecting to prod from dev environment

**Solution:**
1. Check `.env` file is loaded correctly
2. Print `process.env.SUPABASE_URL` at startup
3. Verify Vercel/Netlify environment variable scope

### Issue: OAuth works in dev, not staging

**Solution:**
- Add staging redirect URI to Google/Azure
- Check Supabase staging project has OAuth enabled
- Verify Client ID/Secret are correct for staging

### Issue: RLS policies missing in staging

**Solution:**
- Re-run SQL script in staging project
- Check policies with verification query
- Staging should be identical to prod

---

## 🎯 Deployment Workflow

**Recommended process:**

```
1. Feature development
   └─> Commit to feature branch
   └─> Auto-deploy to Development
   └─> Test locally

2. Ready for review
   └─> Merge to 'staging' branch
   └─> Auto-deploy to Staging
   └─> QA testing

3. Staging approved
   └─> Merge to 'main' branch
   └─> Manual deploy to Production
   └─> Monitor closely

4. Issues found
   └─> Rollback production
   └─> Fix in development
   └─> Repeat from step 1
```

---

## 📈 Success Criteria

**Environment separation is complete when:**

✅ 3 Supabase projects exist (dev, staging, prod)  
✅ Each has own storage buckets + RLS policies  
✅ Each has own secrets (never shared between envs)  
✅ Frontend uses correct env vars per environment  
✅ OAuth redirect URIs configured for all 3  
✅ Deployment process is documented  
✅ Team knows which env to use when  
✅ Production secrets are never used in dev/staging

---

## 💰 Cost Implications

**Free Tier (per project):**
- 500MB database
- 1GB file storage
- 50GB bandwidth
- 500K Edge Function invocations

**If you need more:**
- Keep Development on Free
- Upgrade Staging to Pro ($25/mo) if needed for load testing
- Production should be Pro ($25/mo)

**Total cost:** $25-50/month for 3 environments

---

## 📞 Next Steps

**After environment setup:**

1. ✅ Test auth in all 3 environments
2. ✅ Verify storage works in each
3. ✅ Run Phase 1 security tests in staging
4. ✅ Deploy to production with confidence

**Then proceed to:**
- Phase 2: Multi-Tenant Architecture
- Phase 3: Direct uploads for recordings
- Phase 4: Billing integration

---

**Questions?**
- `/PHASE_1_IMPLEMENTATION_GUIDE.md` - Security setup
- `/PRODUCTION_READINESS_ASSESSMENT.md` - Full roadmap
- Supabase Docs: https://supabase.com/docs/guides/platform/environment-variables

---

**Status: 📝 Guide Complete - Ready for Implementation**
