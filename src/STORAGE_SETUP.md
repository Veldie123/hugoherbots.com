# Supabase Storage Setup Guide

## ✅ Storage is nu geconfigureerd!

De server initialiseert automatisch de volgende buckets bij opstarten:

### 📦 Buckets

1. **`make-b9a572ea-avatars`**
   - User profile pictures
   - Max 5MB per file
   - Formats: JPG, PNG, WEBP, GIF

2. **`make-b9a572ea-scenarios`**
   - Custom scenario assets (audio, images, JSON)
   - Max 10MB per file
   - Formats: MP3, WAV, WEBM, JPG, PNG, JSON

3. **`make-b9a572ea-recordings`**
   - Session recordings (audio/video)
   - Max 10MB per file
   - Formats: MP3, WAV, WEBM, MP4

4. **`make-b9a572ea-resources`**
   - Team resources (PDFs, videos, images)
   - Max 10MB per file
   - Formats: PDF, JPG, PNG, MP4

---

## 🔒 RLS Policies (Row Level Security)

**IMPORTANT:** You need to manually configure RLS policies in the Supabase Dashboard.

### Steps to configure RLS:

1. Go to **Supabase Dashboard** → **Storage** → **Policies**
2. For **each bucket** above, create the following policies:

---

### Policy 1: Users can upload their own files

**Bucket:** `make-b9a572ea-avatars`, `make-b9a572ea-scenarios`, `make-b9a572ea-recordings`

**Policy name:** `Users can upload their own files`  
**Operation:** `INSERT`  
**Target roles:** `authenticated`

**USING expression:**
```sql
(bucket_id = 'make-b9a572ea-avatars'::text AND (storage.foldername(name))[1] = auth.uid()::text)
OR
(bucket_id = 'make-b9a572ea-scenarios'::text AND (storage.foldername(name))[1] = auth.uid()::text)
OR
(bucket_id = 'make-b9a572ea-recordings'::text AND (storage.foldername(name))[1] = auth.uid()::text)
```

**WITH CHECK expression:**
```sql
(bucket_id = 'make-b9a572ea-avatars'::text AND (storage.foldername(name))[1] = auth.uid()::text)
OR
(bucket_id = 'make-b9a572ea-scenarios'::text AND (storage.foldername(name))[1] = auth.uid()::text)
OR
(bucket_id = 'make-b9a572ea-recordings'::text AND (storage.foldername(name))[1] = auth.uid()::text)
```

---

### Policy 2: Users can read their own files

**Bucket:** `make-b9a572ea-avatars`, `make-b9a572ea-scenarios`, `make-b9a572ea-recordings`

**Policy name:** `Users can read their own files`  
**Operation:** `SELECT`  
**Target roles:** `authenticated`

**USING expression:**
```sql
(bucket_id = 'make-b9a572ea-avatars'::text AND (storage.foldername(name))[1] = auth.uid()::text)
OR
(bucket_id = 'make-b9a572ea-scenarios'::text AND (storage.foldername(name))[1] = auth.uid()::text)
OR
(bucket_id = 'make-b9a572ea-recordings'::text AND (storage.foldername(name))[1] = auth.uid()::text)
```

---

### Policy 3: Users can update their own files

**Bucket:** `make-b9a572ea-avatars`, `make-b9a572ea-scenarios`, `make-b9a572ea-recordings`

**Policy name:** `Users can update their own files`  
**Operation:** `UPDATE`  
**Target roles:** `authenticated`

**USING expression:**
```sql
(bucket_id = 'make-b9a572ea-avatars'::text AND (storage.foldername(name))[1] = auth.uid()::text)
OR
(bucket_id = 'make-b9a572ea-scenarios'::text AND (storage.foldername(name))[1] = auth.uid()::text)
OR
(bucket_id = 'make-b9a572ea-recordings'::text AND (storage.foldername(name))[1] = auth.uid()::text)
```

---

### Policy 4: Users can delete their own files

**Bucket:** `make-b9a572ea-avatars`, `make-b9a572ea-scenarios`, `make-b9a572ea-recordings`

**Policy name:** `Users can delete their own files`  
**Operation:** `DELETE`  
**Target roles:** `authenticated`

**USING expression:**
```sql
(bucket_id = 'make-b9a572ea-avatars'::text AND (storage.foldername(name))[1] = auth.uid()::text)
OR
(bucket_id = 'make-b9a572ea-scenarios'::text AND (storage.foldername(name))[1] = auth.uid()::text)
OR
(bucket_id = 'make-b9a572ea-recordings'::text AND (storage.foldername(name))[1] = auth.uid()::text)
```

---

### Policy 5: Team members can read shared resources

**Bucket:** `make-b9a572ea-resources`

**Policy name:** `Authenticated users can read resources`  
**Operation:** `SELECT`  
**Target roles:** `authenticated`

**USING expression:**
```sql
bucket_id = 'make-b9a572ea-resources'::text
```

**Note:** For now, all authenticated users can read resources. Later, you can restrict this to team members only.

---

## 🧪 Testing Storage

After configuring RLS policies, you can test storage with the following:

### Test 1: Upload Avatar

```typescript
import { uploadAvatar } from './utils/storage';

// In a component with auth context
const handleUpload = async (file: File) => {
  const result = await uploadAvatar(file, accessToken);
  
  if ('error' in result) {
    console.error('Upload failed:', result.error);
  } else {
    console.log('Avatar URL:', result.avatarUrl);
  }
};
```

### Test 2: Get Avatar URL

```typescript
import { getAvatarUrl } from './utils/storage';

const avatarUrl = await getAvatarUrl(accessToken);
console.log('Current avatar:', avatarUrl);
```

---

## 📋 Checklist

- [ ] Server starts successfully and initializes buckets
- [ ] All 4 buckets are created in Supabase Dashboard
- [ ] RLS policies are configured for each bucket
- [ ] Test avatar upload from Settings page
- [ ] Test scenario asset upload from Builder page
- [ ] Verify signed URLs expire after 1 hour

---

## 🐛 Troubleshooting

### Server fails to create buckets

**Error:** `Bucket already exists`  
**Solution:** This is expected on subsequent starts. The server checks if buckets exist before creating.

### Upload fails with "Unauthorized"

**Error:** `401 Unauthorized`  
**Solution:** Check that:
1. User is authenticated and has valid access token
2. RLS policies are configured correctly
3. File path follows pattern: `{userId}/{scenarioId}/{fileName}`

### Cannot read files

**Error:** `403 Forbidden`  
**Solution:** 
1. Check RLS policies allow SELECT operation
2. Verify user is trying to read their own files
3. Use signed URLs for private buckets (already implemented in server)

### File upload too slow

**Solution:** File size limits:
- Avatars: 5MB max
- Scenarios/Recordings: 10MB max
- Consider compressing images before upload

---

## 🚀 Next Steps

1. **Auth integration:** Test with real user signup/login
2. **Frontend usage:** Integrate `AvatarUpload` component in Settings page
3. **Scenario Builder:** Add file upload for custom scenario assets
4. **Recordings:** Implement session recording storage
5. **Team resources:** Add team resource library with file sharing

---

## 📝 Notes

- All buckets are **private** by default
- Signed URLs expire after **1 hour** (configurable)
- File uploads are validated on server (type, size)
- Storage uses **user ID** for file organization
- Server uses **SERVICE_ROLE_KEY** for admin operations
- Frontend uses **ANON_KEY** + **access token** for user operations
