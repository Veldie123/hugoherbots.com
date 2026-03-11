/**
 * Admin routes — corrections, notifications, onboarding wizard, stats, welcome briefing
 */
import { type Express, type Request, type Response } from "express";
import path from "path";
import fs from "fs";
import { pool } from "../db";
import { supabase } from "../supabase-client";
import { getAdminStats } from "../admin-stats";
import { getAnthropicClient, HERO_MODEL } from "../v3/anthropic-client";

const SUPERADMIN_EMAIL = "stephane@hugoherbots.com";

/** Sanitize 500 errors: show details only in dev, generic message in production */
function sendError(res: Response, err: any, fallback = 'Er ging iets mis') {
  console.error('[API Error]', err?.message || err);
  const isDev = process.env.NODE_ENV !== 'production';
  res.status(500).json({ error: isDev ? (err?.message || fallback) : fallback });
}

export function registerAdminRoutes(app: Express): void {
  // ===========================================
  // ADMIN CORRECTIONS API
  // ===========================================

  app.post("/api/v2/admin/corrections", async (req: Request, res: Response) => {
    try {
      const { analysisId, type, field, originalValue, newValue, context, submittedBy, source, targetFile, targetKey, originalJson, newJson } = req.body;
      if (!type || !field || !newValue) {
        return res.status(400).json({ error: 'Missing required fields: type, field, newValue' });
      }
      const insertResult = await pool.query(
        `INSERT INTO admin_corrections (analysis_id, type, field, original_value, new_value, context, submitted_by, source, target_file, target_key, original_json, new_json)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
         RETURNING *`,
        [
          analysisId || null,
          type,
          field,
          originalValue || '',
          newValue,
          context || '',
          submittedBy || 'admin',
          source || 'analysis',
          targetFile || null,
          targetKey || null,
          originalJson ? (typeof originalJson === 'string' ? originalJson : JSON.stringify(originalJson)) : null,
          newJson ? (typeof newJson === 'string' ? newJson : JSON.stringify(newJson)) : null,
        ]
      );
      const correction = insertResult.rows[0];

      const submitter = submittedBy || 'admin';
      const corrSource = source || 'analysis';
      const titleMap: Record<string, string> = {
        'technique_edit': `Techniek ${field} bewerkt door ${submitter}`,
        'video_edit': `Video ${field} bewerkt door ${submitter}`,
        'chat_correction': `Chat correctie: ${field} door ${submitter}`,
        'analysis_correction': `Analyse correctie: ${field} door ${submitter}`,
        'ssot_edit': `SSOT ${field} bewerkt door ${submitter}`,
      };
      const notifTitle = titleMap[corrSource] || `Correctie: ${field} door ${submitter}`;
      const notifSeverity = ['technique_edit', 'ssot_edit'].includes(corrSource) ? 'warning' : 'info';
      const notifMessage = `${submitter} heeft ${field} gewijzigd van "${originalValue || '(leeg)'}" naar "${newValue}". Bron: ${corrSource}${targetFile ? `, bestand: ${targetFile}` : ''}${targetKey ? `, key: ${targetKey}` : ''}`;

      let notificationCreated = false;
      try {
        await pool.query(
          `INSERT INTO admin_notifications (type, title, message, category, severity, related_id, related_page)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          ['correction_submitted', notifTitle, notifMessage, 'content', notifSeverity, correction.id, 'admin-config-review']
        );
        notificationCreated = true;
        console.log(`[Admin] Notification created for correction #${correction.id}`);
      } catch (notifErr: any) {
        console.error(`[Admin] Failed to create notification for correction #${correction.id}:`, notifErr.message, notifErr.code, notifErr.detail);
      }

      res.json({ correction, notificationCreated, message: 'Correctie ingediend voor review' });
    } catch (err: any) {
      console.error('[Admin] Correction submit error:', err);
      sendError(res, err, 'Correctie opslaan mislukt');
    }
  });

  // AI-interpreted correction from Hugo's free-text feedback
  app.post("/api/v2/admin/corrections/interpret", async (req: Request, res: Response) => {
    try {
      const { analysisId, turnIdx, turnText, turnSpeaker, expertFeedback, context } = req.body;
      if (!expertFeedback?.trim()) {
        return res.status(400).json({ error: 'expertFeedback is required' });
      }

      // Build SSOT technique list for the prompt
      const { buildSSOTTechniqueList } = await import("../v3/live-analyse-prompt");
      const techniqueList = buildSSOTTechniqueList();

      // Build houding list
      const houdPath = path.join(process.cwd(), "config/klant_houdingen.json");
      const houdData = JSON.parse(fs.readFileSync(houdPath, "utf-8"));
      const houdingList = Object.values(houdData.houdingen)
        .map((h: any) => `${h.id} "${h.naam}"`)
        .join(", ");

      const anthropic = getAnthropicClient();
      const response = await anthropic.messages.create({
        model: HERO_MODEL,
        max_tokens: 500,
        messages: [{
          role: "user",
          content: `Hugo Herbots (sales coach, expert in EPIC-methodologie) heeft feedback gegeven op een AI-analyse van een verkoopgesprek.

Turn ${turnIdx} (${turnSpeaker}): "${turnText}"
AI detecteerde: technieken=${context?.detectedTechniques || 'geen'}, houding=${context?.detectedHouding || 'onbekend'}

Hugo's feedback: "${expertFeedback}"

EPIC Technieken (exacte nummers en namen):
${techniqueList}

Klanthoudingen: ${houdingList}

Interpreteer Hugo's feedback. Antwoord ALLEEN in valid JSON:
{
  "type": "technique" | "houding" | "other",
  "detectedValue": "wat AI detecteerde (nummer of houding-id)",
  "correctedValue": "wat Hugo zegt dat correct is (exact techniek-nummer of houding-id)",
  "confidence": 0.0-1.0,
  "reasoning": "korte uitleg in het Nederlands"
}`,
        }],
      });

      const aiText = response.content[0].type === "text" ? response.content[0].text : "";
      let interpretation: any;
      try {
        const jsonMatch = aiText.match(/\{[\s\S]*\}/);
        interpretation = jsonMatch ? JSON.parse(jsonMatch[0]) : { type: "other", detectedValue: "", correctedValue: expertFeedback, confidence: 0.5, reasoning: "Kon niet automatisch interpreteren" };
      } catch {
        interpretation = { type: "other", detectedValue: "", correctedValue: expertFeedback, confidence: 0.3, reasoning: "JSON parse fout — handmatige review nodig" };
      }

      // Store in admin_corrections
      const corrType = `ai_interpreted_${interpretation.type}`;
      const field = interpretation.type === "technique" ? "detected_technique" : interpretation.type === "houding" ? "houding" : "general";
      const insertResult = await pool.query(
        `INSERT INTO admin_corrections (analysis_id, type, field, original_value, new_value, context, submitted_by, source)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING *`,
        [
          analysisId || null,
          corrType,
          field,
          interpretation.detectedValue || context?.detectedTechniques || '',
          interpretation.correctedValue || expertFeedback,
          JSON.stringify({
            turnIdx,
            turnText: turnText?.substring(0, 200),
            turnSpeaker,
            expertFeedback,
            aiInterpretation: interpretation,
            originalContext: context,
          }),
          'hugo',
          'transcript_feedback',
        ]
      );
      const correction = insertResult.rows[0];

      // Create notification for superadmin
      try {
        await pool.query(
          `INSERT INTO admin_notifications (type, title, message, category, severity, related_id, related_page)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            'correction_submitted',
            `Hugo: ${interpretation.type === 'technique' ? 'Techniek' : interpretation.type === 'houding' ? 'Houding' : 'Feedback'} correctie`,
            `Hugo zegt: "${expertFeedback}". AI-interpretatie (${Math.round(interpretation.confidence * 100)}%): ${interpretation.reasoning}`,
            'content',
            interpretation.confidence >= 0.7 ? 'info' : 'warning',
            correction.id,
            'admin-config-review',
          ]
        );
      } catch (notifErr: any) {
        console.error(`[Admin] Failed to create notification for interpreted correction #${correction.id}:`, notifErr.message);
      }

      console.log(`[Admin] AI-interpreted correction #${correction.id}: type=${interpretation.type}, confidence=${interpretation.confidence}`);
      res.json({ success: true, correction, interpretation });
    } catch (err: any) {
      console.error('[Admin] Correction interpret error:', err);
      sendError(res, err, 'Feedback interpreteren mislukt');
    }
  });

  app.get("/api/v2/admin/corrections", async (req: Request, res: Response) => {
    try {
      const status = req.query.status as string || 'all';
      let queryText = 'SELECT * FROM admin_corrections';
      const params: any[] = [];
      if (status !== 'all') {
        queryText += ' WHERE status = $1';
        params.push(status);
      }
      queryText += ' ORDER BY created_at DESC LIMIT 100';
      const { rows } = await pool.query(queryText, params);
      res.json({ corrections: rows || [] });
    } catch (err: any) {
      sendError(res, err);
    }
  });

  app.patch("/api/v2/admin/corrections/:id", async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { status, reviewedBy } = req.body;
      if (!['approved', 'rejected', 'pending'].includes(status)) {
        return res.status(400).json({ error: 'Status must be approved, rejected or pending' });
      }
      const reviewedAt = status === 'pending' ? null : new Date().toISOString();
      const reviewer = status === 'pending' ? null : (reviewedBy || 'admin');
      const updateResult = await pool.query(
        `UPDATE admin_corrections SET status = $1, reviewed_by = $2, reviewed_at = $3 WHERE id = $4 RETURNING *`,
        [status, reviewer, reviewedAt, parseInt(id as string)]
      );
      const correction = updateResult.rows[0];
      if (!correction) return res.status(404).json({ error: 'Correction not found' });
      let ragGenerated = false;
      let ssotUpdated = false;
      if (status === 'approved') {
        try {
          const ragContent = `[EXPERT CORRECTIE] Bij analyse van een verkoopgesprek werd "${correction.original_value}" gedetecteerd als ${correction.type}/${correction.field}. De expert corrigeerde dit naar "${correction.new_value}". Context: ${correction.context || 'Geen extra context'}. Dit is een belangrijk leermoment voor toekomstige analyses.`;
          const ragTitle = `Expert correctie: ${correction.type} ${correction.field} (${new Date().toISOString().split('T')[0]})`;
          await supabase
            .from('rag_documents')
            .insert({
              doc_type: 'expert_correction',
              title: ragTitle,
              content: ragContent,
              source_id: `admin_correction_${correction.id}`,
              word_count: ragContent.split(/\s+/).length,
              needs_review: false,
              review_status: 'approved',
            });
          ragGenerated = true;
          console.log(`[Admin] RAG fragment generated for approved correction #${correction.id}`);
        } catch (ragErr) {
          console.error('[Admin] Failed to generate RAG fragment:', ragErr);
          ragGenerated = false;
        }

        if (correction.source === 'video_edit' && correction.context) {
          try {
            const ctx = typeof correction.context === 'string' ? JSON.parse(correction.context) : correction.context;
            const videoId = ctx.videoId;
            if (videoId && correction.field && correction.new_value) {
              const updateFields: Record<string, any> = {};
              if (correction.field === 'ai_attractive_title') {
                updateFields.ai_attractive_title = correction.new_value;
              } else if (correction.field === 'title') {
                updateFields.title = correction.new_value;
              }
              if (Object.keys(updateFields).length > 0) {
                const { error: videoErr } = await supabase
                  .from('video_ingest_jobs')
                  .update(updateFields)
                  .eq('id', videoId);
                if (videoErr) {
                  console.error(`[Admin] Failed to apply video_edit correction #${correction.id}:`, videoErr.message);
                } else {
                  console.log(`[Admin] Applied video_edit correction #${correction.id}: ${correction.field} updated for video ${videoId}`);
                }
              }
            }
          } catch (videoEditErr: any) {
            console.error('[Admin] Failed to process video_edit approval:', videoEditErr.message);
          }
        }

        if (correction.source === 'technique_edit' && correction.target_key && correction.new_json) {
          try {
            const ssotPath = path.join(process.cwd(), 'config/ssot/technieken_index.json');
            const srcPath = path.join(process.cwd(), 'src/data/technieken_index.json');
            const ssotData = JSON.parse(fs.readFileSync(ssotPath, 'utf-8'));
            const technieken = ssotData.technieken || {};
            const targetNummer = correction.target_key;
            const newData = typeof correction.new_json === 'string' ? JSON.parse(correction.new_json) : correction.new_json;

            let found = false;
            for (const [key, tech] of Object.entries(technieken)) {
              if ((tech as any).nummer === targetNummer || key === targetNummer) {
                technieken[key] = { ...(tech as any), ...newData };
                found = true;
                console.log(`[Admin] Updated technique ${targetNummer} in SSOT`);
                break;
              }
            }

            if (found) {
              ssotData.technieken = technieken;
              fs.writeFileSync(ssotPath, JSON.stringify(ssotData, null, 2), 'utf-8');
              console.log(`[Admin] Saved SSOT file: ${ssotPath}`);

              try {
                fs.writeFileSync(srcPath, JSON.stringify(ssotData, null, 2), 'utf-8');
                console.log(`[Admin] Copied to src/data: ${srcPath}`);
              } catch (copyErr: any) {
                console.error('[Admin] Failed to copy to src/data:', copyErr.message);
              }

              ssotUpdated = true;
            } else {
              console.warn(`[Admin] Technique ${targetNummer} not found in SSOT`);
            }
          } catch (ssotErr: any) {
            console.error('[Admin] Failed to update SSOT for technique_edit:', ssotErr.message);
          }
        }
      }

      res.json({ correction, ragGenerated, ssotUpdated });
    } catch (err: any) {
      sendError(res, err);
    }
  });

  // ===========================================
  // ADMIN NOTIFICATIONS API
  // ===========================================

  app.get("/api/v2/admin/notifications", async (req: Request, res: Response) => {
    try {
      const readFilter = req.query.read;
      const isSuperAdmin = (req as any).userEmail === SUPERADMIN_EMAIL;
      const audienceFilter = isSuperAdmin
        ? `audience IN ('all', 'superadmin')`
        : `audience IN ('all', 'hugo')`;

      let queryText = `SELECT * FROM admin_notifications WHERE ${audienceFilter}`;
      const params: any[] = [];
      if (readFilter === 'true') {
        queryText += ' AND read = true';
      } else if (readFilter === 'false') {
        queryText += ' AND read = false';
      }
      queryText += ' ORDER BY created_at DESC LIMIT 200';
      const { rows } = await pool.query(queryText, params);
      res.json({ notifications: rows || [] });
    } catch (err: any) {
      console.error('[Admin] Notifications list error:', err.message);
      sendError(res, err);
    }
  });

  app.get("/api/v2/admin/notifications/count", async (req: Request, res: Response) => {
    try {
      const { rows } = await pool.query('SELECT COUNT(*) as count FROM admin_notifications WHERE read = false');
      res.json({ unread: parseInt(rows[0]?.count || '0') });
    } catch (err: any) {
      console.error('[Admin] Notifications count error:', err.message);
      sendError(res, err);
    }
  });

  app.patch("/api/v2/admin/notifications/read-all", async (req: Request, res: Response) => {
    try {
      const result = await pool.query(
        `UPDATE admin_notifications SET read = true WHERE read = false RETURNING *`
      );
      const updated = result.rows?.length || 0;
      console.log(`[Admin] Marked ${updated} notifications as read`);
      res.json({ updated, message: 'Alle notificaties als gelezen gemarkeerd' });
    } catch (err: any) {
      console.error('[Admin] Notifications read-all error:', err.message);
      sendError(res, err);
    }
  });

  app.patch("/api/v2/admin/notifications/:id", async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { read } = req.body;
      const readValue = read !== undefined ? read : true;
      const result = await pool.query(
        `UPDATE admin_notifications SET read = $1 WHERE id = $2 RETURNING *`,
        [readValue, parseInt(id as string)]
      );
      const notification = result.rows[0];
      if (!notification) return res.status(404).json({ error: 'Notification not found' });
      res.json({ notification });
    } catch (err: any) {
      console.error('[Admin] Notification update error:', err.message);
      sendError(res, err);
    }
  });

  app.delete("/api/v2/admin/notifications/:id", async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const result = await pool.query(
        `DELETE FROM admin_notifications WHERE id = $1 RETURNING id`,
        [parseInt(id as string)]
      );
      if (result.rowCount === 0) return res.status(404).json({ error: 'Notification not found' });
      res.json({ deleted: true, id: parseInt(id as string) });
    } catch (err: any) {
      console.error('[Admin] Notification delete error:', err.message);
      sendError(res, err);
    }
  });

  // ===========================================
  // ADMIN ONBOARDING WIZARD
  // ===========================================

  async function ensureOnboardingPopulated(adminUserId: string): Promise<void> {
    const { rows } = await pool.query(
      'SELECT COUNT(*) as count FROM admin_onboarding_progress WHERE admin_user_id = $1',
      [adminUserId]
    );
    if (parseInt(rows[0].count) > 0) return;

    const techPath = path.join(process.cwd(), 'config/ssot/technieken_index.json');
    const techData = JSON.parse(fs.readFileSync(techPath, 'utf-8'));
    const houdPath = path.join(process.cwd(), 'config/klant_houdingen.json');
    const houdData = JSON.parse(fs.readFileSync(houdPath, 'utf-8'));

    const values: string[] = [];
    const params: any[] = [];
    let idx = 1;

    for (const [key, tech] of Object.entries(techData.technieken || {})) {
      const t = tech as any;
      values.push(`($${idx++}, $${idx++}, $${idx++}, $${idx++})`);
      params.push(adminUserId, 'technieken', key, t.naam || key);
    }

    for (const [key, houd] of Object.entries(houdData.houdingen || {})) {
      const h = houd as any;
      values.push(`($${idx++}, $${idx++}, $${idx++}, $${idx++})`);
      params.push(adminUserId, 'houdingen', h.id || key, h.naam || key);
    }

    if (values.length > 0) {
      await pool.query(
        `INSERT INTO admin_onboarding_progress (admin_user_id, module, item_key, item_name) VALUES ${values.join(', ')}`,
        params
      );
      console.log(`[Onboarding] Populated ${values.length} items for admin ${adminUserId}`);
    }
  }

  app.get("/api/v2/admin/onboarding/status", async (req: Request, res: Response) => {
    try {
      const adminUserId = req.userId!;
      await ensureOnboardingPopulated(adminUserId);

      const { rows } = await pool.query(
        `SELECT module, status, item_key, item_name FROM admin_onboarding_progress WHERE admin_user_id = $1 ORDER BY id ASC`,
        [adminUserId]
      );

      const technieken = rows.filter(r => r.module === 'technieken');
      const houdingen = rows.filter(r => r.module === 'houdingen');

      const techReviewed = technieken.filter(r => r.status !== 'pending').length;
      const houdReviewed = houdingen.filter(r => r.status !== 'pending').length;

      const allReviewed = techReviewed + houdReviewed;
      const allTotal = technieken.length + houdingen.length;
      const isComplete = allReviewed >= allTotal;

      let nextItem: { module: string; key: string; name: string } | null = null;
      const pendingTech = technieken.find(r => r.status === 'pending');
      if (pendingTech) {
        nextItem = { module: 'technieken', key: pendingTech.item_key, name: pendingTech.item_name };
      } else {
        const pendingHoud = houdingen.find(r => r.status === 'pending');
        if (pendingHoud) {
          nextItem = { module: 'houdingen', key: pendingHoud.item_key, name: pendingHoud.item_name };
        }
      }

      res.json({
        technieken: { total: technieken.length, reviewed: techReviewed, pending: technieken.length - techReviewed },
        houdingen: { total: houdingen.length, reviewed: houdReviewed, pending: houdingen.length - houdReviewed },
        isComplete,
        nextItem,
        totalReviewed: allReviewed,
        totalItems: allTotal
      });
    } catch (err: any) {
      console.error('[Onboarding] Status error:', err.message);
      sendError(res, err);
    }
  });

  app.post("/api/v2/admin/onboarding/approve", async (req: Request, res: Response) => {
    try {
      const { itemKey, module } = req.body;
      const adminUserId = req.userId!;

      if (!itemKey || !module) {
        return res.status(400).json({ error: 'itemKey and module are required' });
      }

      const result = await pool.query(
        `UPDATE admin_onboarding_progress SET status = 'approved', reviewed_at = NOW() WHERE admin_user_id = $1 AND module = $2 AND item_key = $3 RETURNING *`,
        [adminUserId, module, itemKey]
      );

      if (result.rowCount === 0) {
        return res.status(404).json({ error: 'Item not found' });
      }

      res.json({ success: true, item: result.rows[0] });
    } catch (err: any) {
      console.error('[Onboarding] Approve error:', err.message);
      sendError(res, err);
    }
  });

  app.post("/api/v2/admin/onboarding/skip", async (req: Request, res: Response) => {
    try {
      const { itemKey, module } = req.body;
      const adminUserId = req.userId!;

      if (!itemKey || !module) {
        return res.status(400).json({ error: 'itemKey and module are required' });
      }

      const result = await pool.query(
        `UPDATE admin_onboarding_progress SET status = 'skipped', reviewed_at = NOW() WHERE admin_user_id = $1 AND module = $2 AND item_key = $3 RETURNING *`,
        [adminUserId, module, itemKey]
      );

      if (result.rowCount === 0) {
        return res.status(404).json({ error: 'Item not found' });
      }

      res.json({ success: true, item: result.rows[0] });
    } catch (err: any) {
      console.error('[Onboarding] Skip error:', err.message);
      sendError(res, err);
    }
  });

  app.post("/api/v2/admin/onboarding/feedback", async (req: Request, res: Response) => {
    try {
      const { itemKey, module, feedbackText } = req.body;
      const adminUserId = req.userId!;

      if (!itemKey || !module || !feedbackText) {
        return res.status(400).json({ error: 'itemKey, module, and feedbackText are required' });
      }

      let originalData: any = {};
      let targetFile = '';
      let targetKey = itemKey;
      if (module === 'technieken') {
        const techPath = path.join(process.cwd(), 'config/ssot/technieken_index.json');
        const techData = JSON.parse(fs.readFileSync(techPath, 'utf-8'));
        originalData = techData.technieken?.[itemKey] || {};
        targetFile = 'config/ssot/technieken_index.json';
      } else {
        const houdPath = path.join(process.cwd(), 'config/klant_houdingen.json');
        const houdData = JSON.parse(fs.readFileSync(houdPath, 'utf-8'));
        const entry = Object.entries(houdData.houdingen || {}).find(([_, h]: [string, any]) => h.id === itemKey || _ === itemKey);
        if (entry) {
          originalData = entry[1];
          targetKey = entry[0];
        }
        targetFile = 'config/klant_houdingen.json';
      }

      let aiInterpretation = '';
      let proposedJson: any = null;
      try {
        const { getOpenAI } = await import('../openai-client');
        const openai = getOpenAI();
        const aiResponse = await openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content: `Je bent een assistent die feedback van Hugo (sales trainer) interpreteert en vertaalt naar concrete JSON wijzigingen. Geef een JSON object terug met alleen de velden die gewijzigd moeten worden. Antwoord ALLEEN met valid JSON, geen uitleg.`
            },
            {
              role: 'user',
              content: `Huidige data voor ${module === 'technieken' ? 'techniek' : 'klanthouding'} "${originalData.naam || itemKey}":\n${JSON.stringify(originalData, null, 2)}\n\nHugo's feedback: "${feedbackText}"\n\nWelke velden moeten aangepast worden? Geef alleen de gewijzigde velden als JSON.`
            }
          ],
          temperature: 0.3,
          max_tokens: 1000
        });
        const rawContent = aiResponse.choices[0]?.message?.content || '{}';
        aiInterpretation = rawContent;
        try {
          const cleaned = rawContent.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
          proposedJson = JSON.parse(cleaned);
        } catch {
          proposedJson = { raw_feedback: feedbackText };
        }
      } catch (aiErr: any) {
        console.error('[Onboarding] AI interpretation failed:', aiErr.message);
        proposedJson = { raw_feedback: feedbackText };
        aiInterpretation = 'AI interpretation unavailable';
      }

      const corrType = module === 'technieken' ? 'technique_edit' : 'attitude_edit';
      const client = await pool.connect();
      let correction: any;
      try {
        await client.query('BEGIN');

        const corrResult = await client.query(
          `INSERT INTO admin_corrections (type, field, original_value, new_value, context, submitted_by, source, target_file, target_key, original_json, new_json, status)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
           RETURNING *`,
          [
            corrType,
            originalData.naam || itemKey,
            JSON.stringify(originalData),
            JSON.stringify(proposedJson),
            feedbackText,
            adminUserId,
            'onboarding_review',
            targetFile,
            targetKey,
            JSON.stringify(originalData),
            JSON.stringify(proposedJson),
            'pending'
          ]
        );
        correction = corrResult.rows[0];

        await client.query(
          `INSERT INTO admin_notifications (type, title, message, category, severity, related_id, related_page)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            'onboarding_feedback',
            `Onboarding feedback: ${originalData.naam || itemKey}`,
            `Hugo gaf feedback op ${module === 'technieken' ? 'techniek' : 'klanthouding'} "${originalData.naam || itemKey}": "${feedbackText}"`,
            'content',
            'warning',
            correction.id,
            'admin-config-review'
          ]
        );

        await client.query(
          `UPDATE admin_onboarding_progress SET status = 'feedback_given', feedback_text = $1, correction_id = $2, reviewed_at = NOW() WHERE admin_user_id = $3 AND module = $4 AND item_key = $5`,
          [feedbackText, correction.id, adminUserId, module, itemKey]
        );

        await client.query('COMMIT');
      } catch (txErr) {
        await client.query('ROLLBACK');
        throw txErr;
      } finally {
        client.release();
      }

      res.json({
        success: true,
        interpretation: aiInterpretation,
        correctionId: correction.id,
        proposedChanges: proposedJson
      });
    } catch (err: any) {
      console.error('[Onboarding] Feedback error:', err.message);
      sendError(res, err);
    }
  });

  app.get("/api/v2/admin/onboarding/item/:module/:key", async (req: Request, res: Response) => {
    try {
      const { module, key } = req.params;

      if (module === 'technieken') {
        const techPath = path.join(process.cwd(), 'config/ssot/technieken_index.json');
        const techData = JSON.parse(fs.readFileSync(techPath, 'utf-8'));
        const item = techData.technieken?.[key as string];
        if (!item) return res.status(404).json({ error: 'Technique not found' });
        res.json({ module: 'technieken', key, data: item });
      } else if (module === 'houdingen') {
        const houdPath = path.join(process.cwd(), 'config/klant_houdingen.json');
        const houdData = JSON.parse(fs.readFileSync(houdPath, 'utf-8'));
        const entry = Object.entries(houdData.houdingen || {}).find(([_, h]: [string, any]) => h.id === key || _ === key);
        if (!entry) return res.status(404).json({ error: 'Attitude not found' });
        res.json({ module: 'houdingen', key: entry[0], data: entry[1] });
      } else {
        res.status(400).json({ error: 'Invalid module. Use "technieken" or "houdingen"' });
      }
    } catch (err: any) {
      console.error('[Onboarding] Item fetch error:', err.message);
      sendError(res, err);
    }
  });

  // ===========================================
  // ADMIN DASHBOARD STATS
  // ===========================================
  app.get("/api/v2/admin/stats", async (req: Request, res: Response) => {
    try {
      const stats = await getAdminStats();
      res.json(stats);
    } catch (err: any) {
      console.error('[Admin Stats] Error:', err.message);
      sendError(res, err);
    }
  });

  // ===========================================
  // ADMIN WELCOME BRIEFING
  // ===========================================
  app.get("/api/v2/admin/welcome", async (req: Request, res: Response) => {
    try {
      const stats = await getAdminStats();

      const lines: string[] = [];
      lines.push(`Dag Hugo! Hier is je overzicht van vandaag:\n`);

      lines.push(`**Platform**`);
      lines.push(`• ${stats.platform.totalUsers} gebruikers (${stats.platform.newUsersThisWeek} nieuw deze week)`);
      lines.push(`• ${stats.platform.activeUsers} actieve gebruikers (afgelopen 30 dagen)\n`);

      lines.push(`**Activiteit**`);
      lines.push(`• ${stats.sessions.total} rollenspellen gespeeld (${stats.sessions.recentWeek} deze week)`);
      lines.push(`• ${stats.analyses.total} gespreksanalyses${stats.analyses.avgScore ? ` — gem. score: ${stats.analyses.avgScore}%` : ''}\n`);

      if (stats.pendingReviews > 0) {
        lines.push(`**⚡ Aandacht nodig**`);
        lines.push(`• ${stats.pendingReviews} correctie(s) wachten op review in Config Review\n`);
      }

      if (stats.topAnalyses.length > 0) {
        lines.push(`**Recente analyses**`);
        for (const a of stats.topAnalyses) {
          lines.push(`• "${a.title}" van ${a.userName}${a.score !== null ? ` — ${a.score}%` : ' — wacht op resultaat'}`);
        }
        lines.push('');
      }

      lines.push(`Wat wil je doen?`);
      lines.push(`• Feedback geven op een gespreksanalyse?`);
      lines.push(`• AI-chats van gebruikers bekijken?`);
      lines.push(`• Correcties in Config Review behandelen?`);
      lines.push(`• Een andere vraag?`);

      res.json({
        welcomeMessage: lines.join('\n'),
        stats,
        actions: [
          { label: 'Review gespreksanalyse', action: 'review_analysis' },
          { label: 'Bekijk AI-chats', action: 'review_sessions' },
          { label: 'Config Review', action: 'config_review' },
          { label: 'Iets anders', action: 'open_question' },
        ]
      });
    } catch (err: any) {
      console.error('[Admin Welcome] Error:', err.message);
      res.json({
        welcomeMessage: 'Dag Hugo! Waar kan ik je vandaag mee helpen?',
        stats: null,
        actions: []
      });
    }
  });
}
