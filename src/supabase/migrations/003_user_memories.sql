-- ============================================================================
-- Migration 003: User Memories (Episodic Memory for Hugo V3 Agent)
--
-- Creates a semantic memory system so Hugo remembers insights about sellers
-- across sessions. Uses pgvector for semantic recall.
--
-- Run in Supabase Dashboard → SQL Editor → New Query → Paste → Run
-- ============================================================================

-- Ensure pgvector extension is enabled (should already be from RAG setup)
CREATE EXTENSION IF NOT EXISTS vector;

-- ── User Memories Table ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS user_memories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  content TEXT NOT NULL,
  memory_type TEXT NOT NULL DEFAULT 'insight',
  source TEXT NOT NULL DEFAULT 'autonomous',
  technique_id TEXT,
  session_id TEXT,
  embedding VECTOR(1536),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_user_memories_user_id ON user_memories(user_id);
CREATE INDEX IF NOT EXISTS idx_user_memories_type ON user_memories(memory_type);
CREATE INDEX IF NOT EXISTS idx_user_memories_created ON user_memories(created_at DESC);

-- HNSW index for fast vector similarity search
CREATE INDEX IF NOT EXISTS idx_user_memories_embedding ON user_memories
  USING ivfflat (embedding vector_cosine_ops) WITH (lists = 20);

-- Comments for documentation
COMMENT ON TABLE user_memories IS 'Episodic memory for Hugo V3 agent. Stores insights about sellers across sessions.';
COMMENT ON COLUMN user_memories.memory_type IS 'Type: insight, struggle, goal, personal, session_summary, admin_correction';
COMMENT ON COLUMN user_memories.source IS 'Source: autonomous (agent-generated), admin_correction (Hugo-approved), user_stated';
COMMENT ON COLUMN user_memories.technique_id IS 'Optional: related technique ID from SSOT';
COMMENT ON COLUMN user_memories.metadata IS 'Flexible JSON: confidence, context, tags, etc.';

-- ── RPC Function for Semantic Memory Search ─────────────────────────────────

CREATE OR REPLACE FUNCTION match_user_memories(
  query_embedding VECTOR(1536),
  match_user_id TEXT,
  match_threshold FLOAT DEFAULT 0.4,
  match_count INT DEFAULT 5,
  filter_type TEXT DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  user_id TEXT,
  content TEXT,
  memory_type TEXT,
  source TEXT,
  technique_id TEXT,
  session_id TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ,
  similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    um.id,
    um.user_id,
    um.content,
    um.memory_type,
    um.source,
    um.technique_id,
    um.session_id,
    um.metadata,
    um.created_at,
    1 - (um.embedding <=> query_embedding) AS similarity
  FROM user_memories um
  WHERE um.user_id = match_user_id
    AND um.embedding IS NOT NULL
    AND 1 - (um.embedding <=> query_embedding) > match_threshold
    AND (filter_type IS NULL OR um.memory_type = filter_type)
  ORDER BY um.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- ── Row Level Security ──────────────────────────────────────────────────────

ALTER TABLE user_memories ENABLE ROW LEVEL SECURITY;

-- Service role can do everything (used by the backend)
CREATE POLICY "Service role full access on user_memories"
  ON user_memories
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Authenticated users can read their own memories
CREATE POLICY "Users can read own memories"
  ON user_memories
  FOR SELECT
  USING (auth.uid()::TEXT = user_id);
