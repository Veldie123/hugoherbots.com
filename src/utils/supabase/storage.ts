import { supabase } from './client'

// Storage buckets
export const BUCKETS = {
  AVATARS: 'avatars',
  AUDIO_UPLOADS: 'audio-uploads',
  SESSION_TRANSCRIPTS: 'session-transcripts',
  RESOURCES: 'resources',
  CONVERSATION_UPLOADS: 'make-b9a572ea-conversation-uploads', // For ConversationAnalysis feature - must match server
} as const

// Upload avatar (public bucket)
export async function uploadAvatar(userId: string, file: File) {
  const fileExt = file.name.split('.').pop()
  const fileName = `${userId}-${Date.now()}.${fileExt}`
  const filePath = `${userId}/${fileName}`

  const { data, error } = await supabase.storage
    .from(BUCKETS.AVATARS)
    .upload(filePath, file, {
      cacheControl: '3600',
      upsert: true,
    })

  if (error) {
    console.error('Avatar upload error:', error)
    return { url: null, error }
  }

  // Get public URL
  const { data: { publicUrl } } = supabase.storage
    .from(BUCKETS.AVATARS)
    .getPublicUrl(filePath)

  return { url: publicUrl, error: null }
}

// Upload audio recording (private bucket)
export async function uploadAudio(
  userId: string,
  sessionId: string,
  audioBlob: Blob
) {
  const fileName = `${sessionId}-${Date.now()}.webm`
  const filePath = `${userId}/${fileName}`

  const { data, error } = await supabase.storage
    .from(BUCKETS.AUDIO_UPLOADS)
    .upload(filePath, audioBlob, {
      contentType: 'audio/webm',
      upsert: false,
    })

  if (error) {
    console.error('Audio upload error:', error)
    return { path: null, error }
  }

  return { path: data.path, error: null }
}

// Upload session transcript (private bucket)
export async function uploadTranscript(
  userId: string,
  sessionId: string,
  transcript: any
) {
  const fileName = `${sessionId}-${Date.now()}.json`
  const filePath = `${userId}/${fileName}`

  const { data, error } = await supabase.storage
    .from(BUCKETS.SESSION_TRANSCRIPTS)
    .upload(filePath, JSON.stringify(transcript), {
      contentType: 'application/json',
      upsert: true,
    })

  if (error) {
    console.error('Transcript upload error:', error)
    return { path: null, error }
  }

  return { path: data.path, error: null }
}

// Download transcript
export async function downloadTranscript(filePath: string) {
  const { data, error } = await supabase.storage
    .from(BUCKETS.SESSION_TRANSCRIPTS)
    .download(filePath)

  if (error) {
    console.error('Transcript download error:', error)
    return { transcript: null, error }
  }

  const text = await data.text()
  const transcript = JSON.parse(text)

  return { transcript, error: null }
}

// Get signed URL for private file (expires in 1 hour by default)
export async function getSignedUrl(
  bucket: string,
  path: string,
  expiresIn = 3600
) {
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, expiresIn)

  if (error) {
    console.error('Signed URL error:', error)
    return { url: null, error }
  }

  return { url: data.signedUrl, error: null }
}

// Upload resource file (admin only - private bucket)
export async function uploadResource(
  file: File,
  category: string,
  uploadProgress?: (progress: number) => void
) {
  const fileExt = file.name.split('.').pop()
  const fileName = `${Date.now()}-${file.name}`
  const filePath = `${category}/${fileName}`

  // Note: Progress tracking would require custom implementation
  const { data, error } = await supabase.storage
    .from(BUCKETS.RESOURCES)
    .upload(filePath, file, {
      cacheControl: '3600',
      upsert: false,
    })

  if (error) {
    console.error('Resource upload error:', error)
    return { path: null, error }
  }

  return { path: data.path, error: null }
}

// Delete file from storage
export async function deleteFile(bucket: string, path: string) {
  const { error } = await supabase.storage.from(bucket).remove([path])

  if (error) {
    console.error('File delete error:', error)
    return { error }
  }

  return { error: null }
}

// List files in a bucket path
export async function listFiles(bucket: string, path: string) {
  const { data, error } = await supabase.storage.from(bucket).list(path)

  if (error) {
    console.error('List files error:', error)
    return { files: [], error }
  }

  return { files: data, error: null }
}

// Upload conversation file (audio/video for analysis - private bucket)
export async function uploadConversation(
  userId: string,
  file: File,
  metadata?: { title?: string; context?: string }
) {
  const fileExt = file.name.split('.').pop()?.toLowerCase()
  const fileName = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`
  const filePath = `${userId}/${fileName}`

  console.log('📤 [v2] Uploading conversation file:', { fileName, fileSize: file.size, fileType: file.type })

  // Normalize MIME type to Supabase-supported types
  let contentType = file.type
  
  // M4A files often have problematic MIME types - normalize them
  if (fileExt === 'm4a' || file.type === 'audio/x-m4a' || file.type === 'audio/m4a') {
    contentType = 'audio/mp4' // Supabase accepts audio/mp4 for M4A
    console.log('🔄 Normalized M4A MIME type from', file.type, 'to', contentType)
  }
  
  // MP3 files sometimes have incorrect MIME types
  if (fileExt === 'mp3' && (!file.type || file.type === 'audio/mp3')) {
    contentType = 'audio/mpeg' // Standard MP3 MIME type
    console.log('🔄 Normalized MP3 MIME type from', file.type, 'to', contentType)
  }
  
  // MOV files
  if (fileExt === 'mov' && (!file.type || file.type !== 'video/quicktime')) {
    contentType = 'video/quicktime'
    console.log('🔄 Normalized MOV MIME type from', file.type, 'to', contentType)
  }
  
  // WAV files
  if (fileExt === 'wav' && (!file.type || file.type === 'audio/x-wav')) {
    contentType = 'audio/wav'
    console.log('🔄 Normalized WAV MIME type from', file.type, 'to', contentType)
  }

  console.log('📤 Final upload details:', { filePath, contentType, size: file.size })

  // Create a new Blob with the correct MIME type to ensure Supabase accepts it
  const fileBlob = new Blob([file], { type: contentType })
  
  console.log('📦 Created blob with MIME type:', fileBlob.type)

  const { data, error } = await supabase.storage
    .from(BUCKETS.CONVERSATION_UPLOADS)
    .upload(filePath, fileBlob, {
      contentType, // Use normalized MIME type
      upsert: false,
      cacheControl: '3600',
    })

  if (error) {
    console.error('❌ Conversation upload error:', error)
    return { path: null, error }
  }

  console.log('✅ Conversation uploaded successfully:', data.path)
  return { path: data.path, error: null }
}