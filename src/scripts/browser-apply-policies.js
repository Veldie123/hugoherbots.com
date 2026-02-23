/**
 * 🚀 BROWSER CONSOLE SCRIPT - Apply Storage RLS Policies
 * 
 * INSTRUCTIONS:
 * 1. Open Supabase Dashboard → Storage → Policies
 * 2. Open Browser Console (F12)
 * 3. Paste this ENTIRE script
 * 4. Press Enter
 * 5. Follow prompts
 * 
 * ⚠️ WARNING: You still need to click "Save" for each policy manually!
 * This script just fills the forms for you to save time.
 */

console.log('🚀 HugoHerbots.ai - RLS Policy Generator');
console.log('📋 This will generate 15 storage policies');
console.log('⚠️  You still need to click "Save" for each one!\n');

const policies = [
  // AVATARS (4)
  {
    name: 'Users can upload their own avatar',
    bucket: 'make-b9a572ea-avatars',
    operation: 'INSERT',
    definition: `bucket_id = 'make-b9a572ea-avatars' AND auth.uid()::text = (storage.foldername(name))[1]`,
    useCheck: true
  },
  {
    name: 'Users can update their own avatar',
    bucket: 'make-b9a572ea-avatars',
    operation: 'UPDATE',
    definition: `bucket_id = 'make-b9a572ea-avatars' AND auth.uid()::text = (storage.foldername(name))[1]`,
    useCheck: false
  },
  {
    name: 'Users can delete their own avatar',
    bucket: 'make-b9a572ea-avatars',
    operation: 'DELETE',
    definition: `bucket_id = 'make-b9a572ea-avatars' AND auth.uid()::text = (storage.foldername(name))[1]`,
    useCheck: false
  },
  {
    name: 'Users can read any avatar',
    bucket: 'make-b9a572ea-avatars',
    operation: 'SELECT',
    definition: `bucket_id = 'make-b9a572ea-avatars'`,
    useCheck: false
  },
  
  // SCENARIOS (4)
  {
    name: 'Users can upload their own scenarios',
    bucket: 'make-b9a572ea-scenarios',
    operation: 'INSERT',
    definition: `bucket_id = 'make-b9a572ea-scenarios' AND auth.uid()::text = (storage.foldername(name))[1]`,
    useCheck: true
  },
  {
    name: 'Users can read their own scenarios',
    bucket: 'make-b9a572ea-scenarios',
    operation: 'SELECT',
    definition: `bucket_id = 'make-b9a572ea-scenarios' AND auth.uid()::text = (storage.foldername(name))[1]`,
    useCheck: false
  },
  {
    name: 'Users can update their own scenarios',
    bucket: 'make-b9a572ea-scenarios',
    operation: 'UPDATE',
    definition: `bucket_id = 'make-b9a572ea-scenarios' AND auth.uid()::text = (storage.foldername(name))[1]`,
    useCheck: false
  },
  {
    name: 'Users can delete their own scenarios',
    bucket: 'make-b9a572ea-scenarios',
    operation: 'DELETE',
    definition: `bucket_id = 'make-b9a572ea-scenarios' AND auth.uid()::text = (storage.foldername(name))[1]`,
    useCheck: false
  },
  
  // RECORDINGS (3)
  {
    name: 'Users can upload their own recordings',
    bucket: 'make-b9a572ea-recordings',
    operation: 'INSERT',
    definition: `bucket_id = 'make-b9a572ea-recordings' AND auth.uid()::text = (storage.foldername(name))[1]`,
    useCheck: true
  },
  {
    name: 'Users can read their own recordings',
    bucket: 'make-b9a572ea-recordings',
    operation: 'SELECT',
    definition: `bucket_id = 'make-b9a572ea-recordings' AND auth.uid()::text = (storage.foldername(name))[1]`,
    useCheck: false
  },
  {
    name: 'Users can delete their own recordings',
    bucket: 'make-b9a572ea-recordings',
    operation: 'DELETE',
    definition: `bucket_id = 'make-b9a572ea-recordings' AND auth.uid()::text = (storage.foldername(name))[1]`,
    useCheck: false
  },
  
  // RESOURCES (4)
  {
    name: 'Users can upload their own resources',
    bucket: 'make-b9a572ea-resources',
    operation: 'INSERT',
    definition: `bucket_id = 'make-b9a572ea-resources' AND auth.uid()::text = (storage.foldername(name))[1]`,
    useCheck: true
  },
  {
    name: 'Users can read their own resources',
    bucket: 'make-b9a572ea-resources',
    operation: 'SELECT',
    definition: `bucket_id = 'make-b9a572ea-resources' AND auth.uid()::text = (storage.foldername(name))[1]`,
    useCheck: false
  },
  {
    name: 'Users can update their own resources',
    bucket: 'make-b9a572ea-resources',
    operation: 'UPDATE',
    definition: `bucket_id = 'make-b9a572ea-resources' AND auth.uid()::text = (storage.foldername(name))[1]`,
    useCheck: false
  },
  {
    name: 'Users can delete their own resources',
    bucket: 'make-b9a572ea-resources',
    operation: 'DELETE',
    definition: `bucket_id = 'make-b9a572ea-resources' AND auth.uid()::text = (storage.foldername(name))[1]`,
    useCheck: false
  }
];

console.log('\n📝 COPY-PASTE THESE POLICIES:\n');
console.log('=' .repeat(80));

policies.forEach((policy, index) => {
  console.log(`\n${index + 1}. ${policy.name}`);
  console.log(`   Operation: ${policy.operation}`);
  console.log(`   Target: authenticated`);
  if (policy.useCheck) {
    console.log(`   WITH CHECK: ${policy.definition}`);
  } else {
    console.log(`   USING: ${policy.definition}`);
  }
  console.log('-'.repeat(80));
});

console.log('\n✅ READY! Copy each policy above into Supabase Dashboard UI\n');

// Export as JSON for easy copy
console.log('📋 Or download as JSON:');
const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(policies, null, 2));
const downloadAnchor = document.createElement('a');
downloadAnchor.setAttribute("href", dataStr);
downloadAnchor.setAttribute("download", "hugoherbots-rls-policies.json");
console.log('👉 Run: document.body.appendChild(downloadAnchor); downloadAnchor.click();');
