/**
 * Response Repair - Regenerates invalid responses with mode-specific hints
 * 
 * When validator returns INVALID:
 * 1. Take the original prompt + response
 * 2. Add the validation reason + repair hint
 * 3. Ask LLM to regenerate following the mode-specific style
 */

import { getOpenAIClient } from "./rag-service";
import { validateResponse, type SessionMode, type ValidationResult } from "./response-validator";
import * as fs from "fs";
import * as path from "path";

export interface RepairResult {
  originalResponse: string;
  repairedResponse: string;
  wasRepaired: boolean;
  validationResult: ValidationResult;
  initialValidation: ValidationResult;
  repairAttempts: number;
}

/**
 * ValidatorDebugInfo - Frontend-facing debug info for validator/repair process
 * Shows what the evaluator checked and what repair suggested
 */
export interface ValidatorDebugInfo {
  mode: SessionMode;
  initialValidation: {
    label: string;
    confidence: number;
    reasoning: string;
    violations?: string[];
  };
  finalValidation?: {
    label: string;
    confidence: number;
    reasoning: string;
    violations?: string[];
  };
  repairAttempts: number;
  wasRepaired: boolean;
  configSectionsUsed: string[];
}

export interface RepairMetrics {
  mode: SessionMode;
  originalValid: boolean;
  repairAttempts: number;
  finalValid: boolean;
  totalTimeMs: number;
}

const MAX_REPAIR_ATTEMPTS = 2;

const MODE_CONFIG_FILES: Record<SessionMode, string> = {
  CONTEXT_GATHERING: "config/prompts/context_prompt.json",
  COACH_CHAT: "config/prompts/coach_prompt.json",
  FEEDBACK: "config/prompts/feedback_prompt.json",
  ROLEPLAY: "config/prompts/roleplay_prompt.json",
};

let configCache: Record<string, any> = {};

function loadModeConfig(mode: SessionMode): any {
  const filePath = MODE_CONFIG_FILES[mode];
  
  if (configCache[filePath]) {
    return configCache[filePath];
  }
  
  const fullPath = path.join(process.cwd(), filePath);
  const content = fs.readFileSync(fullPath, "utf-8");
  const config = JSON.parse(content);
  
  configCache[filePath] = config;
  return config;
}

export function clearRepairCache(): void {
  configCache = {};
}

function extractStyleGuidance(config: any, mode: SessionMode): string {
  const parts: string[] = [];
  
  if (mode === "COACH_CHAT") {
    if (config.coaching_richtlijn?.tekst) parts.push(config.coaching_richtlijn.tekst);
    if (config.doel) parts.push(`DOEL: ${config.doel}`);
  }
  
  if (mode === "CONTEXT_GATHERING") {
    if (config.context_richtlijn?.tekst) parts.push(config.context_richtlijn.tekst);
    if (config.doel) parts.push(`DOEL: ${config.doel}`);
  }
  
  if (mode === "FEEDBACK") {
    if (config.feedback_richtlijn?.tekst) parts.push(config.feedback_richtlijn.tekst);
    if (config.doel) parts.push(`DOEL: ${config.doel}`);
  }
  
  if (mode === "ROLEPLAY" && config.doel) {
    parts.push(config.doel);
  }
  
  return parts.join("\n\n");
}

/**
 * Get config section names used for validation/repair in this mode
 */
export function getConfigSectionsUsed(mode: SessionMode): string[] {
  const sections: string[] = [];
  
  switch (mode) {
    case "COACH_CHAT":
      sections.push("coaching_richtlijn.tekst", "doel", "role");
      break;
    case "CONTEXT_GATHERING":
      sections.push("context_richtlijn.tekst", "doel", "role");
      break;
    case "FEEDBACK":
      sections.push("feedback_richtlijn.tekst", "doel", "role");
      break;
    case "ROLEPLAY":
      sections.push("doel", "_meta.philosophy");
      break;
  }
  
  return sections;
}

/**
 * Build ValidatorDebugInfo from RepairResult for frontend display
 * Maps ValidationResult fields to frontend-expected schema
 */
export function buildValidatorDebugInfo(
  mode: SessionMode,
  repairResult: RepairResult
): ValidatorDebugInfo {
  const extractViolations = (result: ValidationResult): string[] | undefined => {
    if (result.valid) return undefined;
    const violations: string[] = [];
    if (result.reason) violations.push(result.reason);
    if (result.repairHint) violations.push(result.repairHint);
    return violations.length > 0 ? violations : undefined;
  };
  
  const result: ValidatorDebugInfo = {
    mode,
    initialValidation: {
      label: repairResult.initialValidation.label,
      confidence: repairResult.initialValidation.valid ? 1.0 : 0.6,
      reasoning: repairResult.initialValidation.reason || 'No reasoning provided',
      violations: extractViolations(repairResult.initialValidation),
    },
    repairAttempts: repairResult.repairAttempts,
    wasRepaired: repairResult.wasRepaired,
    configSectionsUsed: getConfigSectionsUsed(mode),
  };
  
  if (repairResult.wasRepaired) {
    result.finalValidation = {
      label: repairResult.validationResult.label,
      confidence: repairResult.validationResult.valid ? 1.0 : 0.6,
      reasoning: repairResult.validationResult.reason || 'No reasoning provided',
      violations: extractViolations(repairResult.validationResult),
    };
  }
  
  return result;
}

export interface RepairOptions {
  originalSystemPrompt?: string;
  conversationHistory?: Array<{ role: string; content: string }>;
  historicalContext?: string;
  conversationContext?: string;
}

export async function repairResponse(
  originalResponse: string,
  mode: SessionMode,
  validationResult: ValidationResult,
  options?: RepairOptions
): Promise<string> {
  const client = getOpenAIClient();
  
  if (!client) {
    console.log("[Repair] No OpenAI client - returning original");
    return originalResponse;
  }
  
  const config = loadModeConfig(mode);
  const styleGuidance = extractStyleGuidance(config, mode);
  
  // Build context facts (no instructions, just what we know)
  const contextFacts: string[] = [];
  
  if (options?.conversationContext) {
    contextFacts.push(`WAT DE VERKOPER NET ZEI:\n${options.conversationContext}`);
  }
  
  if (options?.historicalContext) {
    contextFacts.push(`WAT WE WETEN OVER DEZE VERKOPER:\n${options.historicalContext}`);
  }
  
  const factsSection = contextFacts.length > 0 
    ? `\n${contextFacts.join('\n\n')}\n` 
    : '';
  
  const repairPrompt = `Je vorige response paste niet.

REDEN: ${validationResult.reason}
${factsSection}
DOEL: ${styleGuidance}

JE ORIGINELE RESPONSE:
"${originalResponse}"

Genereer een nieuwe response die WEL past.

Alleen je nieuwe response:`;

  const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [];
  
  if (options?.originalSystemPrompt) {
    messages.push({ role: "system", content: options.originalSystemPrompt });
  }
  
  if (options?.conversationHistory) {
    for (const msg of options.conversationHistory) {
      messages.push({
        role: msg.role as "user" | "assistant",
        content: msg.content,
      });
    }
  }
  
  messages.push({ role: "user", content: repairPrompt });
  
  try {
    const result = await client.chat.completions.create({
      model: "gpt-5.1",
      messages,
      max_completion_tokens: 2000,
    });
    
    const repairedContent = result.choices[0]?.message?.content;
    
    if (!repairedContent) {
      console.log("[Repair] Empty response - returning original");
      return originalResponse;
    }
    
    console.log(`[Repair] Successfully repaired ${mode} response`);
    return repairedContent;
    
  } catch (error) {
    console.error("[Repair] Error during repair:", error);
    return originalResponse;
  }
}

export async function validateAndRepair(
  response: string,
  mode: SessionMode,
  options?: {
    originalSystemPrompt?: string;
    conversationHistory?: Array<{ role: string; content: string }>;
    conversationContext?: string;
    historicalContext?: string;
  }
): Promise<RepairResult> {
  const startTime = Date.now();
  
  const initialValidation = await validateResponse(
    response,
    mode,
    {
      conversationContext: options?.conversationContext,
      historicalContext: options?.historicalContext
    }
  );
  
  if (initialValidation.valid) {
    return {
      originalResponse: response,
      repairedResponse: response,
      wasRepaired: false,
      validationResult: initialValidation,
      initialValidation: initialValidation,
      repairAttempts: 0,
    };
  }
  
  console.log(`[Repair] Response invalid (${initialValidation.label}), attempting repair...`);
  
  let currentResponse = response;
  let currentValidation = initialValidation;
  let attempts = 0;
  
  while (!currentValidation.valid && attempts < MAX_REPAIR_ATTEMPTS) {
    attempts++;
    
    currentResponse = await repairResponse(
      currentResponse,
      mode,
      currentValidation,
      {
        originalSystemPrompt: options?.originalSystemPrompt,
        conversationHistory: options?.conversationHistory,
        conversationContext: options?.conversationContext,
        historicalContext: options?.historicalContext
      }
    );
    
    currentValidation = await validateResponse(
      currentResponse,
      mode,
      {
        conversationContext: options?.conversationContext,
        historicalContext: options?.historicalContext
      }
    );
    
    if (currentValidation.valid) {
      console.log(`[Repair] Repair successful after ${attempts} attempt(s)`);
      break;
    }
    
    console.log(`[Repair] Attempt ${attempts} still invalid: ${currentValidation.label}`);
  }
  
  const totalTime = Date.now() - startTime;
  
  const metrics: RepairMetrics = {
    mode,
    originalValid: initialValidation.valid,
    repairAttempts: attempts,
    finalValid: currentValidation.valid,
    totalTimeMs: totalTime,
  };
  
  console.log(`[Repair] Metrics: ${JSON.stringify(metrics)}`);
  
  return {
    originalResponse: response,
    repairedResponse: currentResponse,
    wasRepaired: attempts > 0,
    validationResult: currentValidation,
    initialValidation: initialValidation,
    repairAttempts: attempts,
  };
}
