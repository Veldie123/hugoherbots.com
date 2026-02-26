import type { Express } from "express";
import { createServer, type Server } from "http";
import * as fs from "fs";
import * as path from "path";
import { storage } from "./storage";
import { getAllowedTechniques, loadFases, loadTechniquesCatalog, loadAiPrompt, getContextSlotsForPhase, getTechniqueFromCatalog } from "./config-loader";

function applyTemplate(template: string, vars: Record<string, string>): string {
  let result = template;
  for (const [key, value] of Object.entries(vars)) {
    result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value ?? '');
  }
  return result;
}
import { getChatCompletion, getChatCompletionStream, parseHugoResponse, sanitizeRoleplayCustomerText, getEvaluationCompletion, generateDynamicGreeting } from "./openai-client";
import { muxService } from "./mux-service";
import { dailyService } from "./daily-service";
import {
  validatePhase1Order,
  validatePhase2To3Transition,
  validatePhase3To4Transition,
  validateNoTerzijdeInPhase4,
  determineNextPhase,
  updateStapStack,
  handleContextGathering,
  runDetectors,
  detectThemes,
  getTechniqueName,
  getThemeName,
} from "./state-machine";
import { determineNextMode, type Mode } from "./mode-transitions";
import { validateCommitmentDetection } from "./commitment-detector";
import { generateCustomerProfile, recordPersonaStart, recordSessionOutcome } from "./persona-engine";
import { aggregateFeedback, renderFeedbackTemplate } from "./feedback-aggregator";
import type { MessageResponse, CustomerProfile } from "@shared/schema";
import { setupScribeWebSocket } from "./elevenlabs-stt";
import { setupStreamingResponseWebSocket } from "./streaming-response";
import { canAccessTechnique, getUserProgress, getMissingContextSlots } from "./v2/technique-sequence";

// Supabase REST API helper for reading live_sessions data
// (admin frontend stores sessions directly in Supabase, not local PostgreSQL)
async function getSupabaseSessions(filter?: string): Promise<any[]> {
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return [];
  const url = `${SUPABASE_URL}/rest/v1/live_sessions?${filter || ''}select=*&order=scheduled_date.desc`;
  const r = await fetch(url, {
    headers: {
      'apikey': SUPABASE_SERVICE_ROLE_KEY,
      'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    }
  });
  if (!r.ok) return [];
  return await r.json();
}

async function getSupabaseSession(sessionId: string): Promise<any | null> {
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return null;
  const url = `${SUPABASE_URL}/rest/v1/live_sessions?id=eq.${sessionId}&select=*&limit=1`;
  const r = await fetch(url, {
    headers: {
      'apikey': SUPABASE_SERVICE_ROLE_KEY,
      'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    }
  });
  if (!r.ok) return null;
  const rows = await r.json();
  return rows[0] || null;
}

export async function registerRoutes(app: Express): Promise<Server> {
  // GET /api/fases - get phase configuration data
  app.get("/api/fases", async (req, res) => {
    try {
      const fases = loadFases();
      res.json(fases);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // GET /api/technieken - get technique catalog for name-to-ID mapping
  app.get("/api/technieken", async (req, res) => {
    try {
      const technieken = loadTechniquesCatalog();
      res.json(technieken);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // GET /api/techniques - list all techniques grouped by phase (legacy format)
  const techniquesHandler = async (req: any, res: any) => {
    try {
      const technieken = loadTechniquesCatalog();
      const fases = loadFases();
      
      // Group techniques by phase
      const techniquesByPhase = fases.map(fase => ({
        fase: fase.fase,
        naam: fase.naam,
        technieken: technieken.filter((t: any) => {
          // Technique numbers like "1.1", "2.1.3", "3.4", "4.2.1"
          const faseNumber = parseInt(t.nummer.split('.')[0]);
          return faseNumber === fase.fase;
        }).map((t: any) => ({
          id: t.nummer,  // Use nummer as ID
          nummer: t.nummer,
          naam: t.naam,
          fase: t.fase,
          ai_eval_points: t.ai_eval_points || []
        }))
      }));
      
      res.json(techniquesByPhase);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  };
  app.get("/api/techniques", techniquesHandler);
  
  // GET /api/v2/techniques - Full SSOT data including all merged overlay fields
  app.get("/api/v2/techniques", async (req, res) => {
    try {
      const technieken = loadTechniquesCatalog();
      const fases = loadFases();
      
      // Group techniques by phase - return complete merged objects without field pruning
      const techniquesByPhase = fases.map(fase => ({
        fase: fase.fase,
        naam: fase.naam,
        technieken: technieken.filter((t: any) => {
          const faseNumber = parseInt(t.nummer.split('.')[0]);
          return faseNumber === fase.fase;
        }).map((t: any) => ({
          // Return complete merged technique with all SSOT + overlay fields
          id: t.nummer,
          ...t
        }))
      }));
      
      res.json(techniquesByPhase);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // GET /api/user/context - Get user's saved context
  app.get("/api/user/context", async (req, res) => {
    try {
      const userId = (req.query.userId as string) || "demo-user";
      const context = await storage.getUserContext(userId);
      res.json(context || null);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // POST /api/user/context - Save/update user context
  app.post("/api/user/context", async (req, res) => {
    try {
      const { userId, product, klantType, sector, setting, additionalContext } = req.body;
      const userIdToUse = userId || "demo-user";
      
      const context = await storage.createOrUpdateUserContext(userIdToUse, {
        product,
        klantType,
        sector,
        setting,
        additionalContext,
      });
      
      res.json(context);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // POST /api/session/technique-training - create a technique-specific training session
  app.post("/api/session/technique-training", async (req, res) => {
    try {
      const { techniqueId, userId } = req.body;
      
      if (!techniqueId) {
        return res.status(400).json({ error: "techniqueId is required" });
      }
      
      // Determine phase from technique ID (e.g., "2.1.8" -> phase 2)
      const fase = parseInt(techniqueId.split('.')[0]);
      
      // REFACTORED: scenarios.json removed - use synthetic ID and config-loader helpers
      const selectedScenarioId = `technique-${techniqueId}`;
      // houding comes from persona_templates.json defaults (via generateCustomerProfile)
      const selectedHouding = "neutraal, bewuste_kunde";
      
      const userIdToUse = userId || "demo-user";
      
      // Check if we have existing context for this technique
      const existingTechniqueContext = await storage.getTechniqueSession(
        userIdToUse,
        techniqueId
      );
      
      // Check for global user context
      const globalUserContext = await storage.getUserContext(userIdToUse);
      
      // Determine if we have enough context to skip context gathering
      // Need at least product and klant_type for meaningful roleplay
      const hasCompleteContext = globalUserContext && 
        globalUserContext.product && 
        globalUserContext.klantType;
      
      // Build the technique context from global user context if available
      let techniqueContext: any = {};
      if (globalUserContext) {
        techniqueContext = {
          product: globalUserContext.product,
          klant_type: globalUserContext.klantType,
          sector: globalUserContext.sector,
          setting: globalUserContext.setting,
          ...(globalUserContext.additionalContext as Record<string, any> || {}),
        };
      }
      
      // Merge with existing technique-specific context if available
      if (existingTechniqueContext) {
        techniqueContext = {
          ...techniqueContext,
          ...(existingTechniqueContext.context as any),
        };
      }
      
      // Load technique practice config to determine initial mode
      const technieken = loadTechniquesCatalog();
      const technique = technieken.find((t: any) => t.nummer === techniqueId);
      const practiceConfig = technique?.practice || { default_mode: "COACH_CHAT", roleplay_capable: false };
      
      // CONVERSATION-FIRST ARCHITECTURE:
      // - COACH_CHAT: Start with coach conversation, roleplay only if user requests
      // - COACH_CHAT_THEN_ROLEPLAY: Start with coach, then transition to roleplay
      // Default is COACH_CHAT - Hugo as warm, curious, Socratic coach
      let initialMode: string;
      
      if (practiceConfig.default_mode === "COACH_CHAT") {
        // Coach-first: Always start in COACH_CHAT, gather context naturally via conversation
        initialMode = "COACH_CHAT";
      } else if (practiceConfig.default_mode === "COACH_CHAT_THEN_ROLEPLAY") {
        // Coach then roleplay: Start with coach for context, then suggest roleplay
        initialMode = hasCompleteContext ? "COACH_CHAT" : "COACH_CHAT";
      } else {
        // Fallback to coach chat
        initialMode = "COACH_CHAT";
      }
      
      // PERSONA ENGINE: Generate hidden customer profile for roleplay
      const customerProfile = await generateCustomerProfile(userIdToUse);
      
      // REFACTORED: Get context slots from config-loader based on phase
      const contextSlots = getContextSlotsForPhase(fase);
      const greetingIncludesFirstQuestion = !hasCompleteContext && contextSlots.length > 0;
      const initialQuestionIndex = greetingIncludesFirstQuestion ? 1 : 0;
      
      const session = await storage.createSession({
        userId: userIdToUse,
        scenarioId: selectedScenarioId,
        fase,
        mode: initialMode,
        houding: selectedHouding, // FIX: Use scenario houding
        techniqueId,
        techniqueContext: hasCompleteContext ? techniqueContext : { _questionIndex: initialQuestionIndex },
        contextQuestionIndex: initialQuestionIndex,
        customerProfile, // Hidden persona engine selection
      });
      
      // Record persona start for history/cooldown tracking
      await recordPersonaStart(userIdToUse, session.id, customerProfile, techniqueId);
      
      // Check if this is the user's first technique session
      const sessionCount = await storage.countUserTechniqueSessions(userIdToUse);
      const isFirstSession = sessionCount === 0;
      
      const techniekNaam = technique?.naam || techniqueId;
      const voornaam = req.body.userName || "daar";
      
      // CONVERSATION-FIRST: Generate warm coach greeting
      // Hugo is a curious, Socratic coach - not immediately jumping to roleplay
      const isB2C = techniqueContext.klant_type === 'particulier';
      const productInfo = techniqueContext.product || 'jouw product';
      
      // CONTEXT BUG FIX: Log what context is being used for greeting
      console.log("[SESSION-START] Using context for greeting:", {
        hasCompleteContext,
        globalUserContext: globalUserContext ? {
          product: globalUserContext.product,
          klantType: globalUserContext.klantType,
          sector: globalUserContext.sector,
        } : null,
        techniqueContext: {
          product: techniqueContext.product,
          klant_type: techniqueContext.klant_type,
          sector: techniqueContext.sector,
        }
      });
      
      // VALIDATION: Only use sector if it looks like a valid sector name
      // Prevent answers from other questions being used as sector
      const validSectorPatterns = /^(B2B|B2C|Tech|Retail|Healthcare|Finance|Construction|Education|Public|Other|IT|Software|Manufacturing|Services|Consulting)/i;
      const rawSector = techniqueContext.sector;
      const isValidSector = rawSector && (
        rawSector.length < 50 && 
        !rawSector.includes("vragenbarrage") && 
        !rawSector.includes("eenzijdig") &&
        !rawSector.includes("moeilijk")
      );
      
      const sectorPart = !isB2C && isValidSector ? ` in de ${rawSector} sector` : '';
      
      // AI-GENERATED GREETING: Dynamic, human-like responses
      // Uses guidelines from config, not static templates
      const aiPromptForGreeting = loadAiPrompt() as any;
      const contextQuestionsMapping = aiPromptForGreeting.context_questions || {};
      
      // Get first context slot and its intent for dynamic question generation
      const firstSlot = contextSlots[0];
      const firstSlotConfig = firstSlot ? contextQuestionsMapping[firstSlot] : null;
      const firstSlotIntent = typeof firstSlotConfig === 'object' ? firstSlotConfig.intent : null;
      
      // Generate dynamic greeting via AI - every session is unique
      const coachGreeting = await generateDynamicGreeting({
        voornaam,
        techniekNaam,
        techniekId: techniqueId,
        sector: isValidSector ? rawSector : undefined,
        hasContext: Boolean(hasCompleteContext),
        isFirstSession: Boolean(isFirstSession),
        contextSlotNeeded: !hasCompleteContext ? firstSlot : undefined,
        contextSlotIntent: !hasCompleteContext ? firstSlotIntent : undefined,
      });
      
      // Create debug info for transparency panel
      // Note: CustomerProfile uses buying_clock and difficulty (not _stage/_level suffixes)
      const techniqueIntroDebug = {
        mode: "COACH_CHAT" as const,
        context_gathered: {
          product: techniqueContext.product,
          klant_type: techniqueContext.klant_type,
          sector: techniqueContext.sector,
          setting: techniqueContext.setting,
        },
        context_complete: hasCompleteContext,
        persona: {
          behavior_style: customerProfile.behavior_style,
          buying_clock_stage: customerProfile.buying_clock,
          experience_level: String(customerProfile.experience_level),
          difficulty_level: String(customerProfile.difficulty),
        },
      };
      
      await storage.createTurn({
        sessionId: session.id,
        role: "assistant",
        text: coachGreeting,
        techniqueId: null,
        mode: initialMode,
        meta: { debug: techniqueIntroDebug },
      });
      
      return res.json({ 
        sessionId: session.id,
        hasExistingContext: hasCompleteContext,
        mode: initialMode,
        scenarioId: selectedScenarioId,
        houding: selectedHouding,
        practiceConfig,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // POST /api/session - create a new training session (REFACTORED: no longer requires scenarioId)
  app.post("/api/session", async (req, res) => {
    try {
      const { scenarioId, techniqueId, userId, fase, houding } = req.body;
      
      if (!techniqueId) {
        return res.status(400).json({ error: "techniqueId is required for roleplay sessions" });
      }

      // REFACTORED: Derive fase from techniqueId if not provided
      const sessionFase = fase || parseInt(techniqueId.split('.')[0]) || 1;
      
      // REFACTORED: scenarios.json removed - use defaults
      const sessionHouding = houding || "neutraal, bewuste_kunde";
      
      // REFACTORED: Get context slots from config-loader based on phase
      const contextSlots = getContextSlotsForPhase(sessionFase);
      const requiresContext = contextSlots.length > 0;
      
      // v4.0: Start with COACH_CHAT if context gathering needed, otherwise ROLEPLAY
      const initialMode = requiresContext ? "COACH_CHAT" : "ROLEPLAY";

      // PERSONA ENGINE: Generate hidden customer profile for roleplay
      const userIdToUse = userId || "demo-user";
      const customerProfile = await generateCustomerProfile(userIdToUse);

      // REFACTORED: Use synthetic scenarioId based on techniqueId
      const syntheticScenarioId = scenarioId || `technique-${techniqueId}`;

      const session = await storage.createSession({
        userId: userIdToUse,
        scenarioId: syntheticScenarioId,
        fase: sessionFase,
        houding: sessionHouding,
        mode: initialMode,
        techniqueId,
        techniqueContext: requiresContext ? {} : undefined,
        contextQuestionIndex: requiresContext ? 0 : undefined,
        customerProfile,
      });
      
      // Record persona start for history/cooldown tracking
      await recordPersonaStart(userIdToUse, session.id, customerProfile, techniqueId);

      // SSOT: Get technique data from single source of truth
      const aiPrompt = loadAiPrompt();
      const aiPromptTyped = aiPrompt as any;
      const templatesSession = aiPromptTyped.templates || {};
      const technique = getTechniqueFromCatalog(techniqueId);
      const techniqueName = technique?.naam || techniqueId;
      
      // SSOT: Generate coach intro dynamically from technieken_index.json
      // Import at top of file: import { getTechniqueCoachIntro } from "./ssot-loader";
      const { getTechniqueCoachIntro } = await import("./ssot-loader");
      const coachIntro = getTechniqueCoachIntro(techniqueId) 
        || templatesSession.coach_intro?.fallback_intro 
        || `We gaan oefenen met ${techniqueName}.`;

      // Generate Hugo's initial message
      let hugoIntro = "";
      
      if (requiresContext && contextSlots.length > 0) {
        // Start with context gathering
        const contextQuestions = aiPromptTyped.context_questions || {};
        const fallbackQuestionTemplate = contextQuestions._meta?.fallback_template || "Vraag over {{slot}}";
        
        const firstSlot = contextSlots[0];
        const firstQuestion = contextQuestions[firstSlot] || applyTemplate(fallbackQuestionTemplate, { slot: firstSlot });
        
        const welcomeText = applyTemplate(
          templatesSession.coach_intro?.welcome_template || "Welkom bij de training \"{{scenario_titel}}\"!",
          { scenario_titel: techniqueName }
        );
        const contextNeededIntro = templatesSession.coach_intro?.context_needed_intro || "Om het rollenspel relevant te maken, heb ik eerst wat informatie nodig:";
        
        hugoIntro = `${welcomeText}\n\n${coachIntro}\n\n${contextNeededIntro}\n\n${firstQuestion}`;
      } else {
        // No context needed - start with coach intro and roleplay
        const welcomeText = applyTemplate(
          templatesSession.coach_intro?.welcome_template || "Welkom bij de training \"{{scenario_titel}}\"!",
          { scenario_titel: techniqueName }
        );
        const roleplayStartText = templatesSession.coach_intro?.roleplay_start || "Laten we beginnen met het rollenspel. Ik speel de klant.";
        const roleplayFallback = templatesSession.coach_intro?.roleplay_opening_fallback || "Goedendag.";
        hugoIntro = `${welcomeText}\n\n${coachIntro}\n\n${roleplayStartText}\n\n${roleplayFallback}`;
      }

      // Save Hugo's intro message as first turn with debug info
      const contextQuestionsForDebug = aiPromptTyped.context_questions || {};
      const fallbackTemplateForDebug = contextQuestionsForDebug._meta?.fallback_template || "Vraag over {{slot}}";
      const introDebugInfo = {
        mode: "COACH_CHAT" as const,
        context_gathered: {},
        context_complete: false,
        next_question: requiresContext && contextSlots[0] 
          ? (contextQuestionsForDebug[contextSlots[0]] || applyTemplate(fallbackTemplateForDebug, { slot: contextSlots[0] }))
          : undefined,
        persona: {
          behavior_style: customerProfile.behavior_style,
          buying_clock_stage: customerProfile.buying_clock,
          experience_level: String(customerProfile.experience_level),
          difficulty_level: String(customerProfile.difficulty),
        },
      };
      
      await storage.createTurn({
        sessionId: session.id,
        role: "assistant",
        text: hugoIntro,
        mode: initialMode,
        meta: { debug: introDebugInfo },
      });

      res.json({ sessionId: session.id });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // GET /api/session/:id - get session state
  app.get("/api/session/:id", async (req, res) => {
    try {
      const sessionState = await storage.getSessionState(req.params.id);
      
      if (!sessionState) {
        return res.status(404).json({ error: "Session not found" });
      }

      res.json(sessionState);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // GET /api/session/:id/turns - get conversation history
  app.get("/api/session/:id/turns", async (req, res) => {
    try {
      const turns = await storage.getSessionTurns(req.params.id);
      res.json(turns);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // POST /api/session/:id/reset-context - reset context to restart context gathering
  app.post("/api/session/:id/reset-context", async (req, res) => {
    try {
      const session = await storage.getSession(req.params.id);
      if (!session) return res.status(404).json({ error: "Session not found" });
      await storage.updateSession(req.params.id, { techniqueContext: {}, mode: "COACH_CHAT", contextQuestionIndex: 0 });
      await storage.deleteSessionTurns(req.params.id);
      
      // Generate new coach greeting after reset - from config
      const technieken = loadTechniquesCatalog();
      const techniek = technieken.find((t: any) => t.nummer === session.techniqueId);
      const techniekNaam = techniek?.naam || session.techniqueId || "deze techniek";
      const aiPromptReset = loadAiPrompt();
      const resetTemplate = (aiPromptReset as any).templates?.coach_intro?.reset_greeting || "Laten we opnieuw beginnen met {{techniek_naam}}.";
      const greeting = applyTemplate(resetTemplate, { techniek_naam: techniekNaam });
      
      await storage.createTurn({
        sessionId: req.params.id,
        role: "assistant",
        text: greeting,
        techniqueId: null,
        mode: "COACH_CHAT",
        meta: { debug: { mode: "COACH_CHAT", context_gathered: {}, context_complete: false } },
      });
      
      res.json({ success: true, message: "Context reset, ready for new context gathering" });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // POST /api/session/:id/start-roleplay - advance from ROLEPLAY_READY to ROLEPLAY mode
  app.post("/api/session/:id/start-roleplay", async (req, res) => {
    try {
      const sessionId = req.params.id;
      
      const session = await storage.getSession(sessionId);
      if (!session) {
        return res.status(404).json({ error: "Session not found" });
      }
      
      // S5 Fix: Be tolerant if session is already in ROLEPLAY (e.g., auto-started)
      // This prevents 400 errors when button is clicked after autostart
      if (session.mode === "ROLEPLAY") {
        return res.json({ 
          success: true,
          message: "Session already in ROLEPLAY mode",
          mode: "ROLEPLAY",
          alreadyStarted: true
        });
      }
      
      if (session.mode !== "ROLEPLAY_READY") {
        return res.status(400).json({ 
          error: "Session is not in ROLEPLAY_READY mode",
          currentMode: session.mode 
        });
      }
      
      // Update session mode to ROLEPLAY
      await storage.updateSession(sessionId, {
        mode: "ROLEPLAY",
      });
      
      // REFACTORED: scenarios.json removed - user always speaks first in roleplay
      // The design decision is that the salesperson initiates contact
      let openingGreeting: string | null = null;
      
      // DESIGN DECISION: User (salesperson) speaks first in roleplay
      // The roleplay_opening in scenarios describes customer BEHAVIOR, not dialogue
      // Real sales situations: the salesperson initiates contact
      // Hugo (customer) responds to the salesperson's opening
      // 
      // This fixes the bug where Hugo would say "waarmee kan ik u helpen?" 
      // which is coach/service language, not customer language
      
      res.json({
        success: true,
        mode: "ROLEPLAY",
        assistant: null, // No opening greeting - user speaks first
        speechText: null, // Clean text for TTS (no telemetry)
        userSpeaksFirst: true, // Salesperson always initiates
      });
    } catch (error: any) {
      console.error("Error starting roleplay:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // POST /api/session/:id/message - send message and get Hugo's response
  app.post("/api/session/:id/message", async (req, res) => {
    try {
      let { message, action } = req.body;
      const sessionId = req.params.id;

      if (!message) {
        return res.status(400).json({ error: "message is required" });
      }

      const session = await storage.getSession(sessionId);
      if (!session) {
        return res.status(404).json({ error: "Session not found" });
      }

      // VOICE COMMAND DETECTION: Auto-detect end commands for voice input
      // Users saying "feedback", "stop", "einde", "afsluiten", "wil stoppen" trigger feedback mode
      if (!action && session.mode === "ROLEPLAY") {
        const lowerMessage = message.toLowerCase().trim();
        const endKeywords = ["feedback", "stop", "einde", "afsluiten", "beëindig", "klaar", "stoppen", "eindigen"];
        const endPhrases = ["wil stoppen", "wil eindigen", "graag stoppen", "geef feedback", "ontvang feedback", "sessie beëindigen"];
        
        // Check for exact keywords or keywords at start/end
        const hasEndKeyword = endKeywords.some(cmd => 
          lowerMessage === cmd || 
          lowerMessage.startsWith(cmd + " ") || 
          lowerMessage.endsWith(" " + cmd) ||
          lowerMessage.includes(" " + cmd + " ")
        );
        
        // Check for common phrases
        const hasEndPhrase = endPhrases.some(phrase => lowerMessage.includes(phrase));
        
        if (hasEndKeyword || hasEndPhrase) {
          action = "end";
          console.log("[Voice Command] Detected end command:", message);
        }
      }

      // Idempotency check: Skip if same message was sent in last 30 seconds
      const existingTurns = await storage.getSessionTurns(sessionId);
      const lastUserTurn = existingTurns.filter(t => t.role === "user").pop();
      const isDuplicate = lastUserTurn && 
        lastUserTurn.text === message && 
        lastUserTurn.createdAt && 
        (Date.now() - new Date(lastUserTurn.createdAt).getTime()) < 30000;
      
      if (isDuplicate) {
        // Return last assistant response instead of creating duplicate
        const lastAssistantTurn = existingTurns.filter(t => t.role === "assistant").pop();
        if (lastAssistantTurn) {
          return res.json({
            assistant: lastAssistantTurn.text,
            fase: session.fase,
            score: { delta: 0, total: session.scoreTotal || 0 },
            isDuplicate: true,
          });
        }
      }

      // Run detection before saving user message
      const detectionResult = await runDetectors(message, session.fase);
      const themesDetected = await detectThemes(message);

      // Get names from catalog
      const techniqueName = detectionResult.detected 
        ? await getTechniqueName(detectionResult.detected) 
        : null;
      const themeNames = await Promise.all(themesDetected.map(t => getThemeName(t)));

      // Save user message with detection meta
      await storage.createTurn({
        sessionId,
        role: "user",
        text: message,
        mode: session.mode || undefined,
        meta: {
          detection: {
            technique_id: detectionResult.detected,
            technique_name: techniqueName,
            confidence: detectionResult.confidence,
            semantic_matches: detectionResult.semantic_matches,
            themes_touched: themesDetected,
            theme_names: themeNames,
          }
        }
      });

      // Get conversation history
      const allTurns = await storage.getSessionTurns(sessionId);
      
      // Determine current mode (default to COACH_INTRO for new sessions)
      const currentMode = (session.mode || "COACH_INTRO") as Mode;
      
      // CRITICAL FIX: Filter conversation history based on mode
      // In ROLEPLAY mode, exclude coach/context messages to prevent persona drift
      // This ensures Hugo stays in character as CUSTOMER and doesn't mix in coach behavior
      let conversationHistory: Array<{ role: "user" | "assistant"; content: string }>;
      
      if (currentMode === "ROLEPLAY" || currentMode === "ROLEPLAY_READY") {
        // ROLEPLAY mode: Only include ROLEPLAY turns to maintain customer persona
        const roleplayTurns = allTurns.filter(turn => 
          turn.mode === "ROLEPLAY" || 
          // Include the current user message even if mode hasn't been set yet
          (turn.role === "user" && !turn.mode)
        );
        conversationHistory = roleplayTurns.map(turn => ({
          role: turn.role as "user" | "assistant",
          content: turn.text,
        }));
      } else {
        // Non-ROLEPLAY modes: Include all turns for context
        conversationHistory = allTurns.map(turn => ({
          role: turn.role as "user" | "assistant",
          content: turn.text,
        }));
      }
      
      // Check if this is the first user message (turn count === 1 means only user message exists)
      const isFirstUserMessage = allTurns.filter(t => t.role === "user").length === 1;
      
      // Check if this is technique-specific training
      const isTechniqueTraining = !!session.techniqueId;
      
      // Get practice config for roleplay_capable check
      let roleplayCapable = true; // default
      if (session.techniqueId) {
        const technieken = loadTechniquesCatalog();
        const technique = technieken.find((t: any) => t.nummer === session.techniqueId);
        const practiceConfig = technique?.practice || { default_mode: "COACH_CHAT", roleplay_capable: true };
        roleplayCapable = practiceConfig.roleplay_capable !== false;
      }
      
      // Handle COACH_CHAT mode with context gathering if applicable
      let contextComplete = false;
      let nextQuestion: any = null;
      let questionIndex = 0;
      
      // Check if we're already in pure coach mode - skip context gathering entirely
      const currentContext = (session.techniqueContext as any) || {};
      const alreadyInPureCoachMode = currentContext.pureCoachMode === true;
      
      // If already in pure coach mode, mark context as complete and skip gathering
      if (alreadyInPureCoachMode) {
        contextComplete = true;
      } else if (currentMode === "COACH_CHAT") {
        // Only do context gathering if not already in pure coach mode
        questionIndex = currentContext._questionIndex || 0;
        
        // For the first message (questionIndex 0), don't pass the message as an answer
        // It's just the trigger to start the questions
        const userAnswer = questionIndex === 0 ? null : message;
        
        // Import handleScenarioContextGathering
        const { handleScenarioContextGathering } = await import("./state-machine");
        
        // REFACTORED: Get context slots from config-loader based on session fase
        const phaseContextSlots = getContextSlotsForPhase(session.fase);
        
        // Handle context gathering - use phase-specific context_slots
        const contextResult = await handleScenarioContextGathering(
          currentContext,
          userAnswer,
          questionIndex,
          phaseContextSlots // REFACTORED: Use phase-based context slots
        );
        
        contextComplete = contextResult.contextComplete;
        nextQuestion = contextResult.nextQuestion;
        
        // Update session with new context
        if (contextResult.updatedContext) {
          contextResult.updatedContext._questionIndex = contextResult.nextQuestionIndex || 0;
          await storage.updateSession(sessionId, {
            techniqueContext: contextResult.updatedContext,
          });
          
          // Save technique context for reuse (only if techniqueId exists)
          if (contextComplete && session.techniqueId) {
            const existingTechniqueSession = await storage.getTechniqueSession(
              session.userId,
              session.techniqueId
            );
            
            if (existingTechniqueSession) {
              await storage.updateTechniqueSession(
                existingTechniqueSession.id,
                contextResult.updatedContext
              );
            } else {
              await storage.createTechniqueSession({
                userId: session.userId,
                techniqueId: session.techniqueId,
                context: contextResult.updatedContext,
              });
            }
          }
          
          // GLOBAL CONTEXT FIX: Also save to global user_context for cross-session consistency
          // This ensures sector, product, klant_type are shared across ALL sessions
          if (contextComplete && contextResult.updatedContext) {
            const ctx = contextResult.updatedContext;
            await storage.createOrUpdateUserContext(session.userId, {
              product: ctx.product || undefined,
              klantType: ctx.klant_type || undefined,
              sector: ctx.sector || undefined,
              setting: ctx.setting || undefined,
            });
          }
        }
      }
      
      // Determine next mode based on current mode, action, and message count
      const modeTransition = determineNextMode(
        currentMode,
        action as "stop" | "end" | "retry" | "skip_context" | "start_roleplay" | null,
        isFirstUserMessage,
        isTechniqueTraining,
        contextComplete,
        roleplayCapable // NEW: Pass roleplay capability to mode transition
      );
      
      const nextMode = modeTransition.nextMode;
      
      // If transitioning to ROLEPLAY_READY, create transition message and update session
      if (nextMode === "ROLEPLAY_READY" && currentMode !== "ROLEPLAY_READY") {
        await storage.updateSession(sessionId, {
          mode: "ROLEPLAY_READY",
        });
        
        // S5 Fix: Conversational transition from config
        const aiPromptConfig = loadAiPrompt();
        const transitionMessage = aiPromptConfig.templates?.coach_intro?.roleplay_transition || "Oké, laten we beginnen.";
        
        await storage.createTurn({
          sessionId,
          role: "assistant",
          text: transitionMessage,
          mode: "ROLEPLAY_READY",
        });
        
        return res.json({
          assistant: transitionMessage,
          mode: "ROLEPLAY_READY",
          fase: session.fase,
          score: { delta: 0, total: session.scoreTotal || 0 },
          contextComplete: true,
        });
      }
      
      // If transitioning from ROLEPLAY_READY to ROLEPLAY, update session mode
      // Also re-check for concurrent /start-roleplay calls to avoid duplicate openers
      let skipAIResponse = false;
      if (nextMode === "ROLEPLAY" && currentMode === "ROLEPLAY_READY") {
        // Re-fetch latest session and turns to catch any concurrent /start-roleplay call
        const latestSession = await storage.getSession(sessionId);
        const latestTurns = await storage.getSessionTurns(sessionId);
        
        // Check if /start-roleplay already ran (mode changed or ROLEPLAY turn exists)
        const roleplayAlreadyStarted = 
          latestSession?.mode === "ROLEPLAY" ||
          latestTurns.some(t => t.role === "assistant" && t.mode === "ROLEPLAY");
        
        if (roleplayAlreadyStarted) {
          // Roleplay already started via /start-roleplay, skip generating a duplicate opener
          skipAIResponse = true;
        } else {
          // First entry to ROLEPLAY via user message - update mode
          await storage.updateSession(sessionId, {
            mode: "ROLEPLAY",
          });
        }
      }
      
      // If roleplay was already started, don't generate a duplicate opening
      // The user's message will be responded to normally in the next /message call
      if (skipAIResponse) {
        return res.json({
          assistant: null,
          mode: "ROLEPLAY",
          fase: session.fase,
          score: { delta: 0, total: session.scoreTotal || 0 },
          skipped: true,
          message: "Roleplay already started. Your message has been saved.",
        });
      }

      // Prepare additional params for COACH_CHAT context gathering mode
      let additionalParams: any = undefined;
      let useCoachEngine = false; // Flag to use RAG-grounded coach engine
      
      // Use the alreadyInPureCoachMode flag we computed earlier (when checking context gathering)
      
      if (nextMode === "COACH_CHAT") {
        if (alreadyInPureCoachMode || (contextComplete && !roleplayCapable)) {
          // Pure COACH_CHAT mode: Use RAG-grounded coach engine (no roleplay)
          useCoachEngine = true;
          
          // Persist pure coach mode for subsequent requests
          if (!alreadyInPureCoachMode && contextComplete && !roleplayCapable) {
            await storage.updateSession(sessionId, {
              techniqueContext: { ...currentContext, pureCoachMode: true },
            });
          }
        } else if (!nextQuestion && !contextComplete) {
          // This shouldn't happen, but handle it gracefully
          console.error("COACH_CHAT mode but no question available");
          return res.status(500).json({ 
            error: "Failed to load context gathering questions" 
          });
        } else if (nextQuestion) {
          additionalParams = {
            question: nextQuestion,
            questionIndex: questionIndex + 1,  // Always increment from current index
          };
        }
      }
      
      // PURE COACH_CHAT: Use coach-engine with RAG for natural coaching conversation
      if (useCoachEngine) {
        const { generateCoachResponse } = await import("./v2/coach-engine");
        
        // Build coach context from session
        const coachContext = {
          techniqueId: session.techniqueId || undefined,
          techniqueName: session.techniqueId ? 
            loadTechniquesCatalog().find((t: any) => t.nummer === session.techniqueId)?.naam : undefined,
          sector: (session.techniqueContext as any)?.sector,
          product: (session.techniqueContext as any)?.product,
        };
        
        // Convert conversation history for coach engine
        const coachHistory = conversationHistory.map(msg => ({
          role: msg.role as "user" | "assistant",
          content: msg.content,
        }));
        
        const coachResponse = await generateCoachResponse(message, coachHistory, coachContext);
        
        // Save assistant response
        await storage.createTurn({
          sessionId,
          role: "assistant",
          mode: "COACH_CHAT",
          text: coachResponse.message,
          meta: {
            coach_mode: "pure_coach",
            rag_documents: coachResponse.ragContext?.length || 0,
            debug: coachResponse.debug,
          },
        });
        
        return res.json({
          assistant: coachResponse.message,
          mode: "COACH_CHAT",
          fase: session.fase,
          score: { delta: 0, total: session.scoreTotal || 0 },
          contextComplete: true,
          coachMode: true,
          ragDocuments: coachResponse.debug?.documentsFound || 0,
        });
      }
      
      // Call OpenAI to get Hugo's response with mode-specific prompting
      const { response: hugoRawResponse, debug: responseDebug } = await getChatCompletion(
        nextMode,
        conversationHistory, 
        {
          fase: session.fase,
          houding: session.houding || "neutraal, afwachtend",
          scenarioId: session.scenarioId,
          lockedThemes: session.lockedThemes as string[],
          usedTechniques: session.usedTechniques as string[],
          techniqueId: session.techniqueId || undefined,
          techniqueContext: session.techniqueContext || undefined,
        },
        additionalParams
      );

      // Parse Hugo's response - mode-aware parsing
      let assistantText: string;
      let hugoData: any = null;
      
      // GENERATION VS EVALUATION SPLIT:
      // For ROLEPLAY mode, the AI returns pure customer voice (no JSON)
      // Then we automatically run evaluation as a separate step
      if (nextMode === "ROLEPLAY") {
        // ROLEPLAY: Pure customer voice - no JSON parsing needed
        assistantText = sanitizeRoleplayCustomerText(hugoRawResponse.trim());
        
        // Save assistant response first (pure customer text)
        const assistantTurn = await storage.createTurn({
          sessionId,
          role: "assistant",
          mode: nextMode,
          text: assistantText,
          techniqueId: null,
        });

        // AUTOMATIC EVALUATION: Run evaluation as separate AI call
        // This keeps generation clean while still providing scoring
        // FIX Bug 1: Safe filter - mode can be null
        const roleplayTurns = [
          ...allTurns.filter(t => t.mode === "ROLEPLAY" && t.role),
          { role: "user", text: message },
          { role: "assistant", text: assistantText }
        ];
        
        const conversationForEval = roleplayTurns.map(t => ({
          role: t.role as "user" | "assistant",
          content: t.text,
        }));
        
        // FIX Bug 2: Wrap evaluation in try-catch to prevent stream crash
        let evaluation: {
          appliedTechnique: string | null;
          scoreDelta: number;
          feedbackPoints: string[];
          mistakesDetected: string[];
          customerAttitude: string | null;
          commitmentEvent: { performed: boolean; themesLocked: string[] };
          themesDetected: string[];
        };
        
        try {
          evaluation = await getEvaluationCompletion(conversationForEval, {
            fase: session.fase,
            techniqueId: session.techniqueId || undefined,
            usedTechniques: session.usedTechniques as string[],
            houding: session.houding || undefined,
            scenarioId: session.scenarioId,
          });
          
          // Commitment Detection Override
          const commitmentValidation = validateCommitmentDetection(message, evaluation.appliedTechnique);
          if (commitmentValidation.overridden) {
            evaluation.appliedTechnique = commitmentValidation.finalTechnique;
            evaluation.feedbackPoints.push("Commitment techniek (2.4) correct herkend");
          }
        } catch (evalError: any) {
          console.error("[Evaluation Error] Failed to evaluate, using fallback:", evalError.message);
          // Fallback: return customer text without scoring
          evaluation = {
            appliedTechnique: null,
            scoreDelta: 0,
            feedbackPoints: [],
            mistakesDetected: [],
            customerAttitude: null,
            commitmentEvent: { performed: false, themesLocked: [] },
            themesDetected: [],
          };
        }
        
        // Validate policy checks
        const errors: string[] = [];
        const warnings: string[] = [];
        const feedback: string[] = [];
        
        if (evaluation.appliedTechnique) {
          if (session.fase === 1) {
            const validation = validatePhase1Order(
              session.stapStack as string[],
              evaluation.appliedTechnique
            );
            errors.push(...validation.errors);
            warnings.push(...validation.warnings);
          }
          
          const terzijdeValidation = validateNoTerzijdeInPhase4(
            session.fase,
            evaluation.appliedTechnique
          );
          errors.push(...terzijdeValidation.errors);
          warnings.push(...terzijdeValidation.warnings);
        } else {
          // Guardrail: No technique detected - provide feedback based on phase
          if (session.fase === 2) {
            // Better question detection: check for interrogatives and question marks
            const openQuestionWords = ["wie", "wat", "waar", "wanneer", "waarom", "hoe", "welke"];
            const messageLower = message.toLowerCase();
            const hasQuestionMark = message.includes("?");
            const hasInterrogative = openQuestionWords.some(w => messageLower.includes(w));
            
            if (!hasQuestionMark && !hasInterrogative) {
              const msg = "Geen vraag gedetecteerd in Discovery fase - stel open vragen";
              evaluation.mistakesDetected.push(msg);
              warnings.push(msg);
            } else if (!hasQuestionMark) {
              // Has interrogative but no question mark
              const msg = "Vraag mist vraagteken - overweeg de vraag duidelijker te formuleren";
              warnings.push(msg);
            } else {
              // Question mark present but not recognized as specific technique
              const msg = "Vraag niet herkend als specifieke techniek";
              warnings.push(msg);
            }
          } else if (session.fase === 1) {
            const msg = "Geen opening techniek gedetecteerd - volg de fase 1 volgorde";
            evaluation.mistakesDetected.push(msg);
            warnings.push(msg);
          }
        }
        
        // Add all mistakesDetected to warnings array for visibility
        for (const mistake of evaluation.mistakesDetected) {
          if (!warnings.includes(mistake)) {
            warnings.push(mistake);
          }
        }
        
        // Process detected themes - always add to turn metadata, lock on commitment
        const newLockedThemes = [...(session.lockedThemes as string[])];
        if (evaluation.commitmentEvent.performed && evaluation.commitmentEvent.themesLocked.length > 0) {
          for (const theme of evaluation.commitmentEvent.themesLocked) {
            if (!newLockedThemes.includes(theme)) {
              newLockedThemes.push(theme);
              await storage.createCommitmentEvent({
                sessionId,
                theme,
                turnId: assistantTurn.id,
              });
            }
          }
        }
        
        // Determine next phase
        const hugoDataForPhase = {
          applied_technique: evaluation.appliedTechnique,
          customer_attitude: evaluation.customerAttitude,
        };
        const nextPhase = determineNextPhase(session.fase, hugoDataForPhase, newLockedThemes);
        
        // Update stapStack if in phase 1
        let nextStapStack = session.stapStack as string[];
        if (session.fase === 1 && evaluation.appliedTechnique) {
          nextStapStack = updateStapStack(nextStapStack, evaluation.appliedTechnique);
        }
        
        // Calculate new score
        // FIX Bug 1: Default scoreTotal to 0 if null
        const currentScore = session.scoreTotal || 0;
        const scoreDelta = evaluation.scoreDelta;
        const newScore = currentScore + scoreDelta;
        
        // Build feedback array
        evaluation.feedbackPoints.forEach((point: string) => {
          feedback.push(`✅ ${point}`);
        });
        evaluation.mistakesDetected.forEach((mistake: string) => {
          feedback.push(`⚠️ ${mistake}`);
        });
        
        // Update session state
        await storage.updateSession(sessionId, {
          mode: nextMode,
          fase: nextPhase,
          stapStack: nextStapStack,
          lockedThemes: newLockedThemes,
          usedTechniques: evaluation.appliedTechnique ? [
            ...(session.usedTechniques as string[]),
            evaluation.appliedTechnique
          ].filter(Boolean) : session.usedTechniques as string[],
          lastCustomerAttitude: evaluation.customerAttitude || session.lastCustomerAttitude,
          scoreTotal: newScore,
        });
        
        // Update turn with evaluation data including themes
        await storage.updateTurnMeta(assistantTurn.id, {
          evaluation: {
            score_delta: scoreDelta,
            ai_eval_points_hit: evaluation.feedbackPoints,
            mistakes_detected: evaluation.mistakesDetected,
            themes_detected: evaluation.themesDetected,
          },
          customer_attitude: evaluation.customerAttitude,
          feedback,
        });
        
        // Also update techniqueId on the turn
        if (evaluation.appliedTechnique) {
          await storage.updateTurn(assistantTurn.id, {
            techniqueId: evaluation.appliedTechnique,
          });
        }

        // Build response with both natural text AND evaluation
        const response: MessageResponse = {
          assistant: assistantText,
          speechText: assistantText, // Clean text for TTS - no telemetry!
          fase: nextPhase as 1 | 2 | 3 | 4,
          applied_technique: evaluation.appliedTechnique || "",
          locks: newLockedThemes,
          score: {
            delta: scoreDelta,
            total: newScore,
          },
          next_allowed: getAllowedTechniques(nextPhase, evaluation.appliedTechnique),
          warnings,
          mistakes_detected: evaluation.mistakesDetected, // Top-level for consumers
          feedback,
          metadata: {
            customer_attitude: evaluation.customerAttitude,
            commitment_event: evaluation.commitmentEvent,
            themes_detected: evaluation.themesDetected,
            evaluation: {
              score_delta: scoreDelta,
              ai_eval_points_hit: evaluation.feedbackPoints,
              mistakes_detected: evaluation.mistakesDetected,
            },
          },
        };

        return res.json(response);
      }
      
      // Non-ROLEPLAY modes (COACH_CHAT, COACH_INTRO, COACH_FEEDBACK)
      // These still use JSON parsing where applicable
      try {
        const parsed = parseHugoResponse(hugoRawResponse, nextMode);
        assistantText = parsed.text;
        hugoData = parsed.data;
      } catch (error: any) {
        console.error("Failed to parse Hugo response:", error);
        return res.status(500).json({ 
          error: "AI response format error. Hugo did not provide proper feedback structure.",
          details: error.message 
        });
      }

      // For non-ROLEPLAY modes, minimal state updates
      const errors: string[] = [];
      const warnings: string[] = [];
      const feedback: string[] = [];
      const newLockedThemes = session.lockedThemes as string[];
      const nextPhase = session.fase;
      const nextStapStack = session.stapStack as string[];
      const scoreDelta = 0;
      const newScore = session.scoreTotal;

      // Update session state with new mode
      await storage.updateSession(sessionId, {
        mode: nextMode,
      });

      // Save assistant response with debug info for COACH_CHAT transparency
      const turnMeta: Record<string, unknown> = { parsed_text: assistantText };
      if (responseDebug) {
        turnMeta.debug = responseDebug;
      }
      
      await storage.createTurn({
        sessionId,
        role: "assistant",
        mode: nextMode,
        text: hugoRawResponse,
        techniqueId: null,
        meta: turnMeta,
      });

      // Build response
      const response: MessageResponse = {
        assistant: assistantText,
        speechText: assistantText,
        fase: nextPhase as 1 | 2 | 3 | 4,
        applied_technique: "",
        locks: newLockedThemes,
        score: {
          delta: scoreDelta,
          total: newScore,
        },
        next_allowed: getAllowedTechniques(nextPhase, null),
        warnings,
        mistakes_detected: [], // No mistakes in non-ROLEPLAY modes
        feedback,
        metadata: hugoData,
        debug: responseDebug, // Include debug info in response for frontend transparency
      };

      res.json(response);
    } catch (error: any) {
      console.error("Error processing message:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // TASK 3: POST /api/session/:id/feedback - Dedicated feedback endpoint
  // Returns coach feedback on the roleplay session. First-class feature.
  // ARCHITECTURE: Detection-driven feedback - AI formats data, doesn't interpret
  app.post("/api/session/:id/feedback", async (req, res) => {
    try {
      const sessionId = req.params.id;
      
      const session = await storage.getSession(sessionId);
      if (!session) {
        return res.status(404).json({ error: "Session not found" });
      }
      
      // Get only ROLEPLAY turns for feedback generation
      const allTurns = await storage.getSessionTurns(sessionId);
      const roleplayTurns = allTurns.filter(turn => 
        turn.mode === "ROLEPLAY" || 
        // Include turns before mode tracking was added
        (!turn.mode && turn.role !== "system")
      );
      
      if (roleplayTurns.length === 0) {
        return res.status(400).json({ 
          error: "No roleplay conversation to provide feedback on",
          feedbackText: "Er is nog geen gesprek om feedback op te geven. Start eerst een roleplay sessie."
        });
      }
      
      // STEP 1: Aggregate detection data from turn.meta
      // This is the source of truth - NOT AI interpretation
      const aggregation = await aggregateFeedback(roleplayTurns, session.fase);
      
      // STEP 2: Use server-side template for deterministic feedback
      // NO AI reinterpretation - the template renders directly from aggregated data
      const feedbackText = renderFeedbackTemplate(aggregation);
      
      console.log("[Feedback] Rendered deterministic feedback from aggregation:", {
        techniques_used: aggregation.techniques_used.length,
        themes_covered: aggregation.themes_discussed.filter(t => t.covered).length,
        total_score: aggregation.total_score,
      });
      
      // Update session mode to COACH_FEEDBACK
      await storage.updateSession(sessionId, {
        mode: "COACH_FEEDBACK",
      });
      
      // Save the feedback as an assistant turn
      await storage.createTurn({
        sessionId,
        role: "assistant",
        text: feedbackText,
        mode: "COACH_FEEDBACK",
      });
      
      console.log("[Feedback Endpoint] Generated feedback for session:", sessionId);
      
      res.json({
        feedbackText,
        speechText: feedbackText, // Clean text for TTS
        mode: "COACH_FEEDBACK",
        turnsReviewed: roleplayTurns.length,
        // Required unified engine contract fields
        scenarioId: session.scenarioId,
        houding: session.houding || "neutraal",
        fase: session.fase,
        score: {
          delta: 0,
          total: session.scoreTotal || 0,
        },
      });
    } catch (error: any) {
      console.error("Error generating feedback:", error);
      const aiPrompt = loadAiPrompt() as any;
      const errorMessage = aiPrompt.templates?.errors?.feedback_generation_error || "Error generating feedback. Please try again.";
      res.status(500).json({ 
        error: error.message,
        feedbackText: errorMessage
      });
    }
  });

  // POST /api/session/:id/evaluate - Separate evaluation endpoint
  // Analyzes the last ROLEPLAY turn and returns technique detection + scoring
  // This separates "generation" (natural conversation) from "evaluation" (telemetry/scoring)
  app.post("/api/session/:id/evaluate", async (req, res) => {
    try {
      const sessionId = req.params.id;
      
      const session = await storage.getSession(sessionId);
      if (!session) {
        return res.status(404).json({ error: "Session not found" });
      }
      
      // Only evaluate ROLEPLAY turns
      if (session.mode !== "ROLEPLAY") {
        return res.status(400).json({ 
          error: "Evaluation only available for ROLEPLAY mode",
          currentMode: session.mode
        });
      }
      
      // Get recent ROLEPLAY turns for evaluation context
      // FIX Bug 1: Safe filter - mode can be null
      const allTurns = await storage.getSessionTurns(sessionId);
      const roleplayTurns = allTurns.filter(turn => turn.mode === "ROLEPLAY" && turn.role);
      
      if (roleplayTurns.length === 0) {
        return res.status(400).json({ 
          error: "No roleplay turns to evaluate"
        });
      }
      
      // Build conversation history for evaluation
      const conversationHistory = roleplayTurns.map(turn => ({
        role: turn.role as "user" | "assistant",
        content: turn.text,
      }));
      
      // Call the separate evaluation function
      const evaluation = await getEvaluationCompletion(conversationHistory, {
        fase: session.fase,
        techniqueId: session.techniqueId || undefined,
        usedTechniques: session.usedTechniques as string[],
        houding: session.houding || undefined,
        scenarioId: session.scenarioId,
      });
      
      // Commitment Detection Override: Check if last user message contains Commitment technique
      const lastUserTurn = roleplayTurns.filter(t => t.role === "user").pop();
      if (lastUserTurn) {
        const commitmentValidation = validateCommitmentDetection(lastUserTurn.text, evaluation.appliedTechnique);
        
        if (commitmentValidation.overridden) {
          console.log("✅ [Evaluate] Commitment Detection Override:", {
            userMessage: lastUserTurn.text,
            aiDetected: evaluation.appliedTechnique,
            overriddenTo: commitmentValidation.finalTechnique,
          });
          evaluation.appliedTechnique = commitmentValidation.finalTechnique;
          evaluation.feedbackPoints.push("Commitment techniek (2.4) correct herkend");
        }
      }
      
      // Validate policy checks
      const errors: string[] = [];
      const warnings: string[] = [];
      
      if (evaluation.appliedTechnique) {
        // Phase 1 order validation
        if (session.fase === 1) {
          const validation = validatePhase1Order(
            session.stapStack as string[],
            evaluation.appliedTechnique
          );
          errors.push(...validation.errors);
          warnings.push(...validation.warnings);
        }
        
        // Phase 4 ter zijde prohibition
        const terzijdeValidation = validateNoTerzijdeInPhase4(
          session.fase, 
          evaluation.appliedTechnique
        );
        errors.push(...terzijdeValidation.errors);
        warnings.push(...terzijdeValidation.warnings);
      }
      
      // Process commitment events
      const newLockedThemes = [...(session.lockedThemes as string[])];
      if (evaluation.commitmentEvent.performed && evaluation.commitmentEvent.themesLocked.length > 0) {
        for (const theme of evaluation.commitmentEvent.themesLocked) {
          if (!newLockedThemes.includes(theme)) {
            newLockedThemes.push(theme);
            
            // Save commitment event
            await storage.createCommitmentEvent({
              sessionId,
              theme,
              turnId: roleplayTurns[roleplayTurns.length - 1]?.id || sessionId,
            });
          }
        }
      }
      
      // Determine next phase
      const hugoDataForPhase = {
        applied_technique: evaluation.appliedTechnique,
        customer_attitude: evaluation.customerAttitude,
      };
      const nextPhase = determineNextPhase(session.fase, hugoDataForPhase, newLockedThemes);
      
      // Update stapStack if in phase 1
      let nextStapStack = session.stapStack as string[];
      if (session.fase === 1 && evaluation.appliedTechnique) {
        nextStapStack = updateStapStack(nextStapStack, evaluation.appliedTechnique);
      }
      
      // Calculate new score
      // FIX Bug 1: Default scoreTotal to 0 if null
      const currentScore = session.scoreTotal || 0;
      const newScore = currentScore + evaluation.scoreDelta;
      
      // Update session state
      await storage.updateSession(sessionId, {
        fase: nextPhase,
        stapStack: nextStapStack,
        lockedThemes: newLockedThemes,
        usedTechniques: evaluation.appliedTechnique ? [
          ...(session.usedTechniques as string[]),
          evaluation.appliedTechnique
        ].filter(Boolean) : session.usedTechniques as string[],
        lastCustomerAttitude: evaluation.customerAttitude || session.lastCustomerAttitude,
        scoreTotal: newScore,
      });
      
      // Update the last assistant turn with evaluation metadata
      const lastAssistantTurn = roleplayTurns.filter(t => t.role === "assistant").pop();
      if (lastAssistantTurn) {
        await storage.updateTurnMeta(lastAssistantTurn.id, {
          evaluation: {
            appliedTechnique: evaluation.appliedTechnique,
            scoreDelta: evaluation.scoreDelta,
            feedbackPoints: evaluation.feedbackPoints,
            mistakesDetected: evaluation.mistakesDetected,
          },
          customerAttitude: evaluation.customerAttitude,
        });
      }
      
      // Track technique attempt for analytics (non-blocking)
      if (evaluation.appliedTechnique) {
        const userId = session.userId || "demo-user";
        const attemptScore = evaluation.scoreDelta > 0 ? Math.min(100, 50 + evaluation.scoreDelta * 10) : 30;
        const success = evaluation.scoreDelta > 0;
        
        storage.recordTechniqueAttempt(userId, evaluation.appliedTechnique, evaluation.appliedTechnique, attemptScore, success)
          .catch(err => console.error("Failed to record technique attempt:", err));
        
        storage.updateStreak(userId)
          .catch(err => console.error("Failed to update streak:", err));
      }
      
      console.log("[Evaluate Endpoint] Evaluated session:", sessionId, {
        appliedTechnique: evaluation.appliedTechnique,
        scoreDelta: evaluation.scoreDelta,
        newScore,
      });
      
      // Build feedback array for response
      const feedback: string[] = [];
      evaluation.feedbackPoints.forEach(point => feedback.push(`✅ ${point}`));
      evaluation.mistakesDetected.forEach(mistake => feedback.push(`⚠️ ${mistake}`));
      
      res.json({
        appliedTechnique: evaluation.appliedTechnique,
        scoreDelta: evaluation.scoreDelta,
        scoreTotal: newScore,
        feedbackPoints: evaluation.feedbackPoints,
        mistakesDetected: evaluation.mistakesDetected,
        customerAttitude: evaluation.customerAttitude,
        fase: nextPhase,
        locks: newLockedThemes,
        feedback,
        warnings,
        errors,
        next_allowed: getAllowedTechniques(nextPhase, evaluation.customerAttitude || null),
      });
    } catch (error: any) {
      console.error("Error evaluating session:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // POST /api/session/:id/message/stream - SSE streaming endpoint
  app.post("/api/session/:id/message/stream", async (req, res) => {
    try {
      let { message, action } = req.body;
      const sessionId = req.params.id;

      if (!message) {
        return res.status(400).json({ error: "message is required" });
      }

      const session = await storage.getSession(sessionId);
      if (!session) {
        return res.status(404).json({ error: "Session not found" });
      }

      // VOICE COMMAND DETECTION: Auto-detect end commands for voice input
      // Users saying "feedback", "stop", "einde", "afsluiten", "wil stoppen" trigger feedback mode
      if (!action && session.mode === "ROLEPLAY") {
        const lowerMessage = message.toLowerCase().trim();
        const endKeywords = ["feedback", "stop", "einde", "afsluiten", "beëindig", "klaar", "stoppen", "eindigen"];
        const endPhrases = ["wil stoppen", "wil eindigen", "graag stoppen", "geef feedback", "ontvang feedback", "sessie beëindigen"];
        
        // Check for exact keywords or keywords at start/end
        const hasEndKeyword = endKeywords.some(cmd => 
          lowerMessage === cmd || 
          lowerMessage.startsWith(cmd + " ") || 
          lowerMessage.endsWith(" " + cmd) ||
          lowerMessage.includes(" " + cmd + " ")
        );
        
        // Check for common phrases
        const hasEndPhrase = endPhrases.some(phrase => lowerMessage.includes(phrase));
        
        if (hasEndKeyword || hasEndPhrase) {
          action = "end";
          console.log("[Voice Command Stream] Detected end command:", message);
        }
      }

      // Set SSE headers
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");
      res.setHeader("X-Accel-Buffering", "no"); // Disable buffering for nginx

      // Idempotency check: Skip if same message was sent in last 30 seconds
      const existingTurns = await storage.getSessionTurns(sessionId);
      const lastUserTurn = existingTurns.filter(t => t.role === "user").pop();
      const isDuplicate = lastUserTurn && 
        lastUserTurn.text === message && 
        lastUserTurn.createdAt && 
        (Date.now() - new Date(lastUserTurn.createdAt).getTime()) < 30000;
      
      if (isDuplicate) {
        // Return last assistant response instead of creating duplicate
        const lastAssistantTurn = existingTurns.filter(t => t.role === "assistant").pop();
        if (lastAssistantTurn) {
          res.write(`data: ${JSON.stringify({ type: "token", content: lastAssistantTurn.text })}\n\n`);
          res.write(`data: ${JSON.stringify({ type: "done", metadata: { assistant: lastAssistantTurn.text, fase: session.fase, score: { delta: 0, total: session.scoreTotal || 0 } } })}\n\n`);
          return res.end();
        }
      }

      // Run detection before saving user message (streaming)
      const detectionResult = await runDetectors(message, session.fase);
      const themesDetected = await detectThemes(message);

      // Get names from catalog
      const techniqueName = detectionResult.detected 
        ? await getTechniqueName(detectionResult.detected) 
        : null;
      const themeNames = await Promise.all(themesDetected.map(t => getThemeName(t)));

      // Save user message with detection meta
      await storage.createTurn({
        sessionId,
        role: "user",
        text: message,
        mode: session.mode || undefined,
        meta: {
          detection: {
            technique_id: detectionResult.detected,
            technique_name: techniqueName,
            confidence: detectionResult.confidence,
            semantic_matches: detectionResult.semantic_matches,
            themes_touched: themesDetected,
            theme_names: themeNames,
          }
        }
      });

      // Get conversation history
      const allTurns = await storage.getSessionTurns(sessionId);
      
      // Determine current mode
      const currentMode = (session.mode || "COACH_INTRO") as Mode;
      
      // CRITICAL FIX: Filter conversation history based on mode (streaming endpoint)
      // In ROLEPLAY mode, exclude coach/context messages to prevent persona drift
      let conversationHistory: Array<{ role: "user" | "assistant"; content: string }>;
      
      if (currentMode === "ROLEPLAY" || currentMode === "ROLEPLAY_READY") {
        // ROLEPLAY mode: Only include ROLEPLAY turns to maintain customer persona
        const roleplayTurns = allTurns.filter(turn => 
          turn.mode === "ROLEPLAY" || 
          (turn.role === "user" && !turn.mode)
        );
        conversationHistory = roleplayTurns.map(turn => ({
          role: turn.role as "user" | "assistant",
          content: turn.text,
        }));
      } else {
        // Non-ROLEPLAY modes: Include all turns for context
        conversationHistory = allTurns.map(turn => ({
          role: turn.role as "user" | "assistant",
          content: turn.text,
        }));
      }
      const isFirstUserMessage = allTurns.filter(t => t.role === "user").length === 1;
      
      // Check if this is technique-specific training
      const isTechniqueTraining = !!session.techniqueId;
      
      // Handle COACH_CHAT mode with context gathering if applicable
      let contextComplete = false;
      let nextQuestion: any = null;
      let questionIndex = 0;
      
      // Early check: Get current context and pureCoachMode flag
      const earlyContext = (session.techniqueContext as any) || {};
      const earlyPureCoachMode = earlyContext.pureCoachMode === true;
      
      if (currentMode === "COACH_CHAT" && !earlyPureCoachMode) {
        // Get current question index from context or default to 0
        const currentContext = earlyContext;
        questionIndex = currentContext._questionIndex || 0;
        
        // For the first message (questionIndex 0), don't pass the message as an answer
        // It's just the trigger to start the questions
        const userAnswer = questionIndex === 0 ? null : message;
        
        // Import handleScenarioContextGathering
        const { handleScenarioContextGathering } = await import("./state-machine");
        
        // REFACTORED: Get context slots from config-loader based on session fase
        const phaseContextSlots = getContextSlotsForPhase(session.fase);
        
        // Handle context gathering - use phase-specific context_slots
        const contextResult = await handleScenarioContextGathering(
          currentContext,
          userAnswer,
          questionIndex,
          phaseContextSlots // REFACTORED: Use phase-based context slots
        );
        
        contextComplete = contextResult.contextComplete;
        nextQuestion = contextResult.nextQuestion;
        
        // Update session with new context
        if (contextResult.updatedContext) {
          contextResult.updatedContext._questionIndex = contextResult.nextQuestionIndex || 0;
          await storage.updateSession(sessionId, {
            techniqueContext: contextResult.updatedContext,
          });
          
          // Save technique context for reuse (only if techniqueId exists)
          if (contextComplete && session.techniqueId) {
            const existingTechniqueSession = await storage.getTechniqueSession(
              session.userId,
              session.techniqueId
            );
            
            if (existingTechniqueSession) {
              await storage.updateTechniqueSession(
                existingTechniqueSession.id,
                contextResult.updatedContext
              );
            } else {
              await storage.createTechniqueSession({
                userId: session.userId,
                techniqueId: session.techniqueId,
                context: contextResult.updatedContext,
              });
            }
          }
          
          // GLOBAL CONTEXT FIX: Also save to global user_context for cross-session consistency
          // This ensures sector, product, klant_type are shared across ALL sessions
          if (contextComplete && contextResult.updatedContext) {
            const ctx = contextResult.updatedContext;
            await storage.createOrUpdateUserContext(session.userId, {
              product: ctx.product || undefined,
              klantType: ctx.klant_type || undefined,
              sector: ctx.sector || undefined,
              setting: ctx.setting || undefined,
            });
          }
        }
      }
      
      // Determine next mode
      const modeTransition = determineNextMode(
        currentMode,
        action as "stop" | "end" | "retry" | "skip_context" | null,
        isFirstUserMessage,
        isTechniqueTraining,
        contextComplete
      );
      
      const nextMode = modeTransition.nextMode;
      
      // PURE COACH MODE: Check if technique is not roleplay-capable (streaming)
      // For techniques with roleplay_capable: false, stay in COACH_CHAT mode with RAG
      // Use earlyPureCoachMode computed before context gathering to avoid re-reading
      const alreadyInPureCoachMode = earlyPureCoachMode;
      
      // Check roleplay_capable from technique catalog
      let roleplayCapable = true; // default to true for backward compatibility
      if (session.techniqueId) {
        const techniekCatalog = loadTechniquesCatalog();
        const technique = techniekCatalog.find((t: any) => t.nummer === session.techniqueId);
        // roleplay_capable is in the practice sub-object
        if (technique?.practice?.roleplay_capable === false) {
          roleplayCapable = false;
        }
      }
      
      // Skip context gathering if already in pure coach mode
      let useCoachEngine = false;
      if (alreadyInPureCoachMode) {
        useCoachEngine = true;
      } else if (contextComplete && !roleplayCapable) {
        // Transition to pure coach mode
        useCoachEngine = true;
        // Persist pure coach mode for subsequent requests
        await storage.updateSession(sessionId, {
          techniqueContext: { ...earlyContext, pureCoachMode: true },
        });
      }
      
      // Handle pure coach mode with RAG (streaming)
      if (useCoachEngine) {
        const { generateCoachResponse } = await import("./v2/coach-engine");
        
        // Build conversation history in correct format
        const coachHistory = conversationHistory.map(turn => ({
          role: turn.role as "user" | "assistant",
          content: turn.content,
        }));
        
        // Generate coach response with RAG (internally handled by coach-engine)
        const coachResult = await generateCoachResponse(
          message,
          coachHistory,
          {
            techniqueId: session.techniqueId || undefined,
            sector: earlyContext.sector,
            product: earlyContext.product,
          }
        );
        
        // Save assistant turn
        await storage.createTurn({
          sessionId,
          role: "assistant",
          text: coachResult.message,
          mode: "COACH_CHAT",
        });
        
        // Stream the response
        res.write(`data: ${JSON.stringify({ type: "token", content: coachResult.message })}\n\n`);
        res.write(`data: ${JSON.stringify({ 
          type: "done", 
          metadata: {
            assistant: coachResult.message,
            mode: "COACH_CHAT",
            fase: session.fase,
            score: { delta: 0, total: session.scoreTotal || 0 },
            coachMode: true,
            contextComplete: true,
            ragDocuments: coachResult.ragContext?.length || 0,
          }
        })}\n\n`);
        return res.end();
      }
      
      // Handle ROLEPLAY_READY transition - store transition message before streaming
      if (nextMode === "ROLEPLAY_READY" && currentMode !== "ROLEPLAY_READY") {
        await storage.updateSession(sessionId, {
          mode: "ROLEPLAY_READY",
        });
        
        // S5 Fix: Conversational transition from config
        const aiPromptConfig = loadAiPrompt();
        const transitionMessage = aiPromptConfig.templates?.coach_intro?.roleplay_transition || "Oké, laten we beginnen.";
        
        await storage.createTurn({
          sessionId,
          role: "assistant",
          text: transitionMessage,
          mode: "ROLEPLAY_READY",
        });
        
        res.write(`data: ${JSON.stringify({ type: "token", content: transitionMessage })}\n\n`);
        res.write(`data: ${JSON.stringify({ 
          type: "done", 
          metadata: {
            assistant: transitionMessage,
            mode: "ROLEPLAY_READY",
            fase: session.fase,
            score: { delta: 0, total: session.scoreTotal || 0 },
            contextComplete: true,
          }
        })}\n\n`);
        return res.end();
      }
      
      // Prepare additional params for COACH_CHAT context gathering mode
      let additionalParams: any = undefined;
      if (nextMode === "COACH_CHAT") {
        if (!nextQuestion && !contextComplete) {
          // This shouldn't happen, but handle it gracefully
          console.error("COACH_CHAT mode but no question available");
          res.write(`data: ${JSON.stringify({ type: "error", content: "Failed to load context gathering questions" })}\n\n`);
          res.end();
          return;
        }
        if (nextQuestion) {
          additionalParams = {
            question: nextQuestion,
            questionIndex: questionIndex + 1,  // Always increment from current index
          };
        }
      }

      // Set timeout to ensure we don't hang forever (3 seconds)
      const timeout = setTimeout(() => {
        res.write(`data: ${JSON.stringify({ type: "error", content: "Request timeout" })}\n\n`);
        res.end();
      }, 3000);

      // Handle client disconnect
      let isConnected = true;
      req.on("close", () => {
        isConnected = false;
        clearTimeout(timeout);
      });

      try {
        // Get the streaming response from OpenAI with debug info for ROLEPLAY mode
        const { stream, debug: roleplayDebugInfo } = await getChatCompletionStream(
          nextMode,
          conversationHistory, 
          {
            fase: session.fase,
            houding: session.houding || "neutraal, afwachtend",
            scenarioId: session.scenarioId,
            lockedThemes: session.lockedThemes as string[],
            usedTechniques: session.usedTechniques as string[],
            techniqueId: session.techniqueId || undefined,
            techniqueContext: session.techniqueContext || undefined,
          },
          additionalParams
        );

        // Buffer the full response for validation
        let fullResponse = "";
        let insideJsonBlock = false;
        let jsonBuffer = "";
        
        // Stream tokens to client (filtering out JSON blocks)
        for await (const chunk of stream) {
          if (!isConnected) break;
          
          const content = chunk.choices[0]?.delta?.content || "";
          if (content) {
            fullResponse += content;
            
            // Filter out JSON blocks from streaming
            let filteredContent = "";
            for (const char of content) {
              if (!insideJsonBlock) {
                // Check if we're starting a JSON block
                jsonBuffer += char;
                if (jsonBuffer.endsWith("```json")) {
                  insideJsonBlock = true;
                  jsonBuffer = "";
                  // Remove the ```json part from filtered content
                  if (filteredContent.endsWith("```jso")) {
                    filteredContent = filteredContent.slice(0, -6);
                  } else if (filteredContent.endsWith("```js")) {
                    filteredContent = filteredContent.slice(0, -5);
                  } else if (filteredContent.endsWith("```j")) {
                    filteredContent = filteredContent.slice(0, -4);
                  } else if (filteredContent.endsWith("```")) {
                    filteredContent = filteredContent.slice(0, -3);
                  } else if (filteredContent.endsWith("``")) {
                    filteredContent = filteredContent.slice(0, -2);
                  } else if (filteredContent.endsWith("`")) {
                    filteredContent = filteredContent.slice(0, -1);
                  }
                } else {
                  if (jsonBuffer.length > 7) {
                    // Not a JSON block start, output the buffer
                    filteredContent += jsonBuffer.charAt(0);
                    jsonBuffer = jsonBuffer.slice(1) + char;
                  } else if (!("```json".startsWith(jsonBuffer))) {
                    // Buffer doesn't match JSON block start
                    filteredContent += jsonBuffer;
                    jsonBuffer = "";
                  }
                }
              } else {
                // We're inside a JSON block, check for end
                jsonBuffer += char;
                if (jsonBuffer.endsWith("```")) {
                  insideJsonBlock = false;
                  jsonBuffer = "";
                }
              }
            }
            
            // Send only non-JSON content to client
            if (!insideJsonBlock && jsonBuffer && jsonBuffer.length < 7) {
              filteredContent += jsonBuffer;
              jsonBuffer = "";
            }
            
            if (filteredContent) {
              res.write(`data: ${JSON.stringify({ type: "token", content: filteredContent })}\n\n`);
            }
          }
        }

        clearTimeout(timeout);

        if (!isConnected) return;

        // GENERATION VS EVALUATION SPLIT:
        // For ROLEPLAY mode, AI returns pure customer voice (no JSON)
        // Evaluation/scoring happens separately via /evaluate endpoint
        
        let assistantText: string;
        let hugoData: any = null;
        
        if (nextMode === "ROLEPLAY") {
          // ROLEPLAY: Pure customer voice - no JSON parsing needed
          assistantText = sanitizeRoleplayCustomerText(fullResponse.trim());
          
          // Save assistant response first (pure customer text) with debug info for frontend transparency
          const assistantTurn = await storage.createTurn({
            sessionId,
            role: "assistant",
            mode: nextMode,
            text: assistantText,
            techniqueId: null,
            meta: roleplayDebugInfo ? { debug: roleplayDebugInfo } : undefined,
          });

          // AUTOMATIC EVALUATION: Run evaluation as separate AI call
          // FIX Bug 1: Safe filter - mode can be null
          const roleplayTurns = [
            ...allTurns.filter(t => t.mode === "ROLEPLAY" && t.role),
            { role: "user", text: message },
            { role: "assistant", text: assistantText }
          ];
          
          const conversationForEval = roleplayTurns.map(t => ({
            role: t.role as "user" | "assistant",
            content: t.text,
          }));
          
          // FIX Bug 2: Wrap evaluation in try-catch to prevent stream crash
          let evaluation: {
            appliedTechnique: string | null;
            scoreDelta: number;
            feedbackPoints: string[];
            mistakesDetected: string[];
            customerAttitude: string | null;
            commitmentEvent: { performed: boolean; themesLocked: string[] };
          };
          
          try {
            evaluation = await getEvaluationCompletion(conversationForEval, {
              fase: session.fase,
              techniqueId: session.techniqueId || undefined,
              usedTechniques: session.usedTechniques as string[],
              houding: session.houding || undefined,
              scenarioId: session.scenarioId,
            });
            
            // Commitment Detection Override
            const commitmentValidation = validateCommitmentDetection(message, evaluation.appliedTechnique);
            if (commitmentValidation.overridden) {
              evaluation.appliedTechnique = commitmentValidation.finalTechnique;
              evaluation.feedbackPoints.push("Commitment techniek (2.4) correct herkend");
            }
          } catch (evalError: any) {
            console.error("[Streaming Evaluation Error] Failed to evaluate, using fallback:", evalError.message);
            // Fallback: return customer text without scoring
            evaluation = {
              appliedTechnique: null,
              scoreDelta: 0,
              feedbackPoints: [],
              mistakesDetected: [],
              customerAttitude: null,
              commitmentEvent: { performed: false, themesLocked: [] },
            };
          }
          
          // Validate policy checks
          const errors: string[] = [];
          const warnings: string[] = [];
          const feedback: string[] = [];
          
          if (evaluation.appliedTechnique) {
            if (session.fase === 1) {
              const validation = validatePhase1Order(
                session.stapStack as string[],
                evaluation.appliedTechnique
              );
              errors.push(...validation.errors);
              warnings.push(...validation.warnings);
            }
            
            const terzijdeValidation = validateNoTerzijdeInPhase4(
              session.fase,
              evaluation.appliedTechnique
            );
            errors.push(...terzijdeValidation.errors);
            warnings.push(...terzijdeValidation.warnings);
          }
          
          // Process commitment events
          const newLockedThemes = [...(session.lockedThemes as string[])];
          if (evaluation.commitmentEvent.performed && evaluation.commitmentEvent.themesLocked.length > 0) {
            for (const theme of evaluation.commitmentEvent.themesLocked) {
              if (!newLockedThemes.includes(theme)) {
                newLockedThemes.push(theme);
                await storage.createCommitmentEvent({
                  sessionId,
                  theme,
                  turnId: assistantTurn.id,
                });
              }
            }
          }
          
          // Determine next phase
          const hugoDataForPhase = {
            applied_technique: evaluation.appliedTechnique,
            customer_attitude: evaluation.customerAttitude,
          };
          const nextPhase = determineNextPhase(session.fase, hugoDataForPhase, newLockedThemes);
          
          // Update stapStack if in phase 1
          let nextStapStack = session.stapStack as string[];
          if (session.fase === 1 && evaluation.appliedTechnique) {
            nextStapStack = updateStapStack(nextStapStack, evaluation.appliedTechnique);
          }
          
          // Calculate new score
          // FIX Bug 1: Default scoreTotal to 0 if null
          const currentScore = session.scoreTotal || 0;
          const scoreDelta = evaluation.scoreDelta;
          const newScore = currentScore + scoreDelta;
          
          // Build feedback array
          evaluation.feedbackPoints.forEach((point: string) => {
            feedback.push(`✅ ${point}`);
          });
          evaluation.mistakesDetected.forEach((mistake: string) => {
            feedback.push(`⚠️ ${mistake}`);
          });
          
          // Update session state
          await storage.updateSession(sessionId, {
            mode: nextMode,
            fase: nextPhase,
            stapStack: nextStapStack,
            lockedThemes: newLockedThemes,
            usedTechniques: evaluation.appliedTechnique ? [
              ...(session.usedTechniques as string[]),
              evaluation.appliedTechnique
            ].filter(Boolean) : session.usedTechniques as string[],
            lastCustomerAttitude: evaluation.customerAttitude || session.lastCustomerAttitude,
            scoreTotal: newScore,
          });
          
          // Update turn with evaluation data
          await storage.updateTurnMeta(assistantTurn.id, {
            evaluation: {
              score_delta: scoreDelta,
              ai_eval_points_hit: evaluation.feedbackPoints,
              mistakes_detected: evaluation.mistakesDetected,
            },
            customer_attitude: evaluation.customerAttitude,
            feedback,
          });
          
          // Also update techniqueId on the turn
          if (evaluation.appliedTechnique) {
            await storage.updateTurn(assistantTurn.id, {
              techniqueId: evaluation.appliedTechnique,
            });
          }

          // Build response with both natural text AND evaluation
          const metadata: MessageResponse = {
            assistant: assistantText,
            speechText: assistantText, // Clean text for TTS - no telemetry!
            fase: nextPhase as 1 | 2 | 3 | 4,
            applied_technique: evaluation.appliedTechnique || "",
            locks: newLockedThemes,
            score: {
              delta: scoreDelta,
              total: newScore,
            },
            next_allowed: getAllowedTechniques(nextPhase, evaluation.appliedTechnique),
            warnings,
            mistakes_detected: evaluation.mistakesDetected, // Top-level for consumers
            feedback,
            metadata: {
              customer_attitude: evaluation.customerAttitude,
              commitment_event: evaluation.commitmentEvent,
              evaluation: {
                score_delta: scoreDelta,
                ai_eval_points_hit: evaluation.feedbackPoints,
                mistakes_detected: evaluation.mistakesDetected,
              },
            },
          };

          res.write(`data: ${JSON.stringify({ type: "done", metadata })}\n\n`);
          res.end();
          return;
        }
        
        // Non-ROLEPLAY modes (COACH_CHAT, COACH_INTRO, COACH_FEEDBACK)
        try {
          const parsed = parseHugoResponse(fullResponse, nextMode);
          assistantText = parsed.text;
          hugoData = parsed.data;
        } catch (error: any) {
          console.error("Failed to parse Hugo response:", error);
          res.write(`data: ${JSON.stringify({ 
            type: "error", 
            content: "AI response format error" 
          })}\n\n`);
          res.end();
          return;
        }

        // For non-ROLEPLAY modes, minimal state updates
        const newLockedThemes = session.lockedThemes as string[];
        const nextPhase = session.fase;
        const scoreDelta = 0;
        const newScore = session.scoreTotal;

        // Update session state with new mode
        await storage.updateSession(sessionId, {
          mode: nextMode,
        });

        // Save assistant response with debug info for transparency panel
        const streamTurnMeta: Record<string, unknown> = { parsed_text: assistantText };
        if (roleplayDebugInfo) {
          streamTurnMeta.debug = roleplayDebugInfo;
        }
        
        await storage.createTurn({
          sessionId,
          role: "assistant",
          mode: nextMode,
          text: assistantText,
          techniqueId: null,
          meta: streamTurnMeta,
        });

        // Send final metadata with debug info
        const metadata: MessageResponse = {
          assistant: assistantText,
          speechText: assistantText,
          fase: nextPhase as 1 | 2 | 3 | 4,
          applied_technique: "",
          locks: newLockedThemes,
          score: {
            delta: scoreDelta,
            total: newScore,
          },
          next_allowed: getAllowedTechniques(nextPhase, null),
          warnings: [],
          mistakes_detected: [], // No mistakes in non-ROLEPLAY modes
          feedback: [],
          metadata: hugoData,
          debug: roleplayDebugInfo, // Include debug info for frontend transparency
        };

        res.write(`data: ${JSON.stringify({ type: "done", metadata })}\n\n`);
        res.end();

      } catch (error: any) {
        clearTimeout(timeout);
        console.error("Streaming error:", error);
        res.write(`data: ${JSON.stringify({ 
          type: "error", 
          content: error.message || "Streaming failed" 
        })}\n\n`);
        res.end();
      }

    } catch (error: any) {
      console.error("Error in streaming endpoint:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // GET /api/session/:id/report - get session summary
  app.get("/api/session/:id/report", async (req, res) => {
    try {
      const session = await storage.getSession(req.params.id);
      if (!session) {
        return res.status(404).json({ error: "Session not found" });
      }

      const turns = await storage.getSessionTurns(req.params.id);
      const locks = await storage.getSessionLocks(req.params.id);

      const report = {
        session: {
          id: session.id,
          scenarioId: session.scenarioId,
          finalPhase: session.fase,
          scoreTotal: session.scoreTotal,
          duration: new Date(session.updatedAt).getTime() - new Date(session.createdAt).getTime(),
        },
        techniques_used: session.usedTechniques,
        locked_themes: session.lockedThemes,
        commitment_events: locks,
        turns_count: turns.length,
        turns: turns.map(t => ({
          role: t.role,
          technique: t.techniqueId,
          timestamp: t.createdAt,
        })),
      };

      res.json(report);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ==================== VIDEO API ROUTES ====================

  // GET /api/videos - list all videos
  app.get("/api/videos", async (req, res) => {
    try {
      const videos = await storage.getVideos();
      
      // Add thumbnail URLs for videos with playback IDs
      const videosWithThumbnails = videos.map(video => ({
        ...video,
        thumbnailUrl: video.muxPlaybackId 
          ? muxService.getThumbnailUrl(video.muxPlaybackId)
          : null,
      }));
      
      res.json(videosWithThumbnails);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // GET /api/videos/module/:module - get videos by course module
  app.get("/api/videos/module/:module", async (req, res) => {
    try {
      const videos = await storage.getVideosByModule(req.params.module);
      
      const videosWithThumbnails = videos.map(video => ({
        ...video,
        thumbnailUrl: video.muxPlaybackId 
          ? muxService.getThumbnailUrl(video.muxPlaybackId)
          : null,
      }));
      
      res.json(videosWithThumbnails);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // GET /api/videos/:id - get single video with details
  app.get("/api/videos/:id", async (req, res) => {
    try {
      const video = await storage.getVideo(req.params.id);
      
      if (!video) {
        return res.status(404).json({ error: "Video not found" });
      }
      
      const videoWithDetails = {
        ...video,
        thumbnailUrl: video.muxPlaybackId 
          ? muxService.getThumbnailUrl(video.muxPlaybackId)
          : null,
        streamUrl: video.muxPlaybackId
          ? muxService.getStreamUrl(video.muxPlaybackId)
          : null,
      };
      
      res.json(videoWithDetails);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // POST /api/videos/upload - create upload URL for new video
  app.post("/api/videos/upload", async (req, res) => {
    try {
      const { title, description, courseModule, techniqueId } = req.body;
      
      if (!title) {
        return res.status(400).json({ error: "Title is required" });
      }
      
      const uploadData = await muxService.createUpload({
        title,
        description,
        courseModule,
        techniqueId,
      });
      
      res.json(uploadData);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // POST /api/videos/:id/progress - update video progress
  app.post("/api/videos/:id/progress", async (req, res) => {
    try {
      const { watchedSeconds, lastPosition } = req.body;
      const videoId = req.params.id;
      const userId = "demo-user"; // TODO: Get from auth
      
      // Get video to check duration
      const video = await storage.getVideo(videoId);
      if (!video) {
        return res.status(404).json({ error: "Video not found" });
      }
      
      // Check if progress exists
      let progress = await storage.getVideoProgress(userId, videoId);
      
      // Calculate if completed (watched > 90% of video)
      const completed = video.duration && watchedSeconds >= (video.duration * 0.9) ? 1 : 0;
      
      const wasCompleted = progress?.completed === 1;
      
      if (progress) {
        // Update existing progress
        progress = await storage.updateVideoProgress(progress.id, {
          watchedSeconds: Math.max(watchedSeconds, progress.watchedSeconds),
          lastPosition,
          completed: Math.max(completed, progress.completed),
        });
      } else {
        // Create new progress
        progress = await storage.createVideoProgress({
          userId,
          videoId,
          watchedSeconds,
          lastPosition,
          completed,
        });
      }
      
      // Track video completion for analytics (only log once when first completed)
      if (completed === 1 && !wasCompleted) {
        storage.logActivity({
          userId,
          eventType: 'video_complete',
          entityType: 'video',
          entityId: videoId,
          durationSeconds: video.duration || watchedSeconds,
          metadata: { title: video.title, module: video.courseModule },
        }).catch(err => console.error("Failed to log video completion:", err));
        
        storage.incrementUserStats(userId, 'totalVideoTimeSeconds', video.duration || watchedSeconds)
          .catch(err => console.error("Failed to increment video time:", err));
        
        storage.updateStreak(userId)
          .catch(err => console.error("Failed to update streak:", err));
      }
      
      res.json(progress);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // GET /api/videos/:id/progress - get user's progress for a video
  app.get("/api/videos/:id/progress", async (req, res) => {
    try {
      const videoId = req.params.id;
      const userId = "demo-user"; // TODO: Get from auth
      
      const progress = await storage.getVideoProgress(userId, videoId);
      
      res.json(progress || { 
        watchedSeconds: 0, 
        lastPosition: 0, 
        completed: 0 
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // GET /api/user/video-stats - get aggregate video stats for a user
  app.get("/api/user/video-stats", async (req, res) => {
    try {
      const userId = "demo-user"; // TODO: Get from auth
      
      const videos = await storage.getVideos();
      const userProgress = await storage.getUserVideoProgress(userId);
      
      const completedCount = userProgress.filter(p => p.completed === 1).length;
      const inProgressCount = userProgress.filter(p => p.completed === 0 && p.watchedSeconds > 0).length;
      
      // Find current video (most recent in-progress)
      const inProgressVideos = userProgress.filter(p => p.completed === 0 && p.watchedSeconds > 0);
      let currentVideo = null;
      if (inProgressVideos.length > 0) {
        const latestProgress = inProgressVideos.sort((a, b) => 
          new Date(b.updatedAt ?? 0).getTime() - new Date(a.updatedAt ?? 0).getTime()
        )[0];
        const video = videos.find(v => v.id === latestProgress.videoId);
        if (video) {
          currentVideo = {
            id: video.id,
            title: video.title,
            module: video.courseModule,
            progress: latestProgress.watchedSeconds,
            duration: video.duration,
          };
        }
      }
      
      // If no in-progress, find first unwatched
      if (!currentVideo && completedCount < videos.length) {
        const watchedVideoIds = new Set(userProgress.map(p => p.videoId));
        const nextVideo = videos.find(v => !watchedVideoIds.has(v.id));
        if (nextVideo) {
          currentVideo = {
            id: nextVideo.id,
            title: nextVideo.title,
            module: nextVideo.courseModule,
            progress: 0,
            duration: nextVideo.duration,
          };
        }
      }
      
      res.json({
        totalVideos: videos.length,
        completedVideos: completedCount,
        inProgressVideos: inProgressCount,
        progressPercent: videos.length > 0 ? Math.round((completedCount / videos.length) * 100) : 0,
        currentVideo,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // =====================
  // LIVE COACHING ROUTES
  // =====================
  
  // POST /api/admin/sessions/process-recording - Trigger recording processing
  app.post("/api/admin/sessions/process-recording", async (req, res) => {
    try {
      const { sessionId } = req.body;
      // Try local PostgreSQL first, then fallback to Supabase
      let session: any = await storage.getLiveSession(sessionId);
      if (!session) {
        // Session might be in Supabase (created by admin frontend directly)
        const sbSession = await getSupabaseSession(sessionId);
        if (!sbSession) return res.status(404).json({ error: "Session not found" });
        // Normalize to camelCase
        session = {
          id: sbSession.id,
          title: sbSession.title,
          status: sbSession.status,
          dailyRoomName: sbSession.daily_room_name,
          dailyRecordingId: sbSession.daily_recording_id,
          dailyRecordingUrl: sbSession.daily_recording_url,
          recordingReady: sbSession.recording_ready,
          muxPlaybackId: sbSession.mux_playback_id,
          videoUrl: sbSession.video_url,
        };
      }
      
      if (!session.dailyRecordingUrl && session.status === 'ended' && session.dailyRoomName) {
        // Try refreshing recording once if missing
        const { dailyService } = await import("./daily-service");
        const recording = await dailyService.getMostRecentRecording(session.dailyRoomName);
        if (recording && recording.download_link) {
          session.dailyRecordingUrl = recording.download_link;
        }
      }

      if (!session.dailyRecordingUrl) {
        return res.status(400).json({ error: "Geen opname URL gevonden voor deze sessie" });
      }

      const VIDEO_PROCESSOR_URL = process.env.VIDEO_PROCESSOR_URL || 'http://localhost:3001';
      const VIDEO_PROCESSOR_SECRET = process.env.VIDEO_PROCESSOR_SECRET;
      const fetch = (await import('node-fetch')).default as any;

      const response = await fetch(`${VIDEO_PROCESSOR_URL}/api/webinar-recordings/trigger-process`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${VIDEO_PROCESSOR_SECRET}`
        },
        body: JSON.stringify({
          sessionId: session.id,
          recordingUrl: session.dailyRecordingUrl,
          title: session.title
        })
      });

      const result = await response.json();
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // GET /api/live-sessions - get all live sessions
  app.get("/api/live-sessions", async (req, res) => {
    try {
      const status = req.query.status as string | undefined;
      let sessions;
      
      if (status) {
        sessions = await storage.getLiveSessionsByStatus(status);
      } else {
        sessions = await storage.getLiveSessions();
      }
      
      // Strip all sensitive Mux fields from clients
      const safeSessions = sessions.map(({ muxStreamKey, muxLiveStreamId, ...s }) => s);
      
      res.json(safeSessions);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });
  
  // GET /api/live-sessions/recordings - get all sessions with processed recordings
  // IMPORTANT: must be before /:id to avoid "recordings" being matched as an id
  app.get("/api/live-sessions/recordings", async (req, res) => {
    try {
      // Query Supabase directly since admin frontend stores sessions there
      const rows = await getSupabaseSessions('mux_playback_id=not.is.null&');
      // Map snake_case Supabase fields to camelCase for frontend
      const recordings = rows.map((s: any) => ({
        id: s.id,
        title: s.title,
        description: s.description,
        status: s.status,
        scheduledDate: s.scheduled_date,
        durationMinutes: s.duration_minutes,
        topic: s.topic,
        phaseId: s.phase_id,
        muxPlaybackId: s.mux_playback_id,
        transcript: s.transcript,
        aiSummary: s.ai_summary,
        dailyRecordingId: s.daily_recording_id,
        dailyRecordingUrl: s.daily_recording_url,
        recordingReady: s.recording_ready,
        processedAt: s.processed_at,
        thumbnailUrl: s.thumbnail_url,
        hostName: s.host_name,
        createdAt: s.created_at,
      }));
      res.json(recordings);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // GET /api/live-sessions/:id - get a specific live session
  app.get("/api/live-sessions/:id", async (req, res) => {
    try {
      const session = await storage.getLiveSession(req.params.id);
      if (!session) {
        return res.status(404).json({ error: "Session not found" });
      }
      
      // Strip all sensitive Mux fields
      const { muxStreamKey, muxLiveStreamId, ...safeSession } = session;
      res.json(safeSession);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });
  
  // POST /api/live-sessions - create a new live session (admin only)
  app.post("/api/live-sessions", async (req, res) => {
    try {
      const { title, description, topic, level, scheduledDate, duration, hostKey } = req.body;
      
      // Basic host authentication - in production use proper auth
      if (hostKey !== process.env.HOST_SECRET_KEY && hostKey !== "demo-host-key") {
        return res.status(403).json({ error: "Unauthorized - host access required" });
      }
      
      if (!title || !scheduledDate) {
        return res.status(400).json({ error: "title and scheduledDate are required" });
      }
      
      // Create session in database (Daily.co room will be created when session goes live)
      const session = await storage.createLiveSession({
        title,
        description: description || null,
        topic: topic || null,
        level: level || "Alle niveaus",
        scheduledDate: new Date(scheduledDate),
        duration: duration || 60,
        status: "upcoming",
      });
      
      res.json(session);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });
  
  // POST /api/live-sessions/:id/join - join a live session
  app.post("/api/live-sessions/:id/join", async (req, res) => {
    try {
      const sessionId = req.params.id;
      const userId = req.body.userId || "demo-user";
      const userName = req.body.userName || "Deelnemer";
      
      const session = await storage.getLiveSession(sessionId);
      if (!session) {
        return res.status(404).json({ error: "Session not found" });
      }
      
      await storage.joinLiveSession(sessionId, userId);
      
      // Generate Daily.co participant token if session is live and has a room
      let participantToken = null;
      if (session.status === "live" && session.dailyRoomName) {
        participantToken = await dailyService.createParticipantToken(
          session.dailyRoomName,
          userName,
          userId
        );
      }
      
      res.json({ 
        success: true, 
        viewersCount: session.viewersCount + 1,
        dailyRoomUrl: session.dailyRoomUrl,
        participantToken,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });
  
  // POST /api/live-sessions/:id/leave - leave a live session
  app.post("/api/live-sessions/:id/leave", async (req, res) => {
    try {
      const sessionId = req.params.id;
      const userId = req.body.userId || "demo-user";
      
      await storage.leaveLiveSession(sessionId, userId);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });
  
  // POST /api/live-sessions/:id/reminder - set reminder
  app.post("/api/live-sessions/:id/reminder", async (req, res) => {
    try {
      const sessionId = req.params.id;
      const userId = req.body.userId || "demo-user";
      
      await storage.setReminder(sessionId, userId);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });
  
  // POST /api/live-sessions/:id/start - start the session (go live) - HOST ONLY
  app.post("/api/live-sessions/:id/start", async (req, res) => {
    try {
      const { hostKey } = req.body;
      
      // Host authentication required
      if (hostKey !== process.env.HOST_SECRET_KEY && hostKey !== "demo-host-key") {
        return res.status(403).json({ error: "Unauthorized - host access required" });
      }
      
      const session = await storage.getLiveSession(req.params.id);
      if (!session) {
        return res.status(404).json({ error: "Session not found" });
      }
      
      // Create Daily.co room if not exists
      let dailyRoomName = session.dailyRoomName;
      let dailyRoomUrl = session.dailyRoomUrl;
      
      if (!dailyRoomName) {
        const roomName = `hugo-live-${session.id.slice(0, 8)}`;
        const room = await dailyService.createRoom({
          name: roomName,
          privacy: "private",
          enableChat: true,
          enableScreenshare: true,
          maxParticipants: 20,
          expiresAt: Math.floor(Date.now() / 1000) + (session.duration * 60) + 3600, // session duration + 1 hour buffer
        });
        dailyRoomName = room.name;
        dailyRoomUrl = room.url;
        
        await storage.updateLiveSession(session.id, {
          dailyRoomName,
          dailyRoomUrl,
        });
      }
      
      // Generate host token
      const hostToken = await dailyService.createHostToken(dailyRoomName, "Hugo");
      
      // Start cloud recording
      let recordingStarted = false;
      let recordingError: string | null = null;
      try {
        await dailyService.startRecording(dailyRoomName);
        recordingStarted = true;
        console.log(`Recording started for room: ${dailyRoomName}`);
      } catch (err: any) {
        recordingError = err.message || "Recording failed to start";
        console.log("Recording not started:", recordingError);
        // Mark session as having no recording potential
        await storage.updateLiveSession(session.id, { recordingReady: 2 });
      }
      
      // Update status to live
      const updated = await storage.updateLiveSession(session.id, { status: "live" });
      
      res.json({ 
        ...updated, 
        dailyRoomUrl,
        dailyRoomName,
        hostToken,
        recordingStarted,
        recordingError,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });
  
  // POST /api/live-sessions/:id/end - end the session - HOST ONLY
  app.post("/api/live-sessions/:id/end", async (req, res) => {
    try {
      const { hostKey } = req.body;
      
      // Host authentication required
      if (hostKey !== process.env.HOST_SECRET_KEY && hostKey !== "demo-host-key") {
        return res.status(403).json({ error: "Unauthorized - host access required" });
      }
      
      const session = await storage.getLiveSession(req.params.id);
      if (!session) {
        return res.status(404).json({ error: "Session not found" });
      }
      
      let recordingUrl = null;
      
      // Stop Daily.co recording and get recording info
      if (session.dailyRoomName) {
        try {
          await dailyService.stopRecording(session.dailyRoomName);
          console.log(`Recording stopped for room: ${session.dailyRoomName}`);
          
          // Wait a moment for Daily to process, then get recording
          await new Promise(resolve => setTimeout(resolve, 2000));
          
          const recording = await dailyService.getMostRecentRecording(session.dailyRoomName);
          if (recording) {
            recordingUrl = recording.download_link || null;
            await storage.updateLiveSession(session.id, {
              dailyRecordingId: recording.id,
              dailyRecordingUrl: recordingUrl,
              recordingReady: recording.download_link ? 1 : 0, // 0 = still processing
            });
            console.log(`Recording saved: ${recording.id}, ready: ${recording.download_link ? 'yes' : 'processing'}`);
          } else {
            // No recording found - mark as no recording
            await storage.updateLiveSession(session.id, { recordingReady: 2 });
          }
        } catch (recordingError) {
          console.log("Recording stop/retrieve error:", recordingError);
          // Continue without recording info
        }
      }
      
      // Update status to ended
      const updated = await storage.updateLiveSession(session.id, { status: "ended" });
      
      // Queue processing if recording is ready
      if (recordingUrl) {
        try {
          // Send request to video-processor to queue the job
          // Note: we're using a direct DB call in video-processor for this usually,
          // but here we can just use the supabase client if available or a fetch to video-processor
          const fetch = (await import('node-fetch')).default;
          const VIDEO_PROCESSOR_URL = process.env.VIDEO_PROCESSOR_URL || 'http://localhost:3001';
          const VIDEO_PROCESSOR_SECRET = process.env.VIDEO_PROCESSOR_SECRET;

          await fetch(`${VIDEO_PROCESSOR_URL}/api/webinar-recordings/trigger-process`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${VIDEO_PROCESSOR_SECRET}`
            },
            body: JSON.stringify({
              sessionId: session.id,
              recordingUrl: recordingUrl,
              title: session.title
            })
          });
          console.log(`Triggered webinar processing for session ${session.id}`);
        } catch (queueError) {
          console.error("Failed to trigger webinar processing:", queueError);
        }
      }
      
      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });
  
  // POST /api/live-sessions/:id/refresh-recording - refresh recording status - HOST ONLY
  app.post("/api/live-sessions/:id/refresh-recording", async (req, res) => {
    try {
      const { hostKey } = req.body;
      
      if (hostKey !== process.env.HOST_SECRET_KEY && hostKey !== "demo-host-key") {
        return res.status(403).json({ error: "Unauthorized - host access required" });
      }
      
      const session = await storage.getLiveSession(req.params.id);
      if (!session) {
        return res.status(404).json({ error: "Session not found" });
      }
      
      if (!session.dailyRoomName) {
        return res.status(400).json({ error: "No Daily room for this session" });
      }
      
      // Try to get the recording
      const recording = await dailyService.getMostRecentRecording(session.dailyRoomName);
      if (recording && recording.download_link) {
        await storage.updateLiveSession(session.id, {
          dailyRecordingId: recording.id,
          dailyRecordingUrl: recording.download_link,
          recordingReady: 1,
        });
        const updated = await storage.getLiveSession(session.id);
        res.json({ success: true, recordingReady: true, session: updated });
      } else if (recording) {
        // Recording exists but no download link yet - still processing
        await storage.updateLiveSession(session.id, {
          dailyRecordingId: recording.id,
          recordingReady: 0,
        });
        res.json({ success: true, recordingReady: false, message: "Recording still processing" });
      } else {
        res.json({ success: true, recordingReady: false, message: "No recording found" });
      }
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });
  
  // GET /api/live-sessions/:id/chat - get chat messages
  app.get("/api/live-sessions/:id/chat", async (req, res) => {
    try {
      const messages = await storage.getSessionChatMessages(req.params.id);
      res.json(messages);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });
  
  // POST /api/live-sessions/:id/chat - send chat message
  app.post("/api/live-sessions/:id/chat", async (req, res) => {
    try {
      const { message, userName, userInitials, isHost } = req.body;
      const userId = req.body.userId || "demo-user";
      
      if (!message || !userName) {
        return res.status(400).json({ error: "message and userName are required" });
      }
      
      const chatMessage = await storage.createChatMessage({
        sessionId: req.params.id,
        userId,
        userName,
        userInitials: userInitials || userName.split(" ").map((n: string) => n[0]).join("").toUpperCase(),
        message,
        isHost: isHost ? 1 : 0,
      });
      
      res.json(chatMessage);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });
  
  // GET /api/live-sessions/:id/polls - get polls
  app.get("/api/live-sessions/:id/polls", async (req, res) => {
    try {
      const polls = await storage.getSessionPolls(req.params.id);
      const userId = (req.query.userId as string) || "demo-user";
      
      // Enrich with options and user vote status
      const enrichedPolls = await Promise.all(polls.map(async (poll) => {
        const options = await storage.getPollOptions(poll.id);
        const userVote = await storage.getUserPollVote(poll.id, userId);
        const totalVotes = options.reduce((sum, opt) => sum + opt.votes, 0);
        
        return {
          ...poll,
          options,
          totalVotes,
          userVoted: !!userVote,
          userVotedOptionId: userVote?.optionId,
        };
      }));
      
      res.json(enrichedPolls);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });
  
  // POST /api/live-sessions/:id/polls - create poll (host only)
  app.post("/api/live-sessions/:id/polls", async (req, res) => {
    try {
      const { question, options, hostKey } = req.body;
      
      // Host authentication required
      if (hostKey !== process.env.HOST_SECRET_KEY && hostKey !== "demo-host-key") {
        return res.status(403).json({ error: "Unauthorized - host access required" });
      }
      
      if (!question || !options || !Array.isArray(options) || options.length < 2) {
        return res.status(400).json({ error: "question and at least 2 options are required" });
      }
      
      const poll = await storage.createPoll({
        sessionId: req.params.id,
        question,
        active: 1,
      });
      
      // Create options
      const createdOptions = await Promise.all(
        options.map((text: string) => storage.createPollOption({ pollId: poll.id, text, votes: 0 }))
      );
      
      res.json({ ...poll, options: createdOptions, totalVotes: 0 });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });
  
  // POST /api/polls/:id/vote - vote on a poll
  app.post("/api/polls/:id/vote", async (req, res) => {
    try {
      const pollId = req.params.id;
      const { optionId } = req.body;
      const userId = req.body.userId || "demo-user";
      
      if (!optionId) {
        return res.status(400).json({ error: "optionId is required" });
      }
      
      // Verify poll exists and is active
      const poll = await storage.getPoll(pollId);
      if (!poll) {
        return res.status(404).json({ error: "Poll not found" });
      }
      if (poll.active !== 1) {
        return res.status(400).json({ error: "Poll is no longer active" });
      }
      
      // Verify option exists and belongs to this poll
      const options = await storage.getPollOptions(pollId);
      const validOption = options.find(o => o.id === optionId);
      if (!validOption) {
        return res.status(400).json({ error: "Invalid option for this poll" });
      }
      
      // Check if user already voted (prevent duplicate votes)
      const existingVote = await storage.getUserPollVote(pollId, userId);
      if (existingVote) {
        return res.status(400).json({ error: "Already voted on this poll" });
      }
      
      await storage.votePoll(pollId, optionId, userId);
      
      // Return updated poll
      const updatedOptions = await storage.getPollOptions(pollId);
      const totalVotes = updatedOptions.reduce((sum, opt) => sum + opt.votes, 0);
      
      res.json({ ...poll, options: updatedOptions, totalVotes, userVoted: true, userVotedOptionId: optionId });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });
  
  // GET /api/live-sessions/:id/calendar - generate ICS calendar invite
  app.get("/api/live-sessions/:id/calendar", async (req, res) => {
    try {
      const session = await storage.getLiveSession(req.params.id);
      if (!session) {
        return res.status(404).json({ error: "Session not found" });
      }
      
      const startDate = new Date(session.scheduledDate);
      const endDate = new Date(startDate.getTime() + (session.duration * 60 * 1000));
      
      const formatDate = (d: Date) => d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
      
      const ics = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//Hugo Herbots//Live Coaching//NL',
        'BEGIN:VEVENT',
        `DTSTART:${formatDate(startDate)}`,
        `DTEND:${formatDate(endDate)}`,
        `SUMMARY:${session.title}`,
        `DESCRIPTION:${session.description || 'Live coaching sessie met Hugo Herbots'}`,
        `LOCATION:https://hugoherbots.ai/live`,
        'END:VEVENT',
        'END:VCALENDAR'
      ].join('\r\n');
      
      res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${session.title.replace(/[^a-z0-9]/gi, '-')}.ics"`);
      res.send(ics);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // POST /api/seed/live-sessions - seed demo live sessions (development only)
  app.post("/api/seed/live-sessions", async (req, res) => {
    try {
      const { hostKey } = req.body;
      
      if (hostKey !== process.env.HOST_SECRET_KEY && hostKey !== "demo-host-key") {
        return res.status(403).json({ error: "Unauthorized - host access required" });
      }
      
      // Create upcoming sessions
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(14, 0, 0, 0);
      
      const nextWeek = new Date();
      nextWeek.setDate(nextWeek.getDate() + 7);
      nextWeek.setHours(14, 0, 0, 0);
      
      const sessions = [
        {
          title: "Live Coaching: Bezwaarhandeling",
          description: "In deze live sessie gaat Hugo dieper in op bezwaarhandeling in de beslissingsfase. We behandelen de 5 verschillende types bezwaren en hoe je daar effectief mee omgaat.",
          topic: "Fase 4 • Beslissingsfase",
          level: "Gevorderd",
          scheduledDate: tomorrow,
          duration: 60,
          status: "upcoming" as const,
        },
        {
          title: "Live Q&A: Discovery Technieken",
          description: "Live Q&A over discovery technieken en het stellen van de juiste vragen om pijnpunten te ontdekken.",
          topic: "Fase 2 • Ontdekkingsfase",
          level: "Alle niveaus",
          scheduledDate: nextWeek,
          duration: 60,
          status: "upcoming" as const,
        },
      ];
      
      const createdSessions = [];
      for (const sessionData of sessions) {
        const session = await storage.createLiveSession(sessionData);
        createdSessions.push(session);
      }
      
      res.json({ 
        success: true, 
        message: `Created ${createdSessions.length} demo sessions`,
        sessions: createdSessions 
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // POST /api/webhooks/mux - handle Mux webhooks
  app.post("/api/webhooks/mux", async (req, res) => {
    try {
      // Verify webhook signature
      const event = muxService.verifyWebhookSignature(req.body.toString(), req.headers);
      
      if (!event) {
        return res.status(400).json({ error: "Invalid webhook signature" });
      }
      
      // Handle different event types
      switch (event.type) {
        case "video.asset.ready":
          await muxService.handleAssetReady(event);
          break;
        case "video.upload.asset_created":
          await muxService.handleUploadAssetCreated(event);
          break;
        case "video.upload.errored":
          await muxService.handleUploadError(event);
          break;
        default:
          console.log("Unhandled Mux event type:", event.type);
      }
      
      res.json({ received: true });
    } catch (error: any) {
      console.error("Mux webhook error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // =====================
  // USER ANALYTICS ENDPOINTS
  // =====================

  // GET /api/user/stats - get aggregated user statistics
  app.get("/api/user/stats", async (req, res) => {
    try {
      const userId = "demo-user"; // TODO: Get from auth
      
      const stats = await storage.getUserStats(userId);
      const sessionsThisWeek = await storage.getUserSessionsThisWeek(userId);
      const weeklyHistory = await storage.getUserSessionsByWeek(userId, 8);
      const techniques = await storage.getUserTechniqueMasteries(userId);
      
      // Calculate top technique and weakest technique
      const topTechnique = techniques.length > 0 ? techniques[0] : null;
      const weakestTechnique = techniques.length > 0 
        ? techniques.reduce((min, t) => t.averageScore < min.averageScore ? t : min, techniques[0])
        : null;
      
      // Calculate previous week sessions for delta
      const previousWeekSessions = weeklyHistory.length >= 2 ? weeklyHistory[weeklyHistory.length - 2] : 0;
      const currentWeekSessions = sessionsThisWeek;
      const sessionsDelta = currentWeekSessions - previousWeekSessions;
      
      res.json({
        userId,
        stats: stats || {
          totalSessions: 0,
          totalTimeSeconds: 0,
          totalVideoTimeSeconds: 0,
          averageScore: 0,
          currentStreak: 0,
          longestStreak: 0,
        },
        sessionsThisWeek: currentWeekSessions,
        sessionsDelta,
        weeklyHistory,
        topTechnique: topTechnique ? {
          id: topTechnique.techniqueId,
          name: topTechnique.techniqueName,
          score: topTechnique.averageScore,
          level: topTechnique.masteryLevel
        } : null,
        focusAdvice: weakestTechnique && weakestTechnique.averageScore < 70 ? {
          id: weakestTechnique.techniqueId,
          name: weakestTechnique.techniqueName,
          score: weakestTechnique.averageScore,
          reason: "Coach advies"
        } : null,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // GET /api/user/technique-mastery - get technique mastery breakdown
  app.get("/api/user/technique-mastery", async (req, res) => {
    try {
      const userId = "demo-user"; // TODO: Get from auth
      const masteries = await storage.getUserTechniqueMasteries(userId);
      res.json(masteries);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // GET /api/user/activity-log - get recent activity
  app.get("/api/user/activity-log", async (req, res) => {
    try {
      const userId = "demo-user"; // TODO: Get from auth
      const limit = parseInt(req.query.limit as string) || 50;
      const activities = await storage.getUserActivityLog(userId, limit);
      res.json(activities);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // POST /api/user/activity - log a user activity
  app.post("/api/user/activity", async (req, res) => {
    try {
      const userId = "demo-user"; // TODO: Get from auth
      const { eventType, entityType, entityId, durationSeconds, score, metadata } = req.body;
      
      if (!eventType) {
        return res.status(400).json({ error: "eventType is required" });
      }
      
      const activity = await storage.logActivity({
        userId,
        eventType,
        entityType,
        entityId,
        durationSeconds,
        score,
        metadata,
      });
      
      // Update streak on any activity
      await storage.updateStreak(userId);
      
      // Update user stats based on event type
      if (eventType === 'session_end' && durationSeconds) {
        await storage.incrementUserStats(userId, 'totalSessions', 1);
        await storage.incrementUserStats(userId, 'totalTimeSeconds', durationSeconds);
      } else if (eventType === 'video_complete' && durationSeconds) {
        await storage.incrementUserStats(userId, 'totalVideoTimeSeconds', durationSeconds);
      }
      
      res.json(activity);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // POST /api/user/technique-attempt - record a technique attempt
  app.post("/api/user/technique-attempt", async (req, res) => {
    try {
      const userId = "demo-user"; // TODO: Get from auth
      const { techniqueId, techniqueName, score, success } = req.body;
      
      if (!techniqueId) {
        return res.status(400).json({ error: "techniqueId is required" });
      }
      
      const mastery = await storage.recordTechniqueAttempt(
        userId,
        techniqueId,
        techniqueName || techniqueId,
        score || 0,
        success ?? (score >= 70)
      );
      
      res.json(mastery);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // GET /api/user/evolution - get score evolution over time
  app.get("/api/user/evolution", async (req, res) => {
    try {
      const userId = "demo-user"; // TODO: Get from auth
      const weeklyHistory = await storage.getUserSessionsByWeek(userId, 12);
      const masteries = await storage.getUserTechniqueMasteries(userId);
      
      // Calculate improvement rate (last 4 weeks vs previous 4 weeks)
      const recent = weeklyHistory.slice(-4).reduce((a, b) => a + b, 0);
      const previous = weeklyHistory.slice(-8, -4).reduce((a, b) => a + b, 0);
      const improvementRate = previous > 0 ? (recent / previous) : 1;
      
      res.json({
        weeklySessionCounts: weeklyHistory,
        totalTechniques: masteries.length,
        masteredTechniques: masteries.filter(m => m.masteryLevel === 'master').length,
        advancedTechniques: masteries.filter(m => m.masteryLevel === 'advanced').length,
        improvementRate: Math.round(improvementRate * 100) / 100,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // POST /api/liveavatar/session - Create LiveAvatar session with token
  app.post("/api/liveavatar/session", async (req, res) => {
    try {
      const { voiceId, contextId, language = "nl" } = req.body;
      
      // Validate required environment variables upfront
      const heygenApiKey = process.env.HEYGEN_API_KEY;
      const avatarId = process.env.Live_avatar_ID_heygen_hugoherbots;
      
      if (!heygenApiKey) {
        console.error("[LiveAvatar] HEYGEN_API_KEY is missing from environment");
        return res.status(500).json({ 
          error: "HeyGen API key not configured",
          details: "HEYGEN_API_KEY environment variable is not set"
        });
      }
      
      if (!avatarId) {
        console.error("[LiveAvatar] Live_avatar_ID_heygen_hugoherbots is missing from environment");
        return res.status(500).json({ 
          error: "LiveAvatar avatar ID not configured",
          details: "Live_avatar_ID_heygen_hugoherbots environment variable is not set"
        });
      }
      
      console.log("[LiveAvatar] Creating session with avatar:", avatarId);
      
      // Use LiveAvatar API to create a session token
      // FULL mode is required when using avatar_persona (CUSTOM mode expects livekit_config)
      const requestBody = {
        mode: "FULL",
        avatar_id: avatarId,
        avatar_persona: {
          voice_id: voiceId || undefined,
          context_id: contextId || undefined,
          language: language
        }
      };
      
      console.log("[LiveAvatar] Token request body:", JSON.stringify(requestBody, null, 2));
      
      const response = await fetch("https://api.liveavatar.com/v1/sessions/token", {
        method: "POST",
        headers: {
          "X-API-KEY": heygenApiKey,
          "Accept": "application/json",
          "Content-Type": "application/json"
        },
        body: JSON.stringify(requestBody)
      });
      
      if (!response.ok) {
        const errorBody = await response.text();
        console.error(`[LiveAvatar] Token request failed - Status: ${response.status}, Body: ${errorBody}`);
        return res.status(response.status).json({ 
          error: "Failed to create LiveAvatar session", 
          details: errorBody,
          status: response.status
        });
      }
      
      const responseData = await response.json();
      console.log("[LiveAvatar] Token response code:", responseData.code);
      
      // LiveAvatar returns { code: 1000, data: { session_id, session_token } }
      const sessionData = responseData.data || responseData;
      
      if (!sessionData.session_id || !sessionData.session_token) {
        console.error("[LiveAvatar] Invalid token response - missing session_id or session_token:", sessionData);
        return res.status(500).json({ 
          error: "Invalid response from LiveAvatar", 
          details: "Missing session_id or session_token in response"
        });
      }
      
      console.log("[LiveAvatar] Session created:", sessionData.session_id);
      
      // Validate that session_token is a JWT (must contain 2 dots)
      const token = sessionData.session_token;
      const dotCount = (token.match(/\./g) || []).length;
      const isJwt = dotCount === 2;
      
      // Log sanitized token info for debugging
      const sanitizedToken = token.length > 20 
        ? `${token.substring(0, 10)}...${token.substring(token.length - 10)} (${token.length} chars, ${dotCount} dots, isJWT: ${isJwt})`
        : `[short token: ${token.length} chars]`;
      console.log("[LiveAvatar] Token info:", sanitizedToken);
      
      if (!isJwt) {
        console.error("[LiveAvatar] WARNING: session_token is not a JWT! Expected 2 dots, got:", dotCount);
      }
      
      // Return session credentials - the client SDK will handle starting the session
      // Do NOT call /v1/sessions/start here as that would consume the token
      // The client's session.start() will handle the LiveKit connection
      res.json({
        session_id: sessionData.session_id,
        session_token: sessionData.session_token
      });
    } catch (error: any) {
      console.error("[LiveAvatar] Unexpected error:", error.message, error.stack);
      res.status(500).json({ error: error.message });
    }
  });

  // POST /api/heygen/token - Get streaming avatar access token
  // Uses HeyGen Streaming Avatar API at api.heygen.com
  app.post("/api/heygen/token", async (req, res) => {
    try {
      // Use the dedicated streaming avatar API key
      const streamingApiKey = process.env.API_Heygen_streaming_interactive_avatar_ID;
      const streamingAvatarId = process.env.Heygen_streaming_interactive_avatar_ID;
      
      if (!streamingApiKey) {
        console.error("[HeyGen] API_Heygen_streaming_interactive_avatar_ID is missing from environment");
        return res.status(500).json({ 
          error: "HeyGen Streaming API key not configured",
          details: "API_Heygen_streaming_interactive_avatar_ID environment variable is not set"
        });
      }
      
      console.log("[HeyGen] Requesting streaming avatar access token...");
      console.log("[HeyGen] Avatar ID:", streamingAvatarId || "not configured");
      
      // Call HeyGen Streaming Avatar API to get access token
      // Docs: https://docs.heygen.com/reference/create-streaming-avatar-access-token
      const response = await fetch("https://api.heygen.com/v1/streaming.create_token", {
        method: "POST",
        headers: {
          "X-Api-Key": streamingApiKey,
          "Content-Type": "application/json"
        }
      });
      
      if (!response.ok) {
        const errorBody = await response.text();
        console.error(`[HeyGen] Token request failed - Status: ${response.status}, Body: ${errorBody}`);
        return res.status(response.status).json({ 
          error: "Failed to get HeyGen access token", 
          details: errorBody,
          status: response.status
        });
      }
      
      const responseData = await response.json();
      console.log("[HeyGen] Access token obtained successfully");
      
      // HeyGen returns { data: { token: "..." } }
      const token = responseData.data?.token;
      
      if (!token) {
        console.error("[HeyGen] Invalid response - missing token:", responseData);
        return res.status(500).json({ 
          error: "Invalid response from HeyGen", 
          details: "Missing token in response"
        });
      }
      
      // Return token and avatar ID for the frontend to use
      const avatarId = process.env.Heygen_streaming_interactive_avatar_ID;
      res.json({ token, avatarId });
    } catch (error: any) {
      console.error("[HeyGen] Unexpected error:", error.message, error.stack);
      res.status(500).json({ error: error.message });
    }
  });

  // GET /api/avatar/capabilities - Test which avatar SDK works
  app.get("/api/avatar/capabilities", async (req, res) => {
    const heygenApiKey = process.env.HEYGEN_API_KEY;
    const streamingApiKey = process.env.API_Heygen_streaming_interactive_avatar_ID;
    const streamingAvatarId = process.env.Heygen_streaming_interactive_avatar_ID;
    
    const results = {
      streamingAvatar: { ok: false, status: 0, message: "", avatarId: streamingAvatarId || "not configured" },
      liveAvatar: { ok: false, status: 0, message: "", avatarId: "f8343d95-8dd8-4318-aec0-597199fa99ac" }
    };
    
    // Test Streaming Avatar API with dedicated credentials
    if (!streamingApiKey) {
      results.streamingAvatar.message = "API_Heygen_streaming_interactive_avatar_ID not configured";
    } else {
      try {
        const streamingRes = await fetch("https://api.heygen.com/v1/streaming.create_token", {
          method: "POST",
          headers: { "x-api-key": streamingApiKey }
        });
        results.streamingAvatar.status = streamingRes.status;
        results.streamingAvatar.ok = streamingRes.ok;
        const streamingData = await streamingRes.json().catch(() => ({}));
        results.streamingAvatar.message = streamingRes.ok ? "Token created successfully" : (streamingData.message || streamingRes.statusText);
      } catch (e: any) {
        results.streamingAvatar.message = e.message;
      }
    }
    
    // Test LiveAvatar API with HEYGEN_API_KEY
    if (!heygenApiKey) {
      results.liveAvatar.message = "HEYGEN_API_KEY not configured";
    } else {
      try {
        const liveRes = await fetch("https://api.liveavatar.com/v1/sessions/token", {
          method: "POST",
          headers: { 
            "X-API-KEY": heygenApiKey,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ mode: "CUSTOM", avatar_id: "f8343d95-8dd8-4318-aec0-597199fa99ac" })
        });
        results.liveAvatar.status = liveRes.status;
        results.liveAvatar.ok = liveRes.ok;
        const liveData = await liveRes.json().catch(() => ({}));
        results.liveAvatar.message = liveRes.ok ? "Session created" : (liveData.message || liveRes.statusText);
      } catch (e: any) {
        results.liveAvatar.message = e.message;
      }
    }
    
    res.json(results);
  });

  // POST /api/elevenlabs/speak - Text-to-speech using ElevenLabs with Hugo's voice clone
  app.post("/api/elevenlabs/speak", async (req, res) => {
    try {
      const { text } = req.body;
      
      if (!text) {
        return res.status(400).json({ error: "text is required" });
      }
      
      const voiceId = process.env.Elevenlabs_Hugo_voice_clone;
      const apiKey = process.env.Elevenlabs_api_key;
      
      if (!voiceId || !apiKey) {
        console.error("ElevenLabs credentials missing");
        return res.status(500).json({ error: "ElevenLabs configuration missing" });
      }
      
      const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
        method: "POST",
        headers: {
          "xi-api-key": apiKey,
          "Content-Type": "application/json",
          "Accept": "audio/mpeg",
        },
        body: JSON.stringify({
          text,
          model_id: "eleven_multilingual_v2",
        }),
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error("ElevenLabs API error:", errorText);
        return res.status(response.status).json({ error: "ElevenLabs API error", details: errorText });
      }
      
      res.set({
        "Content-Type": "audio/mpeg",
        "Transfer-Encoding": "chunked",
      });
      
      const arrayBuffer = await response.arrayBuffer();
      res.send(Buffer.from(arrayBuffer));
    } catch (error: any) {
      console.error("ElevenLabs speak error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // ============================================================
  // V2 ROLEPLAY ENGINE ROUTES
  // ============================================================
  
  const v2Engine = await import('./v2/roleplay-engine');
  
  // Helper: Convert V2SessionState to DB format for storage
  // Note: isActive defaults to 1 (active) for new sessions, preserved for updates
  function v2StateToDb(state: any, options?: { isActive?: number }) {
    return {
      id: state.sessionId,
      userId: state.userId,
      techniqueId: state.techniqueId,
      mode: state.mode || 'ROLEPLAY',
      currentMode: state.currentMode || 'CONTEXT_GATHERING',
      phase: state.phase ?? 2,
      epicPhase: state.epicPhase || 'explore',
      epicMilestones: state.epicMilestones || { probeUsed: false, impactAsked: false, commitReady: false },
      context: state.context || { gathered: {}, isComplete: false },
      dialogueState: state.dialogueState || { lastCustomerMessage: null, lastSellerMessage: null },
      persona: state.persona || { name: 'Klant', behavior_style: 'neutraal' },
      currentAttitude: state.currentAttitude || null,
      turnNumber: state.turnNumber ?? 0,
      conversationHistory: state.conversationHistory || [],
      customerDynamics: state.customerDynamics || { trustLevel: 50, engagementLevel: 50 },
      events: state.events || [],
      totalScore: state.totalScore ?? 0,
      expertMode: state.expertMode ? 1 : 0,
      isActive: options?.isActive ?? 1 // Preserve isActive if provided, default to active
    };
  }
  
  // Helper: Convert DB format back to V2SessionState
  function dbToV2State(dbSession: any) {
    return {
      sessionId: dbSession.id,
      userId: dbSession.userId,
      techniqueId: dbSession.techniqueId,
      mode: dbSession.mode,
      currentMode: dbSession.currentMode,
      phase: dbSession.phase,
      epicPhase: dbSession.epicPhase,
      epicMilestones: dbSession.epicMilestones,
      context: dbSession.context,
      dialogueState: dbSession.dialogueState,
      persona: dbSession.persona,
      currentAttitude: dbSession.currentAttitude,
      turnNumber: dbSession.turnNumber,
      conversationHistory: dbSession.conversationHistory,
      customerDynamics: dbSession.customerDynamics,
      events: dbSession.events,
      totalScore: dbSession.totalScore,
      expertMode: dbSession.expertMode === 1
    };
  }
  
  // POST /api/v2/session/start - Start a V2 roleplay session
  app.post("/api/v2/session/start", async (req, res) => {
    try {
      const { techniqueId, userId = "demo-user", expertMode = false } = req.body;
      
      if (!techniqueId) {
        return res.status(400).json({ error: "techniqueId is required" });
      }
      
      // SEQUENCE ENFORCEMENT: Check if user can access this technique
      // Expert mode, demo-user, and livekit-user bypass sequence check
      const isDemoUser = userId === "demo-user" || userId.startsWith("demo-");
      const isLiveKitUser = userId === "livekit-user" || userId.startsWith("livekit-");
      if (!expertMode && !isDemoUser && !isLiveKitUser) {
        const accessCheck = await canAccessTechnique(userId, techniqueId);
        if (!accessCheck.canAccess) {
          console.log(`[V2] Sequence blocked: User ${userId} cannot access ${techniqueId}, missing: ${accessCheck.missingTechniques.length} techniques`);
          return res.status(403).json({
            error: "sequence_blocked",
            message: `Je moet eerst de voorgaande technieken afronden voordat je bij ${techniqueId} kunt.`,
            missingTechniques: accessCheck.missingTechniques.slice(0, 5), // Show first 5 missing
            nextInSequence: accessCheck.nextInSequence,
            totalMissing: accessCheck.missingTechniques.length
          });
        }
      } else if (expertMode) {
        console.log(`[V2] Expert mode: Bypassing sequence check for ${techniqueId}`);
      } else if (isDemoUser) {
        console.log(`[V2] Demo user: Bypassing sequence check for ${techniqueId}`);
      } else if (isLiveKitUser) {
        console.log(`[V2] LiveKit user: Bypassing sequence check for ${techniqueId}`);
      }
      
      const sessionId = `v2-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      
      // Load existing user context from database
      const existingContext = await storage.getUserContext(userId);
      
      // Initialize session with pre-loaded context
      const state = v2Engine.initSession(userId, sessionId, techniqueId, existingContext ? {
        sector: existingContext.sector,
        product: existingContext.product,
        klantType: existingContext.klantType,
        setting: existingContext.setting
      } : undefined);
      
      // Set expert mode if enabled (for recording reference answers)
      if (expertMode) {
        state.expertMode = true;
        console.log(`[V2] Expert mode enabled for session ${sessionId}`);
      }
      
      // Get opening message (now async to support coach mode with RAG)
      // AI Freedom Philosophy: Pass userId for historical context injection
      const response = await v2Engine.getOpeningMessage(state, userId);
      
      // Store session to database for persistence
      await storage.saveV2Session(v2StateToDb(response.sessionState));
      console.log(`[V2] Session ${sessionId} saved to database`);
      
      // Log session_start activity
      try {
        await storage.logActivity({
          userId,
          eventType: 'session_start',
          entityType: 'session',
          entityId: sessionId,
          metadata: {
            techniqueId,
            expertMode
          }
        });
      } catch (e) {
        console.error('[V2] Failed to log session_start activity:', e);
      }
      
      // Build debug info - ALWAYS include for expert mode toggle (frontend controls visibility)
      const klantHoudingen = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'config', 'klant_houdingen.json'), 'utf-8'));
      // At turn 0, signal is null/undefined - customer hasn't spoken yet
      const initialSignal = response.signal || null;
      const attitudeConfig = initialSignal ? klantHoudingen.houdingen?.[initialSignal] : null;
      
      const debugInfo = {
        persona: response.sessionState.persona,
        // null means "not yet determined" - customer hasn't spoken
        attitude: initialSignal,
        signal: initialSignal,
        context: {
          sector: response.sessionState.context.gathered?.sector,
          product: response.sessionState.context.gathered?.product,
          klant_type: response.sessionState.context.gathered?.klant_type,
          isComplete: response.sessionState.context.isComplete,
          turnNumber: 0,
          phase: response.sessionState.phase,
          techniqueId: response.sessionState.techniqueId
        },
        attitudeConfig: attitudeConfig ? {
          id: attitudeConfig.id,
          naam: attitudeConfig.naam,
          signalen: attitudeConfig.signalen,
          techniek_reactie: attitudeConfig.techniek_reactie,
          detection_patterns: attitudeConfig.detection_patterns
        } : undefined,
        // No expected moves at turn 0 - wait for first seller message
        expectedMoves: [],
        promptUsed: "Opening message - context gathering or roleplay start",
        promptsUsed: response.promptsUsed
      };
      
      res.json({
        sessionId,
        message: response.message,
        type: response.type,
        signal: response.signal,
        coachMode: response.coachMode,
        ragDocuments: response.ragDocuments,
        contextLoaded: !!existingContext,
        debug: debugInfo,
        state: v2Engine.getSessionSummary(response.sessionState)
      });
    } catch (error: any) {
      console.error("[V2] Session start error:", error);
      res.status(500).json({ error: error.message });
    }
  });
  
  // POST /api/v2/session/message - Send message to V2 session
  app.post("/api/v2/session/message", async (req, res) => {
    try {
      const { sessionId, message, debug = false, expertMode: requestExpertMode } = req.body;
      
      if (!sessionId || !message) {
        return res.status(400).json({ error: "sessionId and message are required" });
      }
      
      // Load session from database
      const dbSession = await storage.getV2Session(sessionId);
      if (!dbSession) {
        return res.status(404).json({ error: "Session not found" });
      }
      
      // Prevent messages to ended sessions
      if (dbSession.isActive === 0) {
        return res.status(400).json({ error: "Session has ended. Start a new session to continue." });
      }
      
      const state = dbToV2State(dbSession);
      
      // Debug is enabled if: request explicitly asks OR session is in expertMode
      const enableDebug = debug || state.expertMode || requestExpertMode;
      
      // Check if we were in context gathering before processing
      const wasContextGathering = state.currentMode === 'CONTEXT_GATHERING';
      
      // Process input with debug flag
      const response = await v2Engine.processInput(state, message, enableDebug);
      
      // If context gathering just completed, save to database
      if (wasContextGathering && response.sessionState.context.isComplete) {
        const gathered = response.sessionState.context.gathered;
        await storage.createOrUpdateUserContext(response.sessionState.userId, {
          sector: gathered.sector || null,
          product: gathered.product || null,
          klantType: gathered.klant_type || null,
          setting: gathered.verkoopkanaal || null,
          additionalContext: {
            gespreksduur: gathered.gespreksduur,
            gespreksdoel: gathered.gespreksdoel
          }
        });
        console.log(`[V2] Saved context to database for user ${response.sessionState.userId}`);
      }
      
      // Update session in database (preserve isActive status from existing session)
      await storage.updateV2Session(sessionId, v2StateToDb(response.sessionState, { isActive: dbSession.isActive }));
      
      res.json({
        message: response.message,
        type: response.type,
        signal: response.signal,
        evaluation: response.evaluation,
        coachMode: response.coachMode,
        ragDocuments: response.ragDocuments,
        debug: enableDebug ? { ...response.debug, promptsUsed: response.promptsUsed } : undefined,
        state: v2Engine.getSessionSummary(response.sessionState)
      });
    } catch (error: any) {
      console.error("[V2] Message error:", error);
      res.status(500).json({ error: error.message });
    }
  });
  
  // POST /api/v2/session/end - End V2 session and get debrief
  app.post("/api/v2/session/end", async (req, res) => {
    try {
      const { sessionId } = req.body;
      
      if (!sessionId) {
        return res.status(400).json({ error: "sessionId is required" });
      }
      
      // Load session from database
      const dbSession = await storage.getV2Session(sessionId);
      if (!dbSession) {
        return res.status(404).json({ error: "Session not found" });
      }
      const state = dbToV2State(dbSession);
      
      // End roleplay with Hugo-style debrief
      const response = await v2Engine.endRoleplay(state);
      
      // Mark session as ended in database (keep for history)
      await storage.endV2Session(sessionId);
      console.log(`[V2] Session ${sessionId} ended and marked inactive`);
      
      // =====================
      // AGGREGATION: Update user analytics
      // =====================
      const { generateSessionFeedback } = await import('./v2/evaluator');
      const feedback = generateSessionFeedback(state.events || []);
      
      // Calculate session metrics
      const sessionDurationSeconds = Math.round((Date.now() - new Date(dbSession.createdAt).getTime()) / 1000);
      const events = state.events || [];
      // Only count events with actual scores (filter out events without scores)
      const scoredEvents = events.filter((e: any) => typeof e.score === 'number' && e.score > 0);
      const totalScore = scoredEvents.reduce((sum: number, e: any) => sum + e.score, 0);
      const avgScore = scoredEvents.length > 0 ? Math.round(totalScore / scoredEvents.length) : 0;
      const successfulTurns = events.filter((e: any) => e.detected).length;
      const isSuccess = avgScore >= 60; // 60+ is considered a successful session
      
      // Get technique name from SSOT
      const techniqueId = state.techniqueId || dbSession.techniqueId;
      let techniqueName = techniqueId;
      try {
        const { getTechnique } = await import('./ssot-loader');
        const tech = getTechnique(techniqueId);
        if (tech) techniqueName = tech.naam;
      } catch (e) {
        console.error('[V2] Failed to load technique name:', e);
      }
      
      // 1. Update technique mastery
      try {
        await storage.recordTechniqueAttempt(
          state.userId,
          techniqueId,
          techniqueName,
          avgScore,
          isSuccess
        );
        console.log(`[V2] Updated technique mastery for ${techniqueId}: score=${avgScore}, success=${isSuccess}`);
      } catch (e) {
        console.error('[V2] Failed to update technique mastery:', e);
      }
      
      // 2. Update user stats
      try {
        // Increment session count
        await storage.incrementUserStats(state.userId, 'totalSessions', 1);
        // Add time spent
        await storage.incrementUserStats(state.userId, 'totalTimeSeconds', sessionDurationSeconds);
        // Update average score (only if there were scored events)
        if (scoredEvents.length > 0) {
          await storage.updateUserAverageScore(state.userId, avgScore);
        }
        // Update streak
        await storage.updateStreak(state.userId);
        console.log(`[V2] Updated user stats: duration=${sessionDurationSeconds}s, avgScore=${avgScore} (from ${scoredEvents.length} scored events)`);
      } catch (e) {
        console.error('[V2] Failed to update user stats:', e);
      }
      
      // 3. Log activity
      try {
        await storage.logActivity({
          userId: state.userId,
          eventType: 'session_end',
          entityType: 'session',
          entityId: sessionId,
          durationSeconds: sessionDurationSeconds,
          score: avgScore,
          metadata: {
            techniqueId,
            techniqueName,
            turnCount: state.turnNumber || 0,
            successfulTurns,
            totalTurns: events.length,
            isSuccess
          }
        });
        console.log(`[V2] Logged session_end activity for ${sessionId}`);
      } catch (e) {
        console.error('[V2] Failed to log activity:', e);
      }
      
      res.json({
        message: response.message,
        type: response.type,
        feedback,
        analytics: {
          durationSeconds: sessionDurationSeconds,
          avgScore,
          successfulTurns,
          totalTurns: events.length,
          masteryUpdated: true
        }
      });
    } catch (error: any) {
      console.error("[V2] Session end error:", error);
      res.status(500).json({ error: error.message });
    }
  });
  
  // GET /api/v2/session/:sessionId - Get V2 session state
  app.get("/api/v2/session/:sessionId", async (req, res) => {
    try {
      const { sessionId } = req.params;
      
      // Load session from database
      const dbSession = await storage.getV2Session(sessionId);
      if (!dbSession) {
        return res.status(404).json({ error: "Session not found" });
      }
      const state = dbToV2State(dbSession);
      
      res.json({
        state: v2Engine.getSessionSummary(state),
        context: state.context.gathered,
        turns: state.turnNumber,
        score: state.totalScore
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // POST /api/v2/session/reset - Reset session and start fresh (for expert mode)
  app.post("/api/v2/session/reset", async (req, res) => {
    try {
      const { sessionId, techniqueId, expertMode = true, clearContext = false } = req.body;
      
      // Mark old session as ended if exists
      if (sessionId) {
        await storage.endV2Session(sessionId);
      }
      
      const userId = "demo-user";
      const newSessionId = `v2-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      
      // Load existing context unless clearContext is true
      let existingContext = undefined;
      if (!clearContext) {
        const userContext = await storage.getUserContext(userId);
        if (userContext) {
          existingContext = {
            sector: userContext.sector,
            product: userContext.product,
            klantType: userContext.klantType,
            setting: userContext.setting
          };
        }
      }
      
      // Initialize fresh session
      const state = v2Engine.initSession(userId, newSessionId, techniqueId, existingContext);
      
      if (expertMode) {
        state.expertMode = true;
      }
      
      // Get opening message
      // AI Freedom Philosophy: Pass userId for historical context injection
      const response = await v2Engine.getOpeningMessage(state, userId);
      
      // Store new session to database
      await storage.saveV2Session(v2StateToDb(response.sessionState));
      
      console.log(`[V2] Session reset: ${sessionId} -> ${newSessionId}`);
      
      res.json({
        sessionId: newSessionId,
        message: response.message,
        type: response.type,
        mode: response.sessionState.currentMode,
        contextComplete: response.sessionState.context.isComplete,
        expertMode: state.expertMode,
        debug: response.debug
      });
    } catch (error: any) {
      console.error("[V2] Session reset error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // POST /api/v2/session/save-reference - Save user message as reference answer (for V2 sessions)
  app.post("/api/v2/session/save-reference", async (req, res) => {
    try {
      const { sessionId, techniqueId, message, context, matchStatus, signal, detectedTechnique } = req.body;
      
      if (!sessionId) {
        return res.status(400).json({ error: "sessionId is required" });
      }
      
      // Load session from database
      const dbSession = await storage.getV2Session(sessionId);
      if (!dbSession) {
        return res.status(404).json({ error: "V2 Session not found" });
      }
      const session = dbToV2State(dbSession);
      
      // Determine if this is a correction (mismatch between expert selection and AI detection)
      const isCorrection = matchStatus === 'mismatch' && detectedTechnique && detectedTechnique !== techniqueId;
      
      // Save as reference answer using the V2 reference-answers module
      const { saveReferenceAnswer } = await import('./v2/reference-answers');
      
      const referenceAnswer = saveReferenceAnswer({
        techniqueId: techniqueId || session.techniqueId,
        customerSignal: signal || 'opening',
        customerMessage: '',
        sellerResponse: message,
        context: context || session.context?.gathered || {},
        recordedBy: 'Hugo (Expert Mode)',
        detectedTechnique: isCorrection ? detectedTechnique : undefined,
        isCorrection
      });
      
      console.log(`[V2] Saved reference answer for technique ${techniqueId}${isCorrection ? ' (CORRECTION from ' + detectedTechnique + ')' : ''}`);
      
      res.json({
        success: true,
        referenceAnswer,
        isCorrection,
        message: isCorrection 
          ? `Correctie opgeslagen: AI detecteerde ${detectedTechnique}, expert zegt ${techniqueId}`
          : `Referentie opgeslagen voor techniek ${techniqueId}`
      });
    } catch (error: any) {
      console.error("[V2] Save reference error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // POST /api/v2/session/flag-customer-response - Flag a customer response as incorrect
  app.post("/api/v2/session/flag-customer-response", async (req, res) => {
    try {
      const { sessionId, turnNumber, customerMessage, customerSignal, currentPhase, techniqueId, expertComment, context } = req.body;
      
      if (!sessionId || !expertComment) {
        return res.status(400).json({ error: "sessionId and expertComment are required" });
      }
      
      // Load session from database for additional context
      const dbSession = await storage.getV2Session(sessionId);
      const session = dbSession ? dbToV2State(dbSession) : null;
      
      // Use conversationHistory from request (preferred) or build from session
      const reqConversationHistory = req.body.conversationHistory;
      const finalConversationHistory = (reqConversationHistory && reqConversationHistory.length > 0) 
        ? reqConversationHistory 
        : (session?.conversationHistory?.map((turn: any) => ({
            role: turn.role,
            content: turn.content
          })) || []);
      
      // Analyze the feedback and generate conflicts
      const { analyzeCustomerResponseFeedback } = await import('./v2/config-consistency');
      
      const conflicts = analyzeCustomerResponseFeedback({
        sessionId,
        turnNumber: turnNumber || 0,
        customerMessage: customerMessage || '',
        customerSignal: customerSignal || 'unknown',
        currentPhase: currentPhase || session?.phase || 2,
        techniqueId: techniqueId || session?.techniqueId || '2.1',
        expertComment,
        context: context || session?.context?.gathered || {},
        conversationHistory: finalConversationHistory
      });
      
      console.log(`[V2] Flagged customer response: ${customerSignal} in phase ${currentPhase}. Found ${conflicts.length} conflicts.`);
      
      res.json({
        success: true,
        conflictsFound: conflicts.length,
        conflicts: conflicts.map(c => ({
          id: c.id,
          severity: c.severity,
          description: c.description
        })),
        message: `Feedback opgeslagen. ${conflicts.length} conflict(en) gedetecteerd in /admin/conflicts.`
      });
    } catch (error: any) {
      console.error("[V2] Flag customer response error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // POST /api/v2/session/flag-evaluation - Flag an AI evaluation as incorrect
  app.post("/api/v2/session/flag-evaluation", async (req, res) => {
    try {
      const { 
        sessionId, 
        turnNumber, 
        evaluationFeedback,
        evaluationDetected,
        evaluationScore,
        expectedMoves,
        currentPhase, 
        techniqueId, 
        expertComment,
        context,
        conversationHistory: reqConversationHistory
      } = req.body;
      
      if (!sessionId || !expertComment) {
        return res.status(400).json({ error: "sessionId and expertComment are required" });
      }
      
      // Load session from database for additional context
      const dbSession = await storage.getV2Session(sessionId);
      const session = dbSession ? dbToV2State(dbSession) : null;
      
      // Use conversationHistory from request (preferred) or build from session
      const finalConversationHistory = (reqConversationHistory && reqConversationHistory.length > 0) 
        ? reqConversationHistory 
        : (session?.conversationHistory?.map((turn: any) => ({
            role: turn.role,
            content: turn.content
          })) || []);
      
      // Generate a conflict for evaluation feedback
      const { addConflict } = await import('./v2/config-consistency');
      
      const conflict = addConflict({
        correctionId: `eval-${sessionId}-${turnNumber}`,
        severity: 'medium',
        configFile: 'ssot/evaluator_overlay.json',
        techniqueId: techniqueId || '2.1',
        conflictType: 'detector_mismatch',
        description: `AI evaluation possibly incorrect. Expected: ${expectedMoves?.join(', ') || 'unknown'}. Detected: ${evaluationDetected ? 'Yes' : 'No'}. Expert comment: "${expertComment}"`,
        suggestedChange: JSON.stringify({
          file: 'ssot/evaluator_overlay.json',
          operation: 'review',
          path: `techniques.${techniqueId}`,
          suggestion: 'Review technique detection patterns based on expert feedback',
          expertComment,
          evaluationWas: evaluationFeedback,
          expectedMoves
        }),
        sessionContext: {
          sessionId,
          turnNumber: turnNumber || 0,
          customerMessage: evaluationFeedback || '',
          customerSignal: 'evaluation',
          currentPhase: currentPhase || 2,
          expertComment,
          context: context || {},
          conversationHistory: finalConversationHistory
        }
      });
      
      console.log(`[V2] Flagged AI evaluation in phase ${currentPhase}. Conflict: ${conflict.id}`);
      
      res.json({
        success: true,
        conflictsFound: 1,
        conflicts: [{
          id: conflict.id,
          severity: conflict.severity,
          description: conflict.description
        }],
        message: `Evaluatie feedback opgeslagen. Conflict aangemaakt in /admin/conflicts.`
      });
    } catch (error: any) {
      console.error("[V2] Flag evaluation error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // POST /api/v2/rag/index - Index RAG corpus (admin only)
  app.post("/api/v2/rag/index", async (req, res) => {
    try {
      const { indexCorpus, getDocumentCount } = await import('./v2/rag-service');
      
      const beforeCount = await getDocumentCount();
      const result = await indexCorpus();
      const afterCount = await getDocumentCount();
      
      res.json({
        success: true,
        indexed: result.indexed,
        errors: result.errors,
        totalDocuments: afterCount,
        wasEmpty: beforeCount === 0
      });
    } catch (error: any) {
      console.error("[RAG] Index error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // GET /api/v2/rag/status - Get RAG status
  app.get("/api/v2/rag/status", async (req, res) => {
    try {
      const { getDocumentCount, isRagAvailable } = await import('./v2/rag-service');
      const count = await getDocumentCount();
      const available = isRagAvailable();
      
      res.json({
        available,
        indexed: count > 0,
        documentCount: count,
        message: available 
          ? (count > 0 ? "RAG ready" : "RAG available but not indexed") 
          : "OPENAI_API_KEY required for RAG"
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // POST /api/v2/rag/search - Search RAG (for testing)
  app.post("/api/v2/rag/search", async (req, res) => {
    try {
      const { query, limit, threshold } = req.body;
      
      if (!query) {
        return res.status(400).json({ error: "Query required" });
      }
      
      const { searchRag } = await import('./v2/rag-service');
      const result = await searchRag(query, { limit, threshold });
      
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // GET /api/v2/admin/methodology-report - Get methodology validation report
  app.get("/api/v2/admin/methodology-report", async (req, res) => {
    try {
      const { generateMethodologyReport } = await import('./v2/methodology-export');
      const report = generateMethodologyReport();
      res.json(report);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // GET /api/v2/admin/epic-flow - Get EPIC flow logic as markdown
  app.get("/api/v2/admin/epic-flow", async (req, res) => {
    try {
      const { generateEpicFlowMarkdown } = await import('./v2/methodology-export');
      const markdown = generateEpicFlowMarkdown();
      res.type('text/markdown').send(markdown);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // GET /api/v2/admin/reference-answers - Get all reference answers
  app.get("/api/v2/admin/reference-answers", async (req, res) => {
    try {
      const { getAllReferenceAnswersGrouped, getReferenceAnswers } = await import('./v2/reference-answers');
      const { techniqueId, signal, grouped } = req.query;
      
      if (grouped === 'true') {
        const answers = getAllReferenceAnswersGrouped();
        res.json(answers);
      } else {
        const answers = getReferenceAnswers(
          techniqueId as string | undefined, 
          signal as string | undefined
        );
        res.json(answers);
      }
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // DELETE /api/v2/admin/reference-answers/:id - Delete a reference answer
  app.delete("/api/v2/admin/reference-answers/:id", async (req, res) => {
    try {
      const { deleteReferenceAnswer } = await import('./v2/reference-answers');
      const success = deleteReferenceAnswer(req.params.id);
      if (success) {
        res.json({ success: true });
      } else {
        res.status(404).json({ error: "Reference answer not found" });
      }
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // GET /api/v2/admin/misclassification-report - Voortschrijdend inzicht report
  // Shows where AI detection differs from expert labels (learning opportunities)
  app.get("/api/v2/admin/misclassification-report", async (req, res) => {
    try {
      const { generateMisclassificationReport, getCorrections } = await import('./v2/reference-answers');
      const { getUnresolvedConflicts, getConflictStats } = await import('./v2/config-consistency');
      
      const report = generateMisclassificationReport();
      const corrections = getCorrections();
      const unresolvedConflicts = getUnresolvedConflicts();
      const conflictStats = getConflictStats();
      
      res.json({
        ...report,
        recentCorrections: corrections.slice(-10).reverse(),
        configConflicts: {
          unresolved: unresolvedConflicts,
          stats: conflictStats,
        },
        description: "Dit rapport toont waar de AI detectie afwijkt van de expert labels. " +
          "Config conflicts tonen waar de config files aangepast moeten worden (voortschrijdend inzicht)."
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // GET /api/v2/admin/config-conflicts - List all config conflicts
  app.get("/api/v2/admin/config-conflicts", async (req, res) => {
    try {
      const { getAllConflicts, getUnresolvedConflicts, getConflictStats } = await import('./v2/config-consistency');
      const { resolved } = req.query;
      
      const conflicts = resolved === 'false' ? getUnresolvedConflicts() : getAllConflicts();
      const stats = getConflictStats();
      
      res.json({ conflicts, stats });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // POST /api/v2/config/conflicts - Add a new config conflict (from transcript corrections, etc.)
  app.post("/api/v2/config/conflicts", async (req, res) => {
    try {
      const { addConflict } = await import('./v2/config-consistency');
      const { 
        techniqueNumber, 
        type, 
        severity, 
        description, 
        source,
        sessionId,
        originalValues,
        correctedValues 
      } = req.body;
      
      if (!techniqueNumber || !description) {
        return res.status(400).json({ error: 'techniqueNumber and description are required' });
      }

      const conflict = addConflict({
        correctionId: `manual-${sessionId || Date.now()}`,
        severity: (severity?.toLowerCase() || 'medium') as 'high' | 'medium' | 'low',
        configFile: 'manual_correction',
        techniqueId: techniqueNumber,
        conflictType: 'detector_mismatch' as const,
        description: `${description} | Original: ${JSON.stringify(originalValues || {})} | Corrected: ${JSON.stringify(correctedValues || {})}`,
        suggestedChange: `Manual correction from ${source || 'unknown'}: Apply the corrected values`
      });

      console.log(`[config-conflicts] Added manual conflict: ${conflict.id}`);
      res.json({ success: true, conflict });
    } catch (error: any) {
      console.error('[config-conflicts] Error adding conflict:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // POST /api/v2/admin/config-conflicts/:id/resolve - Mark a conflict as resolved
  app.post("/api/v2/admin/config-conflicts/:id/resolve", async (req, res) => {
    try {
      const { resolveConflict } = await import('./v2/config-consistency');
      const { resolvedBy } = req.body;
      
      const success = resolveConflict(req.params.id, resolvedBy || 'Hugo');
      if (success) {
        res.json({ success: true, message: 'Conflict marked as resolved' });
      } else {
        res.status(404).json({ error: 'Conflict not found' });
      }
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // GET /api/v2/admin/config-conflicts/:id/patch - Get suggested config patch
  app.get("/api/v2/admin/config-conflicts/:id/patch", async (req, res) => {
    try {
      const { generateConfigPatch } = await import('./v2/config-consistency');
      const patch = generateConfigPatch(req.params.id);
      
      if (patch) {
        res.json(patch);
      } else {
        res.status(404).json({ error: 'Conflict not found or no patch available' });
      }
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // POST /api/v2/admin/config-conflicts/:id/apply - Apply patch (✓ button)
  app.post("/api/v2/admin/config-conflicts/:id/apply", async (req, res) => {
    try {
      const { applyConfigPatch } = await import('./v2/config-consistency');
      const result = applyConfigPatch(req.params.id);
      
      if (result.success) {
        res.json(result);
      } else {
        res.status(400).json({ error: result.message });
      }
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // POST /api/v2/admin/config-conflicts/:id/reject - Reject patch (✗ button)
  app.post("/api/v2/admin/config-conflicts/:id/reject", async (req, res) => {
    try {
      const { rejectPatch } = await import('./v2/config-consistency');
      const success = rejectPatch(req.params.id);
      
      if (success) {
        res.json({ success: true, message: 'Patch afgewezen' });
      } else {
        res.status(404).json({ error: 'Conflict not found' });
      }
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ============================================================
  // GOLDEN STANDARD MODE ENDPOINTS
  // Hugo (trainer) plays seller, AI plays customer
  // ============================================================

  // File-based storage for golden standard sessions (persistent)
  interface GoldenSession {
    id: string;
    techniqueId: string;
    techniqueName: string;
    conversationHistory: Array<{ role: 'seller' | 'customer'; content: string; signal?: string }>;
    persona: any;
    context: any;
    createdAt: string;
    trainerName?: string;
  }
  
  const GOLDEN_SESSIONS_PATH = path.join(process.cwd(), "data", "golden_sessions.json");
  
  function loadGoldenSessions(): Record<string, GoldenSession> {
    try {
      if (fs.existsSync(GOLDEN_SESSIONS_PATH)) {
        return JSON.parse(fs.readFileSync(GOLDEN_SESSIONS_PATH, "utf-8"));
      }
    } catch (e) {
      console.error("[golden-sessions] Error loading sessions:", e);
    }
    return {};
  }
  
  function saveGoldenSession(session: GoldenSession): void {
    const dir = path.dirname(GOLDEN_SESSIONS_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const sessions = loadGoldenSessions();
    sessions[session.id] = session;
    fs.writeFileSync(GOLDEN_SESSIONS_PATH, JSON.stringify(sessions, null, 2));
  }
  
  function getGoldenSession(sessionId: string): GoldenSession | null {
    const sessions = loadGoldenSessions();
    return sessions[sessionId] || null;
  }

  // GET /api/v2/techniques - List all techniques for dropdown (already exists but ensure it returns roleplay-capable)
  // Note: This endpoint already exists above, so we'll use it as-is

  // POST /api/golden-standard/start - Start a golden standard session
  app.post("/api/golden-standard/start", async (req, res) => {
    try {
      const { techniqueId, context } = req.body;
      
      if (!techniqueId) {
        return res.status(400).json({ error: "techniqueId is required" });
      }
      
      // Get technique details
      const technieken = loadTechniquesCatalog();
      const technique = technieken.find((t: any) => t.nummer === techniqueId);
      
      if (!technique) {
        return res.status(404).json({ error: `Technique ${techniqueId} not found` });
      }
      
      // Build persona for the AI customer
      const { buildPersona } = await import('./v2/customer_engine');
      const persona = buildPersona();
      
      // Create session
      const sessionId = `golden-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      const session: GoldenSession = {
        id: sessionId,
        techniqueId,
        techniqueName: technique.naam,
        conversationHistory: [],
        persona,
        context: context || {
          sector: "IT dienstverlening",
          product: "Software oplossingen",
          klant_type: "KMO beslisser"
        },
        createdAt: new Date().toISOString()
      };
      
      saveGoldenSession(session);
      
      // Generate an opening customer message
      const { generateCustomerResponse, sampleAttitude } = await import('./v2/customer_engine');
      const { createContextState } = await import('./v2/context_engine');
      
      const phase = parseInt(techniqueId.split('.')[0]) || 2;
      const attitude = sampleAttitude(phase, techniqueId, persona);
      
      const contextState = createContextState('golden-user', sessionId, techniqueId);
      contextState.gathered = session.context;
      contextState.isComplete = true;
      
      // Generate opening from customer perspective
      const aiPromptConfig = loadAiPrompt() as any;
      const sellerOpening = aiPromptConfig.templates?.roleplay?.seller_opening_default || "Hello, how can I help you?";
      const openingResponse = await generateCustomerResponse(
        contextState,
        persona,
        attitude,
        sellerOpening,
        []
      );
      
      session.conversationHistory.push({
        role: 'customer',
        content: openingResponse.message,
        signal: openingResponse.signal
      });
      
      // Persist opening message
      saveGoldenSession(session);
      
      res.json({
        sessionId,
        techniqueId,
        techniqueName: technique.naam,
        openingMessage: openingResponse.message,
        signal: openingResponse.signal,
        persona: {
          behavior_style: persona.behavior_style,
          difficulty_level: persona.difficulty_level
        }
      });
    } catch (error: any) {
      console.error("[golden-standard/start] Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // POST /api/golden-standard/message - Hugo sends message, AI customer responds
  app.post("/api/golden-standard/message", async (req, res) => {
    try {
      const { sessionId, message, techniqueId: newTechniqueId } = req.body;
      
      if (!sessionId) {
        return res.status(400).json({ error: "sessionId is required" });
      }
      if (!message) {
        return res.status(400).json({ error: "message is required" });
      }
      
      const session = getGoldenSession(sessionId);
      if (!session) {
        return res.status(404).json({ error: "Session not found" });
      }
      
      // Allow changing technique mid-conversation
      if (newTechniqueId && newTechniqueId !== session.techniqueId) {
        const technieken = loadTechniquesCatalog();
        const technique = technieken.find((t: any) => t.nummer === newTechniqueId);
        if (technique) {
          session.techniqueId = newTechniqueId;
          session.techniqueName = technique.naam;
        }
      }
      
      // Add seller message to history
      session.conversationHistory.push({
        role: 'seller',
        content: message
      });
      
      // Generate customer response
      const { generateCustomerResponse, sampleAttitude } = await import('./v2/customer_engine');
      const { createContextState } = await import('./v2/context_engine');
      
      const phase = parseInt(session.techniqueId.split('.')[0]) || 2;
      const attitude = sampleAttitude(phase, session.techniqueId, session.persona);
      
      const contextState = createContextState('golden-user', sessionId, session.techniqueId);
      contextState.gathered = session.context;
      contextState.isComplete = true;
      
      const customerResponse = await generateCustomerResponse(
        contextState,
        session.persona,
        attitude,
        message,
        session.conversationHistory.map(h => ({
          role: h.role,
          content: h.content
        }))
      );
      
      // Add customer response to history
      session.conversationHistory.push({
        role: 'customer',
        content: customerResponse.message,
        signal: customerResponse.signal
      });
      
      // Persist session changes
      saveGoldenSession(session);
      
      res.json({
        customerMessage: customerResponse.message,
        signal: customerResponse.signal,
        techniqueId: session.techniqueId,
        techniqueName: session.techniqueName,
        turnNumber: Math.floor(session.conversationHistory.length / 2)
      });
    } catch (error: any) {
      console.error("[golden-standard/message] Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // POST /api/golden-standard/save-reference - Save Hugo's message as reference answer
  app.post("/api/golden-standard/save-reference", async (req, res) => {
    try {
      const { sessionId, messageIndex, techniqueId, trainerName } = req.body;
      
      if (!sessionId) {
        return res.status(400).json({ error: "sessionId is required" });
      }
      
      const session = getGoldenSession(sessionId);
      if (!session) {
        return res.status(404).json({ error: "Session not found" });
      }
      
      // Find the seller message at the given index
      const sellerMessages = session.conversationHistory.filter(h => h.role === 'seller');
      const targetIndex = messageIndex !== undefined ? messageIndex : sellerMessages.length - 1;
      const sellerMessage = sellerMessages[targetIndex];
      
      if (!sellerMessage) {
        return res.status(404).json({ error: "Seller message not found" });
      }
      
      // Find the preceding customer message (if any) to get the signal
      const messagePos = session.conversationHistory.findIndex(
        (h, i) => h.role === 'seller' && 
        session.conversationHistory.slice(0, i).filter(m => m.role === 'seller').length === targetIndex
      );
      
      const precedingCustomerMessage = messagePos > 0 
        ? session.conversationHistory.slice(0, messagePos).reverse().find(h => h.role === 'customer')
        : session.conversationHistory.find(h => h.role === 'customer');
      
      // Save as reference answer
      const { saveReferenceAnswer } = await import('./v2/reference-answers');
      
      const referenceAnswer = saveReferenceAnswer({
        techniqueId: techniqueId || session.techniqueId,
        customerSignal: precedingCustomerMessage?.signal || 'neutraal',
        customerMessage: precedingCustomerMessage?.content || '',
        sellerResponse: sellerMessage.content,
        context: session.context,
        recordedBy: trainerName || 'Hugo (Golden Standard)'
      });
      
      res.json({
        success: true,
        referenceAnswer,
        message: `Referentie opgeslagen voor techniek ${techniqueId || session.techniqueId}`
      });
    } catch (error: any) {
      console.error("[golden-standard/save-reference] Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // GET /api/golden-standard/session/:sessionId - Get session details
  app.get("/api/golden-standard/session/:sessionId", async (req, res) => {
    try {
      const session = getGoldenSession(req.params.sessionId);
      if (!session) {
        return res.status(404).json({ error: "Session not found" });
      }
      
      res.json({
        id: session.id,
        techniqueId: session.techniqueId,
        techniqueName: session.techniqueName,
        conversationHistory: session.conversationHistory,
        context: session.context,
        createdAt: session.createdAt
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // POST /api/livekit/token - Generate LiveKit access token for client
  app.post("/api/livekit/token", async (req, res) => {
    try {
      const { AccessToken, RoomServiceClient, AgentDispatchClient } = await import("livekit-server-sdk");
      
      const { techniqueId = "2.1", userId = "user" } = req.body;
      
      const apiKey = process.env.LIVEKIT_API_KEY;
      const apiSecret = process.env.LIVEKIT_API_SECRET;
      const livekitUrl = process.env.LIVEKIT_URL;
      
      if (!apiKey || !apiSecret || !livekitUrl) {
        return res.status(500).json({ error: "LiveKit credentials not configured" });
      }
      
      const roomName = `hugo-${techniqueId}-${Date.now()}`;
      const participantIdentity = `${userId}-${Date.now()}`;
      
      // Create room first
      const roomService = new RoomServiceClient(livekitUrl, apiKey, apiSecret);
      await roomService.createRoom({ name: roomName, emptyTimeout: 300 });
      console.log(`[LiveKit] Room created: ${roomName}`);
      
      // Agent will auto-subscribe to room (no explicit dispatch needed)
      // This prevents duplicate agents from joining
      
      const at = new AccessToken(apiKey, apiSecret, {
        identity: participantIdentity,
        ttl: 3600,
      });
      
      at.addGrant({
        roomJoin: true,
        room: roomName,
        canPublish: true,
        canSubscribe: true,
        canPublishData: true,
      });
      
      const token = await at.toJwt();
      
      res.json({
        token,
        roomName,
        livekitUrl,
        participantIdentity,
      });
    } catch (error: any) {
      console.error("[LiveKit] Token generation error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  const httpServer = createServer(app);
  
  // Setup ElevenLabs Scribe WebSocket for real-time STT
  setupScribeWebSocket(httpServer);
  
  // Setup streaming response WebSocket for low-latency LLM->TTS->Audio
  setupStreamingResponseWebSocket(httpServer);
  
  return httpServer;
}
