/**
 * Backend API Client
 * Calls the Express server via Supabase Edge Functions
 */

import { supabase } from './client'
import { projectId, publicAnonKey } from './info'

const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-b9a572ea`

/**
 * Get Authorization header with access token
 */
async function getAuthHeader() {
  const { data } = await supabase.auth.getSession()
  const token = data?.session?.access_token
  
  if (!token) {
    throw new Error('No active session. Please log in.')
  }
  
  return { Authorization: `Bearer ${token}` }
}

/**
 * Upload conversation file (audio/video) for analysis
 * Uses backend route to bypass RLS and normalize MIME types
 */
export async function uploadConversationViaAPI(
  file: File
): Promise<{ path: string; signedUrl: string } | { error: string }> {
  try {
    console.log('📤 [API] Uploading conversation via backend:', { name: file.name, size: file.size, type: file.type })
    
    // Get auth header
    const authHeader = await getAuthHeader()
    
    // Create FormData
    const formData = new FormData()
    formData.append('file', file)
    
    // Call backend API
    const response = await fetch(`${API_BASE}/storage/conversation`, {
      method: 'POST',
      headers: authHeader,
      body: formData,
    })
    
    const result = await response.json()
    
    if (!response.ok) {
      console.error('❌ [API] Upload failed:', result)
      return { error: result.message || result.error || 'Upload failed' }
    }
    
    console.log('✅ [API] Upload successful:', result)
    return { path: result.path, signedUrl: result.signedUrl }
    
  } catch (error: any) {
    console.error('❌ [API] Upload error:', error)
    return { error: error.message || 'Upload failed' }
  }
}

/**
 * Get user workspaces
 */
export async function getUserWorkspaces() {
  try {
    const authHeader = await getAuthHeader()
    
    const response = await fetch(`${API_BASE}/workspaces`, {
      headers: authHeader,
    })
    
    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.message || 'Failed to fetch workspaces')
    }
    
    return await response.json()
  } catch (error: any) {
    console.error('❌ [API] Get workspaces error:', error)
    throw error
  }
}

/**
 * Upload user avatar
 */
export async function uploadAvatarViaAPI(file: File) {
  try {
    const authHeader = await getAuthHeader()
    
    const formData = new FormData()
    formData.append('file', file)
    
    const response = await fetch(`${API_BASE}/storage/avatar`, {
      method: 'POST',
      headers: authHeader,
      body: formData,
    })
    
    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.message || 'Failed to upload avatar')
    }
    
    return await response.json()
  } catch (error: any) {
    console.error('❌ [API] Upload avatar error:', error)
    throw error
  }
}
