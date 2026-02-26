/**
 * RAG Service for Hugo V2 Engine
 * 
 * Provides semantic search over Hugo's training materials
 * using OpenAI embeddings and pgvector similarity search.
 * 
 * UPDATE: februari 2026 - Overschakeling naar Supabase
 * -----------------------------------------------------
 * RAG corpus leeft nu in Supabase (shared met .com Replit)
 * ipv Replit PostgreSQL. Dit maakt cross-platform search mogelijk.
 * 
 * Supabase project: pckctmojjrrgzuufsqoo
 * Corpus: 559 documenten met embeddings
 * Search: Via match_rag_documents RPC functie
 * 
 * Frontend koppeling: N/A - backend-only, RAG grounding gebeurt in coach responses
 */

import OpenAI from "openai";
import { supabase } from "../supabase-client";
import * as fs from "fs";
import * as path from "path";

const EMBEDDING_MODEL = "text-embedding-3-small";
const EMBEDDING_DIMENSIONS = 1536;

// Use OpenAI API for embeddings
// First tries OPENAI_API_KEY, falls back to AI_INTEGRATIONS_OPENAI_API_KEY
export function getOpenAIClientForEmbeddings(): OpenAI | null {
  // Try direct OpenAI API key first
  const directKey = process.env.OPENAI_API_KEY;
  if (directKey) {
    return new OpenAI({ apiKey: directKey });
  }
  
  // Fall back to Replit AI Integrations
  const integrationKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
  const baseURL = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;
  if (integrationKey && baseURL) {
    console.log("[RAG] Using AI Integrations for embeddings");
    return new OpenAI({ apiKey: integrationKey, baseURL });
  }
  
  console.log("[RAG] Embeddings not available (no OPENAI_API_KEY or AI Integrations)");
  return null;
}

// Use Replit AI Integrations for chat completions
export function getOpenAIClient(): OpenAI | null {
  const directKey = process.env.OPENAI_API_KEY;
  if (directKey) {
    return new OpenAI({ apiKey: directKey });
  }

  const apiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
  const baseURL = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;
  
  if (!apiKey || !baseURL) {
    console.log("[RAG] Chat completions not available (no OpenAI key configured)");
    return null;
  }
  return new OpenAI({ apiKey, baseURL });
}

// Check if RAG (embeddings) is available
export function isRagAvailable(): boolean {
  return !!process.env.OPENAI_API_KEY || !!(process.env.AI_INTEGRATIONS_OPENAI_API_KEY && process.env.AI_INTEGRATIONS_OPENAI_BASE_URL);
}

export interface RagDocument {
  id: string;
  docType: string;
  title: string;
  content: string;
  technikId?: string;
  similarity?: number;
}

export interface RagSearchResult {
  documents: RagDocument[];
  query: string;
  searchTimeMs: number;
}

/**
 * Generate embedding for a text using OpenAI
 * Returns null if OpenAI API key is not available (embeddings require direct API key)
 */
export async function generateEmbedding(text: string): Promise<number[] | null> {
  const client = getOpenAIClientForEmbeddings();
  if (!client) {
    return null;
  }
  
  const response = await client.embeddings.create({
    model: EMBEDDING_MODEL,
    input: text,
  });
  return response.data[0].embedding;
}

/**
 * Search for relevant documents using semantic similarity
 * Uses Supabase RPC function match_rag_documents
 */
export async function searchRag(
  query: string,
  options: {
    limit?: number;
    threshold?: number;
    docType?: string;
    technikId?: string;
  } = {}
): Promise<RagSearchResult> {
  const startTime = Date.now();
  const { limit = 5, threshold = 0.3, docType, technikId } = options;

  try {
    const queryEmbedding = await generateEmbedding(query);
    
    if (!queryEmbedding) {
      console.log("[RAG] Embeddings not available (no OPENAI_API_KEY)");
      return { documents: [], query, searchTimeMs: Date.now() - startTime };
    }
    
    // Use Supabase RPC for similarity search
    const { data, error } = await supabase.rpc('match_rag_documents', {
      query_embedding: queryEmbedding,
      match_threshold: threshold,
      match_count: limit
    });

    if (error) {
      console.error("[RAG] Supabase RPC error:", error);
      return { documents: [], query, searchTimeMs: Date.now() - startTime };
    }

    // Filter by docType and technikId if provided
    let filteredData = data || [];
    
    // Support webinar source_type filter
    if (docType === 'webinar') {
      filteredData = filteredData.filter((row: any) => 
        row.doc_type === 'webinar' || (row.metadata && row.metadata.source_type === 'webinar')
      );
    } else if (docType) {
      filteredData = filteredData.filter((row: any) => row.doc_type === docType);
    }

    if (technikId) {
      filteredData = filteredData.filter((row: any) => 
        row.techniek_id === technikId || (row.metadata && row.metadata.techniek_ids && row.metadata.techniek_ids.includes(technikId))
      );
    }

    const documents: RagDocument[] = filteredData.map((row: any) => ({
      id: row.id,
      docType: row.doc_type,
      title: row.title,
      content: row.content,
      technikId: row.techniek_id,
      similarity: row.similarity,
    }));

    console.log(`[RAG] Supabase search returned ${documents.length} docs in ${Date.now() - startTime}ms`);

    return {
      documents,
      query,
      searchTimeMs: Date.now() - startTime,
    };
  } catch (error) {
    console.error("[RAG] Search error:", error);
    return {
      documents: [],
      query,
      searchTimeMs: Date.now() - startTime,
    };
  }
}

/**
 * Load and index the RAG corpus into Supabase
 * NOTE: Indexing should be done via .com Replit (single source of truth)
 * This function is kept for backwards compatibility
 */
export async function indexCorpus(): Promise<{ indexed: number; errors: number; needsApiKey?: boolean }> {
  console.log("[RAG] Indexing disabled on .ai Replit - use .com Replit for corpus management");
  return { indexed: 0, errors: 0 };
}

/**
 * Get document count from Supabase RAG database
 */
export async function getDocumentCount(): Promise<number> {
  const { count, error } = await supabase
    .from('rag_documents')
    .select('*', { count: 'exact', head: true });
  
  if (error) {
    console.error("[RAG] Count error:", error);
    return 0;
  }
  return count || 0;
}

/**
 * Get relevant Hugo training context for a technique or topic
 */
export async function getTrainingContext(
  sellerMessage: string,
  techniqueId?: string
): Promise<string | null> {
  const result = await searchRag(sellerMessage, {
    limit: 3,
    threshold: 0.6,
    docType: "hugo_training",
  });

  if (result.documents.length === 0) {
    return null;
  }

  const contextParts = result.documents.map((doc, i) => {
    const similarity = doc.similarity ? ` (${(doc.similarity * 100).toFixed(0)}%)` : "";
    return `[${i + 1}] ${doc.title}${similarity}:\n${doc.content.slice(0, 500)}...`;
  });

  return contextParts.join("\n\n");
}
