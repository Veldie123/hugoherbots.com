/**
 * RAG routes — indexing, tagging (v1 + v2 heuristic), review, export, technique names
 */
import { type Express, type Request, type Response } from "express";
import path from "path";
import fs from "fs";
import { requireAdmin } from "../auth-middleware";
import { pool } from "../db";
import { indexCorpus, getDocumentCount } from "../v2/rag-service";
import {
  bulkTagFromVideoMapping,
  getTaggingStats,
  getUntaggedChunks,
  tagChunksForVideo,
} from "../v2/rag-techniek-tagger";
import {
  getChunksForReview,
  approveChunk,
  rejectChunk,
  bulkApproveByTechnique,
  getReviewStats,
} from "../v2/rag-heuristic-tagger";
import {
  bulkSuggestTechniquesV2,
  resetHeuristicSuggestionsV2,
  clearHeuristicsCacheV2,
} from "../v2/rag-heuristic-tagger-v2";

/** Sanitize 500 errors: show details only in dev, generic message in production */
function sendError(res: Response, err: any, fallback = 'Er ging iets mis') {
  console.error('[API Error]', err?.message || err);
  const isDev = process.env.NODE_ENV !== 'production';
  res.status(500).json({ error: isDev ? (err?.message || fallback) : fallback });
}

export function registerRagRoutes(app: Express): void {
  // POST /api/v2/rag/index - Index the RAG corpus (admin only)
  app.post("/api/v2/rag/index", requireAdmin, async (req, res) => {
    try {
      console.log("[RAG] Starting corpus indexing...");
      const result = await indexCorpus();
      console.log("[RAG] Indexing complete:", result);
      res.json(result);
    } catch (error: any) {
      console.error("[RAG] Index error:", error.message);
      sendError(res, error);
    }
  });

  // GET /api/v2/rag/status - Get RAG corpus status
  app.get("/api/v2/rag/status", async (req, res) => {
    try {
      const count = await getDocumentCount();
      res.json({
        documentCount: count,
        status: count > 0 ? "indexed" : "empty",
      });
    } catch (error: any) {
      console.error("[RAG] Status error:", error.message);
      sendError(res, error);
    }
  });

  // POST /api/v2/rag/tag-bulk - Bulk tag all chunks from video mapping
  app.post("/api/v2/rag/tag-bulk", requireAdmin, async (req, res) => {
    try {
      console.log("[RAG-TAGGER] Starting bulk tagging from video_mapping.json");
      const result = await bulkTagFromVideoMapping();
      res.json(result);
    } catch (error: any) {
      console.error("[RAG-TAGGER] Bulk tag error:", error.message);
      sendError(res, error);
    }
  });

  // GET /api/v2/rag/tag-stats - Get tagging statistics
  app.get("/api/v2/rag/tag-stats", async (req, res) => {
    try {
      const stats = await getTaggingStats();
      res.json(stats);
    } catch (error: any) {
      console.error("[RAG-TAGGER] Stats error:", error.message);
      sendError(res, error);
    }
  });

  // GET /api/v2/technieken/names - Get technique number to name mapping
  app.get("/api/v2/technieken/names", async (req, res) => {
    try {
      const indexPath = path.join(process.cwd(), "config", "ssot", "technieken_index.json");
      const indexData = JSON.parse(fs.readFileSync(indexPath, "utf-8"));

      const nameMap: Record<string, string> = {};

      function extractNames(obj: any) {
        if (obj.nummer && obj.naam) {
          nameMap[obj.nummer] = obj.naam;
        }
        if (obj.technieken) {
          for (const tech of Object.values(obj.technieken)) {
            extractNames(tech);
          }
        }
        if (obj.subtechnieken) {
          for (const subId of obj.subtechnieken) {
            if (obj[subId]) {
              extractNames(obj[subId]);
            }
          }
        }
      }

      extractNames(indexData);
      res.json(nameMap);
    } catch (error: any) {
      console.error("[TECHNIEKEN] Names error:", error.message);
      sendError(res, error);
    }
  });

  // GET /api/v2/rag/untagged - Get untagged chunks for review
  app.get("/api/v2/rag/untagged", async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 50;
      const chunks = await getUntaggedChunks(limit);
      res.json({ chunks, count: chunks.length });
    } catch (error: any) {
      console.error("[RAG-TAGGER] Untagged error:", error.message);
      sendError(res, error);
    }
  });

  // POST /api/v2/rag/tag-video - Tag all chunks for a specific video
  app.post("/api/v2/rag/tag-video", requireAdmin, async (req, res) => {
    try {
      const { sourceId, technikId } = req.body;
      if (!sourceId || !technikId) {
        return res.status(400).json({ error: "sourceId and technikId required" });
      }
      const updated = await tagChunksForVideo(sourceId, technikId);
      res.json({ success: true, updated });
    } catch (error: any) {
      console.error("[RAG-TAGGER] Tag video error:", error.message);
      sendError(res, error);
    }
  });

  // POST /api/v2/rag/suggest-bulk - Run heuristic tagging on untagged chunks (V2 with primary/mentions)
  app.post("/api/v2/rag/suggest-bulk", requireAdmin, async (req, res) => {
    try {
      console.log("[HEURISTIC-V2] Starting bulk suggestion with SSOT validation");
      clearHeuristicsCacheV2();
      const result = await bulkSuggestTechniquesV2();
      res.json(result);
    } catch (error: any) {
      console.error("[HEURISTIC-V2] Suggest error:", error.message);
      sendError(res, error);
    }
  });

  // GET /api/v2/rag/review - Get chunks needing review
  app.get("/api/v2/rag/review", async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 50;
      const chunks = await getChunksForReview(limit);
      res.json({ chunks, count: chunks.length });
    } catch (error: any) {
      console.error("[HEURISTIC] Review list error:", error.message);
      sendError(res, error);
    }
  });

  // GET /api/v2/rag/review-stats - Get review statistics
  app.get("/api/v2/rag/review-stats", async (req, res) => {
    try {
      const stats = await getReviewStats();
      res.json(stats);
    } catch (error: any) {
      console.error("[HEURISTIC] Stats error:", error.message);
      sendError(res, error);
    }
  });

  // POST /api/v2/rag/approve/:id - Approve a chunk's suggested technique
  app.post("/api/v2/rag/approve/:id", requireAdmin, async (req, res) => {
    try {
      const id = req.params.id as string;
      const success = await approveChunk(id);
      res.json({ success });
    } catch (error: any) {
      console.error("[HEURISTIC] Approve error:", error.message);
      sendError(res, error);
    }
  });

  // POST /api/v2/rag/reject/:id - Reject a suggestion with optional correction
  app.post("/api/v2/rag/reject/:id", requireAdmin, async (req, res) => {
    try {
      const id = req.params.id as string;
      const { newTechniqueId } = req.body;
      const success = await rejectChunk(id, newTechniqueId);
      res.json({ success });
    } catch (error: any) {
      console.error("[HEURISTIC] Reject error:", error.message);
      sendError(res, error);
    }
  });

  // POST /api/v2/rag/approve-bulk - Bulk approve all suggestions for a technique
  app.post("/api/v2/rag/approve-bulk", requireAdmin, async (req, res) => {
    try {
      const { techniqueId } = req.body;
      if (!techniqueId) {
        return res.status(400).json({ error: "techniqueId required" });
      }
      const count = await bulkApproveByTechnique(techniqueId);
      res.json({ success: true, approved: count });
    } catch (error: any) {
      console.error("[HEURISTIC] Bulk approve error:", error.message);
      sendError(res, error);
    }
  });

  // POST /api/v2/rag/reset-suggestions - Reset all heuristic suggestions (V2)
  app.post("/api/v2/rag/reset-suggestions", requireAdmin, async (req, res) => {
    try {
      clearHeuristicsCacheV2();
      const result = await resetHeuristicSuggestionsV2();
      res.json({ success: true, ...result });
    } catch (error: any) {
      console.error("[HEURISTIC-V2] Reset error:", error.message);
      sendError(res, error);
    }
  });

  // GET /api/v2/rag/export - Export all chunks as CSV
  app.get("/api/v2/rag/export", async (req, res) => {
    try {
      const result = await pool.query(`
        SELECT
          id,
          source_id,
          techniek_id,
          suggested_techniek_id,
          CASE
            WHEN techniek_id IS NOT NULL THEN 'video_tagged'
            WHEN suggested_techniek_id IS NOT NULL THEN 'heuristic_suggested'
            ELSE 'untagged'
          END as tag_source,
          COALESCE(techniek_id, suggested_techniek_id) as effective_techniek,
          content
        FROM rag_documents
        ORDER BY source_id, id
      `);

      const format = req.query.format || 'json';

      if (format === 'csv') {
        const csvHeader = 'id,source_id,techniek_id,suggested_techniek_id,tag_source,effective_techniek,content\n';
        const csvRows = result.rows.map(row => {
          const escapeCsv = (val: string | null) => {
            if (val === null) return '';
            return `"${String(val).replace(/"/g, '""').replace(/\n/g, ' ').replace(/\r/g, ' ')}"`;
          };
          return [
            row.id,
            escapeCsv(row.source_id),
            escapeCsv(row.techniek_id),
            escapeCsv(row.suggested_techniek_id),
            row.tag_source,
            escapeCsv(row.effective_techniek),
            escapeCsv(row.content),
          ].join(',');
        }).join('\n');

        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', 'attachment; filename=rag_chunks_export.csv');
        res.send('\ufeff' + csvHeader + csvRows);
      } else {
        res.json({
          total: result.rows.length,
          chunks: result.rows,
        });
      }
    } catch (error: any) {
      console.error("[RAG] Export error:", error.message);
      sendError(res, error);
    }
  });
}
