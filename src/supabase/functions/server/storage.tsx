/**
 * Storage Helper Functions
 * 
 * Manages Supabase Storage buckets for HugoHerbots.ai
 * - User avatars
 * - Scenario assets (audio, images)
 * - Session recordings
 * - Team resources
 * - Conversation uploads (for ConversationAnalysis feature)
 */

import { createClient } from "jsr:@supabase/supabase-js@2";

// Bucket names (all prefixed with make-b9a572ea)
export const BUCKETS = {
  AVATARS: "make-b9a572ea-avatars",
  SCENARIOS: "make-b9a572ea-scenarios",
  RECORDINGS: "make-b9a572ea-recordings",
  RESOURCES: "make-b9a572ea-resources",
  CONVERSATION_UPLOADS: "make-b9a572ea-conversation-uploads", // For ConversationAnalysis feature
} as const;

/**
 * Initialize all storage buckets
 * Called on server startup - idempotent
 */
export async function initializeBuckets() {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  console.log("🗄️ Initializing storage buckets...");

  try {
    // Get existing buckets
    const { data: existingBuckets, error: listError } = await supabase.storage.listBuckets();
    
    if (listError) {
      console.error("❌ Error listing buckets:", listError);
      throw listError;
    }

    const existingBucketNames = new Set(existingBuckets?.map(b => b.name) ?? []);

    // Create OR UPDATE buckets
    for (const [name, bucketName] of Object.entries(BUCKETS)) {
      const fileSizeLimit = name === "CONVERSATION_UPLOADS" 
        ? 52428800 // 50MB for conversation uploads (Supabase max)
        : 10485760; // 10MB for others
      
      const allowedMimeTypes = getBucketAllowedTypes(name);
      
      if (!existingBucketNames.has(bucketName)) {
        console.log(`📦 Creating bucket: ${bucketName}`);
        
        const { error: createError } = await supabase.storage.createBucket(bucketName, {
          public: false,
          fileSizeLimit,
          allowedMimeTypes,
        });

        if (createError) {
          console.error(`❌ Error creating bucket ${bucketName}:`, createError);
          throw createError;
        }
        
        console.log(`✅ Created bucket: ${bucketName}`);
      } else {
        console.log(`✓ Bucket exists: ${bucketName} - updating configuration...`);
        
        // Update existing bucket configuration
        const { error: updateError } = await supabase.storage.updateBucket(bucketName, {
          public: false,
          fileSizeLimit,
          allowedMimeTypes,
        });

        if (updateError) {
          console.error(`⚠️ Error updating bucket ${bucketName}:`, updateError);
          // Don't throw - bucket exists and is functional
        } else {
          console.log(`✅ Updated bucket configuration: ${bucketName}`);
        }
      }
    }

    console.log("✅ All storage buckets initialized");
    return { success: true };

  } catch (error) {
    console.error("❌ Storage initialization failed:", error);
    return { success: false, error };
  }
}

/**
 * Get allowed MIME types for each bucket
 */
function getBucketAllowedTypes(bucketName: string): string[] {
  switch (bucketName) {
    case "AVATARS":
      return ["image/jpeg", "image/png", "image/webp", "image/gif"];
    case "SCENARIOS":
      return ["audio/mpeg", "audio/wav", "audio/webm", "audio/mp4", "image/jpeg", "image/png", "application/json"];
    case "RECORDINGS":
      return ["audio/mpeg", "audio/wav", "audio/webm", "audio/mp4", "video/mp4", "video/webm", "video/quicktime"];
    case "RESOURCES":
      return ["application/pdf", "image/jpeg", "image/png", "video/mp4", "video/quicktime"];
    case "CONVERSATION_UPLOADS":
      // NOTE: M4A files are uploaded as audio/mp4 (normalized in frontend)
      // This is the safest approach as Supabase consistently supports audio/mp4
      return ["audio/mpeg", "audio/wav", "audio/webm", "audio/mp4", "video/mp4", "video/quicktime", "video/webm"];
    default:
      return ["*"]; // Allow all if unknown
  }
}

/**
 * Upload a file to a bucket
 * Returns the file path and signed URL
 */
export async function uploadFile(
  bucketName: string,
  filePath: string,
  fileData: Uint8Array | Blob,
  contentType: string,
  userId?: string
): Promise<{ path: string; signedUrl: string } | { error: string }> {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  try {
    // Upload file
    const { data, error: uploadError } = await supabase.storage
      .from(bucketName)
      .upload(filePath, fileData, {
        contentType,
        upsert: false,
      });

    if (uploadError) {
      console.error(`❌ Upload error for ${filePath}:`, uploadError);
      return { error: uploadError.message };
    }

    console.log(`✅ Uploaded: ${data.path}`);

    // Generate signed URL (valid for 1 hour)
    const { data: urlData, error: urlError } = await supabase.storage
      .from(bucketName)
      .createSignedUrl(data.path, 3600);

    if (urlError) {
      console.error(`❌ Signed URL error for ${data.path}:`, urlError);
      return { error: urlError.message };
    }

    return {
      path: data.path,
      signedUrl: urlData.signedUrl,
    };

  } catch (error: any) {
    console.error("❌ Upload failed:", error);
    return { error: error.message };
  }
}

/**
 * Get a signed URL for a file
 * Valid for 1 hour by default
 */
export async function getSignedUrl(
  bucketName: string,
  filePath: string,
  expiresIn: number = 3600
): Promise<{ signedUrl: string } | { error: string }> {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  try {
    const { data, error } = await supabase.storage
      .from(bucketName)
      .createSignedUrl(filePath, expiresIn);

    if (error) {
      console.error(`❌ Signed URL error for ${filePath}:`, error);
      return { error: error.message };
    }

    return { signedUrl: data.signedUrl };

  } catch (error: any) {
    console.error("❌ Get signed URL failed:", error);
    return { error: error.message };
  }
}

/**
 * Delete a file from a bucket
 */
export async function deleteFile(
  bucketName: string,
  filePath: string
): Promise<{ success: boolean } | { error: string }> {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  try {
    const { error } = await supabase.storage
      .from(bucketName)
      .remove([filePath]);

    if (error) {
      console.error(`❌ Delete error for ${filePath}:`, error);
      return { error: error.message };
    }

    console.log(`✅ Deleted: ${filePath}`);
    return { success: true };

  } catch (error: any) {
    console.error("❌ Delete failed:", error);
    return { error: error.message };
  }
}

/**
 * List files in a folder
 */
export async function listFiles(
  bucketName: string,
  folderPath: string = ""
): Promise<{ files: any[] } | { error: string }> {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  try {
    const { data, error } = await supabase.storage
      .from(bucketName)
      .list(folderPath);

    if (error) {
      console.error(`❌ List error for ${folderPath}:`, error);
      return { error: error.message };
    }

    return { files: data ?? [] };

  } catch (error: any) {
    console.error("❌ List files failed:", error);
    return { error: error.message };
  }
}

/**
 * Get user's avatar URL
 * Returns signed URL if avatar exists, null otherwise
 */
export async function getUserAvatarUrl(userId: string): Promise<string | null> {
  const result = await getSignedUrl(BUCKETS.AVATARS, `${userId}/avatar.jpg`);
  
  if ("error" in result) {
    return null;
  }
  
  return result.signedUrl;
}

/**
 * Upload user avatar
 * Deletes old avatar and uploads new one
 */
export async function uploadUserAvatar(
  userId: string,
  fileData: Uint8Array | Blob,
  contentType: string
): Promise<{ signedUrl: string } | { error: string }> {
  // Delete old avatar if exists
  await deleteFile(BUCKETS.AVATARS, `${userId}/avatar.jpg`);
  
  // Upload new avatar
  const result = await uploadFile(
    BUCKETS.AVATARS,
    `${userId}/avatar.jpg`,
    fileData,
    contentType,
    userId
  );
  
  if ("error" in result) {
    return { error: result.error };
  }
  
  return { signedUrl: result.signedUrl };
}
