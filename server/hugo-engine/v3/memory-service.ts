/**
 * V3 Memory Service — Episodic Memory for Hugo Agent
 *
 * Stores and retrieves seller insights across sessions using
 * pgvector semantic search in Supabase.
 *
 * Memory types:
 * - insight: Agent observation about the seller
 * - struggle: Detected recurring difficulty
 * - goal: Seller-stated goal or ambition
 * - personal: Personal context (company, clients, etc.)
 * - session_summary: Auto-generated session summary
 * - admin_correction: Hugo (admin) approved correction
 */
import { supabase } from "../supabase-client";
import { generateEmbedding } from "../v2/rag-service";

// ── Types ───────────────────────────────────────────────────────────────────

export type MemoryType =
  | "insight"
  | "struggle"
  | "goal"
  | "personal"
  | "session_summary"
  | "admin_correction";

export type MemorySource = "autonomous" | "admin_correction" | "user_stated";

export interface Memory {
  id: string;
  userId: string;
  content: string;
  memoryType: MemoryType;
  source: MemorySource;
  techniqueId?: string;
  sessionId?: string;
  metadata?: Record<string, any>;
  createdAt: string;
  similarity?: number;
}

// ── Save Memory ─────────────────────────────────────────────────────────────

export async function saveMemory(params: {
  userId: string;
  content: string;
  memoryType: MemoryType;
  source?: MemorySource;
  techniqueId?: string;
  sessionId?: string;
  metadata?: Record<string, any>;
}): Promise<{ success: boolean; memoryId?: string; error?: string }> {
  const {
    userId,
    content,
    memoryType,
    source = "autonomous",
    techniqueId,
    sessionId,
    metadata,
  } = params;

  // Generate embedding for semantic recall
  let embedding: number[] | null = null;
  try {
    embedding = await generateEmbedding(content);
  } catch (err) {
    console.warn("[V3 Memory] Embedding generation failed, saving without:", err);
  }

  const { data, error } = await supabase
    .from("user_memories")
    .insert({
      user_id: userId,
      content,
      memory_type: memoryType,
      source,
      technique_id: techniqueId || null,
      session_id: sessionId || null,
      embedding,
      metadata: metadata || {},
    })
    .select("id")
    .single();

  if (error) {
    console.error("[V3 Memory] Save failed:", error);
    return { success: false, error: error.message };
  }

  return { success: true, memoryId: data.id };
}

// ── Recall Memories (Semantic Search) ───────────────────────────────────────

export async function recallMemories(params: {
  userId: string;
  query: string;
  limit?: number;
  threshold?: number;
  memoryType?: MemoryType;
}): Promise<Memory[]> {
  const {
    userId,
    query,
    limit = 5,
    threshold = 0.4,
    memoryType,
  } = params;

  // Try semantic search first
  const embedding = await generateEmbedding(query);
  if (embedding) {
    const { data, error } = await supabase.rpc("match_user_memories", {
      query_embedding: embedding,
      match_user_id: userId,
      match_threshold: threshold,
      match_count: limit,
      filter_type: memoryType || null,
    });

    if (!error && data && data.length > 0) {
      return data.map(mapMemoryRow);
    }

    if (error) {
      console.warn("[V3 Memory] Semantic search failed, falling back to recent:", error);
    }
  }

  // Fallback: recent memories by date
  let query$ = supabase
    .from("user_memories")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (memoryType) {
    query$ = query$.eq("memory_type", memoryType);
  }

  const { data, error } = await query$;

  if (error) {
    console.error("[V3 Memory] Recall failed:", error);
    return [];
  }

  return (data || []).map(mapMemoryRow);
}

// ── Get All Memories for User ───────────────────────────────────────────────

export async function getMemoriesForUser(
  userId: string,
  limit = 20
): Promise<Memory[]> {
  const { data, error } = await supabase
    .from("user_memories")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("[V3 Memory] Get memories failed:", error);
    return [];
  }

  return (data || []).map(mapMemoryRow);
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function mapMemoryRow(row: any): Memory {
  return {
    id: row.id,
    userId: row.user_id,
    content: row.content,
    memoryType: row.memory_type,
    source: row.source,
    techniqueId: row.technique_id,
    sessionId: row.session_id,
    metadata: row.metadata,
    createdAt: row.created_at,
    similarity: row.similarity,
  };
}
