/**
 * API Server for Hugo Engine V2 - FULL ENGINE
 * Uses complete engine with nested prompts, RAG, and validation loop
 * 
 * ROLEPLAY-API-ENDPOINTS
 * ----------------------
 * Status: Done (januari 2026)
 * 
 * Bron: hugo-engine_(4).zip → hugo-engine-export/server/routes.ts
 * Endpoints zijn al geëxtraheerd en werkend.
 * 
 * Beschikbare endpoints (via routes.ts - uit ZIP):
 * - POST /api/session/:id/start-roleplay - Transition to ROLEPLAY mode
 * - POST /api/session/:id/message - Process roleplay messages  
 * - POST /api/session/:id/feedback - Get mid-session feedback
 * - POST /api/session/:id/evaluate - Get evaluation scores
 * 
 * V2 endpoints (via api.ts):
 * - POST /api/v2/roleplay/start - Full V2 roleplay session
 * - POST /api/v2/roleplay/message - V2 roleplay message processing
 * - POST /api/v2/roleplay/end - End with debrief
 * 
 * Frontend koppeling: src/services/hugoApi.ts roept deze endpoints aan
 */

import express, { type Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import path from "path";
import fs from "fs";
import os from "os";
import { nanoid } from "nanoid";

// FULL ENGINE IMPORTS - Replacing simplified versions
import { 
  generateCoachResponse,
  generateCoachResponseStream,
  generateCoachOpening,
  type CoachContext,
  type CoachMessage,
  type CoachResponse
} from "./v2/coach-engine";

import {
  createContextState,
  processAnswer,
  generateQuestionForSlot,
  getNextSlotKey,
  formatContextForPrompt,
  type ContextState,
  type ConversationMessage
} from "./v2/context_engine";

import { getTechnique } from "./ssot-loader";
import { AccessToken } from "livekit-server-sdk";
import { setupScribeWebSocket } from "./elevenlabs-stt";
import { pool } from "./db";

// Roleplay Engine imports
import {
  initSession as initRoleplaySession,
  getOpeningMessage,
  processInput,
  endRoleplay,
  isInRoleplay,
  getSessionSummary,
  type V2SessionState,
  type EngineResponse
} from "./v2/roleplay-engine";

import {
  saveReferenceAnswer,
  getReferenceAnswers,
  getExamplesForTechnique,
  generateMisclassificationReport,
  getAllReferenceAnswersGrouped,
  type ReferenceAnswer
} from "./v2/reference-answers";

import { indexCorpus, getDocumentCount } from "./v2/rag-service";
import { supabase } from "./supabase-client";
import { 
  saveArtifact, 
  getArtifact, 
  getSessionArtifacts, 
  getArtifactsMap,
  hasRequiredArtifacts,
  type ArtifactContent
} from "./v2/artifact-service";
import type { ArtifactType } from "./v2/orchestrator";
import {
  buildExtendedContext,
  formatExtendedContextForPrompt,
  getRequiredLayers,
  checkRoleplayUnlock,
  getSequenceRank,
  LAYER_SLOTS,
  FLOW_RULES,
  type ContextDepth,
  type ContextLayer
} from "./v2/context-layers-service";
import {
  generateDiscoveryBrief,
  generateOfferBrief,
  generateScenarioSnapshot
} from "./v2/brief-generator-service";
import { detectIntent } from "./v2/intent-detector";
import { buildRichResponse } from "./v2/rich-response-builder";
import {
  uploadAndStore,
  runFullAnalysis,
  runChatAnalysis,
  getAnalysisStatus,
  getAnalysisResults,
  generateCoachArtifacts,
  type ConversationAnalysis,
} from "./v2/analysis-service";
import multer from "multer";
import { hugoAgentRouter } from "./hugo-agent";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 24 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['audio/mpeg', 'audio/wav', 'audio/x-wav', 'audio/mp4', 'audio/x-m4a', 'audio/m4a', 'video/mp4', 'video/quicktime', 'application/octet-stream'];
    if (allowed.includes(file.mimetype) || file.originalname.match(/\.(mp3|wav|m4a|mp4|mov)$/i)) {
      cb(null, true);
    } else {
      cb(new Error('Ongeldig bestandstype. Toegestaan: MP3, WAV, M4A, MP4, MOV'));
    }
  }
});

const chunkUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 24 * 1024 * 1024 },
});


const activeChunkedUploads = new Map<string, {
  chunks: Map<number, boolean>;
  totalChunks: number;
  fileName: string;
  mimetype: string;
  tmpDir: string;
  createdAt: number;
}>();

setInterval(() => {
  const now = Date.now();
  for (const [id, upload] of activeChunkedUploads) {
    if (now - upload.createdAt > 30 * 60 * 1000) {
      try { fs.rmSync(upload.tmpDir, { recursive: true, force: true }); } catch {}
      activeChunkedUploads.delete(id);
    }
  }
}, 5 * 60 * 1000);

const app = express();

app.use(express.json({ limit: "100mb" }));
app.use(express.urlencoded({ limit: "100mb", extended: true }));

// CORS headers for development
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }
  next();
});

// Logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    const duration = Date.now() - start;
    if (req.path.startsWith("/api")) {
      console.log(`${req.method} ${req.path} ${res.statusCode} in ${duration}ms`);
    }
  });
  next();
});

// ===========================================
// SESSION STORAGE (database-backed with in-memory cache)
// ===========================================

interface Session {
  id: string;
  mode: "CONTEXT_GATHERING" | "COACH_CHAT" | "ROLEPLAY";
  techniqueId: string;
  techniqueName: string;
  conversationHistory: CoachMessage[];
  contextState: ContextState;
  isExpert: boolean;
  createdAt: Date;
  userId?: string;
  userName?: string;
  viewMode?: "admin" | "user";
}

const sessions = new Map<string, Session>();

// Helper: Save session to database (Supabase)
async function saveSessionToDb(session: Session): Promise<void> {
  try {
    const sessionData = {
      id: session.id,
      user_id: session.userId || 'anonymous',
      technique_id: session.techniqueId,
      mode: session.mode,
      current_mode: session.mode,
      phase: session.contextState.isComplete ? 2 : 1,
      epic_phase: 'OPENING',
      epic_milestones: {},
      context: session.contextState.gathered,
      dialogue_state: { 
        questionsAsked: session.contextState.questionsAsked, 
        questionsAnswered: session.contextState.questionsAnswered,
        viewMode: session.viewMode || 'user'
      },
      persona: { name: session.userName },
      turn_number: session.conversationHistory.length,
      conversation_history: session.conversationHistory,
      customer_dynamics: {},
      events: [],
      total_score: 0,
      expert_mode: session.isExpert ? 1 : 0,
      is_active: 1,
      updated_at: new Date().toISOString()
    };

    const { error } = await supabase
      .from('v2_sessions')
      .upsert(sessionData, { onConflict: 'id' });

    if (error) {
      console.error("[API] Supabase error saving session:", error.message);
    }
  } catch (error: any) {
    console.error("[API] Error saving session to DB:", error.message);
  }
}

// Helper: Load session from database (Supabase)
async function loadSessionFromDb(sessionId: string): Promise<Session | null> {
  try {
    const { data: row, error } = await supabase
      .from('v2_sessions')
      .select('*')
      .eq('id', sessionId)
      .single();
    
    if (error || !row) return null;
    
    const conversationHistory = row.conversation_history || [];
    const context = row.context || {};
    const dialogueState = row.dialogue_state || {};
    
    return {
      id: row.id,
      mode: row.current_mode as Session['mode'],
      techniqueId: row.technique_id,
      techniqueName: getTechnique(row.technique_id)?.naam || row.technique_id,
      conversationHistory,
      contextState: {
        userId: row.user_id,
        sessionId: row.id,
        techniqueId: row.technique_id,
        gathered: context,
        questionsAsked: dialogueState.questionsAsked || [],
        questionsAnswered: dialogueState.questionsAnswered || [],
        isComplete: row.phase >= 2,
        currentQuestionKey: null,
        lensPhase: false,
        lensQuestionsAsked: [],
        deepDiveRounds: {}
      },
      isExpert: row.expert_mode === 1,
      createdAt: new Date(row.created_at),
      userId: row.user_id,
      userName: row.persona?.name,
      viewMode: dialogueState.viewMode || 'user'
    };
  } catch (error: any) {
    console.error("[API] Error loading session from DB:", error.message);
    return null;
  }
}

// Clean up old sessions from memory (older than 2 hours)
// Database sessions persist and can be loaded on demand
setInterval(() => {
  const now = Date.now();
  const twoHours = 2 * 60 * 60 * 1000;
  for (const [id, session] of sessions.entries()) {
    if (now - session.createdAt.getTime() > twoHours) {
      sessions.delete(id);
      console.log(`[API] Cleaned up expired in-memory session: ${id}`);
    }
  }
}, 30 * 60 * 1000); // Run every 30 minutes

// ===========================================
// TECHNIEKEN ENDPOINT (for sidebar)
// ===========================================
app.get("/api/technieken", async (req, res) => {
  try {
    const indexPath = path.join(process.cwd(), "config/ssot/technieken_index.json");
    const indexData = JSON.parse(fs.readFileSync(indexPath, "utf-8"));
    
    const techniques: any[] = [];
    for (const [techId, tech] of Object.entries(indexData.technieken || {})) {
      const techData = tech as any;
      techniques.push({
        nummer: techData.nummer || techId,
        naam: techData.naam,
        fase: techData.fase,
        doel: techData.doel,
        is_fase: techData.is_fase,
        tags: techData.tags,
        ...techData
      });
    }
    res.json(techniques);
  } catch (error: any) {
    console.error("[API] Error loading technieken:", error.message);
    res.status(500).json({ error: error.message });
  }
});

// ===========================================
// V2 SESSION ENDPOINTS - FULL ENGINE
// ===========================================

// Start a new session with FULL engine
app.post("/api/v2/sessions", async (req, res) => {
  try {
    const { techniqueId, mode = "COACH_CHAT", isExpert = false, userId, userName, viewMode } = req.body;
    
    if (!techniqueId) {
      return res.status(400).json({ error: "techniqueId is required" });
    }
    
    const sessionId = `session-${nanoid(12)}`;
    
    // Get technique info from SSOT
    const technique = getTechnique(techniqueId);
    const techniqueName = technique?.naam || techniqueId;
    
    // Create context state for context gathering
    const contextState = createContextState(userId || 'anonymous', sessionId, techniqueId);
    
    // Load existing user context from Supabase and pre-fill gathered slots
    const userIdForContext = userId || 'anonymous';
    try {
      const { data: row } = await supabase
        .from('user_context')
        .select('sector, product, klant_type, setting, additional_context')
        .eq('user_id', userIdForContext)
        .single();
      
      if (row) {
        // Pre-fill context state with existing values
        if (row.sector) {
          contextState.gathered.sector = row.sector;
          contextState.questionsAnswered.push('sector');
        }
        if (row.product) {
          contextState.gathered.product = row.product;
          contextState.questionsAnswered.push('product');
        }
        if (row.klant_type) {
          contextState.gathered.klant_type = row.klant_type;
          contextState.questionsAnswered.push('klant_type');
        }
        // Check additional_context for verkoopkanaal and ervaring
        const additional = row.additional_context || {};
        if (additional.verkoopkanaal) {
          contextState.gathered.verkoopkanaal = additional.verkoopkanaal;
          contextState.questionsAnswered.push('verkoopkanaal');
        }
        if (additional.ervaring) {
          contextState.gathered.ervaring = additional.ervaring;
          contextState.questionsAnswered.push('ervaring');
        }
        
        console.log(`[API] Pre-filled context for user ${userIdForContext}:`, Object.keys(contextState.gathered).join(', '));
      }
    } catch (contextError: any) {
      console.warn("[API] Could not load existing context:", contextError.message);
    }
    
    const session: Session = {
      id: sessionId,
      mode: "CONTEXT_GATHERING",
      techniqueId,
      techniqueName,
      conversationHistory: [],
      contextState,
      isExpert,
      createdAt: new Date(),
      userId,
      userName,
      viewMode: viewMode === 'admin' ? 'admin' : 'user'
    };
    
    sessions.set(sessionId, session);
    
    // Generate opening message using FULL engine
    const coachContext: CoachContext = {
      userId,
      techniqueId,
      techniqueName,
      userName,
      viewMode: viewMode === 'admin' ? 'admin' : 'user'
    };
    
    // For admin mode, skip context gathering entirely — go straight to COACH_CHAT
    const isAdminSession = viewMode === 'admin';
    const nextSlot = isAdminSession ? null : getNextSlotKey(contextState);
    let initialMessage: string;
    
    let richContent: any[] | undefined;
    let onboardingStatus: any | undefined;

    if (isAdminSession) {
      session.mode = "COACH_CHAT";
      session.contextState.isComplete = true;
      const openingResult = await generateCoachOpening(coachContext);
      initialMessage = openingResult.message;
      richContent = openingResult.richContent;
      onboardingStatus = openingResult.onboardingStatus;
    } else if (nextSlot) {
      const questionResult = await generateQuestionForSlot(
        nextSlot,
        contextState.gathered,
        techniqueId,
        []
      );
      initialMessage = questionResult.message;
      session.contextState.currentQuestionKey = nextSlot;
    } else {
      // No context gathering needed, go straight to coaching
      session.mode = "COACH_CHAT";
      const openingResult = await generateCoachOpening(coachContext);
      initialMessage = openingResult.message;
    }
    
    // Add to conversation history
    session.conversationHistory.push({
      role: "assistant",
      content: initialMessage
    });
    
    // Save session to database for persistence
    await saveSessionToDb(session);
    
    console.log(`[API] Created FULL session ${sessionId} for technique ${techniqueId} (${techniqueName})`);
    console.log(`[API] Mode: ${session.mode}, Next slot: ${nextSlot || 'N/A'}`);
    
    res.json({
      sessionId,
      phase: session.mode,
      initialMessage,
      richContent,
      onboardingStatus,
      debug: isExpert ? {
        engine: "V2-FULL",
        technique: techniqueName,
        contextState: {
          nextSlot,
          questionsAnswered: contextState.questionsAnswered,
          gathered: contextState.gathered
        }
      } : undefined
    });
    
  } catch (error: any) {
    console.error("[API] Error creating session:", error.message, error.stack);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/v2/sessions/stream - Streaming version of session creation
app.post("/api/v2/sessions/stream", async (req, res) => {
  try {
    const { techniqueId = "general", mode = "COACH_CHAT", isExpert = false, modality = "chat", viewMode = "user", userId } = req.body;
    
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const techniqueName = techniqueId !== 'general' ? (() => {
      try {
        const techData = JSON.parse(require('fs').readFileSync(require('path').join(process.cwd(), 'config/ssot/technieken_index.json'), 'utf-8'));
        return techData.technieken?.[techniqueId]?.naam || techniqueId;
      } catch { return techniqueId; }
    })() : '';

    const contextState = {
      gathered: { sector: '', product: '', klant_type: '', verkoopkanaal: '', ervaring: '' },
      questionsAnswered: [] as string[],
      currentQuestionKey: null as string | null,
      isComplete: viewMode === 'admin',
      startTime: Date.now()
    };

    if (userId) {
      try {
        const { createClient } = await import('@supabase/supabase-js');
        const supabaseUrl = process.env.SUPABASE_URL;
        const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        if (supabaseUrl && supabaseKey) {
          const supabase = createClient(supabaseUrl, supabaseKey);
          const { data } = await supabase.from('user_context').select('sector, product, klant_type').eq('user_id', userId).single();
          if (data) {
            if (data.sector) { contextState.gathered.sector = data.sector; contextState.questionsAnswered.push('sector'); }
            if (data.product) { contextState.gathered.product = data.product; contextState.questionsAnswered.push('product'); }
            if (data.klant_type) { contextState.gathered.klant_type = data.klant_type; contextState.questionsAnswered.push('klant_type'); }
          }
        }
      } catch (e: any) {
        console.warn("[API] Could not load context for streaming session:", e.message);
      }
    }

    const session: any = {
      id: sessionId,
      techniqueId,
      techniqueName,
      mode: viewMode === 'admin' ? 'COACH_CHAT' : mode,
      isExpert,
      modality,
      viewMode,
      userId: userId || null,
      userName: null,
      conversationHistory: [],
      contextState,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    sessions.set(sessionId, session);

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();

    let clientDisconnected = false;
    req.on('close', () => { clientDisconnected = true; });

    res.write(`data: ${JSON.stringify({ type: "session", sessionId })}\n\n`);

    const { generateCoachOpeningStream } = await import('./v2/coach-engine');

    const coachContext: CoachContext = {
      userId: session.userId,
      techniqueId: session.techniqueId,
      techniqueName: session.techniqueName,
      userName: session.userName,
      sector: contextState.gathered.sector,
      product: contextState.gathered.product,
      klantType: contextState.gathered.klant_type,
      sessionContext: contextState.gathered,
      viewMode: session.viewMode || 'user',
    };

    await generateCoachOpeningStream(
      coachContext,
      (token) => {
        if (!clientDisconnected) {
          res.write(`data: ${JSON.stringify({ type: "token", content: token })}\n\n`);
        }
      },
      async (fullText, meta) => {
        session.conversationHistory.push({ role: "assistant", content: fullText });
        await saveSessionToDb(session);
        
        res.write(`data: ${JSON.stringify({ 
          type: "done",
          onboardingStatus: meta?.onboardingStatus || null,
        })}\n\n`);
        res.end();
      },
      (error) => {
        console.error("[API] Streaming session error:", error.message);
        res.write(`data: ${JSON.stringify({ type: "error", error: error.message })}\n\n`);
        res.end();
      }
    );
    
  } catch (error: any) {
    console.error("[API] Streaming session setup error:", error.message, error.stack);
    if (!res.headersSent) {
      res.status(500).json({ error: error.message });
    } else {
      res.write(`data: ${JSON.stringify({ type: "error", error: error.message })}\n\n`);
      res.end();
    }
  }
});

// Send a message - FULL ENGINE with validation loop
app.post("/api/v2/message", async (req, res) => {
  try {
    const { sessionId, content, isExpert = false } = req.body;
    
    if (!sessionId) {
      return res.status(400).json({ error: "sessionId is required" });
    }
    if (!content) {
      return res.status(400).json({ error: "content is required" });
    }
    
    const session = sessions.get(sessionId);
    if (!session) {
      return res.status(404).json({ error: "Session not found. Please start a new session." });
    }
    
    // Add user message to history
    session.conversationHistory.push({
      role: "user",
      content
    });
    
    let response: string;
    let debug: any = {};
    let validatorInfo: any = null;
    
    // Route to the correct engine based on mode
    switch (session.mode) {
      case "CONTEXT_GATHERING": {
        // Process the answer for current slot
        const currentSlot = session.contextState.currentQuestionKey;
        
        if (currentSlot) {
          // Update context state with the answer
          session.contextState = processAnswer(
            session.contextState,
            currentSlot,
            content,
            session.isExpert ? 2 : undefined // Expert mode: limit to 2 slots
          );
          
          // Save updated context to Supabase for persistence
          const userIdToSave = session.userId || 'anonymous';
          const gathered = session.contextState.gathered;
          try {
            await supabase
              .from('user_context')
              .upsert({
                id: nanoid(),
                user_id: userIdToSave,
                sector: gathered.sector || null,
                product: gathered.product || null,
                klant_type: gathered.klant_type || null,
                additional_context: gathered.verkoopkanaal || gathered.ervaring 
                  ? { verkoopkanaal: gathered.verkoopkanaal, ervaring: gathered.ervaring }
                  : {},
                updated_at: new Date().toISOString()
              }, { onConflict: 'user_id' });
            console.log(`[API] Saved context for user ${userIdToSave}: ${currentSlot}=${gathered[currentSlot]}`);
          } catch (saveError: any) {
            console.warn("[API] Could not save context:", saveError.message);
          }
        }
        
        // Check if context gathering is complete
        if (session.contextState.isComplete) {
          // Transition to COACH_CHAT
          session.mode = "COACH_CHAT";
          console.log(`[API] Session ${sessionId} transitioning to COACH_CHAT`);
          
          // Generate coach opening with gathered context
          const coachContext: CoachContext = {
            userId: session.userId,
            techniqueId: session.techniqueId,
            techniqueName: session.techniqueName,
            userName: session.userName,
            sector: session.contextState.gathered.sector,
            product: session.contextState.gathered.product,
            klantType: session.contextState.gathered.klant_type,
            sessionContext: session.contextState.gathered,
            viewMode: session.viewMode || 'user',
            contextGatheringHistory: session.conversationHistory.map(m => ({
              role: m.role === 'user' ? 'seller' as const : 'customer' as const,
              content: m.content
            }))
          };
          
          const openingResult = await generateCoachOpening(coachContext);
          response = openingResult.message;
          validatorInfo = openingResult.validatorInfo;
          
          debug = {
            phase: "COACH_CHAT",
            transitionedFrom: "CONTEXT_GATHERING",
            gatheredContext: session.contextState.gathered,
            ragDocsFound: openingResult.debug?.documentsFound || 0,
            wasRepaired: openingResult.debug?.wasRepaired || false
          };
        } else {
          // Continue context gathering - ask next question
          const nextSlot = getNextSlotKey(session.contextState);
          
          if (nextSlot) {
            session.contextState.currentQuestionKey = nextSlot;
            
            const conversationHistory: ConversationMessage[] = session.conversationHistory.map(m => ({
              role: m.role as 'user' | 'assistant',
              content: m.content
            }));
            
            const questionResult = await generateQuestionForSlot(
              nextSlot,
              session.contextState.gathered,
              session.techniqueId,
              conversationHistory
            );
            
            response = questionResult.message;
            validatorInfo = questionResult.validatorInfo;
          } else {
            // No more slots but not complete - edge case
            response = "Bedankt voor de informatie! Laten we nu verder gaan met de training.";
            session.mode = "COACH_CHAT";
          }
          
          debug = {
            phase: "CONTEXT_GATHERING",
            contextComplete: session.contextState.isComplete,
            gatheredFields: Object.keys(session.contextState.gathered).filter(k => session.contextState.gathered[k]),
            nextSlot: session.contextState.currentQuestionKey,
            questionsAnswered: session.contextState.questionsAnswered
          };
        }
        break;
      }
        
      case "COACH_CHAT": {
        // Use FULL coach engine with RAG and validation
        const coachContext: CoachContext = {
          userId: session.userId,
          techniqueId: session.techniqueId,
          techniqueName: session.techniqueName,
          userName: session.userName,
          sector: session.contextState.gathered.sector,
          product: session.contextState.gathered.product,
          klantType: session.contextState.gathered.klant_type,
          sessionContext: session.contextState.gathered,
          viewMode: session.viewMode || 'user'
        };
        
        const coachResult = await generateCoachResponse(
          content,
          session.conversationHistory,
          coachContext
        );
        
        response = coachResult.message;
        validatorInfo = coachResult.validatorInfo;
        
        debug = {
          phase: "COACH_CHAT",
          ragQuery: coachResult.debug?.ragQuery,
          ragDocsFound: coachResult.debug?.documentsFound || 0,
          searchTimeMs: coachResult.debug?.searchTimeMs || 0,
          wasRepaired: coachResult.debug?.wasRepaired || false,
          repairAttempts: coachResult.debug?.repairAttempts || 0,
          context: {
            sector: coachContext.sector,
            product: coachContext.product,
            klantType: coachContext.klantType
          }
        };
        break;
      }
        
      case "ROLEPLAY": {
        // Roleplay mode - similar to coach but with different persona
        const coachContext: CoachContext = {
          userId: session.userId,
          techniqueId: session.techniqueId,
          techniqueName: session.techniqueName,
          userName: session.userName,
          sector: session.contextState.gathered.sector,
          product: session.contextState.gathered.product,
          klantType: session.contextState.gathered.klant_type,
          sessionContext: session.contextState.gathered,
          viewMode: session.viewMode || 'user'
        };
        
        const roleplayResult = await generateCoachResponse(
          content,
          session.conversationHistory,
          coachContext
        );
        
        response = roleplayResult.message;
        validatorInfo = roleplayResult.validatorInfo;
        
        debug = {
          phase: "ROLEPLAY",
          ragDocsFound: roleplayResult.debug?.documentsFound || 0,
          wasRepaired: roleplayResult.debug?.wasRepaired || false
        };
        break;
      }
        
      default:
        response = "Onbekende sessie modus. Start een nieuwe sessie.";
    }
    
    // Add assistant response to history
    session.conversationHistory.push({
      role: "assistant",
      content: response
    });
    
    // Return response with optional debug info
    const result: any = { 
      response, 
      phase: session.mode,
      contextData: session.contextState.gathered
    };
    
    if (isExpert || session.isExpert) {
      result.debug = {
        ...debug,
        engine: "V2-FULL",
        persona: {
          behavior_style: "analyserend",
          buying_clock_stage: "market_research",
          difficulty_level: session.isExpert ? "bewuste_kunde" : "onbewuste_onkunde"
        },
        dynamics: session.mode === "ROLEPLAY" ? {
          rapport: 0.5,
          valueTension: 0.5,
          commitReadiness: 0.5
        } : null,
        context: {
          fase: parseInt(session.techniqueId?.split('.')[0]) || 1,
          sector: session.contextState.gathered.sector,
          product: session.contextState.gathered.product
        },
        validatorInfo: validatorInfo ? {
          mode: validatorInfo.mode,
          wasRepaired: validatorInfo.wasRepaired,
          validationLabel: validatorInfo.validationLabel,
          repairAttempts: validatorInfo.repairAttempts
        } : null
      };
    }
    
    // Save updated session to database
    await saveSessionToDb(session);
    
    res.json(result);
    
  } catch (error: any) {
    console.error("[API] Error processing message:", error.message, error.stack);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/v2/session/message - Frontend-compatible message endpoint
// Maps frontend field names and includes full debug info with customerDynamics
app.post("/api/v2/session/message", async (req, res) => {
  try {
    const { sessionId, message, debug: enableDebug = false, expertMode = false, systemContext } = req.body;
    
    if (!sessionId) {
      return res.status(400).json({ error: "sessionId is required" });
    }
    if (!message) {
      return res.status(400).json({ error: "message is required" });
    }
    
    // Try to get session from memory, fallback to database
    let session = sessions.get(sessionId);
    if (!session) {
      session = await loadSessionFromDb(sessionId) ?? undefined;
      if (session) {
        sessions.set(session.id, session);
      }
    }
    
    if (!session) {
      return res.status(404).json({ error: "Session not found. Please start a new session." });
    }
    
    if (systemContext) {
      session.conversationHistory.push({
        role: "system",
        content: systemContext
      });
    }
    
    // Add user message to history
    session.conversationHistory.push({
      role: "user",
      content: message
    });
    
    let responseText: string;
    let promptsUsed: { systemPrompt: string; userPrompt?: string } | undefined;
    let ragDocuments: any[] = [];
    let validatorInfo: any = null;
    
    // Calculate dynamic customerDynamics based on conversation
    const turnCount = session.conversationHistory.filter(m => m.role === 'user').length;
    const baseRapport = 50;
    const rapportGrowth = Math.min(turnCount * 5, 30); // Max +30% growth
    const customerDynamics = {
      rapport: Math.min(baseRapport + rapportGrowth, 85),
      valueTension: 50 + Math.floor(Math.random() * 20) - 10, // Slight variation
      commitReadiness: Math.min(30 + turnCount * 8, 70)
    };
    
    // Route to the correct engine based on mode
    const isAdminView = session.viewMode === 'admin';

    let msgIntentResult: ReturnType<typeof detectIntent> | null = null;
    let hasTechniqueOrContentIntent = false;

    msgIntentResult = detectIntent(
      message,
      session.conversationHistory.map(m => ({ role: m.role, content: m.content })),
      session.techniqueId,
      undefined
    );

    hasTechniqueOrContentIntent = !!(msgIntentResult.detectedTechniqueId || 
      msgIntentResult.shouldSuggestVideo || 
      msgIntentResult.contentSuggestions.some(s => s.type === 'webinar'));

    if (hasTechniqueOrContentIntent) {
      console.log(`[API] Intent detected (${isAdminView ? 'admin' : 'user'}): technique=${msgIntentResult.detectedTechniqueName} (${msgIntentResult.detectedTechniqueId}), wantsVideo=${msgIntentResult.shouldSuggestVideo}, mode=${session.mode}`);
    }

    const shouldShortCircuitToCoach = isAdminView && session.mode === 'CONTEXT_GATHERING' && hasTechniqueOrContentIntent;

    switch (shouldShortCircuitToCoach ? 'COACH_SHORTCIRCUIT' : session.mode) {
      case "CONTEXT_GATHERING": {
        const currentSlot = session.contextState.currentQuestionKey;
        
        if (currentSlot) {
          session.contextState = processAnswer(
            session.contextState,
            currentSlot,
            message,
            session.isExpert ? 2 : undefined
          );
        }
        
        if (session.contextState.isComplete) {
          session.mode = "COACH_CHAT";
          
          const coachContext: CoachContext = {
            userId: session.userId,
            techniqueId: session.techniqueId,
            techniqueName: session.techniqueName,
            userName: session.userName,
            sector: session.contextState.gathered.sector,
            product: session.contextState.gathered.product,
            klantType: session.contextState.gathered.klant_type,
            sessionContext: session.contextState.gathered,
            viewMode: session.viewMode || 'user',
            contextGatheringHistory: session.conversationHistory.map(m => ({
              role: m.role === 'user' ? 'seller' as const : 'customer' as const,
              content: m.content
            }))
          };
          
          const openingResult = await generateCoachOpening(coachContext);
          responseText = openingResult.message;
          validatorInfo = openingResult.validatorInfo;
          promptsUsed = openingResult.promptsUsed;
          ragDocuments = openingResult.ragContext || [];
        } else {
          const nextSlot = getNextSlotKey(session.contextState);
          
          if (nextSlot) {
            session.contextState.currentQuestionKey = nextSlot;
            
            const conversationHistory: ConversationMessage[] = session.conversationHistory.map(m => ({
              role: m.role as 'user' | 'assistant',
              content: m.content
            }));
            
            const questionResult = await generateQuestionForSlot(
              nextSlot,
              session.contextState.gathered,
              session.techniqueId,
              conversationHistory
            );
            
            responseText = questionResult.message;
            promptsUsed = questionResult.promptsUsed;
            ragDocuments = [];
          } else {
            responseText = "Ik heb alle benodigde context. Laten we beginnen met de coaching.";
            session.mode = "COACH_CHAT";
          }
        }
        break;
      }
      
      case "COACH_SHORTCIRCUIT":
      case "COACH_CHAT":
      case "ROLEPLAY": {
        const effectiveTechId = msgIntentResult?.detectedTechniqueId || session.techniqueId;
        const effectiveTechName = msgIntentResult?.detectedTechniqueName || session.techniqueName;

        const coachContext: CoachContext = {
          userId: session.userId,
          techniqueId: effectiveTechId,
          techniqueName: effectiveTechName,
          userName: session.userName,
          sector: session.contextState.gathered.sector,
          product: session.contextState.gathered.product,
          klantType: session.contextState.gathered.klant_type,
          sessionContext: session.contextState.gathered,
          viewMode: session.viewMode || 'user',
          contextGatheringHistory: session.conversationHistory.map(m => ({
            role: m.role === 'user' ? 'seller' as const : 'customer' as const,
            content: m.content
          })),
          ...(msgIntentResult ? {
            detectedTechniqueId: msgIntentResult.detectedTechniqueId,
            detectedTechniqueName: msgIntentResult.detectedTechniqueName,
            userWantsVideo: msgIntentResult.shouldSuggestVideo,
            userWantsWebinar: msgIntentResult.contentSuggestions.some(s => s.type === 'webinar'),
          } : {}),
        };
        
        if (isAdminView) {
          try {
            const { getOnboardingStatusFromDB, getOnboardingItemData, loadOnboardingPromptConfig } = await import('./v2/coach-engine');
            const obStatus = await getOnboardingStatusFromDB(session.userId || 'hugo');
            if (!obStatus.isComplete && obStatus.nextItem) {
              const lowerMsg = message.toLowerCase().trim();
              const isStartIntent = /^(ja|yes|start|laten we|ga maar|ok|oké|begin|verder|door|go|let'?s go|klaar|ready|absolutely|zeker|natuurlijk|prima|goed|top|volgende|next)/i.test(lowerMsg) 
                || /start/i.test(lowerMsg) || /verder/i.test(lowerMsg) || /volgende/i.test(lowerMsg);
              
              if (isStartIntent) {
                const obConfig = loadOnboardingPromptConfig();
                const itemData = getOnboardingItemData(obStatus.nextItem.module, obStatus.nextItem.key);
                if (itemData && obConfig) {
                  const ni = obStatus.nextItem;
                  let onboardingInstruction = '';
                  if (ni.module === 'technieken') {
                    onboardingInstruction = obConfig.technique_review_intro
                      .replace('{nummer}', itemData.nummer || ni.key)
                      .replace('{naam}', itemData.naam || ni.name)
                      .replace('{fase}', itemData.fase || '');
                    onboardingInstruction += "\n\nPresenteer deze techniek aan Hugo met de volgende velden: " + obConfig.technique_fields_to_show.join(', ') + ".";
                    onboardingInstruction += "\nGebruik de data hieronder:\n" + JSON.stringify(itemData, null, 2);
                  } else {
                    onboardingInstruction = obConfig.attitude_review_intro
                      .replace('{id}', itemData.id || ni.key)
                      .replace('{naam}', itemData.naam || ni.name);
                    onboardingInstruction += "\n\nPresenteer deze klanthouding aan Hugo met de volgende velden: " + obConfig.attitude_fields_to_show.join(', ') + ".";
                    onboardingInstruction += "\nGebruik de data hieronder:\n" + JSON.stringify(itemData, null, 2);
                  }
                  onboardingInstruction += "\n\nVraag Hugo om deze te beoordelen: goedkeuren (👍) of feedback geven (👎).";
                  onboardingInstruction += "\n\n" + obConfig.onboarding_system_instruction;
                  
                  session.conversationHistory.push({
                    role: "system",
                    content: onboardingInstruction
                  });
                  console.log(`[API] Injected onboarding context for ${ni.module}/${ni.key} (start intent detected)`);
                }
              } else {
                console.log(`[API] Onboarding active but no start intent detected in: "${lowerMsg.substring(0, 50)}"`);
              }
            }
          } catch (err: any) {
            console.log('[API] Onboarding context injection skipped:', err.message);
          }
        }
        
        const coachHistory: CoachMessage[] = session.conversationHistory.map(m => ({
          role: m.role as 'user' | 'assistant',
          content: m.content
        }));
        
        const coachResult = await generateCoachResponse(message, coachHistory, coachContext);
        responseText = coachResult.message;
        validatorInfo = coachResult.validatorInfo;
        promptsUsed = coachResult.promptsUsed;
        ragDocuments = coachResult.ragContext || [];

        if (shouldShortCircuitToCoach) {
          session.mode = "COACH_CHAT";
          session.contextState.isComplete = true;
        }
        break;
      }
      
      default:
        responseText = "Onbekende sessiemodus.";
    }
    
    // Add assistant response to history
    session.conversationHistory.push({
      role: "assistant",
      content: responseText
    });
    
    // Save updated session
    await saveSessionToDb(session);
    
    let richContent: any[] = [];

    if (msgIntentResult && msgIntentResult.contentSuggestions.length > 0) {
      const rcTechId = msgIntentResult.detectedTechniqueId || session.techniqueId;
      const rcTechName = msgIntentResult.detectedTechniqueName || session.techniqueName;
      try {
        const richResponse = await buildRichResponse(
          responseText,
          msgIntentResult,
          {
            techniqueId: rcTechId,
            techniqueName: rcTechName,
            phase: session.mode,
            userId: session.userId,
            gatheredContext: session.contextState.gathered,
          }
        );
        if (richResponse.richContent && richResponse.richContent.length > 0) {
          richContent = richResponse.richContent;
        }
      } catch (err: any) {
        console.log('[API] Rich content from intent skipped:', err.message);
      }
    }

    if (richContent.length === 0 && (session.mode === 'COACH_CHAT' || session.mode === 'ROLEPLAY')) {
      try {
        const { getSlidesForTechnique, buildEpicSlideRichContent } = await import('./v2/epic-slides-service');
        const matchedSlides = getSlidesForTechnique(session.techniqueId);
        if (matchedSlides.length > 0) {
          richContent = matchedSlides.map(slide =>
            buildEpicSlideRichContent(slide, session.contextState.gathered)
          );
        }
      } catch (err: any) {
        console.log('[API] Rich content generation skipped:', err.message);
      }
    }
    
    // Build response matching frontend expectations (SendMessageResponse interface)
    const currentPhase = parseInt(session.techniqueId?.split('.')[0]) || 1;
    const response: any = {
      response: responseText,  // Frontend expects 'response', not 'message'
      phase: session.mode,
      contextData: {
        sector: session.contextState.gathered.sector,
        product: session.contextState.gathered.product,
        klant_type: session.contextState.gathered.klant_type,
        verkoopkanaal: session.contextState.gathered.verkoopkanaal
      },
      debug: {
        phase: session.mode,
        signal: "neutraal",
        detectedTechniques: [],
        evaluation: "neutraal",
        contextComplete: session.contextState.isComplete,
        gatheredFields: Object.keys(session.contextState.gathered).filter(k => session.contextState.gathered[k]),
        persona: {
          behavior_style: "analyserend",
          buying_clock_stage: "market_research",
          difficulty_level: session.isExpert ? "bewuste_kunde" : "onbewuste_onkunde"
        },
        context: {
          fase: currentPhase,
          gathered: session.contextState.gathered
        },
        customerDynamics: customerDynamics,
        aiDecision: {
          epicFase: `Fase ${currentPhase}`,
          evaluatie: "neutraal"
        },
        ragDocuments: ragDocuments,
        promptsUsed: promptsUsed || { systemPrompt: "Geen prompt beschikbaar", userPrompt: "" },
        validatorInfo: validatorInfo ? {
          mode: validatorInfo.mode,
          wasRepaired: validatorInfo.wasRepaired,
          validationLabel: validatorInfo.validationLabel
        } : null
      },
      promptsUsed: promptsUsed || { systemPrompt: "Geen prompt beschikbaar", userPrompt: "" },
      richContent: richContent.length > 0 ? richContent : undefined
    };
    
    res.json(response);
    
  } catch (error: any) {
    console.error("[API] Error in session/message:", error.message, error.stack);
    res.status(500).json({ error: error.message });
  }
});

// Get session info
app.get("/api/v2/sessions/:sessionId", async (req, res) => {
  try {
    let session = sessions.get(req.params.sessionId);
    
    // Try to load from database if not in memory
    if (!session) {
      session = await loadSessionFromDb(req.params.sessionId) ?? undefined;
      if (session) {
        sessions.set(session.id, session);
      }
    }
    
    if (!session) {
      return res.status(404).json({ error: "Session not found" });
    }
    
    res.json({
      id: session.id,
      mode: session.mode,
      techniqueId: session.techniqueId,
      techniqueName: session.techniqueName,
      contextData: session.contextState.gathered,
      contextComplete: session.contextState.isComplete,
      messageCount: session.conversationHistory.length,
      createdAt: session.createdAt
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Delete session
app.delete("/api/v2/sessions/:sessionId", async (req, res) => {
  try {
    const deleted = sessions.delete(req.params.sessionId);
    if (!deleted) {
      return res.status(404).json({ error: "Session not found" });
    }
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get session stats
app.get("/api/sessions/stats", async (req, res) => {
  try {
    const activeSessions = sessions.size;
    res.json({
      total: activeSessions,
      active: activeSessions,
      excellentQuality: 0,
      averageScore: 0,
      needsImprovement: 0
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get all sessions list (from Supabase)
app.get("/api/sessions", async (req, res) => {
  try {
    const userId = req.query.userId as string;
    
    // Query Supabase for sessions
    let query = supabase
      .from('v2_sessions')
      .select('id, user_id, technique_id, current_mode, phase, turn_number, conversation_history, context, total_score, expert_mode, events, customer_dynamics, epic_phase, created_at, updated_at, is_active')
      .eq('is_active', 1)
      .order('created_at', { ascending: false })
      .limit(100);
    
    if (userId) {
      query = query.eq('user_id', userId);
    }
    
    const { data: rows, error } = await query;
    
    if (error) {
      console.error("[API] Supabase error fetching sessions:", error.message);
      return res.status(500).json({ error: error.message });
    }
    
    const result = { rows: rows || [] };
    
    const sessionList = result.rows.map(row => {
      const conversationHistory = row.conversation_history || [];
      const context = row.context || {};
      const events = row.events || [];
      const customerDynamics = row.customer_dynamics || {};
      const epicPhase = row.epic_phase || 'explore';
      const technique = getTechnique(row.technique_id);
      
      // Calculate duration from first to last message if available
      const duration = conversationHistory.length > 0 
        ? `${Math.ceil(conversationHistory.length * 0.5)}:00`
        : "0:00";
      
      // Calculate score (0-100 based on turn count and phase)
      const score = Math.min(100, Math.round(50 + row.turn_number * 5 + (row.phase >= 2 ? 20 : 0)));
      
      // Build debug info per message by matching with events
      const transcript = conversationHistory.map((msg: any, idx: number) => {
        // Find matching event for this message index (seller messages are odd indices in roleplay)
        const turnNumber = Math.floor(idx / 2) + 1;
        const matchingEvent = events.find((e: any) => e.turnNumber === turnNumber);
        
        // Determine signal based on evaluation or default
        let signal: "positief" | "neutraal" | "negatief" = "neutraal";
        if (matchingEvent) {
          if (matchingEvent.moveRating === 'positive' || matchingEvent.correct) signal = "positief";
          else if (matchingEvent.moveRating === 'negative' || matchingEvent.incorrect) signal = "negatief";
        }
        
        // Build debug info
        const debugInfo: any = {
          signal,
          expectedTechnique: technique?.nummer || row.technique_id,
          detectedTechnique: matchingEvent?.moveId || matchingEvent?.techniqueId || null,
          context: {
            fase: row.phase,
            gathered: context.gathered || {}
          },
          customerDynamics: {
            rapport: customerDynamics.rapport || 50,
            valueTension: customerDynamics.valueTension || 50,
            commitReadiness: customerDynamics.commitReadiness || 0
          },
          aiDecision: {
            epicFase: epicPhase,
            evaluatie: matchingEvent?.feedback || matchingEvent?.evaluation || null
          }
        };
        
        return {
          speaker: msg.role === 'assistant' || msg.role === 'customer' ? 'AI Coach' : 'Verkoper',
          time: `${Math.floor(idx * 5 / 60)}:${String(idx * 5 % 60).padStart(2, '0')}`,
          text: msg.content,
          debugInfo
        };
      });
      
      // Extract feedback from events
      const strengths: string[] = [];
      const improvements: string[] = [];
      events.forEach((e: any) => {
        if (e.feedback && e.correct) strengths.push(e.feedback);
        if (e.feedback && !e.correct) improvements.push(e.feedback);
      });
      
      return {
        id: row.id,
        mode: row.current_mode,
        techniqueId: row.technique_id,
        techniqueName: technique?.naam || row.technique_id,
        techniqueNummer: technique?.nummer || row.technique_id.split('.').slice(0, 2).join('.'),
        fase: technique?.fase || parseInt(row.technique_id?.split('.')[0]) || 1,
        messageCount: conversationHistory.length,
        turnNumber: row.turn_number,
        context: context,
        score,
        duration,
        quality: score >= 80 ? 'excellent' : score >= 60 ? 'good' : 'needs-improvement',
        isExpert: row.expert_mode === 1,
        isActive: row.is_active === 1,
        userId: row.user_id,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        transcript,
        feedback: {
          strengths: strengths.slice(0, 5),
          improvements: improvements.slice(0, 5)
        }
      };
    });
    
    res.json({
      sessions: sessionList,
      total: sessionList.length
    });
  } catch (error: any) {
    console.error("[API] Error fetching sessions:", error.message);
    res.status(500).json({ error: error.message });
  }
});

// Get sessions for a specific user (user view) - Supabase
app.get("/api/user/sessions", async (req, res) => {
  try {
    const userId = req.query.userId as string || 'anonymous';
    
    const { data: rows, error } = await supabase
      .from('v2_sessions')
      .select('id, technique_id, current_mode, phase, turn_number, conversation_history, context, total_score, created_at, updated_at')
      .eq('user_id', userId)
      .eq('is_active', 1)
      .order('created_at', { ascending: false })
      .limit(50);
    
    if (error) {
      console.error("[API] Supabase error fetching user sessions:", error.message);
      return res.status(500).json({ error: error.message });
    }
    
    const sessionList = (rows || []).map(row => {
      const conversationHistory = row.conversation_history || [];
      const context = row.context || {};
      const technique = getTechnique(row.technique_id);
      
      const duration = conversationHistory.length > 0 
        ? `${Math.ceil(conversationHistory.length * 0.5)}:00`
        : "0:00";
      
      const score = Math.min(100, Math.round(50 + row.turn_number * 5 + (row.phase >= 2 ? 20 : 0)));
      
      return {
        id: row.id,
        nummer: technique?.nummer || row.technique_id,
        naam: technique?.naam || row.technique_id,
        fase: technique?.fase || parseInt(row.technique_id?.split('.')[0]) || 1,
        type: 'ai-chat' as const, // TODO: detect from session metadata
        score,
        quality: score >= 80 ? 'excellent' : score >= 60 ? 'good' : 'needs-improvement',
        duration,
        date: new Date(row.created_at).toISOString().split('T')[0],
        time: new Date(row.created_at).toTimeString().split(' ')[0].substring(0, 5),
        transcript: conversationHistory.map((msg: any, idx: number) => ({
          speaker: msg.role === 'assistant' ? 'AI Coach' : 'Verkoper',
          time: `${Math.floor(idx * 5 / 60)}:${String(idx * 5 % 60).padStart(2, '0')}`,
          text: msg.content
        }))
      };
    });
    
    res.json({
      sessions: sessionList,
      total: sessionList.length
    });
  } catch (error: any) {
    console.error("[API] Error fetching user sessions:", error.message);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/admin/sessions/process-recording - Trigger webinar recording processing pipeline
// Used by AdminLiveSessions.tsx "Verwerk opname" button
app.post("/api/admin/sessions/process-recording", async (req, res) => {
  try {
    const { sessionId } = req.body;
    if (!sessionId) return res.status(400).json({ error: "sessionId required" });

    // Fetch session from Supabase
    const { data: sessionRow, error: fetchErr } = await supabase
      .from('live_sessions').select('*').eq('id', sessionId).single();

    if (fetchErr || !sessionRow) {
      return res.status(404).json({ error: "Session not found" });
    }

    const recordingUrl = sessionRow.daily_recording_url || sessionRow.video_url;
    if (!recordingUrl) {
      return res.status(400).json({ error: "Geen opname URL gevonden voor deze sessie" });
    }

    const VIDEO_PROCESSOR_URL = process.env.VIDEO_PROCESSOR_URL || 'http://localhost:3001';
    const VIDEO_PROCESSOR_SECRET = process.env.VIDEO_PROCESSOR_SECRET;
    const nodeFetch = (await import('node-fetch')).default as any;

    const response = await nodeFetch(`${VIDEO_PROCESSOR_URL}/api/webinar-recordings/trigger-process`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${VIDEO_PROCESSOR_SECRET}`
      },
      body: JSON.stringify({
        sessionId,
        recordingUrl,
        title: sessionRow.title
      })
    });

    const result = await response.json();
    res.json(result);
  } catch (error: any) {
    console.error("[API] process-recording error:", error.message);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/live-sessions/recordings - get all webinar sessions with processed Mux recordings
// Used by LiveCoaching.tsx "Opgenomen Webinars" section
app.get("/api/live-sessions/recordings", async (req, res) => {
  try {
    const { data: rows, error } = await supabase
      .from('live_sessions')
      .select('*')
      .eq('status', 'ended')
      .order('scheduled_date', { ascending: false });
    
    if (error) throw error;
    
    // Filter to only sessions with a processed mux_playback_id (column may not exist yet → undefined check)
    const processed = (rows || []).filter((s: any) => s.mux_playback_id);
    
    const recordings = processed.map((s: any) => ({
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
    console.error("[API] Error fetching live session recordings:", error.message);
    res.status(500).json({ error: error.message });
  }
});

// ===========================================
// USER CONTEXT ENDPOINTS - DATABASE BACKED
// ===========================================

// Get user context from Supabase
app.get("/api/user/context", async (req, res) => {
  try {
    const userId = req.query.userId as string || "default";
    
    const { data: row, error } = await supabase
      .from('user_context')
      .select('sector, product, klant_type, setting, additional_context')
      .eq('user_id', userId)
      .single();
    
    if (error || !row) {
      return res.json({ success: true, context: {} });
    }
    
    const context = {
      sector: row.sector,
      product: row.product,
      klantType: row.klant_type,
      setting: row.setting,
      ...(row.additional_context || {})
    };
    
    console.log("[API] Loaded user context for", userId, ":", Object.keys(context).filter(k => context[k as keyof typeof context]).join(", "));
    res.json({ success: true, context });
  } catch (error: any) {
    console.error("[API] Error loading user context:", error.message);
    res.status(500).json({ error: error.message });
  }
});

// Save user context to Supabase
app.post("/api/user/context", async (req, res) => {
  try {
    const { userId = "default", context } = req.body;
    
    // Extract known fields and additional context
    const { sector, product, klantType, setting, ...additional } = context;
    
    // Upsert the context to Supabase
    const { error: upsertError } = await supabase
      .from('user_context')
      .upsert({
        id: nanoid(),
        user_id: userId,
        sector: sector || null,
        product: product || null,
        klant_type: klantType || null,
        setting: setting || null,
        additional_context: Object.keys(additional).length > 0 ? additional : {},
        updated_at: new Date().toISOString()
      }, { onConflict: 'user_id' });
    
    if (upsertError) {
      console.error("[API] Supabase error saving user context:", upsertError.message);
      return res.status(500).json({ error: upsertError.message });
    }
    
    // Fetch updated context
    const { data: row } = await supabase
      .from('user_context')
      .select('sector, product, klant_type, setting, additional_context')
      .eq('user_id', userId)
      .single();
    
    const updatedContext = {
      sector: row?.sector,
      product: row?.product,
      klantType: row?.klant_type,
      setting: row?.setting,
      ...(row?.additional_context || {})
    };
    
    console.log("[API] Saved user context for", userId);
    res.json({ success: true, context: updatedContext });
  } catch (error: any) {
    console.error("[API] Error saving user context:", error.message);
    res.status(500).json({ error: error.message });
  }
});

// ===========================================
// SESSION CONTROL ENDPOINTS
// ===========================================

// Start roleplay mode for existing session
app.post("/api/session/:sessionId/start-roleplay", async (req, res) => {
  try {
    const session = sessions.get(req.params.sessionId);
    if (!session) {
      return res.status(404).json({ error: "Session not found" });
    }
    
    // Transition to ROLEPLAY mode
    session.mode = "ROLEPLAY";
    
    // Generate roleplay opening
    const roleplayOpening = `Ik speel nu de rol van een klant. Je kunt de techniek "${session.techniqueName}" oefenen. Begin maar wanneer je klaar bent!`;
    
    session.conversationHistory.push({
      role: "assistant",
      content: roleplayOpening
    });
    
    res.json({
      success: true,
      phase: "ROLEPLAY",
      message: roleplayOpening
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Request feedback/debrief
app.post("/api/session/:sessionId/feedback", async (req, res) => {
  try {
    const session = sessions.get(req.params.sessionId);
    if (!session) {
      return res.status(404).json({ error: "Session not found" });
    }
    
    const turnCount = session.conversationHistory.filter(m => m.role === "user").length;
    
    const feedbackMessage = `
**Tussentijdse Feedback**

Je hebt ${turnCount} berichten gestuurd in deze sessie over "${session.techniqueName}".

**Sterke punten:**
- Je bent actief bezig met de techniek
- Je stelt vragen en zoekt naar verdieping

**Aandachtspunten:**
- Probeer de techniek concreet toe te passen
- Gebruik voorbeelden uit je eigen praktijk

Wil je doorgaan met oefenen of heb je een specifieke vraag?
`;
    
    session.conversationHistory.push({
      role: "assistant",
      content: feedbackMessage
    });
    
    res.json({
      success: true,
      phase: session.mode,
      feedback: feedbackMessage,
      stats: {
        turnCount,
        technique: session.techniqueName,
        contextComplete: session.contextState.isComplete
      }
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get evaluation/score
app.post("/api/session/:sessionId/evaluate", async (req, res) => {
  try {
    const session = sessions.get(req.params.sessionId);
    if (!session) {
      return res.status(404).json({ error: "Session not found" });
    }
    
    const turnCount = session.conversationHistory.filter(m => m.role === "user").length;
    const contextFields = Object.keys(session.contextState.gathered).filter(
      k => session.contextState.gathered[k]
    ).length;
    
    // Simple scoring based on engagement
    const engagementScore = Math.min(100, turnCount * 15 + contextFields * 10);
    const technicalScore = Math.min(100, 60 + Math.random() * 30);
    const overallScore = Math.round((engagementScore + technicalScore) / 2);
    
    const evaluation = {
      overallScore,
      scores: {
        engagement: Math.round(engagementScore),
        technical: Math.round(technicalScore),
        contextGathering: session.contextState.isComplete ? 100 : contextFields * 20
      },
      technique: session.techniqueName,
      recommendation: overallScore >= 70 
        ? "Goed gedaan! Je beheerst deze techniek redelijk goed."
        : "Blijf oefenen. Focus op het toepassen van de kernprincipes.",
      nextSteps: [
        "Oefen deze techniek in een echte verkoopsituatie",
        "Probeer de volgende techniek in de E.P.I.C. flow"
      ]
    };
    
    res.json({
      success: true,
      evaluation
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Reset session context (go back to CONTEXT_GATHERING)
app.post("/api/session/:sessionId/reset-context", async (req, res) => {
  try {
    const session = sessions.get(req.params.sessionId);
    if (!session) {
      return res.status(404).json({ error: "Session not found" });
    }
    
    // Reset context state
    session.contextState = createContextState(
      session.userId || "anonymous",
      session.id,
      session.techniqueId
    );
    session.mode = "CONTEXT_GATHERING";
    session.conversationHistory = [];
    
    // Generate new opening question
    const nextSlot = getNextSlotKey(session.contextState);
    let openingMessage = "Laten we opnieuw beginnen. ";
    
    if (nextSlot) {
      const questionResult = await generateQuestionForSlot(
        nextSlot,
        session.contextState.gathered,
        session.techniqueId,
        []
      );
      openingMessage += questionResult.message;
      session.contextState.currentQuestionKey = nextSlot;
    }
    
    session.conversationHistory.push({
      role: "assistant",
      content: openingMessage
    });
    
    res.json({
      success: true,
      phase: "CONTEXT_GATHERING",
      message: openingMessage
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get session turns/history
app.get("/api/session/:sessionId/turns", async (req, res) => {
  try {
    const session = sessions.get(req.params.sessionId);
    if (!session) {
      return res.status(404).json({ error: "Session not found" });
    }
    
    const turns = session.conversationHistory.map((msg, idx) => ({
      id: idx,
      role: msg.role,
      content: msg.content,
      timestamp: session.createdAt
    }));
    
    res.json({
      success: true,
      turns,
      total: turns.length
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ===========================================
// STREAMING ENDPOINT
// ===========================================

// Streaming message endpoint using Server-Sent Events
app.post("/api/session/:sessionId/message/stream", async (req, res) => {
  try {
    const { content, isExpert = false } = req.body;
    let session = sessions.get(req.params.sessionId);
    if (!session) {
      session = await loadSessionFromDb(req.params.sessionId) ?? undefined;
      if (session) sessions.set(session.id, session);
    }
    
    if (!session) {
      return res.status(404).json({ error: "Session not found" });
    }
    
    if (!content) {
      return res.status(400).json({ error: "content is required" });
    }
    
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();
    
    session.conversationHistory.push({
      role: "user",
      content
    });
    
    const coachContext: CoachContext = {
      userId: session.userId,
      techniqueId: session.techniqueId,
      techniqueName: session.techniqueName,
      userName: session.userName,
      sector: session.contextState.gathered.sector,
      product: session.contextState.gathered.product,
      klantType: session.contextState.gathered.klant_type,
      sessionContext: session.contextState.gathered,
      viewMode: session.viewMode || 'user'
    };
    
    await generateCoachResponseStream(
      content,
      session.conversationHistory,
      coachContext,
      (token) => {
        res.write(`data: ${JSON.stringify({ token })}\n\n`);
      },
      async (fullText, debug) => {
        session!.conversationHistory.push({
          role: "assistant",
          content: fullText
        });
        await saveSessionToDb(session!);
        
        res.write(`data: ${JSON.stringify({ 
          done: true,
          phase: session!.mode,
          debug: isExpert ? {
            ragDocsFound: debug?.documentsFound || 0,
          } : undefined
        })}\n\n`);
        res.end();
      },
      (error) => {
        console.error("[API] Streaming error:", error.message);
        res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
        res.end();
      }
    );
    
  } catch (error: any) {
    console.error("[API] Streaming setup error:", error.message);
    if (!res.headersSent) {
      res.status(500).json({ error: error.message });
    } else {
      res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
      res.end();
    }
  }
});

// ===========================================
// HEYGEN STREAMING AVATAR TOKEN
// ===========================================
app.post("/api/heygen/token", async (req, res) => {
  try {
    // Use the dedicated streaming avatar API key for proper avatar access
    const streamingApiKey = process.env.API_Heygen_streaming_interactive_avatar_ID;
    const streamingAvatarId = process.env.Heygen_streaming_interactive_avatar_ID;
    
    // Fallback to generic HEYGEN_API_KEY if streaming key not available
    const apiKey = streamingApiKey || process.env.HEYGEN_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: "HEYGEN_API_KEY not configured" });
    }

    const response = await fetch("https://api.heygen.com/v1/streaming.create_token", {
      method: "POST",
      headers: {
        "x-api-key": apiKey
      }
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error("[API] HeyGen token error:", errorData);
      return res.status(response.status).json({ error: "Failed to create HeyGen token" });
    }

    const data = await response.json();
    const token = data.data?.token || data.token;
    
    console.log("[API] HeyGen token created successfully, avatarId:", streamingAvatarId || "using default");
    
    // Return both token and avatarId for the frontend
    res.json({ 
      token, 
      avatarId: streamingAvatarId || null 
    });
  } catch (error: any) {
    console.error("[API] HeyGen token error:", error.message);
    res.status(500).json({ error: error.message });
  }
});

// ===========================================
// LIVEKIT TOKEN ENDPOINT (for voice sessions)
// ===========================================
app.post("/api/livekit/token", async (req, res) => {
  try {
    const { techniqueId } = req.body;
    
    const livekitUrl = process.env.LIVEKIT_URL;
    const apiKey = process.env.LIVEKIT_API_KEY;
    const apiSecret = process.env.LIVEKIT_API_SECRET;
    
    if (!livekitUrl || !apiKey || !apiSecret) {
      return res.status(500).json({ 
        error: "LiveKit not configured",
        message: "Set LIVEKIT_URL, LIVEKIT_API_KEY, and LIVEKIT_API_SECRET"
      });
    }
    
    const roomName = `hugo-${techniqueId || 'general'}-${Date.now()}`;
    const identity = `user-${Date.now()}`;
    
    const token = new AccessToken(apiKey, apiSecret, {
      identity,
      name: 'Trainee'
    });
    
    token.addGrant({
      room: roomName,
      roomJoin: true,
      canPublish: true,
      canSubscribe: true
    });
    
    const jwt = await token.toJwt();
    
    console.log(`[API] LiveKit token created for room: ${roomName}`);
    res.json({
      token: jwt,
      url: livekitUrl,
      roomName,
      identity
    });
  } catch (error: any) {
    console.error("[API] LiveKit token error:", error.message);
    res.status(500).json({ error: error.message });
  }
});

// ===========================================
// ROLEPLAY ENGINE ENDPOINTS (V2 Full)
// ===========================================

// Roleplay session with metadata wrapper
interface RoleplaySessionEntry {
  state: V2SessionState;
  createdAt: Date;
  isActive: boolean;
}

// Roleplay session storage (separate from coach sessions)
const roleplaySessions = new Map<string, RoleplaySessionEntry>();

// Clean up old roleplay sessions
setInterval(() => {
  const now = Date.now();
  const twoHours = 2 * 60 * 60 * 1000;
  for (const [id, entry] of roleplaySessions.entries()) {
    if (!entry.isActive || (now - entry.createdAt.getTime() > twoHours)) {
      roleplaySessions.delete(id);
      console.log(`[API] Cleaned up roleplay session: ${id}`);
    }
  }
}, 30 * 60 * 1000);

// Start a new roleplay session
app.post("/api/v2/roleplay/start", async (req, res) => {
  try {
    const { techniqueId, userId = "demo-user", existingContext } = req.body;
    
    if (!techniqueId) {
      return res.status(400).json({ error: "techniqueId is required" });
    }
    
    // Get technique info
    const technique = getTechnique(techniqueId);
    if (!technique) {
      return res.status(404).json({ error: `Technique ${techniqueId} not found` });
    }
    
    // Generate session ID
    const sessionId = `rp-${Date.now()}-${nanoid(6)}`;
    
    // Initialize roleplay session
    const sessionState = initRoleplaySession(userId, sessionId, techniqueId, existingContext);
    
    // Store session with metadata
    const entry: RoleplaySessionEntry = {
      state: sessionState,
      createdAt: new Date(),
      isActive: true
    };
    roleplaySessions.set(sessionId, entry);
    
    // Get opening message (context question or roleplay intro)
    const openingResponse = await getOpeningMessage(sessionState, userId);
    
    // Update stored session with any state changes
    entry.state = openingResponse.sessionState;
    roleplaySessions.set(sessionId, entry);
    
    console.log(`[API] Created roleplay session ${sessionId} for technique ${techniqueId}`);
    console.log(`[API] Mode: ${openingResponse.sessionState.currentMode}, Type: ${openingResponse.type}`);
    
    res.json({
      sessionId,
      phase: openingResponse.sessionState.currentMode,
      message: openingResponse.message,
      type: openingResponse.type,
      debug: openingResponse.debug
    });
    
  } catch (error: any) {
    console.error("[API] Error starting roleplay:", error.message, error.stack);
    res.status(500).json({ error: error.message });
  }
});

// Send message in roleplay session
app.post("/api/v2/roleplay/message", async (req, res) => {
  try {
    const { sessionId, content, isExpert = false } = req.body;
    
    if (!sessionId) {
      return res.status(400).json({ error: "sessionId is required" });
    }
    if (!content) {
      return res.status(400).json({ error: "content is required" });
    }
    
    const entry = roleplaySessions.get(sessionId);
    if (!entry) {
      return res.status(404).json({ error: "Roleplay session not found. Please start a new session." });
    }
    
    // Set expert mode if requested
    if (isExpert) {
      entry.state.expertMode = true;
    }
    
    // Process input through roleplay engine
    const response = await processInput(entry.state, content);
    
    // Update stored session
    entry.state = response.sessionState;
    roleplaySessions.set(sessionId, entry);
    
    console.log(`[API] Roleplay message processed - Mode: ${response.sessionState.currentMode}, Turn: ${response.sessionState.turnNumber}`);
    
    res.json({
      message: response.message,
      type: response.type,
      phase: response.sessionState.currentMode,
      signal: response.signal,
      evaluation: response.evaluation,
      epicPhase: response.sessionState.epicPhase,
      epicMilestones: response.sessionState.epicMilestones,
      turnNumber: response.sessionState.turnNumber,
      debug: isExpert ? response.debug : undefined
    });
    
  } catch (error: any) {
    console.error("[API] Error processing roleplay message:", error.message, error.stack);
    res.status(500).json({ error: error.message });
  }
});

// End roleplay session with debrief
app.post("/api/v2/roleplay/end", async (req, res) => {
  try {
    const { sessionId } = req.body;
    
    if (!sessionId) {
      return res.status(400).json({ error: "sessionId is required" });
    }
    
    const entry = roleplaySessions.get(sessionId);
    if (!entry) {
      return res.status(404).json({ error: "Roleplay session not found" });
    }
    
    // End roleplay and get debrief
    const debriefResponse = await endRoleplay(entry.state);
    
    // Get session summary
    const summary = getSessionSummary(entry.state);
    
    // Mark session as ended
    entry.isActive = false;
    roleplaySessions.set(sessionId, entry);
    
    console.log(`[API] Roleplay session ${sessionId} ended - Score: ${summary.score}`);
    
    res.json({
      message: debriefResponse.message,
      type: "debrief",
      summary: {
        score: summary.score,
        turns: summary.turns
      }
    });
    
  } catch (error: any) {
    console.error("[API] Error ending roleplay:", error.message, error.stack);
    res.status(500).json({ error: error.message });
  }
});

// Get roleplay session status
app.get("/api/v2/roleplay/:sessionId", (req, res) => {
  const { sessionId } = req.params;
  
  const entry = roleplaySessions.get(sessionId);
  if (!entry) {
    return res.status(404).json({ error: "Session not found" });
  }
  
  const summary = getSessionSummary(entry.state);
  
  res.json({
    sessionId,
    phase: entry.state.currentMode,
    isActive: entry.isActive,
    techniqueId: entry.state.techniqueId,
    epicPhase: entry.state.epicPhase,
    epicMilestones: entry.state.epicMilestones,
    turnNumber: entry.state.turnNumber,
    summary
  });
});

// ============================================
// GOLDEN STANDARD ENDPOINTS
// ============================================

// POST /api/v2/session/save-reference - Save seller message as reference answer
app.post("/api/v2/session/save-reference", async (req, res) => {
  try {
    const { 
      sessionId, 
      techniqueId, 
      message, 
      context, 
      matchStatus, 
      signal, 
      detectedTechnique 
    } = req.body;
    
    if (!sessionId) {
      return res.status(400).json({ error: "sessionId is required" });
    }
    if (!message) {
      return res.status(400).json({ error: "message is required" });
    }
    
    // Save as reference answer
    const referenceAnswer = saveReferenceAnswer({
      techniqueId: techniqueId || "unknown",
      customerSignal: signal || "neutraal",
      customerMessage: context?.customerMessage || "",
      sellerResponse: message,
      context: {
        sector: context?.sector,
        product: context?.product,
        klantType: context?.klantType
      },
      recordedBy: context?.recordedBy || "admin",
      detectedTechnique: detectedTechnique,
      isCorrection: matchStatus === "incorrect" || (detectedTechnique && detectedTechnique !== techniqueId),
      correctionNote: matchStatus === "incorrect" ? `Expert disagreed: detected ${detectedTechnique}, should be ${techniqueId}` : undefined
    });
    
    console.log(`[save-reference] Saved reference for session ${sessionId}, technique ${techniqueId}`);
    
    res.json({ 
      success: true, 
      referenceId: referenceAnswer.id,
      isCorrection: referenceAnswer.isCorrection
    });
    
  } catch (error: any) {
    console.error("[save-reference] Error:", error.message);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/v2/session/flag-customer-response - Flag a customer response as incorrect
app.post("/api/v2/session/flag-customer-response", async (req, res) => {
  try {
    const { 
      sessionId, 
      messageId, 
      feedback, 
      expectedBehavior, 
      context 
    } = req.body;
    
    if (!sessionId) {
      return res.status(400).json({ error: "sessionId is required" });
    }
    if (!feedback) {
      return res.status(400).json({ error: "feedback is required" });
    }
    
    // Log the flag for config consistency analysis
    console.log(`[flag-response] Session ${sessionId}, Message ${messageId}: ${feedback}`);
    
    // Could integrate with config-consistency.ts here if needed
    
    res.json({ 
      success: true,
      message: "Feedback recorded for analysis"
    });
    
  } catch (error: any) {
    console.error("[flag-response] Error:", error.message);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/v2/golden-standard/examples/:techniqueId - Get examples for few-shot learning
app.get("/api/v2/golden-standard/examples/:techniqueId", (req, res) => {
  try {
    const { techniqueId } = req.params;
    const limit = parseInt(req.query.limit as string) || 5;
    
    const examples = getExamplesForTechnique(techniqueId, limit);
    
    res.json({ 
      techniqueId,
      count: examples.length,
      examples
    });
    
  } catch (error: any) {
    console.error("[golden-standard/examples] Error:", error.message);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/v2/golden-standard/report - Get misclassification report
app.get("/api/v2/golden-standard/report", (req, res) => {
  try {
    const report = generateMisclassificationReport();
    res.json(report);
  } catch (error: any) {
    console.error("[golden-standard/report] Error:", error.message);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/v2/golden-standard/all - Get all reference answers grouped
app.get("/api/v2/golden-standard/all", (req, res) => {
  try {
    const grouped = getAllReferenceAnswersGrouped();
    const allAnswers = getReferenceAnswers();
    
    res.json({
      total: allAnswers.length,
      grouped
    });
  } catch (error: any) {
    console.error("[golden-standard/all] Error:", error.message);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// V3 ARTIFACT ENDPOINTS
// ============================================================================

// POST /api/v2/artifacts - Save an artifact
app.post("/api/v2/artifacts", async (req, res) => {
  try {
    const { sessionId, userId, artifactType, techniqueId, content, epicPhase } = req.body;
    
    if (!sessionId || !userId || !artifactType || !techniqueId || !content) {
      return res.status(400).json({ 
        error: "Missing required fields: sessionId, userId, artifactType, techniqueId, content" 
      });
    }
    
    const artifact = await saveArtifact(
      sessionId,
      userId,
      artifactType as ArtifactType,
      techniqueId,
      content as ArtifactContent,
      epicPhase
    );
    
    res.json({ success: true, artifact });
    
  } catch (error: any) {
    console.error("[artifacts] Save error:", error.message);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/v2/artifacts/:sessionId/check - Check if required artifacts exist
// NOTE: Specific routes must come BEFORE generic :artifactType route
app.get("/api/v2/artifacts/:sessionId/check", async (req, res) => {
  try {
    const { sessionId } = req.params;
    const required = (req.query.required as string)?.split(',') as ArtifactType[] || [];
    
    if (required.length === 0) {
      return res.status(400).json({ error: "required query param is needed (comma-separated artifact types)" });
    }
    
    const result = await hasRequiredArtifacts(sessionId, required);
    
    res.json({
      sessionId,
      required,
      ...result
    });
    
  } catch (error: any) {
    console.error("[artifacts] Check error:", error.message);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/v2/artifacts/:sessionId/map - Get artifacts as a map for gate checking
app.get("/api/v2/artifacts/:sessionId/map", async (req, res) => {
  try {
    const { sessionId } = req.params;
    const map = await getArtifactsMap(sessionId);
    
    res.json({
      sessionId,
      artifacts: map
    });
    
  } catch (error: any) {
    console.error("[artifacts] Map error:", error.message);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/v2/artifacts/:sessionId - Get all artifacts for a session
app.get("/api/v2/artifacts/:sessionId", async (req, res) => {
  try {
    const { sessionId } = req.params;
    const artifacts = await getSessionArtifacts(sessionId);
    
    res.json({ 
      sessionId, 
      count: artifacts.length, 
      artifacts 
    });
    
  } catch (error: any) {
    console.error("[artifacts] Get error:", error.message);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/v2/artifacts/:sessionId/:artifactType - Get specific artifact
// NOTE: This generic route must come AFTER specific routes like /check and /map
app.get("/api/v2/artifacts/:sessionId/:artifactType", async (req, res) => {
  try {
    const { sessionId, artifactType } = req.params;
    const artifact = await getArtifact(sessionId, artifactType as ArtifactType);
    
    if (!artifact) {
      return res.status(404).json({ 
        error: `Artifact '${artifactType}' not found for session ${sessionId}` 
      });
    }
    
    res.json(artifact);
    
  } catch (error: any) {
    console.error("[artifacts] Get specific error:", error.message);
    res.status(500).json({ error: error.message });
  }
});

// ===========================================
// V3.2-V3.5: BRIEF GENERATION ENDPOINTS
// ===========================================

// POST /api/v2/briefs/discovery - Generate discovery brief from conversation
app.post("/api/v2/briefs/discovery", async (req, res) => {
  try {
    const { sessionId, userId, techniqueId, conversationHistory } = req.body;
    
    if (!sessionId || !userId || !conversationHistory) {
      return res.status(400).json({ error: "sessionId, userId, and conversationHistory are required" });
    }
    
    console.log(`[briefs] Generating discovery brief for session ${sessionId}`);
    const brief = await generateDiscoveryBrief(
      sessionId,
      userId,
      techniqueId || "2",
      conversationHistory
    );
    
    res.json({ success: true, brief });
    
  } catch (error: any) {
    console.error("[briefs] Discovery brief error:", error.message);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/v2/briefs/offer - Generate offer brief from conversation
app.post("/api/v2/briefs/offer", async (req, res) => {
  try {
    const { sessionId, userId, techniqueId, conversationHistory, discoveryBrief } = req.body;
    
    if (!sessionId || !userId || !conversationHistory) {
      return res.status(400).json({ error: "sessionId, userId, and conversationHistory are required" });
    }
    
    console.log(`[briefs] Generating offer brief for session ${sessionId}`);
    const brief = await generateOfferBrief(
      sessionId,
      userId,
      techniqueId || "3",
      conversationHistory,
      discoveryBrief
    );
    
    res.json({ success: true, brief });
    
  } catch (error: any) {
    console.error("[briefs] Offer brief error:", error.message);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/v2/context/build - Build extended context layers
app.post("/api/v2/context/build", async (req, res) => {
  try {
    const { baseContext, contextDepth, requiredLayers: explicitLayers } = req.body;
    
    if (!baseContext) {
      return res.status(400).json({ error: "baseContext is required" });
    }
    
    // Allow explicit layers OR depth-based layers
    const depth = (contextDepth || 'STANDARD') as ContextDepth;
    const requiredLayers = explicitLayers || getRequiredLayers(depth);
    
    console.log(`[context] Building extended context with layers:`, requiredLayers);
    const layers = await buildExtendedContext(baseContext, requiredLayers);
    const formatted = formatExtendedContextForPrompt(layers);
    
    res.json({ 
      success: true, 
      layers,
      formatted,
      depth,
      requiredLayers
    });
    
  } catch (error: any) {
    console.error("[context] Build error:", error.message);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/v2/roleplay/unlock-check - Check if roleplay is unlocked for a technique
app.post("/api/v2/roleplay/unlock-check", async (req, res) => {
  try {
    const { techniqueId, userAttempts } = req.body;
    
    if (!techniqueId) {
      return res.status(400).json({ error: "techniqueId is required" });
    }
    
    const overlayPath = path.join(process.cwd(), 'config/ssot/coach_overlay_v3_1.json');
    let overlayConfig: any = {};
    try {
      overlayConfig = JSON.parse(fs.readFileSync(overlayPath, 'utf-8'));
    } catch (e) {
      console.warn('[roleplay] Could not load coach_overlay_v3_1.json, falling back to v3');
      const fallbackPath = path.join(process.cwd(), 'config/ssot/coach_overlay_v3.json');
      overlayConfig = JSON.parse(fs.readFileSync(fallbackPath, 'utf-8'));
    }
    
    const result = checkRoleplayUnlock(techniqueId, userAttempts || {}, overlayConfig);
    const sequenceRank = getSequenceRank(techniqueId, overlayConfig);
    
    res.json({ 
      ...result, 
      sequenceRank,
      techniqueId 
    });
    
  } catch (error: any) {
    console.error("[roleplay] Unlock check error:", error.message);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/v2/context/flow-rules - Get context flow rules
app.get("/api/v2/context/flow-rules", async (req, res) => {
  try {
    res.json({ 
      success: true, 
      flowRules: FLOW_RULES,
      layerSlots: LAYER_SLOTS
    });
  } catch (error: any) {
    console.error("[context] Flow rules error:", error.message);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/v2/context/snapshot - Save scenario snapshot as artifact
app.post("/api/v2/context/snapshot", async (req, res) => {
  try {
    const { sessionId, userId, techniqueId, contextLayers } = req.body;
    
    if (!sessionId || !userId || !contextLayers) {
      return res.status(400).json({ error: "sessionId, userId, and contextLayers are required" });
    }
    
    console.log(`[context] Saving scenario snapshot for session ${sessionId}`);
    await generateScenarioSnapshot(sessionId, userId, techniqueId || "1", contextLayers);
    
    res.json({ success: true, message: "Scenario snapshot saved" });
    
  } catch (error: any) {
    console.error("[context] Snapshot error:", error.message);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/v2/rag/index - Index the RAG corpus (admin only)
app.post("/api/v2/rag/index", async (req, res) => {
  try {
    console.log("[RAG] Starting corpus indexing...");
    const result = await indexCorpus();
    console.log("[RAG] Indexing complete:", result);
    res.json(result);
  } catch (error: any) {
    console.error("[RAG] Index error:", error.message);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/v2/rag/status - Get RAG corpus status
app.get("/api/v2/rag/status", async (req, res) => {
  try {
    const count = await getDocumentCount();
    res.json({ 
      documentCount: count,
      status: count > 0 ? "indexed" : "empty"
    });
  } catch (error: any) {
    console.error("[RAG] Status error:", error.message);
    res.status(500).json({ error: error.message });
  }
});

// =====================
// RAG TECHNIEK TAGGING ENDPOINTS
// =====================
import { 
  bulkTagFromVideoMapping, 
  getTaggingStats, 
  getUntaggedChunks,
  tagChunksForVideo 
} from "./v2/rag-techniek-tagger";

// POST /api/v2/rag/tag-bulk - Bulk tag all chunks from video mapping
app.post("/api/v2/rag/tag-bulk", async (req, res) => {
  try {
    console.log("[RAG-TAGGER] Starting bulk tagging from video_mapping.json");
    const result = await bulkTagFromVideoMapping();
    res.json(result);
  } catch (error: any) {
    console.error("[RAG-TAGGER] Bulk tag error:", error.message);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/v2/rag/tag-stats - Get tagging statistics
app.get("/api/v2/rag/tag-stats", async (req, res) => {
  try {
    const stats = await getTaggingStats();
    res.json(stats);
  } catch (error: any) {
    console.error("[RAG-TAGGER] Stats error:", error.message);
    res.status(500).json({ error: error.message });
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
    res.status(500).json({ error: error.message });
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
    res.status(500).json({ error: error.message });
  }
});

// POST /api/v2/rag/tag-video - Tag all chunks for a specific video
app.post("/api/v2/rag/tag-video", async (req, res) => {
  try {
    const { sourceId, technikId } = req.body;
    if (!sourceId || !technikId) {
      return res.status(400).json({ error: "sourceId and technikId required" });
    }
    const updated = await tagChunksForVideo(sourceId, technikId);
    res.json({ success: true, updated });
  } catch (error: any) {
    console.error("[RAG-TAGGER] Tag video error:", error.message);
    res.status(500).json({ error: error.message });
  }
});

// =====================
// RAG HEURISTIC TAGGING ENDPOINTS (P1)
// =====================
import { 
  bulkSuggestTechniques,
  getChunksForReview,
  approveChunk,
  rejectChunk,
  bulkApproveByTechnique,
  getReviewStats,
  resetHeuristicSuggestions
} from "./v2/rag-heuristic-tagger";

import {
  analyzeChunkV2,
  bulkSuggestTechniquesV2,
  resetHeuristicSuggestionsV2,
  clearHeuristicsCacheV2
} from "./v2/rag-heuristic-tagger-v2";

// POST /api/v2/rag/suggest-bulk - Run heuristic tagging on untagged chunks (V2 with primary/mentions)
app.post("/api/v2/rag/suggest-bulk", async (req, res) => {
  try {
    console.log("[HEURISTIC-V2] Starting bulk suggestion with SSOT validation");
    clearHeuristicsCacheV2();
    const result = await bulkSuggestTechniquesV2();
    res.json(result);
  } catch (error: any) {
    console.error("[HEURISTIC-V2] Suggest error:", error.message);
    res.status(500).json({ error: error.message });
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
    res.status(500).json({ error: error.message });
  }
});

// GET /api/v2/rag/review-stats - Get review statistics
app.get("/api/v2/rag/review-stats", async (req, res) => {
  try {
    const stats = await getReviewStats();
    res.json(stats);
  } catch (error: any) {
    console.error("[HEURISTIC] Stats error:", error.message);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/v2/rag/approve/:id - Approve a chunk's suggested technique
app.post("/api/v2/rag/approve/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const success = await approveChunk(id);
    res.json({ success });
  } catch (error: any) {
    console.error("[HEURISTIC] Approve error:", error.message);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/v2/rag/reject/:id - Reject a suggestion with optional correction
app.post("/api/v2/rag/reject/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { newTechniqueId } = req.body;
    const success = await rejectChunk(id, newTechniqueId);
    res.json({ success });
  } catch (error: any) {
    console.error("[HEURISTIC] Reject error:", error.message);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/v2/rag/approve-bulk - Bulk approve all suggestions for a technique
app.post("/api/v2/rag/approve-bulk", async (req, res) => {
  try {
    const { techniqueId } = req.body;
    if (!techniqueId) {
      return res.status(400).json({ error: "techniqueId required" });
    }
    const count = await bulkApproveByTechnique(techniqueId);
    res.json({ success: true, approved: count });
  } catch (error: any) {
    console.error("[HEURISTIC] Bulk approve error:", error.message);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/v2/rag/reset-suggestions - Reset all heuristic suggestions (V2)
app.post("/api/v2/rag/reset-suggestions", async (req, res) => {
  try {
    clearHeuristicsCacheV2();
    const result = await resetHeuristicSuggestionsV2();
    res.json({ success: true, ...result });
  } catch (error: any) {
    console.error("[HEURISTIC-V2] Reset error:", error.message);
    res.status(500).json({ error: error.message });
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
          escapeCsv(row.content)
        ].join(',');
      }).join('\n');
      
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename=rag_chunks_export.csv');
      res.send('\ufeff' + csvHeader + csvRows);
    } else {
      res.json({
        total: result.rows.length,
        chunks: result.rows
      });
    }
  } catch (error: any) {
    console.error("[RAG] Export error:", error.message);
    res.status(500).json({ error: error.message });
  }
});

// =====================
// PERFORMANCE TRACKER ENDPOINTS
// =====================
import { performanceTracker } from "./v2/performance-tracker";

// GET /api/v2/user/level - Get current competence level
app.get("/api/v2/user/level", async (req, res) => {
  try {
    const userId = (req.query.userId as string) || "demo-user";
    const level = await performanceTracker.getCurrentLevel(userId);
    const levelName = performanceTracker.getLevelName(level);
    const assistanceConfig = performanceTracker.getAssistanceConfig(level);
    
    res.json({
      userId,
      level,
      levelName,
      assistance: assistanceConfig
    });
  } catch (error: any) {
    console.error("[Performance] Get level error:", error.message);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/v2/user/performance - Record performance and check for level transition
app.post("/api/v2/user/performance", async (req, res) => {
  try {
    const { userId = "demo-user", techniqueId, techniqueName, score, struggleSignals } = req.body;
    
    if (!techniqueId || score === undefined) {
      return res.status(400).json({ error: "techniqueId and score are required" });
    }
    
    const outcome = score >= 70 ? "success" : score >= 50 ? "partial" : "struggle";
    
    const transition = await performanceTracker.recordPerformance(userId, {
      techniqueId,
      techniqueName: techniqueName || techniqueId,
      score,
      outcome,
      struggleSignals
    });
    
    // Get updated level info
    const newLevel = await performanceTracker.getCurrentLevel(userId);
    const assistanceConfig = performanceTracker.getAssistanceConfig(newLevel);
    
    res.json({
      recorded: true,
      currentLevel: newLevel,
      levelName: performanceTracker.getLevelName(newLevel),
      assistance: assistanceConfig,
      transition: transition ? {
        ...transition,
        congratulationMessage: transition.shouldCongratulate 
          ? performanceTracker.getCongratulationMessage(transition)
          : null
      } : null
    });
  } catch (error: any) {
    console.error("[Performance] Record error:", error.message);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/v2/user/mastery - Get technique mastery summary
app.get("/api/v2/user/mastery", async (req, res) => {
  try {
    const userId = (req.query.userId as string) || "demo-user";
    const mastery = await performanceTracker.getTechniqueMasterySummary(userId);
    const level = await performanceTracker.getCurrentLevel(userId);
    
    res.json({
      userId,
      currentLevel: level,
      levelName: performanceTracker.getLevelName(level),
      techniques: mastery
    });
  } catch (error: any) {
    console.error("[Performance] Get mastery error:", error.message);
    res.status(500).json({ error: error.message });
  }
});

// ===========================================
// USER ACTIVITY - Cross-platform activity tracking (Supabase)
// ===========================================

app.get("/api/v2/user/activity-summary", async (req, res) => {
  const userId = req.query.userId as string;
  
  if (!userId) {
    return res.status(400).json({ error: "userId required" });
  }
  
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
          case "technique_practice":
            welcomeMessage = `${timePhrase} oefende je een techniek. Wil je daar verder mee, of iets anders proberen?`;
            break;
          case "chat_session":
            welcomeMessage = `${timePhrase} hadden we een gesprek. Waar kan ik je vandaag mee helpen?`;
            break;
        }
      }
      
      return res.json({
        welcomeMessage,
        summary: {
          videosWatched: summary.videos_watched || 0,
          webinarsAttended: summary.webinars_attended || 0,
          techniquesExplored: summary.techniques_practiced || 0,
          totalChatSessions: summary.total_chat_sessions || 0,
          strugglingWith: summary.struggling_with || [],
        },
        lastActivity: {
          type: summary.last_activity_type,
          at: summary.last_activity_at,
        }
      });
    }
    
    const { data: activities, error } = await supabase
      .from("user_activity")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(50);
    
    if (error) {
      if (error.code === 'PGRST205' || error.code === '42P01' || error.code === '22P02') {
        return res.json({
          welcomeMessage: "Waar kan ik je vandaag mee helpen?",
          summary: { videosWatched: 0, webinarsAttended: 0, techniquesExplored: 0 },
          recent: {},
          note: "Activity tracking not yet configured in Supabase"
        });
      }
      console.error("[Activity] Supabase error:", error);
      return res.status(500).json({ error: error.message });
    }
    
    const recentVideos = activities?.filter(a => a.activity_type === "video_view").slice(0, 5) || [];
    const recentWebinars = activities?.filter(a => a.activity_type === "webinar_attend").slice(0, 5) || [];
    const recentTechniques = activities?.filter(a => a.activity_type === "technique_practice").slice(0, 5) || [];
    const recentChats = activities?.filter(a => a.activity_type === "chat_session").slice(0, 5) || [];
    
    const lastActivity = activities?.[0] || null;
    
    let welcomeMessage = "Waar kan ik je vandaag mee helpen?";
    if (lastActivity) {
      const timeAgo = Date.now() - new Date(lastActivity.created_at).getTime();
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
      
      const entityName = lastActivity.metadata?.title || lastActivity.video_id || lastActivity.webinar_id || lastActivity.techniek_id || lastActivity.session_id || '';
      
      switch (lastActivity.activity_type) {
        case "technique_practice":
          welcomeMessage = `${timePhrase} oefende je "${entityName}". Wil je daar verder mee, of zit je ergens anders mee?`;
          break;
        case "video_view":
          welcomeMessage = `${timePhrase} keek je een video${entityName ? ` "${entityName}"` : ''}. Heb je daar nog vragen over?`;
          break;
        case "webinar_attend":
          welcomeMessage = `${timePhrase} volgde je een webinar${entityName ? ` "${entityName}"` : ''}. Zullen we de besproken technieken oefenen?`;
          break;
        case "chat_session":
          welcomeMessage = `${timePhrase} hadden we een gesprek. Waar kan ik je vandaag mee helpen?`;
          break;
      }
    }
    
    res.json({
      lastActivity,
      welcomeMessage,
      summary: {
        videosWatched: recentVideos.length,
        webinarsAttended: recentWebinars.length,
        techniquesExplored: recentTechniques.length,
        totalChatSessions: recentChats.length,
      },
      recent: {
        videos: recentVideos,
        webinars: recentWebinars,
        techniques: recentTechniques,
        chats: recentChats,
      },
      source: lastActivity?.source_app || null
    });
  } catch (err) {
    console.error("[Activity] Error:", err);
    res.status(500).json({ error: "Failed to fetch activity summary" });
  }
});

app.post("/api/v2/user/activity", async (req, res) => {
  const { userId, activityType, entityType, entityId, durationSeconds, score, metadata, sourceApp } = req.body;
  
  if (!userId || !activityType) {
    return res.status(400).json({ error: "userId and activityType required" });
  }
  
  try {
    const record: Record<string, any> = {
      user_id: userId,
      activity_type: activityType,
      source_app: sourceApp || 'ai',
      metadata: metadata || {},
      created_at: new Date().toISOString()
    };
    
    const isUUID = (val: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);
    
    if (entityType === 'video' || activityType === 'video_view') {
      if (entityId && isUUID(entityId)) record.video_id = entityId;
      else if (entityId) record.metadata = { ...record.metadata, videoId: entityId };
    } else if (entityType === 'webinar' || activityType === 'webinar_attend') {
      if (entityId && isUUID(entityId)) record.webinar_id = entityId;
      else if (entityId) record.metadata = { ...record.metadata, webinarId: entityId };
    } else if (entityType === 'session' || activityType === 'chat_session') {
      if (entityId && isUUID(entityId)) record.session_id = entityId;
      else if (entityId) record.metadata = { ...record.metadata, sessionId: entityId };
    } else if (entityType === 'technique' || activityType === 'technique_practice') {
      if (entityId) record.techniek_id = entityId;
    }
    
    if (durationSeconds) record.metadata = { ...record.metadata, duration_seconds: durationSeconds };
    if (score) record.metadata = { ...record.metadata, score };
    
    const { data, error } = await supabase
      .from("user_activity")
      .insert(record)
      .select()
      .single();
    
    if (error) {
      if (error.code === 'PGRST205' || error.code === '42P01') {
        return res.json({ 
          success: false, 
          note: "Activity tracking table not yet configured in Supabase" 
        });
      }
      console.error("[Activity] Insert error:", error);
      return res.status(500).json({ error: error.message });
    }
    
    console.log(`[Activity] Logged: ${activityType} for user ${userId} (source: ai)`);
    res.json({ success: true, activity: data });
  } catch (err) {
    console.error("[Activity] Error:", err);
    res.status(500).json({ error: "Failed to log activity" });
  }
});

app.get("/api/v2/user/hugo-context", async (req, res) => {
  const userId = req.query.userId as string;
  
  if (!userId) {
    return res.status(400).json({ error: "userId required" });
  }
  
  try {
    let rpcData = null;
    try {
      const rpcResult = await supabase
        .rpc('get_user_activity_summary', { p_user_id: userId });
      if (!rpcResult.error) rpcData = rpcResult.data;
    } catch (e) {
      // RPC not available yet, use fallback
    }
    
    if (rpcData) {
      const contextForHugo = {
        user: {
          product: rpcData.product || null,
          klantType: rpcData.klant_type || null,
          sector: rpcData.sector || null,
        },
        recentActivity: rpcData.recent_activities || [],
        mastery: (rpcData.technique_progress || []).map((t: any) => ({
          technique: t.technique_id,
          attempts: t.practice_count,
          avgScore: t.average_score,
        })),
        strugglingWith: rpcData.struggling_with || [],
        summary: `${rpcData.videos_watched || 0} videos, ${rpcData.webinars_attended || 0} webinars, ${rpcData.techniques_practiced || 0} techniques`,
      };
      return res.json(contextForHugo);
    }
    
    const [activityResult, userContextResult, masteryResult] = await Promise.all([
      supabase
        .from("user_activity")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(20),
      supabase
        .from("user_context")
        .select("*")
        .eq("user_id", userId)
        .single(),
      supabase
        .from("technique_mastery")
        .select("*")
        .eq("user_id", userId)
        .order("last_practiced", { ascending: false })
        .limit(10)
    ]);
    
    const activities = activityResult.data || [];
    const userContext = userContextResult.data;
    const mastery = masteryResult.data || [];
    
    const contextForHugo = {
      user: {
        product: userContext?.product || null,
        klantType: userContext?.klant_type || null,
        sector: userContext?.sector || null,
        setting: userContext?.setting || null,
      },
      recentActivity: activities.map((a: any) => ({
        type: a.activity_type,
        name: a.metadata?.title || a.entity_id,
        when: a.created_at,
      })),
      mastery: mastery.map((m: any) => ({
        technique: m.technique_name,
        level: m.mastery_level,
        attempts: m.attempt_count,
        avgScore: m.average_score,
      })),
      summary: `${activities.length} recent activities, ${mastery.length} techniques practiced`,
    };
    
    res.json(contextForHugo);
  } catch (err) {
    console.error("[Hugo Context] Error:", err);
    res.status(500).json({ error: "Failed to build Hugo context" });
  }
});

// ============================================================================
// GESPREKSANALYSE API ENDPOINTS
// ============================================================================

import { compressAudioIfNeeded, compressAudioFileFromPath } from "./v2/audio-compressor";

app.post("/api/v2/analysis/upload", upload.single('file'), async (req: Request, res: Response) => {
  try {
    const file = req.file;
    if (!file) {
      return res.status(400).json({ error: 'Geen bestand ontvangen' });
    }

    const { title, context, userId, consentConfirmed } = req.body;

    if (!consentConfirmed || consentConfirmed === 'false') {
      return res.status(400).json({ error: 'Toestemming is vereist voor het uploaden van gesprekken' });
    }

    if (!title) {
      return res.status(400).json({ error: 'Titel is verplicht' });
    }

    const effectiveUserId = userId || 'anonymous';

    console.log(`[Analysis] Upload started: "${title}" by ${effectiveUserId}, file: ${file.originalname} (${(file.size / 1024 / 1024).toFixed(1)}MB)`);

    const compressed = await compressAudioIfNeeded(file.buffer, file.originalname, file.mimetype);

    const storageKey = await uploadAndStore(
      compressed.buffer,
      compressed.originalName,
      compressed.mimetype,
      effectiveUserId
    );

    const conversationId = crypto.randomUUID();

    runFullAnalysis(conversationId, storageKey, effectiveUserId, title);

    res.json({
      success: true,
      conversationId,
      storageKey,
      status: 'transcribing',
      message: compressed.compressed 
        ? 'Upload succesvol! Bestand gecomprimeerd en analyse wordt gestart...'
        : 'Upload succesvol! Analyse wordt gestart...'
    });
  } catch (err: any) {
    console.error("[Analysis] Upload error:", err);
    res.status(500).json({ error: err.message || 'Upload mislukt' });
  }
});

app.post("/api/v2/analysis/inline", upload.single('file'), async (req: Request, res: Response) => {
  try {
    const file = req.file;
    if (!file) {
      return res.status(400).json({ error: 'Geen bestand ontvangen' });
    }

    const { title, userId } = req.body;
    const effectiveTitle = title || file.originalname?.replace(/\.[^/.]+$/, '') || `Analyse ${new Date().toLocaleDateString('nl-NL')}`;
    const effectiveUserId = userId || 'anonymous';

    console.log(`[Analysis:Inline] Starting inline analysis: "${effectiveTitle}" by ${effectiveUserId}, file: ${file.originalname} (${(file.size / 1024 / 1024).toFixed(1)}MB)`);

    const compressed = await compressAudioIfNeeded(file.buffer, file.originalname, file.mimetype);

    const storageKey = await uploadAndStore(
      compressed.buffer,
      compressed.originalName,
      compressed.mimetype,
      effectiveUserId
    );

    const conversationId = crypto.randomUUID();

    runFullAnalysis(conversationId, storageKey, effectiveUserId, effectiveTitle);

    res.json({
      success: true,
      conversationId,
      title: effectiveTitle,
      status: 'transcribing',
    });
  } catch (err: any) {
    console.error("[Analysis:Inline] Upload error:", err);
    res.status(500).json({ error: err.message || 'Inline analyse mislukt' });
  }
});

app.post("/api/v2/analysis/upload/init", express.json(), (req: Request, res: Response) => {
  try {
    const { fileName, fileSize, totalChunks, mimetype } = req.body;

    if (!fileName || !totalChunks) {
      return res.status(400).json({ error: 'fileName en totalChunks zijn vereist' });
    }

    const allowedAudioExts = ['.mp3', '.wav', '.m4a', '.mp4', '.mov', '.ogg', '.webm', '.flac', '.aac'];
    const fileExt = path.extname(fileName).toLowerCase();
    if (!allowedAudioExts.includes(fileExt)) {
      return res.status(400).json({ error: `Ongeldig bestandstype: ${fileExt}. Alleen audio/video bestanden zijn toegestaan.` });
    }

    const maxSize = 100 * 1024 * 1024;
    if (fileSize > maxSize) {
      return res.status(400).json({ error: `Bestand is te groot. Maximum: 100MB` });
    }

    const uploadId = crypto.randomUUID();
    const tmpDir = path.join(os.tmpdir(), `chunked_${uploadId}`);
    fs.mkdirSync(tmpDir, { recursive: true });

    activeChunkedUploads.set(uploadId, {
      chunks: new Map(),
      totalChunks,
      fileName,
      mimetype: mimetype || 'application/octet-stream',
      tmpDir,
      createdAt: Date.now(),
    });

    console.log(`[ChunkedUpload] Initialized: ${uploadId}, file: ${fileName} (${(fileSize / 1024 / 1024).toFixed(1)}MB, ${totalChunks} chunks)`);

    res.json({ uploadId, totalChunks });
  } catch (err: any) {
    console.error("[ChunkedUpload] Init error:", err);
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/v2/analysis/upload/chunk", chunkUpload.single('chunk'), (req: Request, res: Response) => {
  try {
    const { uploadId, chunkIndex } = req.body;
    const chunkData = req.file;

    if (!uploadId || chunkIndex === undefined || !chunkData) {
      return res.status(400).json({ error: 'uploadId, chunkIndex en chunk data zijn vereist' });
    }

    const upload = activeChunkedUploads.get(uploadId);
    if (!upload) {
      return res.status(404).json({ error: 'Upload niet gevonden of verlopen' });
    }

    const idx = parseInt(chunkIndex, 10);
    const chunkPath = path.join(upload.tmpDir, `chunk_${String(idx).padStart(5, '0')}`);
    fs.writeFileSync(chunkPath, chunkData.buffer);
    upload.chunks.set(idx, true);

    const received = upload.chunks.size;
    console.log(`[ChunkedUpload] ${uploadId}: chunk ${idx + 1}/${upload.totalChunks} received`);

    res.json({ 
      received, 
      total: upload.totalChunks, 
      complete: received === upload.totalChunks 
    });
  } catch (err: any) {
    console.error("[ChunkedUpload] Chunk error:", err);
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/v2/analysis/upload/complete", express.json(), async (req: Request, res: Response) => {
  try {
    const { uploadId, title, context, userId, consentConfirmed } = req.body;

    if (!uploadId) {
      return res.status(400).json({ error: 'uploadId is vereist' });
    }

    const uploadInfo = activeChunkedUploads.get(uploadId);
    if (!uploadInfo) {
      return res.status(404).json({ error: 'Upload niet gevonden of verlopen' });
    }

    if (uploadInfo.chunks.size !== uploadInfo.totalChunks) {
      return res.status(400).json({ 
        error: `Niet alle chunks ontvangen: ${uploadInfo.chunks.size}/${uploadInfo.totalChunks}` 
      });
    }

    if (!consentConfirmed || consentConfirmed === 'false') {
      return res.status(400).json({ error: 'Toestemming is vereist' });
    }

    if (!title) {
      return res.status(400).json({ error: 'Titel is verplicht' });
    }

    const effectiveUserId = userId || 'anonymous';

    const ext = path.extname(uploadInfo.fileName).toLowerCase() || '.m4a';
    const assembledPath = path.join(uploadInfo.tmpDir, `assembled${ext}`);
    const writeStream = fs.createWriteStream(assembledPath);
    for (let i = 0; i < uploadInfo.totalChunks; i++) {
      const chunkPath = path.join(uploadInfo.tmpDir, `chunk_${String(i).padStart(5, '0')}`);
      const chunkData = fs.readFileSync(chunkPath);
      writeStream.write(chunkData);
    }
    await new Promise<void>((resolve, reject) => {
      writeStream.end(() => resolve());
      writeStream.on('error', reject);
    });

    const fileSize = fs.statSync(assembledPath).size;
    console.log(`[ChunkedUpload] Assembled ${uploadId}: ${(fileSize / 1024 / 1024).toFixed(1)}MB`);

    const compressed = await compressAudioFileFromPath(assembledPath, uploadInfo.fileName, fileSize);

    const storageKey = await uploadAndStore(
      compressed.buffer,
      compressed.originalName,
      compressed.mimetype,
      effectiveUserId
    );

    const conversationId = crypto.randomUUID();
    runFullAnalysis(conversationId, storageKey, effectiveUserId, title);

    try { fs.rmSync(uploadInfo.tmpDir, { recursive: true, force: true }); } catch {}
    activeChunkedUploads.delete(uploadId);

    res.json({
      success: true,
      conversationId,
      storageKey,
      status: 'transcribing',
      message: compressed.compressed
        ? 'Upload succesvol! Bestand gecomprimeerd en analyse wordt gestart...'
        : 'Upload succesvol! Analyse wordt gestart...'
    });
  } catch (err: any) {
    console.error("[ChunkedUpload] Complete error:", err);
    res.status(500).json({ error: err.message || 'Upload afronden mislukt' });
  }
});

app.get("/api/v2/analysis/status/:conversationId", async (req: Request, res: Response) => {
  try {
    const conversationId = req.params.conversationId as string;
    const status = await getAnalysisStatus(conversationId);

    if (!status) {
      return res.status(404).json({ error: 'Analyse niet gevonden' });
    }

    res.json(status);
  } catch (err: any) {
    console.error("[Analysis] Status error:", err);
    res.status(500).json({ error: err.message || 'Status ophalen mislukt' });
  }
});

app.get("/api/v2/analysis/results/:conversationId", async (req: Request, res: Response) => {
  try {
    const conversationId = req.params.conversationId as string;
    const results = await getAnalysisResults(conversationId);

    if (!results) {
      const status = await getAnalysisStatus(conversationId as string);
      if (status) {
        return res.status(202).json({ 
          status: status.status, 
          message: 'Analyse is nog bezig...' 
        });
      }
      return res.status(404).json({ error: 'Analyse niet gevonden' });
    }

    res.json(results);
  } catch (err: any) {
    console.error("[Analysis] Results error:", err);
    res.status(500).json({ error: err.message || 'Resultaten ophalen mislukt' });
  }
});

app.get("/api/v2/analysis/percentile/:conversationId", async (req: Request, res: Response) => {
  try {
    const conversationId = req.params.conversationId;
    const period = (req.query.period as string) || 'all';

    const scoreResult = await pool.query(
      `SELECT (result->'insights'->>'overallScore')::numeric as score
       FROM conversation_analyses
       WHERE id = $1 AND status = 'completed' AND result IS NOT NULL`,
      [conversationId]
    );

    if (scoreResult.rows.length === 0) {
      return res.status(404).json({ error: 'Analyse niet gevonden' });
    }

    const myScore = Number(scoreResult.rows[0].score);

    let dateFilter = '';
    if (period === 'week') {
      dateFilter = "AND created_at >= NOW() - INTERVAL '7 days'";
    } else if (period === 'month') {
      dateFilter = "AND created_at >= NOW() - INTERVAL '30 days'";
    } else if (period === 'year') {
      dateFilter = "AND created_at >= NOW() - INTERVAL '365 days'";
    }

    const statsResult = await pool.query(
      `SELECT 
         COUNT(*)::int as total,
         COUNT(CASE WHEN (result->'insights'->>'overallScore')::numeric <= $1 THEN 1 END)::int as at_or_below
       FROM conversation_analyses
       WHERE status = 'completed' 
         AND result IS NOT NULL 
         AND result->'insights'->>'overallScore' IS NOT NULL
         ${dateFilter}`,
      [myScore]
    );

    const { total, at_or_below } = statsResult.rows[0];
    const percentile = total > 0 ? Math.round((at_or_below / total) * 100) : 50;

    res.json({
      score: myScore,
      percentile,
      totalAnalyses: total,
      period,
    });
  } catch (err: any) {
    console.error("[Analysis] Percentile error:", err);
    res.status(500).json({ error: err.message || 'Percentiel ophalen mislukt' });
  }
});

app.post("/api/v2/analysis/retry/:conversationId", express.json(), async (req: Request, res: Response) => {
  try {
    const { conversationId } = req.params;

    const { rows } = await pool.query(
      'SELECT id, user_id, title, status, storage_key FROM conversation_analyses WHERE id = $1',
      [conversationId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Analyse niet gevonden' });
    }

    const analysis = rows[0];
    if (!['failed', 'transcribing', 'completed'].includes(analysis.status)) {
      return res.status(400).json({ error: 'Deze analyse kan niet opnieuw worden gestart' });
    }

    const storageKey = analysis.storage_key;
    if (!storageKey) {
      return res.status(400).json({ error: 'Audiobestand niet meer beschikbaar. Upload het gesprek opnieuw.' });
    }

    const filePath = path.join(process.cwd(), 'tmp/uploads', storageKey);
    if (!fs.existsSync(filePath)) {
      return res.status(400).json({ error: 'Audiobestand niet meer beschikbaar. Upload het gesprek opnieuw.' });
    }

    await pool.query(
      'UPDATE conversation_analyses SET status = $1, error = NULL WHERE id = $2',
      ['transcribing', conversationId]
    );

    runFullAnalysis(conversationId as string, storageKey, analysis.user_id, analysis.title);

    res.json({
      success: true,
      conversationId,
      status: 'transcribing',
      message: 'Analyse wordt opnieuw gestart...'
    });
  } catch (err: any) {
    console.error("[Analysis] Retry error:", err);
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/v2/analysis/regenerate-coach/:conversationId", express.json(), async (req: Request, res: Response) => {
  try {
    const { conversationId } = req.params;
    const results = await getAnalysisResults(conversationId as string);
    if (!results) {
      return res.status(404).json({ error: 'Analyse niet gevonden' });
    }

    const { transcript, evaluations, signals, insights } = results;
    if (!transcript || transcript.length === 0) {
      return res.status(400).json({ error: 'Geen transcript beschikbaar' });
    }

    const { buildSSOTContextForEvaluation } = await import("./v2/ssot-context-builder");
    const { searchRag } = await import("./v2/rag-service");

    const phaseCoverage = insights.phaseCoverage || { phase1: { score: 0 }, phase2: { overall: { score: 0 }, explore: { score: 0 }, probe: { score: 0 }, impact: { score: 0 }, commit: { score: 0 } }, phase3: { score: 0 }, phase4: { score: 0 }, overall: 0 };
    const missedOpps = insights.missedOpportunities || [];

    let ssotContext = '';
    let ragContext = '';
    try {
      ssotContext = buildSSOTContextForEvaluation([]);
    } catch (e: any) { console.warn('[Regenerate] SSOT context error:', e.message); }
    try {
      const ragResults = await searchRag('verkooptechnieken EPIC coaching', { limit: 3 });
      if (ragResults.documents && ragResults.documents.length > 0) {
        ragContext = '--- RAG CONTEXT ---\n' + ragResults.documents.map((r: any) => r.content?.substring(0, 500)).join('\n\n');
      }
    } catch (e: any) { console.warn('[Regenerate] RAG context error:', e.message); }

    console.log(`[Analysis] Regenerating coach artifacts for ${conversationId} (${transcript.length} turns, ${evaluations.length} evals)`);

    const { coachDebrief, moments } = await generateCoachArtifacts(
      transcript, evaluations, signals, phaseCoverage as any, missedOpps, insights, ssotContext, ragContext
    );

    insights.coachDebrief = coachDebrief;
    insights.moments = moments;

    const updatedResult = { ...results, insights };

    await pool.query(
      'UPDATE conversation_analyses SET result = $1 WHERE id = $2',
      [JSON.stringify(updatedResult), conversationId]
    );

    console.log(`[Analysis] Coach artifacts regenerated: ${moments.length} moments for ${conversationId}`);

    res.json({
      success: true,
      momentsGenerated: moments.length,
      oneliner: coachDebrief.oneliner,
    });
  } catch (err: any) {
    console.error("[Analysis] Regenerate coach error:", err);
    res.status(500).json({ error: err.message || 'Coach artifacts regenereren mislukt' });
  }
});

app.post("/api/v2/analysis/chat-session", express.json(), async (req: Request, res: Response) => {
  try {
    const { sessionId, userId } = req.body;
    
    if (!sessionId) {
      return res.status(400).json({ error: 'sessionId is vereist' });
    }

    const existingResults = await getAnalysisResults(sessionId);
    if (existingResults) {
      return res.json({ conversationId: sessionId, status: 'completed', message: 'Analyse al beschikbaar' });
    }

    const existingStatus = await getAnalysisStatus(sessionId);
    if (existingStatus && ['analyzing', 'evaluating', 'generating_report'].includes(existingStatus.status)) {
      return res.json({ conversationId: sessionId, status: existingStatus.status, message: 'Analyse is al bezig' });
    }

    if (existingStatus && existingStatus.status === 'failed') {
      try {
        await pool.query('DELETE FROM conversation_analyses WHERE id = $1', [sessionId]);
      } catch (e: any) {
        console.warn('[API] Failed to clear old failed analysis:', e.message);
      }
    }

    const { data: session, error } = await supabase
      .from('v2_sessions')
      .select('*')
      .eq('id', sessionId)
      .single();

    if (error || !session) {
      return res.status(404).json({ error: 'Sessie niet gevonden' });
    }

    const chatHistory = session.conversation_history || [];
    if (chatHistory.length === 0) {
      return res.status(400).json({ error: 'Geen berichten in de sessie' });
    }

    const effectiveUserId = userId || session.user_id || 'anonymous';
    const techniqueName = getTechnique(session.technique_id)?.naam || session.technique_id || 'Algemeen';
    const title = techniqueName;

    res.json({ conversationId: sessionId, status: 'analyzing', message: 'Analyse gestart' });

    runChatAnalysis(
      sessionId,
      chatHistory,
      effectiveUserId,
      title,
      session.technique_id,
      session.created_at
    ).catch(err => {
      console.error('[API] Chat analysis background error:', err.message);
    });

  } catch (err: any) {
    console.error("[API] Chat session analysis error:", err);
    res.status(500).json({ error: err.message || 'Analyse starten mislukt' });
  }
});

app.get("/api/v2/analysis/list", async (req: Request, res: Response) => {
  try {
    const userId = req.query.userId as string;
    const source = req.query.source as string;

    let queryText = 'SELECT id, user_id, title, status, error, created_at, completed_at, result FROM conversation_analyses';
    const conditions: string[] = [];
    const params: any[] = [];

    if (userId) {
      params.push(userId);
      conditions.push(`user_id = $${params.length}`);
    }

    if (source === 'upload') {
      conditions.push("id NOT LIKE 'session-%'");
    } else if (source === 'chat') {
      conditions.push("id LIKE 'session-%'");
    }

    if (conditions.length > 0) {
      queryText += ' WHERE ' + conditions.join(' AND ');
    }

    queryText += ' ORDER BY created_at DESC';

    const { rows } = await pool.query(queryText, params);

    const userIds = [...new Set(rows.map(r => r.user_id).filter(Boolean))];
    let userMap: Record<string, { name: string; email: string }> = {};
    if (userIds.length > 0) {
      try {
        const { data: users } = await supabase.auth.admin.listUsers({ perPage: 1000 });
        if (users?.users) {
          for (const u of users.users) {
            const firstName = u.user_metadata?.first_name || '';
            const lastName = u.user_metadata?.last_name || '';
            const name = [firstName, lastName].filter(Boolean).join(' ') || u.email?.split('@')[0] || 'Onbekend';
            userMap[u.id] = { name, email: u.email || '' };
          }
        }
      } catch (e) {
        console.log('[Analysis] Could not fetch user names from Supabase:', (e as any)?.message);
      }
    }

    const analyses = rows.map(row => {
      const result = row.result as any;
      const userInfo = userMap[row.user_id];
      return {
        id: row.id,
        userId: row.user_id,
        userName: userInfo?.name || null,
        userEmail: userInfo?.email || null,
        title: row.title,
        status: row.status,
        error: row.error,
        createdAt: row.created_at,
        completedAt: row.completed_at,
        overallScore: result?.insights?.overallScore ?? null,
        turnCount: result?.transcript?.length ?? null,
        durationMs: result?.transcript?.length > 0
          ? result.transcript[result.transcript.length - 1].endMs
          : null,
        techniquesFound: result?.evaluations
          ? [...new Set(result.evaluations.flatMap((e: any) => e.techniques.map((t: any) => t.id)))]
          : [],
        phaseCoverage: result?.insights?.phaseCoverage
          ? {
              phase1: result.insights.phaseCoverage.phase1?.score ?? 0,
              phase2: result.insights.phaseCoverage.phase2?.overall?.score ?? 0,
              phase3: result.insights.phaseCoverage.phase3?.score ?? 0,
              phase4: result.insights.phaseCoverage.phase4?.score ?? 0,
              overall: result.insights.phaseCoverage.overall ?? 0,
            }
          : null,
      };
    });

    res.json({ analyses, totalCount: analyses.length });
  } catch (err: any) {
    console.error("[Analysis] List error:", err);
    res.status(500).json({ error: err.message || 'Analyses ophalen mislukt' });
  }
});


app.post("/api/v2/analysis/coach-action", express.json(), async (req: Request, res: Response) => {
  try {
    const { analysisId, momentId, actionType } = req.body;

    if (!analysisId || !momentId || !actionType) {
      res.status(400).json({ error: 'analysisId, momentId en actionType zijn verplicht' });
      return;
    }

    const { rows } = await pool.query(
      'SELECT result FROM conversation_analyses WHERE id = $1 AND status = $2',
      [analysisId, 'completed']
    );

    if (rows.length === 0 || !rows[0].result) {
      res.status(404).json({ error: 'Analyse niet gevonden' });
      return;
    }

    const analysisResult = rows[0].result;
    const moments = analysisResult.insights?.moments || [];
    const moment = moments.find((m: any) => m.id === momentId);

    if (!moment) {
      res.status(404).json({ error: 'Moment niet gevonden' });
      return;
    }

    const openai = new (await import('openai')).default({
      baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
      apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
    });

    if (actionType === 'three_options') {
      const response = await openai.chat.completions.create({
        model: 'gpt-5.1',
        messages: [
          {
            role: 'system',
            content: `Je bent Hugo Herbots, verkoopcoach. Geef 3 concrete antwoord-opties die de verkoper had kunnen gebruiken op dit moment.

CONTEXT:
- De verkoper zei: "${moment.sellerText}"
- De klant zei: "${moment.customerText}"
- Klantsignaal: ${moment.customerSignal || 'neutraal'}
- Aanbevolen technieken: ${moment.recommendedTechniques.join(', ')}

Geef 3 opties met verschillende stijlen:
1. Direct en assertief
2. Empathisch en doorvragend
3. Creatief/onverwacht

Output als JSON array: [{"style": "Direct", "text": "..."}, {"style": "Empathisch", "text": "..."}, {"style": "Creatief", "text": "..."}]`
          }
        ],
        max_completion_tokens: 500,
        temperature: 0.7,
      });

      const content = response.choices[0]?.message?.content?.trim() || '[]';
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      let options: any[] = [];
      try { options = jsonMatch ? JSON.parse(jsonMatch[0]) : []; } catch { options = []; }

      res.json({ type: 'three_options', options });
      return;
    }

    if (actionType === 'micro_drill') {
      const response = await openai.chat.completions.create({
        model: 'gpt-5.1',
        messages: [
          {
            role: 'system',
            content: `Je bent Hugo Herbots, verkoopcoach. Geef een micro-drill oefening (1 zin schrijven) gebaseerd op dit moment.

CONTEXT:
- Moment: ${moment.label}
- Klantsignaal: ${moment.customerSignal || 'neutraal'}
- Aanbevolen technieken: ${moment.recommendedTechniques.join(', ')}
- Klant zei: "${moment.customerText}"

Geef:
1. Een korte instructie (1 zin) wat de verkoper moet oefenen
2. Een voorbeeld van een goede reactie

Output als JSON: {"instruction": "...", "example": "..."}`
          }
        ],
        max_completion_tokens: 300,
        temperature: 0.6,
      });

      const content = response.choices[0]?.message?.content?.trim() || '{}';
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      let drill = { instruction: '', example: '' };
      try { drill = jsonMatch ? JSON.parse(jsonMatch[0]) : drill; } catch {}

      res.json({ type: 'micro_drill', drill });
      return;
    }

    if (actionType === 'hugo_demo') {
      const response = await openai.chat.completions.create({
        model: 'gpt-5.1',
        messages: [
          {
            role: 'system',
            content: `Je bent Hugo Herbots, verkoopcoach. Laat zien hoe JIJ dit moment zou aanpakken.

CONTEXT:
- De klant zei: "${moment.customerText}"
- Klantsignaal: ${moment.customerSignal || 'neutraal'}
- Aanbevolen technieken: ${moment.recommendedTechniques.join(', ')}

Geef:
1. Wat jij zou zeggen (letterlijk, als verkoper)
2. Waarom dit werkt (1 zin)

Output als JSON: {"response": "...", "reasoning": "..."}`
          }
        ],
        max_completion_tokens: 300,
        temperature: 0.6,
      });

      const content = response.choices[0]?.message?.content?.trim() || '{}';
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      let demo = { response: '', reasoning: '' };
      try { demo = jsonMatch ? JSON.parse(jsonMatch[0]) : demo; } catch {}

      res.json({ type: 'hugo_demo', demo });
      return;
    }

    res.status(400).json({ error: 'Onbekend actionType' });
  } catch (err: any) {
    console.error("[CoachAction] Error:", err);
    res.status(500).json({ error: 'Coach actie kon niet worden uitgevoerd. Probeer opnieuw.' });
  }
});

app.post("/api/v2/chat/feedback", express.json(), async (req: Request, res: Response) => {
  try {
    const { messageId, sessionId, userId, feedback, messageText, debugInfo } = req.body;

    if (!messageId || !feedback) {
      return res.status(400).json({ error: 'messageId and feedback are required' });
    }

    if (feedback === null) {
      await pool.query('DELETE FROM chat_feedback WHERE message_id = $1 AND user_id = $2', [messageId, userId]);
      return res.json({ success: true, action: 'removed' });
    }

    await pool.query(
      `INSERT INTO chat_feedback (message_id, session_id, user_id, feedback, message_text, debug_info)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (message_id, user_id) DO UPDATE SET feedback = $4, created_at = NOW()`,
      [messageId, sessionId, userId, feedback, messageText, debugInfo ? JSON.stringify(debugInfo) : null]
    );

    if (feedback === 'down') {
      console.log(`[Feedback] Thumbs-down from ${userId} on message ${messageId}: "${(messageText || '').slice(0, 100)}..."`);

      try {
        await pool.query(
          `INSERT INTO admin_notifications (type, title, message, category, severity)
           VALUES ($1, $2, $3, $4, $5)`,
          ['chat_feedback', 'Negatieve feedback op AI antwoord', `Gebruiker gaf een duimpje omlaag: "${(messageText || '').slice(0, 150)}..."`, 'feedback', 'info']
        );
      } catch (notifErr) {
        console.error('[Feedback] Failed to create admin notification:', notifErr);
      }
    }

    res.json({ success: true, feedback });
  } catch (err: any) {
    console.error('[Feedback] Error:', err);
    res.status(500).json({ error: err.message || 'Feedback opslaan mislukt' });
  }
});

app.get("/api/v2/admin/feedback", async (req: Request, res: Response) => {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM chat_feedback WHERE feedback = 'down' ORDER BY created_at DESC LIMIT 50`
    );
    res.json({ feedback: rows });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ===========================================
// ADMIN CORRECTIONS API
// ===========================================

// Tables admin_corrections and admin_notifications exist in LOCAL PostgreSQL (DATABASE_URL)

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

    try {
      await pool.query(
        `INSERT INTO admin_notifications (type, title, message, category, severity, related_id, related_page)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        ['correction_submitted', notifTitle, notifMessage, 'content', notifSeverity, correction.id, 'admin-config-review']
      );
      console.log(`[Admin] Notification created for correction #${correction.id}`);
    } catch (notifErr: any) {
      console.error('[Admin] Failed to create notification:', notifErr.message);
    }

    res.json({ correction, message: 'Correctie ingediend voor review' });
  } catch (err: any) {
    console.error('[Admin] Correction submit error:', err);
    res.status(500).json({ error: err.message || 'Correctie opslaan mislukt' });
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
    res.status(500).json({ error: err.message });
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
    res.status(500).json({ error: err.message });
  }
});

// ===========================================
// ADMIN NOTIFICATIONS API
// ===========================================

app.get("/api/v2/admin/notifications", async (req: Request, res: Response) => {
  try {
    const readFilter = req.query.read;
    let queryText = 'SELECT * FROM admin_notifications';
    const params: any[] = [];
    if (readFilter === 'true') {
      queryText += ' WHERE read = true';
    } else if (readFilter === 'false') {
      queryText += ' WHERE read = false';
    }
    queryText += ' ORDER BY created_at DESC LIMIT 200';
    const { rows } = await pool.query(queryText, params);
    res.json({ notifications: rows || [] });
  } catch (err: any) {
    console.error('[Admin] Notifications list error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/v2/admin/notifications/count", async (req: Request, res: Response) => {
  try {
    const { rows } = await pool.query('SELECT COUNT(*) as count FROM admin_notifications WHERE read = false');
    res.json({ unread: parseInt(rows[0]?.count || '0') });
  } catch (err: any) {
    console.error('[Admin] Notifications count error:', err.message);
    res.status(500).json({ error: err.message });
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
    res.status(500).json({ error: err.message });
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
    res.status(500).json({ error: err.message });
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
    res.status(500).json({ error: err.message });
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
    const adminUserId = (req.query.userId as string) || 'hugo';
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
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/v2/admin/onboarding/approve", async (req: Request, res: Response) => {
  try {
    const { itemKey, module, userId } = req.body;
    const adminUserId = userId || 'hugo';

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
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/v2/admin/onboarding/skip", async (req: Request, res: Response) => {
  try {
    const { itemKey, module, userId } = req.body;
    const adminUserId = userId || 'hugo';

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
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/v2/admin/onboarding/feedback", async (req: Request, res: Response) => {
  try {
    const { itemKey, module, feedbackText, userId } = req.body;
    const adminUserId = userId || 'hugo';

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
      const { getOpenAI } = await import('./openai-client');
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
    const corrResult = await pool.query(
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
    const correction = corrResult.rows[0];

    await pool.query(
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

    await pool.query(
      `UPDATE admin_onboarding_progress SET status = 'feedback_given', feedback_text = $1, correction_id = $2, reviewed_at = NOW() WHERE admin_user_id = $3 AND module = $4 AND item_key = $5`,
      [feedbackText, correction.id, adminUserId, module, itemKey]
    );

    res.json({
      success: true,
      interpretation: aiInterpretation,
      correctionId: correction.id,
      proposedChanges: proposedJson
    });
  } catch (err: any) {
    console.error('[Onboarding] Feedback error:', err.message);
    res.status(500).json({ error: err.message });
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
    res.status(500).json({ error: err.message });
  }
});

// ===========================================
// ADMIN DASHBOARD STATS
// ===========================================
app.get("/api/v2/admin/stats", async (req: Request, res: Response) => {
  try {
    const { data: allUsers } = await supabase.auth.admin.listUsers({ perPage: 1000 });
    const users = (allUsers as any)?.users || [];
    const totalUsers = users.length || 0;

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const activeUsers = users.filter((u: any) => 
      u.last_sign_in_at && new Date(u.last_sign_in_at) > new Date(thirtyDaysAgo)
    ).length || 0;

    const newUsersThisWeek = users.filter((u: any) => 
      u.created_at && new Date(u.created_at) > new Date(sevenDaysAgo)
    ).length || 0;

    const { data: allSessions } = await supabase
      .from('v2_sessions')
      .select('id, total_score, technique_id, created_at, user_id, conversation_history')
      .eq('is_active', 1)
      .order('created_at', { ascending: false })
      .limit(500);

    const totalSessions = allSessions?.length || 0;
    const recentSessions = allSessions?.filter(s => 
      s.created_at && new Date(s.created_at) > new Date(sevenDaysAgo)
    ).length || 0;

    let totalAnalyses = 0;
    let completedAnalyses = 0;
    let avgAnalysisScore = 0;
    let pendingReviews = 0;
    try {
      const uploadResult = await pool.query(
        "SELECT COUNT(*) as total, COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed FROM conversation_analyses WHERE id NOT LIKE 'session-%'"
      );
      totalAnalyses = parseInt(uploadResult.rows[0]?.total || '0');
      completedAnalyses = parseInt(uploadResult.rows[0]?.completed || '0');
      
      const scoreResult = await pool.query(
        "SELECT AVG(COALESCE((result->'insights'->>'overallScore')::numeric, (result->>'overallScore')::numeric)) as avg_score FROM conversation_analyses WHERE id NOT LIKE 'session-%' AND status = 'completed' AND (result->'insights'->>'overallScore' IS NOT NULL OR result->>'overallScore' IS NOT NULL)"
      );
      avgAnalysisScore = Math.round(parseFloat(scoreResult.rows[0]?.avg_score || '0'));

      const pendingResult = await pool.query("SELECT COUNT(*) as count FROM admin_corrections WHERE status = 'pending'");
      pendingReviews = parseInt(pendingResult.rows[0]?.count || '0');
    } catch (e) {
      console.log('[Admin Stats] DB query error:', (e as any)?.message);
    }

    const topAnalyses: Array<{id: string; title: string; score: number | null; userName: string}> = [];
    try {
      const { rows } = await pool.query(
        `SELECT id, title, user_id, COALESCE((result->'insights'->>'overallScore')::numeric, (result->>'overallScore')::numeric) as score 
         FROM conversation_analyses 
         WHERE status = 'completed' AND id NOT LIKE 'session-%'
         ORDER BY created_at DESC LIMIT 3`
      );
      const userIds = [...new Set(rows.map(r => r.user_id).filter(Boolean))];
      let userMap: Record<string, string> = {};
      if (userIds.length > 0 && allUsers?.users) {
        for (const u of allUsers.users) {
          const name = [u.user_metadata?.first_name, u.user_metadata?.last_name].filter(Boolean).join(' ') || u.email?.split('@')[0] || 'Onbekend';
          userMap[u.id] = name;
        }
      }
      for (const row of rows) {
        topAnalyses.push({
          id: row.id,
          title: row.title || 'Untitled',
          score: row.score !== null && row.score !== undefined ? Math.round(row.score) : null,
          userName: userMap[row.user_id] || 'Anoniem',
        });
      }
    } catch (e) {
      console.log('[Admin Stats] Top analyses query error:', (e as any)?.message);
    }

    const topChatSessions: Array<{id: string; technique: string; userName: string; score: number}> = [];
    if (allSessions && allSessions.length > 0) {
      for (const s of allSessions.slice(0, 3)) {
        const technique = getTechnique(s.technique_id);
        const userName = users.find((u: any) => u.id === s.user_id);
        const name = userName ? [userName.user_metadata?.first_name, userName.user_metadata?.last_name].filter(Boolean).join(' ') || userName.email?.split('@')[0] || 'Anoniem' : 'Anoniem';
        topChatSessions.push({
          id: s.id,
          technique: technique?.naam || s.technique_id || 'general',
          userName: name,
          score: Math.min(100, Math.round(50 + (s.conversation_history?.length || 0) * 2.5)),
        });
      }
    }

    res.json({
      platform: {
        totalUsers,
        activeUsers,
        newUsersThisWeek,
      },
      sessions: {
        total: totalSessions,
        recentWeek: recentSessions,
      },
      analyses: {
        total: totalAnalyses,
        completed: completedAnalyses,
        avgScore: avgAnalysisScore,
      },
      pendingReviews,
      topAnalyses,
      topChatSessions,
    });
  } catch (err: any) {
    console.error('[Admin Stats] Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ===========================================
// ADMIN WELCOME BRIEFING
// ===========================================
app.get("/api/v2/admin/welcome", async (req: Request, res: Response) => {
  try {
    const statsRes = await fetch(`http://localhost:3002/api/v2/admin/stats`);
    const stats = await statsRes.json();
    
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

// ===========================================
// USER WELCOME BRIEFING (personalized)
// ===========================================
app.get("/api/v2/user/welcome", async (req: Request, res: Response) => {
  try {
    const userId = req.query.userId as string;
    
    let userName = 'daar';
    let sessionsPlayed = 0;
    let avgScore = 0;
    let techniquesUsed: string[] = [];
    let lastTechnique: string | null = null;
    let analysesCount = 0;

    if (userId) {
      try {
        const { data: userData } = await supabase.auth.admin.getUserById(userId);
        if (userData?.user) {
          const fn = userData.user.user_metadata?.first_name;
          if (fn) userName = fn;
        }
      } catch (e) {}

      const { data: sessions } = await supabase
        .from('v2_sessions')
        .select('id, technique_id, total_score, conversation_history, created_at')
        .eq('user_id', userId)
        .eq('is_active', 1)
        .order('created_at', { ascending: false })
        .limit(50);

      if (sessions && sessions.length > 0) {
        sessionsPlayed = sessions.length;
        const scores = sessions.map(s => Math.min(100, Math.round(50 + (s.conversation_history?.length || 0) * 2.5)));
        avgScore = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
        
        const techIds = [...new Set(sessions.map(s => s.technique_id).filter(Boolean))];
        techniquesUsed = techIds.map(id => {
          const t = getTechnique(id);
          return t?.naam || id;
        });
        
        if (sessions[0]?.technique_id) {
          const t = getTechnique(sessions[0].technique_id);
          lastTechnique = t?.naam || sessions[0].technique_id;
        }
      }

      try {
        const analysisResult = await pool.query(
          "SELECT COUNT(*) as total FROM conversation_analyses WHERE user_id = $1 AND id NOT LIKE 'session-%'",
          [userId]
        );
        analysesCount = parseInt(analysisResult.rows[0]?.total || '0');
      } catch (e) {}
    }

    const lines: string[] = [];

    if (sessionsPlayed > 0) {
      lines.push(`Hé ${userName}, goed je weer te zien.\n`);
      lines.push(`**Jouw voortgang:** ${sessionsPlayed} sessies • gem. ${avgScore}%${analysesCount > 0 ? ` • ${analysesCount} analyse${analysesCount > 1 ? 's' : ''}` : ''}`);
      if (lastTechnique) {
        lines.push(`\nJe was laatst bezig met "${lastTechnique}". Verder gaan, of iets anders?`);
      } else {
        lines.push(`\nWaar kan ik je mee helpen?`);
      }
    } else {
      lines.push(`Hé ${userName}!\n`);
      lines.push(`Waar heb je zin in? We kunnen sparren over een techniek, een rollenspel doen, een video bekijken, of een echt gesprek analyseren. Jij zegt het maar.`);
    }

    res.json({
      welcomeMessage: lines.join('\n'),
      progress: {
        sessionsPlayed,
        avgScore,
        techniquesUsed,
        analysesCount,
        lastTechnique,
      },
      actions: sessionsPlayed > 0 ? [
        { label: lastTechnique ? `Verder met ${lastTechnique}` : 'Oefenen', action: 'continue_practice' },
        { label: 'Nieuwe techniek', action: 'new_technique' },
        { label: 'Gesprek analyseren', action: 'upload_analysis' },
        { label: 'Vraag stellen', action: 'open_question' },
      ] : [
        { label: 'Start mijn eerste oefening', action: 'first_practice' },
        { label: 'Wat is EPIC?', action: 'explain_epic' },
        { label: 'Gesprek uploaden', action: 'upload_analysis' },
      ]
    });
  } catch (err: any) {
    console.error('[User Welcome] Error:', err.message);
    res.json({
      welcomeMessage: `Hallo! Waar kan ik je vandaag mee helpen?`,
      progress: null,
      actions: []
    });
  }
});

// Health check - now shows FULL engine
app.get("/api/health", (req, res) => {
  res.json({ 
    status: "ok", 
    timestamp: new Date().toISOString(),
    activeSessions: sessions.size,
    engine: "V2-FULL",
    features: [
      "nested-prompts",
      "rag-grounding",
      "validation-loop",
      "hugo-persona-ssot",
      "detector-patterns",
      "livekit-audio",
      "heygen-video"
    ]
  });
});

// Hugo Agent router — platform management chat for Hugo Herbots
app.use("/api/hugo-agent", hugoAgentRouter);

// Error handler
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error("[API] Error:", err);
  res.status(err.status || 500).json({ message: err.message || "Internal Server Error" });
});

// Start server on port 3001 (backend API)
const PORT = parseInt(process.env.API_PORT || "3001", 10);

// ===========================================
// CROSS-PLATFORM API ALIASES (.com → .ai)
// These endpoints match what the .com Replit expects
// ===========================================

// Primary endpoint for .com platform: /api/v2/chat
// Returns rich responses with content suggestions (videos, slides, webinars, roleplay)
app.post("/api/v2/chat", async (req, res) => {
  const { message, userId, sessionId, conversationHistory, techniqueContext, sourceApp } = req.body;
  
  console.log(`[API] /api/v2/chat from ${sourceApp || 'unknown'}, userId: ${userId || 'anonymous'}`);
  
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
      userId: userId || undefined,
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
        userId: userId || undefined
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
  const { message, userId, conversationHistory, techniqueContext, sourceApp } = req.body;
  
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
      userId: userId || undefined,
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
  const { message, userId, conversationHistory } = req.body;
  
  if (!message) {
    return res.status(400).json({ error: "message is required" });
  }

  try {
    const history: CoachMessage[] = (conversationHistory || []).map((m: any) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content
    }));
    
    const coachResult = await generateCoachResponse(message, history, {
      userId: userId || undefined
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
  const userId = req.query.userId as string;
  
  if (!userId) {
    return res.status(400).json({ error: "userId required" });
  }
  
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
    res.status(500).json({ error: error.message });
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
    res.status(500).json({ error: error.message });
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
    res.status(500).json({ error: error.message });
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
    res.status(500).json({ error: error.message });
  }
});

// =============================================================================
// SSO HANDOFF TOKEN ENDPOINTS - Cross-platform authentication
// =============================================================================

// POST /api/sso/generate-token - Generate SSO handoff token for cross-platform auth
app.post("/api/sso/generate-token", async (req, res) => {
  try {
    const { userId, sourcePlatform, targetPlatform, targetPath, ttlSeconds = 60 } = req.body;

    if (!userId) {
      return res.status(400).json({ error: "userId is required" });
    }

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
      return res.status(500).json({ error: error.message });
    }

    const token = data;
    console.log(`[SSO] Token generated successfully (expires in ${ttlSeconds}s)`);

    // Build the redirect URL
    const targetBaseUrl = targetPlatform === 'ai' 
      ? 'https://hugoherbots-ai-chat.replit.app'
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
    res.status(500).json({ error: error.message });
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
      return res.status(500).json({ error: error.message });
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
    res.status(500).json({ error: error.message });
  }
});

// POST /api/sso/cleanup - Clean up expired tokens (can be called by cron)
app.post("/api/sso/cleanup", async (req, res) => {
  try {
    console.log("[SSO] Running token cleanup...");
    
    const { error } = await supabase.rpc('cleanup_expired_handoff_tokens');
    
    if (error) {
      console.error("[SSO] Cleanup error:", error);
      return res.status(500).json({ error: error.message });
    }

    console.log("[SSO] Cleanup completed successfully");
    res.json({ success: true, message: "Expired tokens cleaned up" });
  } catch (error: any) {
    console.error("[SSO] Cleanup error:", error);
    res.status(500).json({ error: error.message });
  }
});

const server = createServer(app);

// Setup ElevenLabs Scribe WebSocket for STT
setupScribeWebSocket(server);

async function startServer() {
  // ============================================================================
  // WEBSITE ANALYSIS & EPIC SLIDES ENDPOINTS
  // ============================================================================

  app.post("/api/v2/company/analyze", async (req: Request, res: Response) => {
    try {
      const { website, bedrijfsnaam } = req.body;
      
      if (!website && !bedrijfsnaam) {
        return res.status(400).json({ error: "website or bedrijfsnaam required" });
      }
      
      const { analyzeCompanyWebsite } = await import("./v2/website-analyzer");
      const profile = await analyzeCompanyWebsite(website || bedrijfsnaam, bedrijfsnaam);
      
      res.json({ success: true, profile });
    } catch (error: any) {
      console.error("[API] Company analyze error:", error.message);
      res.status(500).json({ error: "Website analysis failed" });
    }
  });

  app.get("/api/v2/slides/:techniqueId", async (req: Request, res: Response) => {
    try {
      const techniqueId = req.params.techniqueId as string;
      const { getSlidesForTechnique } = await import("./v2/epic-slides-service");
      const slides = getSlidesForTechnique(techniqueId);
      res.json({ slides });
    } catch (error: any) {
      console.error("[API] Slides error:", error.message);
      res.status(500).json({ error: "Failed to load slides" });
    }
  });

  app.get("/api/v2/slides", async (_req: Request, res: Response) => {
    try {
      const { getAllSlides } = await import("./v2/epic-slides-service");
      const slides = getAllSlides();
      res.json({ slides });
    } catch (error: any) {
      console.error("[API] Slides error:", error.message);
      res.status(500).json({ error: "Failed to load slides" });
    }
  });

  const API_PORT = parseInt(process.env.PORT || process.env.API_PORT || "3002", 10);
  server.listen(API_PORT, "0.0.0.0", () => {
    console.log(`[API] Hugo Engine V2 FULL API running on port ${API_PORT}`);
    console.log(`[API] Features: nested-prompts, rag-grounding, validation-loop, livekit-audio`);
  });
}

startServer();

export { app, server };
