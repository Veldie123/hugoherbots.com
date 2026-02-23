/**
 * RAG Heuristic Tagger Service
 * 
 * Semi-automatic chunk-level tagging using keyword heuristics from detectors.json.
 * Suggests technique_id for chunks that don't have one, based on content matching.
 * 
 * Flow:
 * 1. analyzeChunk(content) → returns suggested technique + confidence
 * 2. bulkSuggestTechniques() → processes all untagged chunks
 * 3. Admin reviews suggestions and approves/rejects
 */

import { pool } from "../db";
import * as fs from "fs";
import * as path from "path";

interface DetectorPattern {
  patterns: string[];
  semantic?: string[];
  confidence_threshold?: number;
}

interface HeuristicPattern {
  patterns: string[];
  min_matches?: number;
}

interface HeuristicsConfig {
  version: string;
  techniques: {
    [techniqueId: string]: HeuristicPattern;
  };
  global_excludes?: string[];
}

interface DetectorsConfig {
  version: string;
  techniques: {
    [techniqueId: string]: DetectorPattern;
  };
  lexicon?: {
    [category: string]: string[];
  };
}

interface TechniqueSuggestion {
  techniqueId: string;
  confidence: number;
  matchedPatterns: string[];
}

interface HeuristicResult {
  processed: number;
  suggested: number;
  noMatch: number;
  errors: string[];
}

let heuristicsCache: HeuristicsConfig | null = null;

/**
 * Load heuristics configuration (specific patterns for RAG tagging)
 */
function loadHeuristics(): HeuristicsConfig {
  if (heuristicsCache) return heuristicsCache;
  
  const heuristicsPath = path.join(process.cwd(), "config", "rag_heuristics.json");
  const data = fs.readFileSync(heuristicsPath, "utf-8");
  heuristicsCache = JSON.parse(data);
  return heuristicsCache!;
}

/**
 * Clear cache (for reloading after config changes)
 */
export function clearHeuristicsCache(): void {
  heuristicsCache = null;
}

/**
 * Analyze chunk content and suggest a technique based on SPECIFIC keyword matching
 * Uses rag_heuristics.json which has more specific patterns than detectors.json
 */
export function analyzeChunk(content: string): TechniqueSuggestion | null {
  const heuristics = loadHeuristics();
  const contentLower = content.toLowerCase();
  
  // Check for global excludes - if content is too generic, skip
  const globalExcludes = heuristics.global_excludes || [];
  const hasOnlyGenericTerms = globalExcludes.some(term => 
    contentLower.includes(term) && contentLower.length < 100
  );
  if (hasOnlyGenericTerms && contentLower.length < 50) {
    return null; // Too short and only generic terms
  }
  
  let bestMatch: TechniqueSuggestion | null = null;
  
  for (const [techniqueId, config] of Object.entries(heuristics.techniques)) {
    if (!config.patterns || config.patterns.length === 0) continue;
    
    const matchedPatterns: string[] = [];
    let matchCount = 0;
    
    for (const pattern of config.patterns) {
      if (contentLower.includes(pattern.toLowerCase())) {
        matchedPatterns.push(pattern);
        matchCount++;
      }
    }
    
    // Check minimum matches requirement
    const minMatches = config.min_matches || 1;
    if (matchCount < minMatches) continue;
    
    // Calculate confidence: higher for more specific matches
    const confidence = Math.min(0.95, 0.5 + (matchCount * 0.15));
    
    if (!bestMatch || confidence > bestMatch.confidence || 
        (confidence === bestMatch.confidence && matchCount > bestMatch.matchedPatterns.length)) {
      bestMatch = {
        techniqueId,
        confidence,
        matchedPatterns
      };
    }
  }
  
  return bestMatch;
}

/**
 * Process all untagged chunks and add suggestions
 */
export async function bulkSuggestTechniques(): Promise<HeuristicResult> {
  const result: HeuristicResult = {
    processed: 0,
    suggested: 0,
    noMatch: 0,
    errors: []
  };
  
  try {
    // Get chunks without technique_id that haven't been reviewed
    const { rows: chunks } = await pool.query(`
      SELECT id, content, source_id, title
      FROM rag_documents 
      WHERE (techniek_id IS NULL OR techniek_id = '')
        AND (suggested_techniek_id IS NULL OR suggested_techniek_id = '')
      LIMIT 500
    `);
    
    console.log(`[HEURISTIC] Processing ${chunks.length} untagged chunks`);
    
    for (const chunk of chunks) {
      result.processed++;
      
      try {
        const suggestion = analyzeChunk(chunk.content);
        
        if (suggestion && suggestion.confidence >= 0.5) {
          await pool.query(
            `UPDATE rag_documents 
             SET suggested_techniek_id = $1, 
                 needs_review = TRUE,
                 review_status = 'suggested'
             WHERE id = $2`,
            [suggestion.techniqueId, chunk.id]
          );
          result.suggested++;
        } else {
          result.noMatch++;
        }
      } catch (err: any) {
        result.errors.push(`Chunk ${chunk.id}: ${err.message}`);
      }
    }
    
    console.log(`[HEURISTIC] Suggested: ${result.suggested}, No match: ${result.noMatch}`);
    
  } catch (err: any) {
    result.errors.push(`Bulk processing failed: ${err.message}`);
  }
  
  return result;
}

/**
 * Get chunks needing review with their suggestions
 */
export async function getChunksForReview(limit: number = 50): Promise<{
  id: string;
  source_id: string;
  title: string;
  content_preview: string;
  content: string;
  techniek_id: string | null;
  suggested_techniek_id: string | null;
  review_status: string;
}[]> {
  const { rows } = await pool.query(`
    SELECT id, source_id, title, 
           LEFT(content, 200) as content_preview,
           content,
           techniek_id, suggested_techniek_id, review_status
    FROM rag_documents 
    WHERE needs_review = TRUE 
      AND review_status IN ('suggested', 'pending')
    ORDER BY suggested_techniek_id, source_id
    LIMIT $1
  `, [limit]);
  
  return rows;
}

/**
 * Approve a suggested technique for a chunk
 */
export async function approveChunk(chunkId: string, useExisting: boolean = false): Promise<boolean> {
  const { rowCount } = await pool.query(`
    UPDATE rag_documents 
    SET techniek_id = CASE 
          WHEN $2 THEN techniek_id 
          ELSE COALESCE(suggested_techniek_id, techniek_id)
        END,
        approved_techniek_id = COALESCE(suggested_techniek_id, techniek_id),
        needs_review = FALSE,
        review_status = 'approved'
    WHERE id = $1
  `, [chunkId, useExisting]);
  
  return (rowCount || 0) > 0;
}

/**
 * Reject a suggestion and optionally set a different technique
 */
export async function rejectChunk(chunkId: string, newTechniqueId?: string): Promise<boolean> {
  if (newTechniqueId) {
    const { rowCount } = await pool.query(`
      UPDATE rag_documents 
      SET techniek_id = $2,
          approved_techniek_id = $2,
          needs_review = FALSE,
          review_status = 'corrected'
      WHERE id = $1
    `, [chunkId, newTechniqueId]);
    return (rowCount || 0) > 0;
  } else {
    const { rowCount } = await pool.query(`
      UPDATE rag_documents 
      SET needs_review = FALSE,
          review_status = 'rejected'
      WHERE id = $1
    `, [chunkId]);
    return (rowCount || 0) > 0;
  }
}

/**
 * Bulk approve all suggestions for a specific technique
 */
export async function bulkApproveByTechnique(techniqueId: string): Promise<number> {
  const { rowCount } = await pool.query(`
    UPDATE rag_documents 
    SET techniek_id = suggested_techniek_id,
        approved_techniek_id = suggested_techniek_id,
        needs_review = FALSE,
        review_status = 'approved'
    WHERE suggested_techniek_id = $1
      AND needs_review = TRUE
      AND review_status = 'suggested'
  `, [techniqueId]);
  
  return rowCount || 0;
}

/**
 * Get review statistics
 */
export async function getReviewStats(): Promise<{
  needsReview: number;
  approved: number;
  rejected: number;
  corrected: number;
  pending: number;
  byTechnique: { technique: string; count: number }[];
}> {
  const { rows: statusCounts } = await pool.query(`
    SELECT 
      COUNT(CASE WHEN needs_review = TRUE THEN 1 END) as needs_review,
      COUNT(CASE WHEN review_status = 'approved' THEN 1 END) as approved,
      COUNT(CASE WHEN review_status = 'rejected' THEN 1 END) as rejected,
      COUNT(CASE WHEN review_status = 'corrected' THEN 1 END) as corrected,
      COUNT(CASE WHEN review_status = 'pending' THEN 1 END) as pending
    FROM rag_documents
  `);
  
  const { rows: byTechnique } = await pool.query(`
    SELECT suggested_techniek_id as technique, COUNT(*) as count
    FROM rag_documents
    WHERE needs_review = TRUE AND suggested_techniek_id IS NOT NULL
    GROUP BY suggested_techniek_id
    ORDER BY count DESC
    LIMIT 15
  `);
  
  return {
    needsReview: parseInt(statusCounts[0]?.needs_review || "0"),
    approved: parseInt(statusCounts[0]?.approved || "0"),
    rejected: parseInt(statusCounts[0]?.rejected || "0"),
    corrected: parseInt(statusCounts[0]?.corrected || "0"),
    pending: parseInt(statusCounts[0]?.pending || "0"),
    byTechnique: byTechnique.map(r => ({ 
      technique: r.technique, 
      count: parseInt(r.count) 
    }))
  };
}

/**
 * Reset all heuristic suggestions (clear suggested_techniek_id and needs_review flags)
 * Use this to start fresh with only video-level tagging
 */
export async function resetHeuristicSuggestions(): Promise<{ reset: number }> {
  const { rowCount } = await pool.query(`
    UPDATE rag_documents 
    SET suggested_techniek_id = NULL,
        needs_review = FALSE,
        review_status = NULL
    WHERE suggested_techniek_id IS NOT NULL
      AND review_status IN ('suggested', 'pending')
  `);
  
  console.log(`[HEURISTIC] Reset ${rowCount} heuristic suggestions`);
  
  return { reset: rowCount || 0 };
}
