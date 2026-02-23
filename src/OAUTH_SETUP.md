# 🔐 OAuth Setup Guide - Google & Microsoft

## Overzicht

Je Login en Signup pagina's hebben al **Google** en **Microsoft** login buttons. Nu moet je OAuth configureren in Supabase + bij de providers.

---

## 🔵 Google OAuth Setup

### **Stap 1: Google Cloud Console**

1. Ga naar **[Google Cloud Console](https://console.cloud.google.com/)**
2. Maak een nieuw project aan (of selecteer bestaand project)
3. Ga naar **APIs & Services** → **Credentials**
4. Klik **Create Credentials** → **OAuth 2.0 Client ID**

### **Stap 2: Configure OAuth Consent Screen**

Als je dit nog niet hebt gedaan:

1. Klik **Configure Consent Screen**
2. Kies **External** (voor publieke app)
3. Vul in:
   - **App name:** HugoHerbots.ai
   - **User support email:** jouw email
   - **App logo:** (optioneel) Hugo logo
   - **App domain:** jouw productie domain
   - **Developer contact:** jouw email
4. Klik **Save and Continue**
5. **Scopes:** Voeg toe:
   - `.../auth/userinfo.email`
   - `.../auth/userinfo.profile`
6. **Test users:** (optioneel in development)
7. Klik **Save and Continue**

### **Stap 3: Create OAuth Client ID**

1. **Application type:** Web application
2. **Name:** HugoHerbots.ai Web Client
3. **Authorized JavaScript origins:**
   ```
   https://YOUR_PROJECT_REF.supabase.co
   http://localhost:5173
   ```
4. **Authorized redirect URIs:**
   ```
   https://YOUR_PROJECT_REF.supabase.co/auth/v1/callback
   ```
   
   ⚠️ **Vervang `YOUR_PROJECT_REF`** met je Supabase project reference!
   
   **Waar vind je dit?**
   - Ga naar Supabase Dashboard
   - Project Settings → General  
   - Kopieer de **Reference ID**
   - URL format: `https://[reference-id].supabase.co`
   
   **Voorbeeld:**
   - Als je Reference ID is `abcdefgh`
   - Dan is de redirect URI: `https://abcdefgh.supabase.co/auth/v1/callback`

5. Klik **Create**
6. **Kopieer en bewaar:**
   - ✅ **Client ID**
   - ✅ **Client Secret**

---

### **Stap 4: Supabase Dashboard - Google OAuth**

1. Ga naar **[Supabase Dashboard](https://supabase.com/dashboard)**
2. Selecteer je project
3. Ga naar **Authentication** → **Providers**
4. Scroll naar **Google**
5. Toggle **Enable** aan
6. Vul in:
   - **Client ID:** (paste van Google Cloud Console)
   - **Client Secret:** (paste van Google Cloud Console)
7. Klik **Save**

✅ **Google OAuth is nu actief!**

---

## 🔷 Microsoft OAuth Setup

### **Stap 1: Azure Portal**

1. Ga naar **[Azure Portal](https://portal.azure.com/)**
2. Zoek naar **Azure Active Directory** (of **Microsoft Entra ID**)
3. Ga naar **App registrations**
4. Klik **New registration**

### **Stap 2: Register Application**

1. **Name:** HugoHerbots.ai
2. **Supported account types:** 
   - Kies **Accounts in any organizational directory and personal Microsoft accounts**
   - (Dit geeft meeste flexibiliteit - B2B + B2C)
3. **Redirect URI:**
   - Type: **Web**
   - URL: `https://YOUR_PROJECT_REF.supabase.co/auth/v1/callback`
   
   ⚠️ **Vervang `YOUR_PROJECT_REF`** met je Supabase project reference!

4. Klik **Register**

### **Stap 3: Get Application (client) ID**

1. Na registratie zie je **Overview** pagina
2. **Kopieer en bewaar:**
   - ✅ **Application (client) ID**
   - ✅ **Directory (tenant) ID**

### **Stap 4: Create Client Secret**

1. Ga naar **Certificates & secrets** (in sidebar)
2. Klik **New client secret**
3. **Description:** Supabase Auth
4. **Expires:** 24 months (of Custom voor longer)
5. Klik **Add**
6. **Kopieer DIRECT de Secret Value!** (je kunt dit maar 1x zien)
   - ✅ **Secret Value**

### **Stap 5: Configure Redirect URIs**

1. Ga naar **Authentication** (in sidebar)
2. Onder **Platform configurations** → **Web**
3. Voeg toe:
   ```
   https://YOUR_PROJECT_REF.supabase.co/auth/v1/callback
   http://localhost:5173/auth/v1/callback
   ```
4. Onder **Advanced settings**:
   - ✅ Enable **ID tokens** (for implicit and hybrid flows)
   - ✅ Enable **Access tokens** (for implicit and hybrid flows)
5. Klik **Save**

### **Stap 6: API Permissions**

1. Ga naar **API permissions** (in sidebar)
2. Klik **Add a permission**
3. Kies **Microsoft Graph**
4. Kies **Delegated permissions**
5. Voeg toe:
   - ✅ `email`
   - ✅ `openid`
   - ✅ `profile`
   - ✅ `User.Read`
6. Klik **Add permissions**
7. Klik **Grant admin consent** (als je admin bent)

---

### **Stap 7: Supabase Dashboard - Microsoft OAuth**

1. Ga naar **[Supabase Dashboard](https://supabase.com/dashboard)**
2. Selecteer je project
3. Ga naar **Authentication** → **Providers**
4. Scroll naar **Azure (Microsoft)**
5. Toggle **Enable** aan
6. Vul in:
   - **Client ID:** (Application ID van Azure)
   - **Client Secret:** (Secret Value van Azure)
   - **Azure Tenant:** 
     - Voor personal + work accounts: `common`
     - Voor specific tenant: gebruik **Directory (tenant) ID**
7. Klik **Save**

✅ **Microsoft OAuth is nu actief!**

---

## 🧪 Testing OAuth

### **Test Google Login**

1. Ga naar je Login pagina
2. Klik op **Google** button
3. Je wordt doorgestuurd naar Google login
4. Login met Google account
5. Je wordt teruggestuurd naar je app (met access token)
6. Check browser console voor session:
   ```javascript
   const { data: { session } } = await supabase.auth.getSession();
   console.log('User:', session?.user);
   ```

### **Test Microsoft Login**

1. Ga naar je Login pagina
2. Klik op **Microsoft** button
3. Je wordt doorgestuurd naar Microsoft login
4. Login met Microsoft account (work/school of personal)
5. Je wordt teruggestuurd naar je app
6. Check session zoals hierboven

---

## 🐛 Troubleshooting

### **Error: "redirect_uri_mismatch"**

**Probleem:** Redirect URI komt niet overeen

**Oplossing:**
1. Check exact de URL in Google/Azure console
2. Moet zijn: `https://YOUR_REF.supabase.co/auth/v1/callback`
3. Geen trailing slash `/`
4. HTTPS in productie, HTTP in development OK

### **Error: "invalid_client"**

**Probleem:** Client ID of Secret is verkeerd

**Oplossing:**
1. Check Client ID in Supabase matches Google/Azure
2. Regenerate Client Secret als nodig
3. Update in Supabase Dashboard

### **Error: "consent_required"**

**Probleem:** User heeft toestemming niet gegeven

**Oplossing:**
1. Check scopes in Google/Azure
2. Voor Microsoft: Grant admin consent in API permissions
3. User moet permissions accepteren bij eerste login

### **Error: "Access blocked: app not verified"**

**Probleem:** Google app nog in development mode

**Oplossing:**
1. Voor development: Voeg test users toe in Google Console
2. Voor productie: Verifieer je app (verification process)
3. Of: Blijf in testing mode (max 100 users)

### **Login succeeds maar user niet aangemaakt**

**Probleem:** Auto-confirm mogelijk uit

**Oplossing:**
1. Ga naar Supabase → Authentication → Settings
2. Onder **Auth Providers**:
   - ✅ Enable **Auto Confirm Email** voor OAuth users
3. Save changes

---

## 📋 Quick Reference

### **Google Cloud Console URLs**
- Console: https://console.cloud.google.com/
- Credentials: https://console.cloud.google.com/apis/credentials
- OAuth consent screen: https://console.cloud.google.com/apis/credentials/consent

### **Azure Portal URLs**
- Portal: https://portal.azure.com/
- App registrations: https://portal.azure.com/#blade/Microsoft_AAD_IAM/ActiveDirectoryMenuBlade/RegisteredApps

### **Supabase Redirect URL Format**
```
https://[YOUR_PROJECT_REF].supabase.co/auth/v1/callback
```

**Vind je Project Reference:**
- Supabase Dashboard → Settings → General → Reference ID

---

## ✅ Checklist

### Google OAuth
- [ ] Google Cloud project aangemaakt
- [ ] OAuth consent screen geconfigureerd
- [ ] OAuth Client ID created
- [ ] Redirect URIs toegevoegd
- [ ] Client ID & Secret gekopieerd
- [ ] Supabase Google provider enabled
- [ ] Client ID & Secret in Supabase geplaatst
- [ ] Test login succeeds

### Microsoft OAuth
- [ ] Azure app registration aangemaakt
- [ ] Redirect URIs geconfigureerd
- [ ] Client Secret gegenereerd
- [ ] API permissions toegevoegd
- [ ] Admin consent granted (if needed)
- [ ] Client ID & Secret gekopieerd
- [ ] Supabase Azure provider enabled
- [ ] Tenant set to "common"
- [ ] Test login succeeds

---

## 🔒 Security Notes

### **Productie Checklist**
- [ ] Remove `localhost` redirect URIs in productie
- [ ] Use environment variables voor secrets (NEVER commit)
- [ ] Set restrictive CORS policies
- [ ] Enable email verification voor nieuwe accounts
- [ ] Monitor authentication logs

### **Development Tips**
- Voor development: Test users voldoende
- Voor staging: Aparte OAuth app credentials
- Voor productie: Production credentials + verified app

---

## 🚀 Next Steps

Na OAuth configuratie:

1. **Test beide providers** (Google + Microsoft)
2. **Check user creation** in Supabase Auth → Users
3. **Implement logout** flow (already in Login component)
4. **Handle OAuth errors** gracefully in UI
5. **Add user profile sync** (save OAuth profile data)

---

## 📝 Code Example - Frontend

Je hebt dit al in Login.tsx en Signup.tsx, maar hier is de flow:

```typescript
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Google login
async function signInWithGoogle() {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${window.location.origin}/dashboard`,
      queryParams: {
        access_type: 'offline',
        prompt: 'consent',
      }
    }
  });
  
  if (error) console.error('Google login failed:', error);
}

// Microsoft login
async function signInWithMicrosoft() {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'azure',
    options: {
      redirectTo: `${window.location.origin}/dashboard`,
      scopes: 'email profile openid'
    }
  });
  
  if (error) console.error('Microsoft login failed:', error);
}

// Check session after redirect
useEffect(() => {
  const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_IN') {
      console.log('User signed in:', session?.user);
      navigate('dashboard');
    }
  });

  return () => subscription.unsubscribe();
}, []);
```

---

**Klaar om te configureren?** Start met **Google** (makkelijkst) en daarna **Microsoft**! 🚀

**Vragen?** Check de troubleshooting sectie of laat het me weten! 💪