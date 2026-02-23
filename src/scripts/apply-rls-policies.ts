/**
 * Apply Storage RLS Policies via Supabase Management API
 * Run with: deno run --allow-net --allow-env apply-rls-policies.ts
 * Or: npx tsx apply-rls-policies.ts
 */

// INSTRUCTIONS:
// 1. Replace SUPABASE_PROJECT_REF with your project reference
// 2. Replace SERVICE_ROLE_KEY with your service role key
// 3. Run this script

const SUPABASE_PROJECT_REF = 'pckctmojjrrgzuufsqoo';
const SERVICE_ROLE_KEY = 'YOUR_SERVICE_ROLE_KEY_HERE'; // Get from Dashboard → Settings → API

const SUPABASE_URL = `https://${SUPABASE_PROJECT_REF}.supabase.co`;

interface Policy {
  name: string;
  definition: string;
  command: 'INSERT' | 'SELECT' | 'UPDATE' | 'DELETE';
  check?: string;
}

const policies: Policy[] = [
  // ============================================
  // AVATARS BUCKET (4 policies)
  // ============================================
  {
    name: 'Users can upload their own avatar',
    definition: `bucket_id = 'make-b9a572ea-avatars' AND auth.uid()::text = (storage.foldername(name))[1]`,
    command: 'INSERT',
    check: `bucket_id = 'make-b9a572ea-avatars' AND auth.uid()::text = (storage.foldername(name))[1]`
  },
  {
    name: 'Users can update their own avatar',
    definition: `bucket_id = 'make-b9a572ea-avatars' AND auth.uid()::text = (storage.foldername(name))[1]`,
    command: 'UPDATE'
  },
  {
    name: 'Users can delete their own avatar',
    definition: `bucket_id = 'make-b9a572ea-avatars' AND auth.uid()::text = (storage.foldername(name))[1]`,
    command: 'DELETE'
  },
  {
    name: 'Users can read any avatar',
    definition: `bucket_id = 'make-b9a572ea-avatars'`,
    command: 'SELECT'
  },
  
  // ============================================
  // SCENARIOS BUCKET (4 policies)
  // ============================================
  {
    name: 'Users can upload their own scenarios',
    definition: `bucket_id = 'make-b9a572ea-scenarios' AND auth.uid()::text = (storage.foldername(name))[1]`,
    command: 'INSERT',
    check: `bucket_id = 'make-b9a572ea-scenarios' AND auth.uid()::text = (storage.foldername(name))[1]`
  },
  {
    name: 'Users can read their own scenarios',
    definition: `bucket_id = 'make-b9a572ea-scenarios' AND auth.uid()::text = (storage.foldername(name))[1]`,
    command: 'SELECT'
  },
  {
    name: 'Users can update their own scenarios',
    definition: `bucket_id = 'make-b9a572ea-scenarios' AND auth.uid()::text = (storage.foldername(name))[1]`,
    command: 'UPDATE'
  },
  {
    name: 'Users can delete their own scenarios',
    definition: `bucket_id = 'make-b9a572ea-scenarios' AND auth.uid()::text = (storage.foldername(name))[1]`,
    command: 'DELETE'
  },
  
  // ============================================
  // RECORDINGS BUCKET (3 policies - no UPDATE)
  // ============================================
  {
    name: 'Users can upload their own recordings',
    definition: `bucket_id = 'make-b9a572ea-recordings' AND auth.uid()::text = (storage.foldername(name))[1]`,
    command: 'INSERT',
    check: `bucket_id = 'make-b9a572ea-recordings' AND auth.uid()::text = (storage.foldername(name))[1]`
  },
  {
    name: 'Users can read their own recordings',
    definition: `bucket_id = 'make-b9a572ea-recordings' AND auth.uid()::text = (storage.foldername(name))[1]`,
    command: 'SELECT'
  },
  {
    name: 'Users can delete their own recordings',
    definition: `bucket_id = 'make-b9a572ea-recordings' AND auth.uid()::text = (storage.foldername(name))[1]`,
    command: 'DELETE'
  },
  
  // ============================================
  // RESOURCES BUCKET (4 policies)
  // ============================================
  {
    name: 'Users can upload their own resources',
    definition: `bucket_id = 'make-b9a572ea-resources' AND auth.uid()::text = (storage.foldername(name))[1]`,
    command: 'INSERT',
    check: `bucket_id = 'make-b9a572ea-resources' AND auth.uid()::text = (storage.foldername(name))[1]`
  },
  {
    name: 'Users can read their own resources',
    definition: `bucket_id = 'make-b9a572ea-resources' AND auth.uid()::text = (storage.foldername(name))[1]`,
    command: 'SELECT'
  },
  {
    name: 'Users can update their own resources',
    definition: `bucket_id = 'make-b9a572ea-resources' AND auth.uid()::text = (storage.foldername(name))[1]`,
    command: 'UPDATE'
  },
  {
    name: 'Users can delete their own resources',
    definition: `bucket_id = 'make-b9a572ea-resources' AND auth.uid()::text = (storage.foldername(name))[1]`,
    command: 'DELETE'
  }
];

async function applyPolicies() {
  console.log('🚀 Applying Storage RLS Policies...\n');
  
  let successCount = 0;
  let errorCount = 0;
  
  for (const policy of policies) {
    try {
      // Create policy via SQL with proper permissions
      const sql = `
        CREATE POLICY "${policy.name}"
        ON storage.objects FOR ${policy.command}
        TO authenticated
        ${policy.command === 'INSERT' && policy.check ? `WITH CHECK (${policy.check})` : ''}
        ${policy.command !== 'INSERT' ? `USING (${policy.definition})` : ''}
      `.trim();
      
      const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SERVICE_ROLE_KEY,
          'Authorization': `Bearer ${SERVICE_ROLE_KEY}`
        },
        body: JSON.stringify({ query: sql })
      });
      
      if (response.ok) {
        console.log(`✅ Created: ${policy.name}`);
        successCount++;
      } else {
        const error = await response.text();
        if (error.includes('already exists')) {
          console.log(`⚠️  Already exists: ${policy.name}`);
          successCount++;
        } else {
          console.error(`❌ Failed: ${policy.name}`, error);
          errorCount++;
        }
      }
    } catch (error) {
      console.error(`❌ Error creating ${policy.name}:`, error);
      errorCount++;
    }
  }
  
  console.log(`\n📊 Summary:`);
  console.log(`✅ Success: ${successCount}`);
  console.log(`❌ Errors: ${errorCount}`);
  console.log(`📋 Total: ${policies.length}`);
}

applyPolicies();
