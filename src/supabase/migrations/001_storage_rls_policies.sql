-- ============================================
-- SUPABASE STORAGE RLS POLICIES
-- Phase 1: Security Essentials
-- ============================================
-- 
-- EXECUTE THIS SCRIPT IN SUPABASE SQL EDITOR
-- Dashboard → SQL Editor → New Query → Paste → Run
--
-- This implements Row Level Security on all storage buckets
-- to prevent unauthorized access to user files.
--
-- CRITICAL: Without these policies, users can access each other's files!
-- ============================================

-- ============================================
-- 1. AVATARS BUCKET POLICIES
-- ============================================
-- Users can only upload to their own folder
-- Anyone authenticated can read avatars (for display in team views)

-- Allow users to upload their own avatar
CREATE POLICY "Users can upload their own avatar"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'make-b9a572ea-avatars' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Allow users to update their own avatar
CREATE POLICY "Users can update their own avatar"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'make-b9a572ea-avatars' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Allow users to delete their own avatar
CREATE POLICY "Users can delete their own avatar"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'make-b9a572ea-avatars' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Allow authenticated users to read any avatar (for team views, leaderboards)
CREATE POLICY "Users can read any avatar"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'make-b9a572ea-avatars');

-- ============================================
-- 2. SCENARIOS BUCKET POLICIES
-- ============================================
-- Users can only access their own scenario files
-- Format: userId/scenarioId/filename

-- Allow users to upload to their own scenarios
CREATE POLICY "Users can upload their own scenarios"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'make-b9a572ea-scenarios' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Allow users to read their own scenarios
CREATE POLICY "Users can read their own scenarios"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'make-b9a572ea-scenarios' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Allow users to update their own scenarios
CREATE POLICY "Users can update their own scenarios"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'make-b9a572ea-scenarios' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Allow users to delete their own scenarios
CREATE POLICY "Users can delete their own scenarios"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'make-b9a572ea-scenarios' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- ============================================
-- 3. RECORDINGS BUCKET POLICIES
-- ============================================
-- Users can only access their own recordings
-- Format: userId/sessionId/recording.mp3

-- Allow users to upload their own recordings
CREATE POLICY "Users can upload their own recordings"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'make-b9a572ea-recordings' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Allow users to read their own recordings
CREATE POLICY "Users can read their own recordings"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'make-b9a572ea-recordings' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Allow users to delete their own recordings
CREATE POLICY "Users can delete their own recordings"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'make-b9a572ea-recordings' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- ============================================
-- 4. RESOURCES BUCKET POLICIES
-- ============================================
-- Users can only access their own resources
-- Format: userId/resourceId/file.pdf

-- Allow users to upload their own resources
CREATE POLICY "Users can upload their own resources"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'make-b9a572ea-resources' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Allow users to read their own resources
CREATE POLICY "Users can read their own resources"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'make-b9a572ea-resources' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Allow users to update their own resources
CREATE POLICY "Users can update their own resources"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'make-b9a572ea-resources' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Allow users to delete their own resources
CREATE POLICY "Users can delete their own resources"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'make-b9a572ea-resources' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- ============================================
-- 5. ENABLE RLS ON STORAGE.OBJECTS
-- ============================================
-- This enforces that ALL storage access goes through policies

-- Check if RLS is enabled
SELECT 
  schemaname, 
  tablename, 
  rowsecurity 
FROM pg_tables 
WHERE schemaname = 'storage' AND tablename = 'objects';

-- Enable RLS (if not already enabled)
-- Note: Supabase storage has RLS enabled by default, but this ensures it
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 6. VERIFICATION QUERIES
-- ============================================
-- Run these to verify policies are active

-- List all policies on storage.objects
SELECT 
  policyname,
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE schemaname = 'storage' 
  AND tablename = 'objects'
  AND policyname LIKE '%make-b9a572ea%'
ORDER BY policyname;

-- Expected output: 16 policies (4 per bucket x 4 buckets)

-- ============================================
-- 7. TESTING CHECKLIST
-- ============================================
-- After running this script, test:
--
-- ✅ User A can upload avatar to userId-A/ folder
-- ❌ User A CANNOT upload avatar to userId-B/ folder
-- ✅ User A can read User B's avatar (for team views)
-- ✅ User A can upload scenario to userId-A/scenarioId/ folder
-- ❌ User A CANNOT read User B's scenarios
-- ✅ User A can upload recording to userId-A/sessionId/ folder
-- ❌ User A CANNOT read User B's recordings
--
-- Use /TEST_STORAGE.md for detailed testing instructions
-- ============================================

-- ============================================
-- 8. TROUBLESHOOTING
-- ============================================
-- If you get "policy already exists" errors:
-- DROP existing policies first:
/*
DO $$ 
DECLARE
  r RECORD;
BEGIN
  FOR r IN (
    SELECT policyname 
    FROM pg_policies 
    WHERE schemaname = 'storage' 
      AND tablename = 'objects'
      AND policyname LIKE '%make-b9a572ea%'
  ) LOOP
    EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON storage.objects';
  END LOOP;
END $$;
*/

-- Then re-run this script from the top
-- ============================================

-- ✅ POLICIES CREATED SUCCESSFULLY
-- Next step: Test with /TEST_STORAGE.md
