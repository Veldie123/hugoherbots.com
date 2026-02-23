# 🧪 Storage Testing Guide

## Quick Test Checklist

### 1️⃣ Check Server Logs
Open your browser console and check for these messages:

```
🚀 Server starting...
🗄️ Initializing storage buckets...
✓ Bucket exists: make-b9a572ea-avatars
✓ Bucket exists: make-b9a572ea-scenarios
✓ Bucket exists: make-b9a572ea-recordings
✓ Bucket exists: make-b9a572ea-resources
✅ All storage buckets initialized
✅ Server initialized
```

**OR** if buckets don't exist yet:

```
🗄️ Initializing storage buckets...
📦 Creating bucket: make-b9a572ea-avatars
✅ Created bucket: make-b9a572ea-avatars
📦 Creating bucket: make-b9a572ea-scenarios
✅ Created bucket: make-b9a572ea-scenarios
... etc
```

---

### 2️⃣ Verify Buckets in Supabase Dashboard

1. Go to https://supabase.com/dashboard
2. Select your project
3. Click **Storage** in sidebar
4. You should see 4 buckets:
   - ✅ `make-b9a572ea-avatars`
   - ✅ `make-b9a572ea-scenarios`
   - ✅ `make-b9a572ea-recordings`
   - ✅ `make-b9a572ea-resources`

---

### 3️⃣ Test Health Endpoint

Open browser console and run:

```javascript
fetch('https://YOUR_PROJECT_ID.supabase.co/functions/v1/make-server-b9a572ea/health')
  .then(r => r.json())
  .then(console.log);
// Expected: { status: "ok" }
```

---

### 4️⃣ Test Avatar Upload (with Auth)

**Prerequisites:** You need to be signed in and have an access token.

```javascript
// 1. Get your access token
const accessToken = 'YOUR_ACCESS_TOKEN'; // From signup/login

// 2. Create a test file
const testImage = new File(
  [new Blob(['fake image data'])], 
  'test-avatar.jpg', 
  { type: 'image/jpeg' }
);

// 3. Upload avatar
const formData = new FormData();
formData.append('file', testImage);

fetch('https://YOUR_PROJECT_ID.supabase.co/functions/v1/make-server-b9a572ea/storage/avatar', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${accessToken}`
  },
  body: formData
})
  .then(r => r.json())
  .then(console.log);
// Expected: { success: true, avatarUrl: "https://..." }
```

---

### 5️⃣ Test Get Avatar URL

```javascript
fetch('https://YOUR_PROJECT_ID.supabase.co/functions/v1/make-server-b9a572ea/storage/avatar', {
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${accessToken}`
  }
})
  .then(r => r.json())
  .then(console.log);
// Expected: { avatarUrl: "https://..." } or { avatarUrl: null }
```

---

### 6️⃣ Test Upload without Auth (Should Fail)

```javascript
fetch('https://YOUR_PROJECT_ID.supabase.co/functions/v1/make-server-b9a572ea/storage/avatar', {
  method: 'POST',
  body: new FormData()
})
  .then(r => r.json())
  .then(console.log);
// Expected: { error: "No authorization header" }
```

---

### 7️⃣ Test File Size Limit (Should Fail)

```javascript
// Create a 6MB file (over 5MB limit)
const largeFile = new File(
  [new Blob([new Uint8Array(6 * 1024 * 1024)])], 
  'large.jpg', 
  { type: 'image/jpeg' }
);

const formData = new FormData();
formData.append('file', largeFile);

fetch('https://YOUR_PROJECT_ID.supabase.co/functions/v1/make-server-b9a572ea/storage/avatar', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${accessToken}`
  },
  body: formData
})
  .then(r => r.json())
  .then(console.log);
// Expected: { error: "File too large (max 5MB)" }
```

---

### 8️⃣ Test Wrong File Type (Should Fail)

```javascript
const pdfFile = new File(
  [new Blob(['fake pdf'])], 
  'doc.pdf', 
  { type: 'application/pdf' }
);

const formData = new FormData();
formData.append('file', pdfFile);

fetch('https://YOUR_PROJECT_ID.supabase.co/functions/v1/make-server-b9a572ea/storage/avatar', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${accessToken}`
  },
  body: formData
})
  .then(r => r.json())
  .then(console.log);
// Expected: { error: "Only image files allowed" }
```

---

## 🎨 Visual Test in App

### Test Avatar Upload Component

Add this to your Settings page temporarily:

```typescript
import { AvatarUpload } from './components/HH/AvatarUpload';

// In your Settings component:
<AvatarUpload
  userId="test-user-123"
  accessToken={accessToken}
  currentAvatarUrl={null}
  onUploadSuccess={(url) => {
    console.log('✅ Avatar uploaded:', url);
    alert('Avatar uploaded successfully!');
  }}
/>
```

**Test flow:**
1. Click "Wijzig foto" button
2. Select an image file
3. Watch for upload progress
4. Verify avatar appears in preview
5. Check console for success message

---

## 🔍 Debugging Tips

### Server logs not showing?

Check browser console → Network tab → look for requests to:
```
/functions/v1/make-server-b9a572ea/...
```

### Upload returns 401 Unauthorized?

1. Verify you're signed in
2. Check access token is valid:
```javascript
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const { data: { session } } = await supabase.auth.getSession();
console.log('Access token:', session?.access_token);
```

### Upload returns 500 Server Error?

1. Check server logs in Supabase Dashboard → Edge Functions → Logs
2. Look for error messages with ❌ emoji
3. Common issues:
   - SERVICE_ROLE_KEY not set
   - Bucket doesn't exist
   - RLS policies blocking access

### File doesn't appear in bucket?

1. Go to Storage → Select bucket
2. Check folder structure: `{userId}/avatar.jpg`
3. Verify RLS policies allow INSERT operation

### Signed URL doesn't work?

1. URLs expire after 1 hour
2. Copy-paste full URL into new tab
3. Should download file or show image
4. If 404: file doesn't exist or wrong path

---

## ✅ Success Criteria

All tests should pass:

- [ ] Server logs show successful bucket initialization
- [ ] 4 buckets visible in Supabase Dashboard
- [ ] Health endpoint returns `{ status: "ok" }`
- [ ] Avatar upload succeeds with valid auth
- [ ] Avatar upload fails without auth (401)
- [ ] Large file upload fails (400)
- [ ] Wrong file type fails (400)
- [ ] Get avatar URL returns signed URL
- [ ] Avatar appears in Storage bucket
- [ ] `<AvatarUpload />` component works end-to-end

---

## 🚨 Common Issues & Fixes

### Issue: "Bucket already exists"
**Fix:** This is expected! Server checks before creating. Ignore this message.

### Issue: RLS policy error
**Fix:** Configure policies in Supabase Dashboard (see `/STORAGE_SETUP.md`)

### Issue: CORS error
**Fix:** Server already has CORS enabled. Check you're using correct URL.

### Issue: File upload stuck
**Fix:** 
1. Check file size (max 5MB for avatars)
2. Check internet connection
3. Check server logs for errors

---

## 📝 Manual Test Checklist

Print this and check off as you test:

```
SERVER STARTUP
[ ] Server starts without errors
[ ] Buckets initialize successfully
[ ] Health endpoint responds

AVATAR UPLOAD
[ ] Upload with valid auth succeeds
[ ] Upload without auth fails (401)
[ ] Large file fails (400)
[ ] Wrong type fails (400)
[ ] File appears in Storage bucket
[ ] Signed URL works in browser

COMPONENT
[ ] AvatarUpload renders correctly
[ ] File select opens dialog
[ ] Upload shows loading state
[ ] Success shows new avatar
[ ] Errors display to user

SECURITY
[ ] Users can only access own files
[ ] Invalid token rejected
[ ] RLS policies enforce user isolation
```

---

**Ready to test?** Start with step 1️⃣ and work your way down! 🚀
