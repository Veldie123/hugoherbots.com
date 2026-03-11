/**
 * Platform sync routes — cross-platform aliases (.com↔.ai), sync endpoints, SSO handoff
 */
import { type Express, type Request, type Response } from "express";
import {
  generateCoachResponse,
  type CoachMessage,
} from "../v2/coach-engine";
import { detectIntent } from "../v2/intent-detector";
import { buildRichResponse } from "../v2/rich-response-builder";
import { supabase } from "../supabase-client";

/** Sanitize 500 errors: show details only in dev, generic message in production */
function sendError(res: Response, err: any, fallback = 'Er ging iets mis') {
  console.error('[API Error]', err?.message || err);
  const isDev = process.env.NODE_ENV !== 'production';
  res.status(500).json({ error: isDev ? (err?.message || fallback) : fallback });
}

export function registerPlatformSyncRoutes(app: Express): void {
  // ===========================================
  // CROSS-PLATFORM API ALIASES (.com → .ai)
  // ===========================================

  // Primary endpoint for .com platform: /api/v2/chat
  app.post("/api/v2/chat", async (req, res) => {
    const { message, sessionId, conversationHistory, techniqueContext, sourceApp } = req.body;
    const userId = req.userId!;

    console.log(`[API] /api/v2/chat from ${sourceApp || 'unknown'}, userId: ${userId}`);

    if (!message) {
      return res.status(400).json({ error: "message is required" });
    }

    try {
      const history: CoachMessage[] = (conversationHistory || []).map((m: any) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content
      }));

      const techniqueId = techniqueContext?.techniqueId || techniqueContext || undefined;
      const techniqueName = techniqueContext?.techniqueName || undefined;
      const phase = techniqueContext?.phase || undefined;

      const coachResult = await generateCoachResponse(message, history, {
        userId,
        techniqueId
      });

      const intentResult = detectIntent(
        message,
        (conversationHistory || []).map((m: any) => ({ role: m.role, content: m.content })),
        techniqueId,
        undefined
      );

      const richResponse = await buildRichResponse(
        coachResult.message,
        intentResult,
        {
          techniqueId,
          techniqueName,
          phase,
          userId
        }
      );

      res.json({
        response: coachResult.message,
        message: coachResult.message,
        sessionId: sessionId || null,
        mode: 'coach',
        technique: techniqueId || null,
        sources: coachResult.ragContext?.map(doc => ({
          type: doc.docType || 'technique',
          title: doc.title || 'Video fragment',
          snippet: doc.content?.substring(0, 200) || '',
          relevance: doc.similarity || 0
        })) || [],
        richContent: richResponse.richContent || [],
        suggestions: richResponse.suggestions || [],
        intent: {
          primary: intentResult.primaryIntent,
          confidence: intentResult.confidence
        }
      });
    } catch (error: any) {
      console.error("[API] /api/v2/chat error:", error);
      res.status(500).json({
        error: "Er ging iets mis. Probeer het opnieuw.",
        message: "Hmm, ik heb even moeite met antwoorden. Kun je het nogmaals proberen?"
      });
    }
  });

  // Alias: /api/chat → same as /api/v2/chat
  app.post("/api/chat", async (req, res) => {
    const { message, conversationHistory, techniqueContext, sourceApp } = req.body;
    const userId = req.userId!;

    console.log(`[API] /api/chat from ${sourceApp || 'unknown'}`);

    if (!message) {
      return res.status(400).json({ error: "message is required" });
    }

    try {
      const history: CoachMessage[] = (conversationHistory || []).map((m: any) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content
      }));

      const coachResult = await generateCoachResponse(message, history, {
        userId,
        techniqueId: techniqueContext || undefined
      });

      res.json({
        message: coachResult.message,
        technique: null,
        sources: coachResult.ragContext?.map(doc => ({
          title: doc.title || 'Video fragment',
          chunk: doc.content?.substring(0, 200)
        })) || []
      });
    } catch (error: any) {
      console.error("[API] /api/chat error:", error);
      res.status(500).json({
        error: "Er ging iets mis",
        message: "Hmm, ik heb even moeite met antwoorden. Kun je het nogmaals proberen?"
      });
    }
  });

  // Alias: /api/chat/message → uses V2 coach engine
  app.post("/api/chat/message", async (req, res) => {
    const { message, conversationHistory } = req.body;
    const userId = req.userId!;

    if (!message) {
      return res.status(400).json({ error: "message is required" });
    }

    try {
      const history: CoachMessage[] = (conversationHistory || []).map((m: any) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content
      }));

      const coachResult = await generateCoachResponse(message, history, {
        userId
      });

      res.json({
        success: true,
        message: coachResult.message,
        sessionId: `session-${Date.now()}`
      });
    } catch (error: any) {
      console.error("[API] /api/chat/message error:", error);
      res.status(500).json({
        error: "Er ging iets mis. Probeer het opnieuw.",
        message: "Hmm, ik heb even moeite met antwoorden. Kun je het nogmaals proberen?"
      });
    }
  });

  // Alias: /api/user/activity-summary → forwards to v2 endpoint
  app.get("/api/user/activity-summary", async (req, res) => {
    const userId = req.userId!;

    try {
      let rpcData = null;
      const rpcResult = await supabase
        .rpc('get_user_activity_summary', { p_user_id: userId });

      if (!rpcResult.error && rpcResult.data) {
        rpcData = rpcResult.data;
      }

      if (rpcData) {
        const summary = rpcData;
        let welcomeMessage = "Waar kan ik je vandaag mee helpen?";

        if (summary.last_activity_type) {
          const lastActivityDate = new Date(summary.last_activity_at);
          const timeAgo = Date.now() - lastActivityDate.getTime();
          const hoursAgo = Math.floor(timeAgo / (1000 * 60 * 60));
          const daysAgo = Math.floor(hoursAgo / 24);

          let timePhrase = "";
          if (daysAgo > 0) {
            timePhrase = daysAgo === 1 ? "Gisteren" : `${daysAgo} dagen geleden`;
          } else if (hoursAgo > 0) {
            timePhrase = hoursAgo === 1 ? "Een uur geleden" : `${hoursAgo} uur geleden`;
          } else {
            timePhrase = "Net";
          }

          switch (summary.last_activity_type) {
            case "video_view":
              welcomeMessage = `${timePhrase} keek je een video. Heb je daar nog vragen over, of wil je het in de praktijk oefenen?`;
              break;
            case "webinar_attend":
              welcomeMessage = `${timePhrase} volgde je een webinar. Zullen we de besproken technieken oefenen?`;
              break;
            case "chat_session":
              welcomeMessage = `Welkom terug! ${timePhrase} hadden we een gesprek. Zullen we verdergaan waar we gebleven waren?`;
              break;
            default:
              welcomeMessage = "Waar kan ik je vandaag mee helpen?";
          }
        }

        res.json({
          success: true,
          activity: {
            videos_watched: summary.videos_watched || 0,
            webinars_attended: summary.webinars_attended || 0,
            chat_sessions: summary.chat_sessions || 0,
            last_activity_type: summary.last_activity_type,
            last_activity_at: summary.last_activity_at
          },
          welcomeMessage
        });
      } else {
        res.json({
          success: true,
          activity: {
            videos_watched: 0,
            webinars_attended: 0,
            chat_sessions: 0,
            last_activity_type: null,
            last_activity_at: null
          },
          welcomeMessage: "Waar kan ik je vandaag mee helpen?"
        });
      }
    } catch (error: any) {
      console.error("[API] /api/user/activity-summary error:", error);
      res.json({
        success: true,
        activity: {
          videos_watched: 0,
          webinars_attended: 0,
          chat_sessions: 0,
          last_activity_type: null,
          last_activity_at: null
        },
        welcomeMessage: "Waar kan ik je vandaag mee helpen?"
      });
    }
  });

  // ============================================
  // PLATFORM SYNC ENDPOINTS (.com ↔ .ai)
  // ============================================

  // GET /api/platform-sync/pending - Get pending sync messages for .ai
  app.get("/api/platform-sync/pending", async (req, res) => {
    try {
      const { data, error } = await supabase
        .from('platform_sync')
        .select('*')
        .eq('target_platform', 'ai')
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (error) throw error;

      res.json({
        success: true,
        count: data?.length || 0,
        messages: data || []
      });
    } catch (error: any) {
      console.error("[SYNC] Error fetching pending messages:", error);
      sendError(res, error);
    }
  });

  // POST /api/platform-sync/acknowledge - Mark message as read
  app.post("/api/platform-sync/acknowledge", async (req, res) => {
    const { messageId } = req.body;

    if (!messageId) {
      return res.status(400).json({ error: "messageId is required" });
    }

    try {
      const { data, error } = await supabase
        .from('platform_sync')
        .update({
          status: 'read',
          read_at: new Date().toISOString()
        })
        .eq('id', messageId)
        .select()
        .single();

      if (error) throw error;

      res.json({
        success: true,
        message: "Message acknowledged",
        data
      });
    } catch (error: any) {
      console.error("[SYNC] Error acknowledging message:", error);
      sendError(res, error);
    }
  });

  // POST /api/platform-sync/send - Send message to .com platform
  app.post("/api/platform-sync/send", async (req, res) => {
    const { messageType, title, content } = req.body;

    if (!messageType || !content) {
      return res.status(400).json({ error: "messageType and content are required" });
    }

    try {
      const { data, error } = await supabase
        .from('platform_sync')
        .insert({
          source_platform: 'ai',
          target_platform: 'com',
          message_type: messageType,
          title: title || `Sync from .ai: ${messageType}`,
          content,
          status: 'pending'
        })
        .select()
        .single();

      if (error) throw error;

      res.json({
        success: true,
        message: "Message sent to .com platform",
        data
      });
    } catch (error: any) {
      console.error("[SYNC] Error sending message:", error);
      sendError(res, error);
    }
  });

  // GET /api/platform-sync/status - Get sync status overview
  app.get("/api/platform-sync/status", async (req, res) => {
    try {
      const { data: pending } = await supabase
        .from('platform_sync')
        .select('id, message_type, created_at')
        .eq('target_platform', 'ai')
        .eq('status', 'pending');

      const { data: recent } = await supabase
        .from('platform_sync')
        .select('id, message_type, status, created_at, read_at')
        .order('created_at', { ascending: false })
        .limit(10);

      res.json({
        success: true,
        pendingForAi: pending?.length || 0,
        recentMessages: recent || []
      });
    } catch (error: any) {
      console.error("[SYNC] Error fetching status:", error);
      sendError(res, error);
    }
  });

  // =============================================================================
  // SSO HANDOFF TOKEN ENDPOINTS - Cross-platform authentication
  // =============================================================================

  // POST /api/sso/generate-token - Generate SSO handoff token for cross-platform auth
  app.post("/api/sso/generate-token", async (req, res) => {
    try {
      const { sourcePlatform, targetPlatform, targetPath, ttlSeconds = 60 } = req.body;
      const userId = req.userId!;

      // Validate platforms
      const validPlatforms = ['com', 'ai'];
      if (!validPlatforms.includes(sourcePlatform) || !validPlatforms.includes(targetPlatform)) {
        return res.status(400).json({ error: "Invalid platform. Must be 'com' or 'ai'" });
      }

      if (sourcePlatform === targetPlatform) {
        return res.status(400).json({ error: "Source and target platform must be different" });
      }

      console.log(`[SSO] Generating token for user ${userId}: ${sourcePlatform} → ${targetPlatform}`);

      // Call Supabase RPC to generate token
      const { data, error } = await supabase.rpc('generate_sso_handoff_token', {
        p_user_id: userId,
        p_source_platform: sourcePlatform,
        p_target_platform: targetPlatform,
        p_target_path: targetPath || null,
        p_ttl_seconds: ttlSeconds
      });

      if (error) {
        console.error("[SSO] Error generating token:", error);
        return sendError(res, error);
      }

      const token = data;
      console.log(`[SSO] Token generated successfully (expires in ${ttlSeconds}s)`);

      // Build the redirect URL
      const targetBaseUrl = targetPlatform === 'ai'
        ? (process.env.HUGO_AI_URL || 'https://hugoherbots.ai')
        : 'https://hugoherbots.com';

      const redirectUrl = `${targetBaseUrl}/sso/validate?token=${token}`;

      res.json({
        success: true,
        token,
        redirectUrl,
        expiresIn: ttlSeconds
      });
    } catch (error: any) {
      console.error("[SSO] Error generating token:", error);
      sendError(res, error);
    }
  });

  // GET /api/sso/validate - Validate SSO token and return session info
  app.get("/api/sso/validate", async (req, res) => {
    try {
      const { token } = req.query;

      if (!token || typeof token !== 'string') {
        return res.status(400).json({ error: "Token is required" });
      }

      console.log(`[SSO] Validating token...`);

      // Call Supabase RPC to validate and consume token
      const { data, error } = await supabase.rpc('validate_sso_handoff_token', {
        p_token: token
      });

      if (error) {
        console.error("[SSO] Error validating token:", error);
        return sendError(res, error);
      }

      // RPC returns a table row
      const result = data?.[0];

      if (!result || !result.valid) {
        console.log("[SSO] Token invalid or expired");
        return res.status(401).json({
          valid: false,
          error: "Token invalid, expired, or already used"
        });
      }

      console.log(`[SSO] Token valid for user ${result.user_id}`);

      // Get user info from Supabase
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('id, email, name, role')
        .eq('id', result.user_id)
        .single();

      if (userError) {
        // Try auth.users if users table doesn't exist
        const { data: authUser } = await supabase.auth.admin.getUserById(result.user_id);

        res.json({
          valid: true,
          userId: result.user_id,
          targetPath: result.target_path,
          user: authUser?.user ? {
            id: authUser.user.id,
            email: authUser.user.email,
            name: authUser.user.user_metadata?.name || authUser.user.email?.split('@')[0]
          } : null
        });
        return;
      }

      res.json({
        valid: true,
        userId: result.user_id,
        targetPath: result.target_path,
        user: userData
      });
    } catch (error: any) {
      console.error("[SSO] Error validating token:", error);
      sendError(res, error);
    }
  });

  // POST /api/sso/cleanup - Clean up expired tokens (can be called by cron)
  app.post("/api/sso/cleanup", async (req, res) => {
    try {
      console.log("[SSO] Running token cleanup...");

      const { error } = await supabase.rpc('cleanup_expired_handoff_tokens');

      if (error) {
        console.error("[SSO] Cleanup error:", error);
        return sendError(res, error);
      }

      console.log("[SSO] Cleanup completed successfully");
      res.json({ success: true, message: "Expired tokens cleaned up" });
    } catch (error: any) {
      console.error("[SSO] Cleanup error:", error);
      sendError(res, error);
    }
  });
}
