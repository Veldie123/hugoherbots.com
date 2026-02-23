# 🔒 RLS Policies Toepassen - Working Solutions

**Probleem:** SQL Editor heeft geen permissies voor `storage.objects`

**Oplossingen (van makkelijk naar complex):**

---

## ✅ **OPLOSSING 1: Via Supabase Dashboard UI** (RECOMMENDED)

Dit is de **makkelijkste** manier, maar je moet elke policy handmatig maken.

### **Stap 1: Open Storage Policies**
1. Supabase Dashboard → **Storage** (linker sidebar)
2. Klik op tab **"Policies"** (bovenaan)

### **Stap 2: Klik "New Policy"**

Voor **elke policy hieronder**, doe:
1. Klik "New Policy"
2. Kies "Create a policy from scratch"
3. Vul de velden in (zie hieronder)
4. Klik "Save policy"

---

### **📋 AVATARS BUCKET - 4 Policies**

#### **Policy 1: Upload Own Avatar**
```
Policy name: Users can upload their own avatar
Allowed operation: INSERT
Policy definition: 
  WITH CHECK: bucket_id = 'make-b9a572ea-avatars' AND auth.uid()::text = (storage.foldername(name))[1]
Target roles: authenticated
```

#### **Policy 2: Update Own Avatar**
```
Policy name: Users can update their own avatar
Allowed operation: UPDATE
Policy definition:
  USING: bucket_id = 'make-b9a572ea-avatars' AND auth.uid()::text = (storage.foldername(name))[1]
Target roles: authenticated
```

#### **Policy 3: Delete Own Avatar**
```
Policy name: Users can delete their own avatar
Allowed operation: DELETE
Policy definition:
  USING: bucket_id = 'make-b9a572ea-avatars' AND auth.uid()::text = (storage.foldername(name))[1]
Target roles: authenticated
```

#### **Policy 4: Read Any Avatar**
```
Policy name: Users can read any avatar
Allowed operation: SELECT
Policy definition:
  USING: bucket_id = 'make-b9a572ea-avatars'
Target roles: authenticated
```

---

### **📋 SCENARIOS BUCKET - 4 Policies**

#### **Policy 5: Upload Own Scenarios**
```
Policy name: Users can upload their own scenarios
Allowed operation: INSERT
Policy definition:
  WITH CHECK: bucket_id = 'make-b9a572ea-scenarios' AND auth.uid()::text = (storage.foldername(name))[1]
Target roles: authenticated
```

#### **Policy 6: Read Own Scenarios**
```
Policy name: Users can read their own scenarios
Allowed operation: SELECT
Policy definition:
  USING: bucket_id = 'make-b9a572ea-scenarios' AND auth.uid()::text = (storage.foldername(name))[1]
Target roles: authenticated
```

#### **Policy 7: Update Own Scenarios**
```
Policy name: Users can update their own scenarios
Allowed operation: UPDATE
Policy definition:
  USING: bucket_id = 'make-b9a572ea-scenarios' AND auth.uid()::text = (storage.foldername(name))[1]
Target roles: authenticated
```

#### **Policy 8: Delete Own Scenarios**
```
Policy name: Users can delete their own scenarios
Allowed operation: DELETE
Policy definition:
  USING: bucket_id = 'make-b9a572ea-scenarios' AND auth.uid()::text = (storage.foldername(name))[1]
Target roles: authenticated
```

---

### **📋 RECORDINGS BUCKET - 3 Policies**

#### **Policy 9: Upload Own Recordings**
```
Policy name: Users can upload their own recordings
Allowed operation: INSERT
Policy definition:
  WITH CHECK: bucket_id = 'make-b9a572ea-recordings' AND auth.uid()::text = (storage.foldername(name))[1]
Target roles: authenticated
```

#### **Policy 10: Read Own Recordings**
```
Policy name: Users can read their own recordings
Allowed operation: SELECT
Policy definition:
  USING: bucket_id = 'make-b9a572ea-recordings' AND auth.uid()::text = (storage.foldername(name))[1]
Target roles: authenticated
```

#### **Policy 11: Delete Own Recordings**
```
Policy name: Users can delete their own recordings
Allowed operation: DELETE
Policy definition:
  USING: bucket_id = 'make-b9a572ea-recordings' AND auth.uid()::text = (storage.foldername(name))[1]
Target roles: authenticated
```

---

### **📋 RESOURCES BUCKET - 4 Policies**

#### **Policy 12: Upload Own Resources**
```
Policy name: Users can upload their own resources
Allowed operation: INSERT
Policy definition:
  WITH CHECK: bucket_id = 'make-b9a572ea-resources' AND auth.uid()::text = (storage.foldername(name))[1]
Target roles: authenticated
```

#### **Policy 13: Read Own Resources**
```
Policy name: Users can read their own resources
Allowed operation: SELECT
Policy definition:
  USING: bucket_id = 'make-b9a572ea-resources' AND auth.uid()::text = (storage.foldername(name))[1]
Target roles: authenticated
```

#### **Policy 14: Update Own Resources**
```
Policy name: Users can update their own resources
Allowed operation: UPDATE
Policy definition:
  USING: bucket_id = 'make-b9a572ea-resources' AND auth.uid()::text = (storage.foldername(name))[1]
Target roles: authenticated
```

#### **Policy 15: Delete Own Resources**
```
Policy name: Users can delete their own resources
Allowed operation: DELETE
Policy definition:
  USING: bucket_id = 'make-b9a572ea-resources' AND auth.uid()::text = (storage.foldername(name))[1]
Target roles: authenticated
```

---

## ✅ **VERIFICATIE**

Na het toevoegen van alle 15 policies:

1. Ga naar **Storage** → **Policies**
2. Je zou **15 policies** moeten zien
3. Run deze SQL query om te verifiëren:

```sql
SELECT COUNT(*) 
FROM pg_policies 
WHERE schemaname = 'storage' 
  AND tablename = 'objects'
  AND policyname LIKE '%avatar%' 
   OR policyname LIKE '%scenario%'
   OR policyname LIKE '%recording%'
   OR policyname LIKE '%resource%';
```

**Expected: 15 rows**

---

## 🚀 **SNELLERE OPLOSSING: Simplified Policies**

Als je wilt sneller gaan, kun je **bucket-level policies** maken in plaats van per-operatie:

### **Storage → Policies → New Policy → Use Template**

Supabase heeft templates! Probeer:

1. Klik "New Policy"
2. Kies **"Enable access to a folder for specific users"**
3. Customize voor jouw buckets

Maar dit is minder granulaire controle.

---

## 💡 **ALTERNATIEF: Ask Supabase Support**

Als Owner van het project kun je Supabase support vragen om:

1. RLS policies te applyen via hun admin panel
2. Of: Je "superuser" rechten geven in SQL Editor

**Email:** support@supabase.io
**Subject:** "Need help applying storage RLS policies"

---

## 🎯 **RECOMMENDED PATH**

**Voor nu:**
1. ✅ Maak policies via Dashboard UI (15x "New Policy")
2. ✅ Kopieer exact de definities hierboven
3. ✅ Verify met SQL query
4. ✅ Test met twee users

**Total time:** 20-30 minuten (klikkertje werk)

**Voor later (Phase 5):**
- Gebruik Supabase CLI migrations voor dev/staging/prod
- Automate policy creation

---

## 🤝 **Wil je dat ik het voor je doe?**

**Optie A: Ik maak een video walkthrough**
- Ik guide je stap-voor-stap
- Screen recording van exact wat te klikken

**Optie B: Shared screen session**
- Als je TeamViewer / Zoom hebt
- Ik klik ze voor je aan

**Optie C: Bootstrap script voor later**
- Maak 1-2 policies handmatig
- Dan script voor rest (via Supabase Management API)

**Wat werkt voor jou? 🚀**

Ik kan ook gewoon de exacte klik-volgorde geven als je het zelf wilt doen (20 min werk).
