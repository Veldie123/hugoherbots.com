/**
 * Frontend Storage Helpers
 * 
 * Helper functions to interact with Supabase Storage via server endpoints
 */

import { projectId, publicAnonKey } from './supabase/info';

const SERVER_URL = `https://${projectId}.supabase.co/functions/v1/make-server-b9a572ea`;

/**
 * Upload user avatar
 * @param file - Image file to upload
 * @param accessToken - User's auth access token
 * @returns Avatar URL or error
 */
export async function uploadAvatar(
  file: File,
  accessToken: string
): Promise<{ avatarUrl: string } | { error: string }> {
  try {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(`${SERVER_URL}/storage/avatar`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      body: formData,
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('❌ Avatar upload failed:', data.error);
      return { error: data.error || 'Upload failed' };
    }

    console.log('✅ Avatar uploaded:', data.avatarUrl);
    return { avatarUrl: data.avatarUrl };

  } catch (error: any) {
    console.error('❌ Avatar upload error:', error);
    return { error: error.message };
  }
}

/**
 * Get user avatar URL
 * @param accessToken - User's auth access token
 * @returns Avatar URL or null
 */
export async function getAvatarUrl(
  accessToken: string
): Promise<string | null> {
  try {
    const response = await fetch(`${SERVER_URL}/storage/avatar`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('❌ Get avatar failed:', data.error);
      return null;
    }

    return data.avatarUrl;

  } catch (error: any) {
    console.error('❌ Get avatar error:', error);
    return null;
  }
}

/**
 * Upload scenario asset (audio, image, etc.)
 * @param scenarioId - ID of the scenario
 * @param file - File to upload
 * @param fileName - Name for the file
 * @param accessToken - User's auth access token
 * @returns File URL or error
 */
export async function uploadScenarioAsset(
  scenarioId: string,
  file: File,
  fileName: string,
  accessToken: string
): Promise<{ url: string; path: string } | { error: string }> {
  try {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('fileName', fileName);

    const response = await fetch(`${SERVER_URL}/storage/scenario/${scenarioId}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      body: formData,
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('❌ Scenario asset upload failed:', data.error);
      return { error: data.error || 'Upload failed' };
    }

    console.log('✅ Scenario asset uploaded:', data.path);
    return { url: data.url, path: data.path };

  } catch (error: any) {
    console.error('❌ Scenario asset upload error:', error);
    return { error: error.message };
  }
}

/**
 * Get signed URL for a file
 * @param bucket - Bucket name
 * @param path - File path in bucket
 * @param accessToken - User's auth access token
 * @param expiresIn - URL expiration time in seconds (default: 1 hour)
 * @returns Signed URL or error
 */
export async function getSignedUrl(
  bucket: string,
  path: string,
  accessToken: string,
  expiresIn: number = 3600
): Promise<{ url: string } | { error: string }> {
  try {
    const response = await fetch(`${SERVER_URL}/storage/url`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ bucket, path, expiresIn }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('❌ Get signed URL failed:', data.error);
      return { error: data.error || 'Failed to get URL' };
    }

    return { url: data.url };

  } catch (error: any) {
    console.error('❌ Get signed URL error:', error);
    return { error: error.message };
  }
}

/**
 * Upload multiple files (helper for batch uploads)
 * @param files - Array of files to upload
 * @param uploadFn - Upload function to use for each file
 * @returns Array of results
 */
export async function uploadMultiple<T>(
  files: File[],
  uploadFn: (file: File) => Promise<T>
): Promise<T[]> {
  const results = await Promise.all(files.map(uploadFn));
  return results;
}
