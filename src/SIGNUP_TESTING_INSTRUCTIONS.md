# 🧪 Signup Testing Instructions

**Status:** ✅ Frontend Updated - Ready to Test

---

## ✅ **WAT IS GEÜPDATET:**

### Signup Component (`/components/HH/Signup.tsx`)
- ✅ Backend signup route geïntegreerd
- ✅ Auto-login na signup
- ✅ Workspace fetch + storage in localStorage
- ✅ Console logging voor debugging
- ✅ Navigatie naar onboarding

---

## 🚀 **HOE TE TESTEN:**

### **STAP 1: Open Signup Page**
1. Ga naar je Figma Make app
2. Klik "Start gratis met Hugo" (of navigeer naar Signup page)

---

### **STAP 2: Vul Formulier In**
```
Voornaam: Test
Achternaam: User
Email: test@hugoherbots.test (of andere test email)
Bedrijf: (optioneel)
Wachtwoord: TestPassword123!
✅ Accept terms checkbox
```

**⚠️ BELANGRIJK:** Gebruik elke keer een **nieuw email adres** (bijv. test2@, test3@, etc.)

---

### **STAP 3: Klik "Start gratis met Hugo"**

Je zou moeten zien:
- Button text verandert naar "Account aanmaken..."
- (Na ~2-3 seconden) Navigatie naar Onboarding page

---

### **STAP 4: Open Browser Console (F12)**

Check de console logs. Je zou moeten zien:

```
🚀 Starting signup process...
✅ Signup success: { success: true, user: { id: "...", email: "..." } }
🔐 Logging in to get session...
✅ Login success: { success: true, session: { access_token: "..." }, user: { ... } }
📁 Fetching workspaces...
✅ Workspaces fetched: [ { id: "...", name: "Test's Workspace", ... } ]
📦 Workspace stored: { id: "...", name: "Test's Workspace", ... }
🎉 Signup complete! Navigating to onboarding...
```

**Als je errors ziet → screenshot naar mij sturen!**

---

### **STAP 5: Verify in Supabase Dashboard**

1. Open **Supabase Dashboard** → SQL Editor
2. Run deze queries:

**A) Check user created:**
```sql
SELECT id, email, created_at, raw_user_meta_data
FROM auth.users
WHERE email = 'test@hugoherbots.test'
ORDER BY created_at DESC
LIMIT 1;
```

**Expected:** 1 row met user data

**B) Check workspace created:**
```sql
SELECT w.id, w.name, w.slug, w.plan_tier, wm.role
FROM workspaces w
INNER JOIN workspace_memberships wm ON w.id = wm.workspace_id
WHERE wm.user_id = (
  SELECT id FROM auth.users 
  WHERE email = 'test@hugoherbots.test'
)
ORDER BY w.created_at DESC
LIMIT 1;
```

**Expected:** 1 row met workspace data
- name: "Test's Workspace"
- plan_tier: "starter"
- role: "owner"

**C) Check features created:**
```sql
SELECT wf.*
FROM workspace_features wf
INNER JOIN workspaces w ON wf.workspace_id = w.id
INNER JOIN workspace_memberships wm ON w.id = wm.workspace_id
WHERE wm.user_id = (
  SELECT id FROM auth.users 
  WHERE email = 'test@hugoherbots.test'
)
ORDER BY wf.created_at DESC
LIMIT 1;
```

**Expected:** 1 row met features
- scenario_builder_enabled: true
- video_avatar_enabled: false
- max_monthly_minutes: 100
- max_team_members: 1

---

### **STAP 6: Check LocalStorage**

In browser console, run:

```javascript
// Check access token
console.log('Access Token:', localStorage.getItem('access_token'));

// Check user
console.log('User:', JSON.parse(localStorage.getItem('user')));

// Check workspace
console.log('Workspace:', JSON.parse(localStorage.getItem('workspace')));

// Check workspace ID
console.log('Workspace ID:', localStorage.getItem('workspace_id'));
```

**Expected:**
- access_token: JWT string (starts with "eyJ...")
- user: Object met id, email, etc.
- workspace: Object met id, name, slug, plan_tier, role
- workspace_id: UUID string

---

## ✅ **SUCCESS CRITERIA:**

Signup is successful als:

- ✅ User created in `auth.users`
- ✅ Workspace created in `workspaces`
- ✅ Membership created in `workspace_memberships` (role = owner)
- ✅ Features created in `workspace_features`
- ✅ LocalStorage contains: access_token, user, workspace, workspace_id
- ✅ Console logs tonen alle 5 steps zonder errors
- ✅ User navigated naar Onboarding page

---

## ❌ **TROUBLESHOOTING:**

### Error: "Failed to fetch" / Network error
**Oorzaak:** Backend route niet bereikbaar  
**Check:**
```bash
curl https://pckctmojjrrgzuufsqoo.supabase.co/functions/v1/make-server-b9a572ea/health

# Expected: {"status":"ok"}
```

---

### Error: "Signup failed" / 500 error
**Oorzaak:** Database error (tables missing, constraint violation, etc.)  
**Check:**
1. Supabase → Logs → Edge Functions
2. Look for error messages
3. Screenshot en stuur naar mij

---

### Error: "Login failed after signup"
**Oorzaak:** User created maar login failed (rare edge case)  
**Fix:** Try logging in manually with same credentials

---

### Warning: "No workspaces found"
**Oorzaak:** Workspace creation failed (maar user is aangemaakt)  
**Check:**
```sql
-- Check if workspace exists for user
SELECT * FROM workspaces w
INNER JOIN workspace_memberships wm ON w.id = wm.workspace_id
WHERE wm.user_id = (SELECT id FROM auth.users WHERE email = 'test@hugoherbots.test');
```

**If empty:** Backend workspace creation failed. Check Edge Function logs.

---

### Console shows: "undefined" for projectId or publicAnonKey
**Oorzaak:** Import path issue  
**Fix:** Check `/utils/supabase/info.tsx` exists en export correct is

---

## 📊 **EXPECTED FLOW:**

```
User fills form
  ↓
Click "Start gratis met Hugo"
  ↓
POST /auth/signup → User created + Workspace created
  ↓
POST /auth/login → Session retrieved
  ↓
GET /workspaces → Workspaces fetched
  ↓
LocalStorage updated
  ↓
Navigate to Onboarding
```

**Total time:** 2-5 seconds

---

## 🎯 **NEXT STEPS AFTER SUCCESSFUL TEST:**

1. ✅ Test Login flow (should also fetch workspaces)
2. ✅ Test Dashboard (should show workspace data)
3. ✅ Test multi-user isolation (create 2 users, verify data isolated)
4. ✅ Add workspace switcher to UI
5. ✅ Update all API calls to include workspace_id header

---

## 📞 **HELP NEEDED?**

**Als je errors ziet:**
1. Screenshot console logs
2. Screenshot Supabase Edge Function logs
3. Copy-paste error message
4. Stuur naar mij

**Common issues:**
- Missing import statement
- Network/CORS error
- Database constraint violation
- Backend route not deployed

---

**Ready to test! 🚀**

Vul signup form in en check console + Supabase Dashboard!
