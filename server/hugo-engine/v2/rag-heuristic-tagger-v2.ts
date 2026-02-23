/**
 * RAG Heuristic Tagger V2 Service
 * 
 * Advanced chunk tagging with:
 * - SSOT validation (fails hard on unknown technique IDs)
 * - Anchor/support weighted scoring
 * - Primary/mentions policy (parent phases get primary when multiple children match)
 * - Text normalization
 */

import { pool } from "../db";
import * as fs from "fs";
import * as path from "path";

interface TechniqueConfig {
  naam: string;
  kind: "phase" | "overview" | "technique" | "theme";
  emit: ("primary" | "mention")[];
  anchors: string[];
  support: string[];
  min_anchor_matches?: number;
  min_support_matches?: number;
  notes?: string;
}

interface ScoringConfig {
  anchor_weight: number;
  support_weight: number;
  min_score_to_consider: number;
  leaf_dominance_margin: number;
}

interface PrimaryPolicy {
  prefer_parent_primary_when: {
    min_distinct_child_mentions: number;
    or_parent_anchor_hit: boolean;
  };
  parent_child_bonus_per_distinct_child: number;
}

interface HeuristicsConfigV2 {
  version: string;
  description: string;
  ssot: {
    source_file: string;
    enforce_ids_exist: boolean;
  };
  normalization: {
    lowercase: boolean;
    strip_diacritics: boolean;
    remove_punctuation: boolean;
    collapse_whitespace: boolean;
  };
  scoring: ScoringConfig;
  primary_policy: PrimaryPolicy;
  techniques: {
    [techniqueId: string]: TechniqueConfig;
  };
  global_excludes: string[];
}

interface TechniqueMatch {
  techniqueId: string;
  kind: string;
  score: number;
  anchorHits: number;
  supportHits: number;
  matchedAnchors: string[];
  matchedSupport: string[];
}

interface TaggingResult {
  primary: string | null;
  mentions: string[];
  scores: { [id: string]: number };
}

interface BulkResult {
  processed: number;
  suggested: number;
  noMatch: number;
  errors: string[];
}

let heuristicsCache: HeuristicsConfigV2 | null = null;
let ssotIdsCache: Set<string> | null = null;

function loadSSOTIds(): Set<string> {
  if (ssotIdsCache) return ssotIdsCache;
  
  const ssotPath = path.join(process.cwd(), "config", "ssot", "technieken_index.json");
  const data = fs.readFileSync(ssotPath, "utf-8");
  const ssot = JSON.parse(data);
  
  const ids = new Set<string>();
  
  function extractIds(obj: any) {
    if (obj && typeof obj === "object") {
      if (obj.nummer) ids.add(obj.nummer);
      for (const key of Object.keys(obj)) {
        extractIds(obj[key]);
      }
    }
  }
  
  extractIds(ssot.technieken || ssot);
  ssotIdsCache = ids;
  console.log(`[HEURISTIC-V2] Loaded ${ids.size} SSOT technique IDs`);
  return ids;
}

function loadHeuristicsV2(): HeuristicsConfigV2 {
  if (heuristicsCache) return heuristicsCache;
  
  const heuristicsPath = path.join(process.cwd(), "config", "rag_heuristics.json");
  const data = fs.readFileSync(heuristicsPath, "utf-8");
  const config: HeuristicsConfigV2 = JSON.parse(data);
  
  if (config.ssot?.enforce_ids_exist) {
    const ssotIds = loadSSOTIds();
    const invalidIds: string[] = [];
    
    for (const techniqueId of Object.keys(config.techniques)) {
      if (!ssotIds.has(techniqueId)) {
        invalidIds.push(techniqueId);
      }
    }
    
    if (invalidIds.length > 0) {
      throw new Error(
        `[HEURISTIC-V2] SSOT validation FAILED! Invalid technique IDs in rag_heuristics.json: ${invalidIds.join(", ")}. ` +
        `These IDs do not exist in technieken_index.json. Remove them from heuristics.`
      );
    }
    console.log(`[HEURISTIC-V2] SSOT validation passed: all ${Object.keys(config.techniques).length} technique IDs are valid`);
  }
  
  heuristicsCache = config;
  return config;
}

export function clearHeuristicsCacheV2(): void {
  heuristicsCache = null;
  ssotIdsCache = null;
}

function normalizeText(text: string, config: HeuristicsConfigV2["normalization"]): string {
  let normalized = text;
  
  if (config.lowercase) {
    normalized = normalized.toLowerCase();
  }
  
  if (config.strip_diacritics) {
    normalized = normalized.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  }
  
  if (config.remove_punctuation) {
    normalized = normalized.replace(/[.,!?;:'"()\[\]{}]/g, " ");
  }
  
  if (config.collapse_whitespace) {
    normalized = normalized.replace(/\s+/g, " ").trim();
  }
  
  return normalized;
}

function getParentId(techniqueId: string): string | null {
  const parts = techniqueId.split(".");
  if (parts.length <= 1) return null;
  parts.pop();
  return parts.join(".");
}

function isChildOf(childId: string, parentId: string): boolean {
  return childId.startsWith(parentId + ".") && childId !== parentId;
}

export function analyzeChunkV2(content: string): TaggingResult {
  const config = loadHeuristicsV2();
  const normalized = normalizeText(content, config.normalization);
  
  const matches: TechniqueMatch[] = [];
  
  for (const [techniqueId, techConfig] of Object.entries(config.techniques)) {
    let anchorHits = 0;
    let supportHits = 0;
    const matchedAnchors: string[] = [];
    const matchedSupport: string[] = [];
    
    for (const anchor of techConfig.anchors || []) {
      const normalizedAnchor = normalizeText(anchor, config.normalization);
      if (normalized.includes(normalizedAnchor)) {
        anchorHits++;
        matchedAnchors.push(anchor);
      }
    }
    
    for (const support of techConfig.support || []) {
      const normalizedSupport = normalizeText(support, config.normalization);
      if (normalized.includes(normalizedSupport)) {
        supportHits++;
        matchedSupport.push(support);
      }
    }
    
    const minAnchors = techConfig.min_anchor_matches ?? 1;
    const minSupport = techConfig.min_support_matches ?? 0;
    
    if (anchorHits < minAnchors) continue;
    if (supportHits < minSupport) continue;
    
    const score = 
      anchorHits * config.scoring.anchor_weight + 
      supportHits * config.scoring.support_weight;
    
    if (score >= config.scoring.min_score_to_consider) {
      matches.push({
        techniqueId,
        kind: techConfig.kind,
        score,
        anchorHits,
        supportHits,
        matchedAnchors,
        matchedSupport
      });
    }
  }
  
  if (matches.length === 0) {
    return { primary: null, mentions: [], scores: {} };
  }
  
  const mentions = matches.map(m => m.techniqueId);
  const scores: { [id: string]: number } = {};
  matches.forEach(m => { scores[m.techniqueId] = m.score; });
  
  let bestLeaf: TechniqueMatch | null = null;
  for (const match of matches) {
    if (match.kind === "technique" || match.kind === "theme") {
      if (!bestLeaf || match.score > bestLeaf.score) {
        bestLeaf = match;
      }
    }
  }
  
  let primary: string | null = bestLeaf?.techniqueId || null;
  
  const policy = config.primary_policy;
  
  const potentialParentIds = new Set<string>();
  for (const m of mentions) {
    const parentId = getParentId(m);
    if (parentId) potentialParentIds.add(parentId);
    const grandParentId = parentId ? getParentId(parentId) : null;
    if (grandParentId) potentialParentIds.add(grandParentId);
  }
  
  for (const parentId of potentialParentIds) {
    const childMentions = mentions.filter(m => isChildOf(m, parentId));
    const distinctChildCount = new Set(childMentions).size;
    
    if (distinctChildCount < policy.prefer_parent_primary_when.min_distinct_child_mentions) {
      continue;
    }
    
    const parentMatch = matches.find(m => m.techniqueId === parentId);
    const parentAnchorHit = parentMatch ? parentMatch.anchorHits > 0 : false;
    
    const parentScoreBase = parentMatch?.score || 0;
    const parentScore = parentScoreBase + 
      (distinctChildCount * policy.parent_child_bonus_per_distinct_child);
    
    const shouldPreferParent = 
      distinctChildCount >= policy.prefer_parent_primary_when.min_distinct_child_mentions ||
      (policy.prefer_parent_primary_when.or_parent_anchor_hit && parentAnchorHit);
    
    if (shouldPreferParent) {
      const leafScore = bestLeaf?.score || 0;
      if (parentScore > leafScore - config.scoring.leaf_dominance_margin) {
        primary = parentId;
      }
    }
  }
  
  if (!primary && matches.length > 0) {
    primary = matches.sort((a, b) => b.score - a.score)[0].techniqueId;
  }
  
  return {
    primary,
    mentions: [...new Set(mentions)],
    scores
  };
}

export async function bulkSuggestTechniquesV2(): Promise<BulkResult> {
  const result: BulkResult = {
    processed: 0,
    suggested: 0,
    noMatch: 0,
    errors: []
  };
  
  try {
    loadHeuristicsV2();
    
    const { rows: chunks } = await pool.query(`
      SELECT id, content, source_id, title
      FROM rag_documents 
      WHERE (techniek_id IS NULL OR techniek_id = '')
        AND (suggested_techniek_id IS NULL OR suggested_techniek_id = '')
      LIMIT 500
    `);
    
    console.log(`[HEURISTIC-V2] Processing ${chunks.length} untagged chunks`);
    
    for (const chunk of chunks) {
      result.processed++;
      
      try {
        const tagging = analyzeChunkV2(chunk.content);
        
        if (tagging.primary) {
          await pool.query(
            `UPDATE rag_documents 
             SET suggested_techniek_id = $1, 
                 suggested_mentions = $2::jsonb,
                 needs_review = TRUE,
                 review_status = 'suggested'
             WHERE id = $3`,
            [tagging.primary, JSON.stringify(tagging.mentions), chunk.id]
          );
          result.suggested++;
        } else {
          result.noMatch++;
        }
      } catch (err: any) {
        result.errors.push(`Chunk ${chunk.id}: ${err.message}`);
      }
    }
    
    console.log(`[HEURISTIC-V2] Suggested: ${result.suggested}, No match: ${result.noMatch}`);
    
  } catch (err: any) {
    result.errors.push(`Bulk processing failed: ${err.message}`);
    console.error(`[HEURISTIC-V2] Error:`, err.message);
  }
  
  return result;
}

export async function resetHeuristicSuggestionsV2(): Promise<{ reset: number }> {
  const { rowCount } = await pool.query(`
    UPDATE rag_documents 
    SET suggested_techniek_id = NULL,
        suggested_mentions = NULL,
        needs_review = FALSE,
        review_status = NULL
    WHERE suggested_techniek_id IS NOT NULL
      AND review_status IN ('suggested', 'pending')
  `);
  
  console.log(`[HEURISTIC-V2] Reset ${rowCount} heuristic suggestions`);
  
  return { reset: rowCount || 0 };
}

export { 
  getChunksForReview, 
  approveChunk, 
  rejectChunk, 
  bulkApproveByTechnique,
  getReviewStats 
} from "./rag-heuristic-tagger";
