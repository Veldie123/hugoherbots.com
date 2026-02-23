# 🔐 OAuth Testing in Figma Make - Summary

**TL;DR:** OAuth werkt **NIET** in Figma Make. Email/password signup werkt **WEL**.

---

## ❌ **1. OAUTH (Google/Microsoft) in Figma Make: NIET MOGELIJK**

### Waarom OAuth niet werkt in Figma Make:

**Screenshot 3 (localhost error) laat zien:**
```
localhost refused to connect
ERR_CONNECTION_REFUSED
```

**Wat gebeurt:**
1. User klikt "Sign up with Google"
2. Google auth succesvol
3. Google redirect naar **`localhost:3000/callback`**
4. Maar Figma Make draait op `figma.site`, niet localhost
5. → Connection refused

**Root cause:**
- OAuth redirect URLs moeten **exact** matchen in Google/Microsoft console
- Figma Make URLs zijn **dynamic** (`https://inter-sepia-28958558.figma.site`)
- Je kunt deze URLs **niet** registreren bij Google/Microsoft
- Supabase probeert terug te redirecten naar `localhost:3000` (dev default)
- Dit werkt niet in published Figma Make app

**Conclusie:**  
❌ **OAuth kan NIET getest worden in Figma Make**

---

## ✅ **2. AUTO-PROVISIONING TESTEN: WEL MOGELIJK**

### Wat werkt WEL:

**Email/Password Signup:**
- ✅ Signup via backend `/auth/signup` route
- ✅ Auto-provisioning van workspace
- ✅ Login via backend `/auth/login` route
- ✅ Workspace fetch via `/workspaces`

**HOE:** Gebruik email/password signup (geen OAuth)

---

## 🔧 **3. BUG FIX: Database Error**

**Screenshot 2 laat zien:**
```
❌ ERROR | 500: Database error saving new user
```

**Oorzaak:**  
SQL trigger `on_auth_user_created` probeert workspace te maken, maar faalt omdat:
- Trigger heeft geen permission op `auth.users` schema
- Of workspace creation faalt

**Oplossing:**  
✅ Ik heb **backend signup route** toegevoegd die workspace aanmaakt:
- `POST /make-server-b9a572ea/auth/signup`
- User wordt aangemaakt
- Workspace wordt aangemaakt (met error handling)
- Membership + features worden aangemaakt

**Voordeel:**  
- Betere error handling
- Logs zichtbaar in Supabase
- Geen dependency op SQL triggers

---

## 📝 **4. HOE TE TESTEN:**

### Option A: Update Frontend Signup Component (Recommended)

**Update `/components/HH/Signup.tsx`:**

```typescript
import { projectId, publicAnonKey } from './utils/supabase/info';

const handleSignup = async (e: React.FormEvent) => {
  e.preventDefault();
  setLoading(true);
  setError(null);

  try {
    // Call backend signup route
    const response = await fetch(
      `https://${projectId}.supabase.co/functions/v1/make-server-b9a572ea/auth/signup`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${publicAnonKey}`
        },
        body: JSON.stringify({
          email: emailRef.current?.value,
          password: passwordRef.current?.value,
          firstName: firstNameRef.current?.value,
          lastName: lastNameRef.current?.value
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Signup failed');
    }

    console.log('✅ Signup success:', data);
    
    // Now login to get session
    const loginResponse = await fetch(
      `https://${projectId}.supabase.co/functions/v1/make-server-b9a572ea/auth/login`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${publicAnonKey}`
        },
        body: JSON.stringify({
          email: emailRef.current?.value,
          password: passwordRef.current?.value
        })
      }
    );

    const loginData = await loginResponse.json();

    if (!loginResponse.ok) {
      throw new Error(loginData.message || 'Login failed');
    }

    console.log('✅ Login success:', loginData);
    
    // Store session
    localStorage.setItem('access_token', loginData.session.access_token);
    localStorage.setItem('user', JSON.stringify(loginData.user));
    
    // Fetch workspaces
    const workspacesResponse = await fetch(
      `https://${projectId}.supabase.co/functions/v1/make-server-b9a572ea/workspaces`,
      {
        headers: {
          'Authorization': `Bearer ${loginData.session.access_token}`
        }
      }
    );

    const workspacesData = await workspacesResponse.json();
    console.log('✅ Workspaces:', workspacesData);
    
    // Store current workspace
    if (workspacesData.workspaces?.length > 0) {
      localStorage.setItem('workspace', JSON.stringify(workspacesData.workspaces[0]));
    }
    
    // Navigate to dashboard
    navigate('/dashboard');

  } catch (err: any) {
    console.error('❌ Signup error:', err);
    setError(err.message);
  } finally {
    setLoading(false);
  }
};
```

### Option B: Test via cURL (Quick Verification)

**1. Signup:**
```bash
curl -X POST \
  https://pckctmojjrrgzuufsqoo.supabase.co/functions/v1/make-server-b9a572ea/auth/signup \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" \
  -d '{
    "email": "test@hugoherbots.test",
    "password": "TestPassword123!",
    "firstName": "Test",
    "lastName": "User"
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "user": {
    "id": "uuid-here",
    "email": "test@hugoherbots.test"
  }
}
```

**2. Login:**
```bash
curl -X POST \
  https://pckctmojjrrgzuufsqoo.supabase.co/functions/v1/make-server-b9a572ea/auth/login \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" \
  -d '{
    "email": "test@hugoherbots.test",
    "password": "TestPassword123!"
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "session": { "access_token": "..." },
  "user": { ... }
}
```

**3. Fetch Workspaces:**
```bash
curl -X GET \
  https://pckctmojjrrgzuufsqoo.supabase.co/functions/v1/make-server-b9a572ea/workspaces \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN_HERE"
```

**Expected Response:**
```json
{
  "workspaces": [
    {
      "id": "uuid-here",
      "name": "Test's Workspace",
      "slug": "test-12345678",
      "plan_tier": "starter",
      "role": "owner"
    }
  ]
}
```

---

## 🔍 **5. VERIFY IN SUPABASE DASHBOARD:**

**After signup, check in SQL Editor:**

```sql
-- Check user created
SELECT id, email, created_at 
FROM auth.users 
WHERE email = 'test@hugoherbots.test';

-- Check workspace created
SELECT w.*, wm.role
FROM workspaces w
INNER JOIN workspace_memberships wm ON w.id = wm.workspace_id
WHERE wm.user_id = (
  SELECT id FROM auth.users WHERE email = 'test@hugoherbots.test'
);

-- Check features created
SELECT wf.*
FROM workspace_features wf
INNER JOIN workspaces w ON wf.workspace_id = w.id
INNER JOIN workspace_memberships wm ON w.id = wm.workspace_id
WHERE wm.user_id = (
  SELECT id FROM auth.users WHERE email = 'test@hugoherbots.test'
);
```

**Expected:**
- 1 user in `auth.users`
- 1 workspace in `workspaces`
- 1 membership in `workspace_memberships` (role = owner)
- 1 feature set in `workspace_features`

---

## 📊 **6. SUMMARY TABLE:**

| Feature | Figma Make | Local Dev | Production |
|---------|------------|-----------|------------|
| **Email/Password Signup** | ✅ YES | ✅ YES | ✅ YES |
| **Google OAuth** | ❌ NO | ✅ YES | ✅ YES |
| **Microsoft OAuth** | ❌ NO | ✅ YES | ✅ YES |
| **Auto-provisioning** | ✅ YES | ✅ YES | ✅ YES |
| **Workspace fetch** | ✅ YES | ✅ YES | ✅ YES |

---

## 🎯 **7. NEXT ACTIONS:**

**Voor testing in Figma Make:**
1. ✅ Use email/password signup (NIET OAuth)
2. ✅ Test via frontend component update
3. ✅ Verify workspace created in Supabase Dashboard
4. ✅ Check logs in Supabase → Logs & Analytics

**Voor OAuth testing:**
1. ⏸️ Setup local development environment
2. ⏸️ Or: Deploy to production with custom domain
3. ⏸️ Configure OAuth redirect URLs in Google/Microsoft console

---

## 💡 **8. RECOMMENDATION:**

**For MVP/Beta:**
- ✅ Use email/password signup ONLY
- ✅ Skip OAuth for now
- ✅ Add OAuth later when you have custom domain

**For Production:**
- ✅ Setup custom domain (hugoherbots.ai)
- ✅ Configure OAuth properly
- ✅ Add OAuth buttons back

---

**Questions?**
- `/PHASE_2_IMPLEMENTATION_GUIDE.md` - Full implementation guide
- `/PHASE_2_SUMMARY.md` - Architecture overview
- `/supabase/functions/server/index.tsx` - Signup/login routes

---

**Ready to test! 🚀**

Use email/password signup to test auto-provisioning in Figma Make.
