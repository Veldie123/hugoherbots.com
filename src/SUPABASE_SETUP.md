# Supabase Setup Guide - HugoHerbots.ai
## Fase 1 (Auth) + Fase 2 (Storage) Implementatie

Deze guide helpt je om Supabase Auth en Storage te configureren voor HugoHerbots.ai.

**BELANGRIJK**: Figma Make heeft al een Supabase project aangemaakt en geconfigureerd!
- Project URL: `https://pckctmojjrrgzuufsqoo.supabase.co`
- Credentials worden automatisch beheerd in `/utils/supabase/info.tsx`
- Je hoeft geen `.env` file aan te maken voor Supabase credentials

---

## 1. Supabase Project Aanmaken

✅ **AL GEDAAN** - Figma Make heeft al een Supabase project voor je aangemaakt:
- **Project ID**: `pckctmojjrrgzuufsqoo`
- **Project URL**: `https://pckctmojjrrgzuufsqoo.supabase.co`

Je kunt dit project beheren via [https://supabase.com/dashboard](https://supabase.com/dashboard)

---

## 2. API Keys Ophalen

✅ **AL GEDAAN** - De anon key staat al in `/utils/supabase/info.tsx`

Als je de **Service Role Key** nodig hebt (voor backend):
1. Ga naar [Supabase Dashboard](https://supabase.com/dashboard/project/pckctmojjrrgzuufsqoo)
2. Ga naar **Settings** > **API**
3. Kopieer de **service_role key** (SECRET - gebruik alleen in backend!)

---

## 3. Environment Variables Instellen

Voor Supabase credentials: **NIET NODIG** - deze worden automatisch ingelezen.

Voor andere API's (OpenAI, HeyGen) kun je later environment variables toevoegen voor de Express backend.

---

## 4. Auth Providers Configureren

### Email/Password Auth (standaard enabled)
Deze is al actief - geen extra configuratie nodig!

### Google OAuth (optioneel maar aangeraden)

1. In Supabase: **Authentication** > **Providers** > **Google**
2. Volg de instructies op [Supabase Docs - Google Auth](https://supabase.com/docs/guides/auth/social-login/auth-google)
3. Samenvatting:
   - Ga naar [Google Cloud Console](https://console.cloud.google.com/)
   - Maak een nieuw project of selecteer bestaand
   - Ga naar **APIs & Services** > **Credentials**
   - Klik **Create Credentials** > **OAuth client ID**
   - Application type: **Web application**
   - **Authorized redirect URIs**: `https://xxxxx.supabase.co/auth/v1/callback` (vervang xxxxx met jouw project ID)
   - Kopieer **Client ID** en **Client secret**
   - Plak deze in Supabase Provider settings
   - **Enable provider**

### Microsoft OAuth (optioneel)

1. In Supabase: **Authentication** > **Providers** > **Azure (Microsoft)**
2. Volg de instructies op [Supabase Docs - Microsoft Auth](https://supabase.com/docs/guides/auth/social-login/auth-azure)
3. Samenvatting:
   - Ga naar [Azure Portal](https://portal.azure.com/)
   - Ga naar **App registrations** > **New registration**
   - Name: `HugoHerbots.ai`
   - Supported account types: **Accounts in any organizational directory and personal Microsoft accounts**
   - Redirect URI: Web, `https://xxxxx.supabase.co/auth/v1/callback`
   - Copy **Application (client) ID**
   - Ga naar **Certificates & secrets** > **New client secret**
   - Copy **Secret value**
   - Plak deze in Supabase Provider settings
   - **Enable provider**

---

## 5. Storage Buckets Aanmaken

1. In Supabase: ga naar **Storage**
2. Klik op **Create a new bucket**

### Bucket 1: `avatars` (PUBLIC)
   - **Name**: `avatars`
   - **Public bucket**: ✅ **Enabled**
   - **File size limit**: `2 MB`
   - **Allowed MIME types**: `image/jpeg, image/png`
   - Klik **Create bucket**

### Bucket 2: `audio-uploads` (PRIVATE)
   - **Name**: `audio-uploads`
   - **Public bucket**: ❌ **Disabled**
   - **File size limit**: `10 MB`
   - **Allowed MIME types**: `audio/webm, audio/wav, audio/mp3`
   - Klik **Create bucket**

### Bucket 3: `session-transcripts` (PRIVATE)
   - **Name**: `session-transcripts`
   - **Public bucket**: ❌ **Disabled**
   - **File size limit**: `5 MB`
   - **Allowed MIME types**: `application/json`
   - Klik **Create bucket**

### Bucket 4: `resources` (PRIVATE)
   - **Name**: `resources`
   - **Public bucket**: ❌ **Disabled**
   - **File size limit**: `50 MB`
   - **Allowed MIME types**: `application/pdf, video/mp4, application/vnd.ms-excel, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`
   - Klik **Create bucket**

---

## 6. Storage Policies (RLS) Instellen

Ga naar **Storage** > klik op een bucket > **Policies** tab > **New Policy**.

### Voor `avatars` bucket:

**Policy 1: Public Read Access**
```sql
-- Name: Public avatars are viewable
-- Operation: SELECT
-- Target roles: public

CREATE POLICY "Public avatars are viewable"
ON storage.objects FOR SELECT
USING (bucket_id = 'avatars');
```

**Policy 2: Authenticated Upload**
```sql
-- Name: Users can upload own avatars
-- Operation: INSERT
-- Target roles: authenticated

CREATE POLICY "Users can upload own avatars"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'avatars');
```

**Policy 3: Update Own Avatar**
```sql
-- Name: Users can update own avatars
-- Operation: UPDATE
-- Target roles: authenticated

CREATE POLICY "Users can update own avatars"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
```

### Voor `audio-uploads` bucket:

**Policy 1: Users can manage own audio**
```sql
-- Name: Users can manage own audio
-- Operation: ALL
-- Target roles: authenticated

CREATE POLICY "Users can manage own audio"
ON storage.objects FOR ALL
TO authenticated
USING (bucket_id = 'audio-uploads' AND (storage.foldername(name))[1] = auth.uid()::text);
```

### Voor `session-transcripts` bucket:

**Policy 1: Users can view own transcripts**
```sql
-- Name: Users can view own transcripts
-- Operation: SELECT
-- Target roles: authenticated

CREATE POLICY "Users can view own transcripts"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'session-transcripts' AND (storage.foldername(name))[1] = auth.uid()::text);
```

**Policy 2: Users can upload own transcripts**
```sql
-- Name: Users can upload own transcripts
-- Operation: INSERT
-- Target roles: authenticated

CREATE POLICY "Users can upload own transcripts"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'session-transcripts' AND (storage.foldername(name))[1] = auth.uid()::text);
```

### Voor `resources` bucket:

**Policy 1: Authenticated users can view resources**
```sql
-- Name: Auth users can view resources
-- Operation: SELECT
-- Target roles: authenticated

CREATE POLICY "Auth users can view resources"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'resources');
```

**Policy 2: Only admins can upload resources** (implementeer later met role check)
```sql
-- Name: Admins can upload resources
-- Operation: INSERT
-- Target roles: authenticated

CREATE POLICY "Admins can upload resources"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'resources'
  -- TODO: Add admin role check when profiles table exists
);
```

---

## 7. Email Templates Configureren (optioneel)

1. Ga naar **Authentication** > **Email Templates**
2. Pas de templates aan met HugoHerbots branding:

### Confirm signup template:
```html
<h2>Welkom bij HugoHerbots.ai!</h2>
<p>Bevestig je email om te beginnen met trainen:</p>
<p><a href="{{ .ConfirmationURL }}">Bevestig je email</a></p>
<p>Als je dit account niet hebt aangemaakt, kun je deze email negeren.</p>
```

### Reset password template:
```html
<h2>Wachtwoord resetten</h2>
<p>Je hebt een wachtwoord reset aangevraagd voor je HugoHerbots.ai account.</p>
<p><a href="{{ .ConfirmationURL }}">Reset je wachtwoord</a></p>
<p>Als je dit niet hebt aangevraagd, kun je deze email negeren.</p>
```

---

## 8. Test de Setup

### Test Auth:
1. Start je development server: `npm run dev`
2. Ga naar de Signup page
3. Maak een test account aan met email/password
4. Check Supabase Dashboard > **Authentication** > **Users** - je zou de nieuwe user moeten zien
5. Test Login met dezelfde credentials
6. Test Social login (Google/Microsoft) als je die hebt geconfigureerd

### Test Storage:
1. Log in met een test account
2. Ga naar Settings page
3. Klik "Upload foto" en selecteer een avatar (JPG/PNG, max 2MB)
4. Check Supabase Dashboard > **Storage** > `avatars` - je zou de geüploade file moeten zien
5. Check de console logs voor success/error messages

---

## 9. Security Best Practices

### ✅ DO:
- Bewaar `.env` NOOIT in git (check `.gitignore`)
- Gebruik **anon key** in de frontend (deze is safe)
- Gebruik **service role key** ALLEEN in backend/server code
- Enable RLS (Row Level Security) op alle buckets
- Test policies grondig voor production deploy

### ❌ DON'T:
- Commit je `.env` file
- Gebruik service role key in de frontend
- Disable RLS in production
- Deel je database password publiekelijk

---

## 10. Troubleshooting

### "Invalid API key" error:
- Check of `VITE_SUPABASE_URL` en `VITE_SUPABASE_ANON_KEY` correct zijn ingevuld in `.env`
- Herstart je dev server na het aanpassen van `.env`

### "User not found" bij login:
- Check of de user bestaat in Supabase Dashboard > Authentication > Users
- Check of email confirmation is vereist (standaard staat dit AAN)

### "Access denied" bij file upload:
- Check of je bent ingelogd (auth token aanwezig)
- Check of de RLS policies correct zijn ingesteld
- Check browser console voor detailed error messages

### Social login redirect errors:
- Check of de redirect URI in Google/Microsoft console exact overeenkomt
- Format: `https://xxxxx.supabase.co/auth/v1/callback`
- Zorg dat HTTPS gebruikt wordt (niet HTTP)

---

## Volgende Stappen

Na het voltooien van deze setup:
1. ✅ Auth werkt (email/password + social login)
2. ✅ Storage werkt (avatar uploads)
3. ⏭️ **Volgende**: Fase 3 - Postgres Database setup (profiles, sessions, scenarios)
4. ⏭️ Fase 4 - Vector Search (pgvector)
5. ⏭️ Fase 5 - Express Server + API integraties

---

## Need Help?

- [Supabase Docs - Authentication](https://supabase.com/docs/guides/auth)
- [Supabase Docs - Storage](https://supabase.com/docs/guides/storage)
- [Supabase Discord](https://discord.supabase.com/)

Happy coding! 🚀