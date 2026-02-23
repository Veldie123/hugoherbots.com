/**
 * RAG Techniek Tagger Service
 * 
 * Syncs technique_id from video_mapping.json to rag_documents table.
 * Video-level tagging: all chunks from a video inherit the video's technique.
 * 
 * Usage:
 * - bulkTagFromVideoMapping(): One-time sync of all existing chunks
 * - tagChunksForVideo(sourceId, technikId): Tag chunks for a specific video
 * - getUntaggedChunks(): Get chunks that need review
 */

import { pool } from "../db";
import * as fs from "fs";
import * as path from "path";

interface VideoMapping {
  _meta: {
    description: string;
    updated: string;
    source: string;
    total_videos: number;
  };
  videos: {
    [fileName: string]: {
      id: string;
      title: string;
      file_name: string;
      fase: number | null;
      fase_naam: string;
      techniek: string | null;
      techniek_naam: string;
      techniek_source: string;
      has_transcript: boolean;
      ai_confidence: number | null;
    };
  };
}

interface TaggingResult {
  success: boolean;
  tagged: number;
  skipped: number;
  errors: string[];
}

/**
 * Load video mapping from config
 */
function loadVideoMapping(): VideoMapping {
  const mappingPath = path.join(process.cwd(), "config", "video_mapping.json");
  const data = fs.readFileSync(mappingPath, "utf-8");
  return JSON.parse(data);
}

/**
 * Strip all known extensions from a filename
 * Handles: .MP4, .mp4, .mov, .MOV, .m4a, .M4A, .wav, .WAV
 */
function stripExtension(filename: string): string {
  return filename.replace(/\.(MP4|mp4|mov|MOV|m4a|M4A|wav|WAV)$/i, "");
}

/**
 * Build a lookup map: source_id -> techniek_id
 * Handles various source_id formats (MVI_0080, MVI_0080.MP4, MVI_0080.m4a, etc.)
 */
function buildSourceToTechnikMap(mapping: VideoMapping): Map<string, string> {
  const lookup = new Map<string, string>();
  
  for (const [fileName, video] of Object.entries(mapping.videos)) {
    if (!video.techniek) continue;
    
    // Add multiple lookup keys for flexibility
    const baseId = video.title; // e.g., "MVI_0080"
    const fullName = fileName; // e.g., "MVI_0080.MP4"
    const noExt = stripExtension(fileName);
    
    // Store with lowercase keys for case-insensitive matching
    lookup.set(noExt.toLowerCase(), video.techniek);
    lookup.set(baseId.toLowerCase(), video.techniek);
    lookup.set(fullName.toLowerCase(), video.techniek);
  }
  
  return lookup;
}

/**
 * Bulk update all rag_documents with technique_id from video mapping
 */
export async function bulkTagFromVideoMapping(): Promise<TaggingResult> {
  const result: TaggingResult = {
    success: false,
    tagged: 0,
    skipped: 0,
    errors: []
  };
  
  try {
    const mapping = loadVideoMapping();
    const lookup = buildSourceToTechnikMap(mapping);
    
    console.log(`[RAG-TAGGER] Loaded ${lookup.size} source->techniek mappings`);
    
    // Get all rag_documents with source_id
    const { rows: docs } = await pool.query(`
      SELECT id, source_id, techniek_id 
      FROM rag_documents 
      WHERE source_id IS NOT NULL AND source_id != ''
    `);
    
    console.log(`[RAG-TAGGER] Found ${docs.length} documents with source_id`);
    
    for (const doc of docs) {
      const sourceId = doc.source_id;
      const existingTechnik = doc.techniek_id;
      
      // Normalize source_id: lowercase and strip extension
      const normalizedSourceId = stripExtension(sourceId || "").toLowerCase();
      
      // Try to find techniek for this source
      let techniek = lookup.get(normalizedSourceId);
      
      // Fallback: if source_id is like "techniek_X.X.X" or "techniek_4.INDIEN", extract the technique ID directly
      if (!techniek && sourceId) {
        const technikMatch = sourceId.match(/^techniek_(\d+(?:\.\d+)*(?:\.[A-Z]+)?)/i);
        if (technikMatch) {
          techniek = technikMatch[1].toUpperCase().includes('INDIEN') 
            ? technikMatch[1].replace(/indien/i, 'INDIEN') 
            : technikMatch[1];
          console.log(`[RAG-TAGGER] Extracted techniek ${techniek} from source_id ${sourceId}`);
        }
      }
      
      if (!techniek) {
        result.skipped++;
        continue;
      }
      
      // Skip if already tagged with same techniek
      if (existingTechnik === techniek) {
        result.skipped++;
        continue;
      }
      
      // Update the document
      try {
        await pool.query(
          `UPDATE rag_documents SET techniek_id = $1 WHERE id = $2`,
          [techniek, doc.id]
        );
        result.tagged++;
      } catch (err: any) {
        result.errors.push(`Failed to update ${doc.id}: ${err.message}`);
      }
    }
    
    result.success = result.errors.length === 0;
    console.log(`[RAG-TAGGER] Tagged: ${result.tagged}, Skipped: ${result.skipped}, Errors: ${result.errors.length}`);
    
  } catch (err: any) {
    result.errors.push(`Bulk tagging failed: ${err.message}`);
  }
  
  return result;
}

/**
 * Tag all chunks for a specific video source
 */
export async function tagChunksForVideo(sourceId: string, technikId: string): Promise<number> {
  const { rowCount } = await pool.query(
    `UPDATE rag_documents SET techniek_id = $1 WHERE source_id = $2`,
    [technikId, sourceId]
  );
  return rowCount || 0;
}

/**
 * Get statistics about tagging status
 */
export async function getTaggingStats(): Promise<{
  total: number;
  tagged: number;
  untagged: number;
  byTechniek: { techniek_id: string; count: number }[];
}> {
  const { rows: stats } = await pool.query(`
    SELECT 
      COUNT(*) as total,
      COUNT(CASE WHEN techniek_id IS NOT NULL AND techniek_id != '' THEN 1 END) as tagged,
      COUNT(CASE WHEN techniek_id IS NULL OR techniek_id = '' THEN 1 END) as untagged
    FROM rag_documents
  `);
  
  const { rows: byTechniek } = await pool.query(`
    SELECT techniek_id, COUNT(*) as count 
    FROM rag_documents 
    WHERE techniek_id IS NOT NULL AND techniek_id != ''
    GROUP BY techniek_id 
    ORDER BY count DESC
    LIMIT 20
  `);
  
  return {
    total: parseInt(stats[0]?.total || "0"),
    tagged: parseInt(stats[0]?.tagged || "0"),
    untagged: parseInt(stats[0]?.untagged || "0"),
    byTechniek: byTechniek.map(r => ({ 
      techniek_id: r.techniek_id, 
      count: parseInt(r.count) 
    }))
  };
}

/**
 * Get untagged chunks that need review
 */
export async function getUntaggedChunks(limit: number = 50): Promise<{
  id: string;
  source_id: string;
  title: string;
  content_preview: string;
  doc_type: string;
}[]> {
  const { rows } = await pool.query(`
    SELECT id, source_id, title, LEFT(content, 200) as content_preview, doc_type
    FROM rag_documents 
    WHERE (techniek_id IS NULL OR techniek_id = '') 
      AND source_id IS NOT NULL 
      AND source_id != ''
    LIMIT $1
  `, [limit]);
  
  return rows;
}
