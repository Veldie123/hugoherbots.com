/**
 * Response Validator - Validates AI responses against mode-specific style
 * 
 * Based on "Grounded Agentic LLMs" paper approach:
 * - The .json config files ARE the ground truth
 * - Validator asks LLM: "Does this response match the style in this config?"
 * - Returns VALID/INVALID with reason for repair loop
 */

import { getOpenAIClient } from "./rag-service";
import * as fs from "fs";
import * as path from "path";

export type SessionMode = "CONTEXT_GATHERING" | "COACH_CHAT" | "FEEDBACK" | "ROLEPLAY";

export type ValidationLabel = "VALID" | "WRONG_MODE" | "TOO_DIRECTIVE" | "MIXED_SIGNALS" | "NOT_LISTENING" | "IGNORES_HISTORY";

export interface ValidationResult {
  valid: boolean;
  label: ValidationLabel;
  reason: string;
  repairHint: string | null;
}

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

function extractRelevantSections(config: any, mode: SessionMode): string {
  const sections: string[] = [];
  
  if (mode === "COACH_CHAT") {
    if (config.coaching_richtlijn?.tekst) {
      sections.push(`COACHING RICHTLIJN:\n${config.coaching_richtlijn.tekst}`);
    }
    if (config.doel) {
      sections.push(`DOEL:\n${config.doel}`);
    }
    if (config.role) {
      sections.push(`ROL:\nJe bent: ${config.role.what_you_are}\nJe bent NIET: ${config.role.what_you_are_not}`);
    }
  }
  
  if (mode === "CONTEXT_GATHERING") {
    if (config.context_richtlijn?.tekst) {
      sections.push(`CONTEXT RICHTLIJN:\n${config.context_richtlijn.tekst}`);
    }
    if (config.doel) {
      sections.push(`DOEL:\n${config.doel}`);
    }
    if (config.role) {
      sections.push(`ROL:\nJe bent: ${config.role.what_you_are}\nJe bent NIET: ${config.role.what_you_are_not}`);
    }
  }
  
  if (mode === "FEEDBACK") {
    if (config.feedback_richtlijn?.tekst) {
      sections.push(`FEEDBACK RICHTLIJN:\n${config.feedback_richtlijn.tekst}`);
    }
    if (config.doel) {
      sections.push(`DOEL:\n${config.doel}`);
    }
    if (config.role) {
      sections.push(`ROL:\nJe bent: ${config.role.what_you_are}\nJe bent NIET: ${config.role.what_you_are_not}`);
    }
  }
  
  if (mode === "ROLEPLAY") {
    if (config.doel) {
      sections.push(`DOEL:\n${config.doel}`);
    }
    if (config._meta?.philosophy) {
      sections.push(`FILOSOFIE:\n${config._meta.philosophy}`);
    }
  }
  
  return sections.join("\n\n---\n\n");
}

export interface ValidatorOptions {
  conversationContext?: string;
  historicalContext?: string;
}

export async function validateResponse(
  response: string,
  mode: SessionMode,
  options?: ValidatorOptions | string
): Promise<ValidationResult> {
  const client = getOpenAIClient();
  
  // Support both old string signature and new options object
  const opts: ValidatorOptions = typeof options === 'string' 
    ? { conversationContext: options } 
    : (options || {});
  
  const { conversationContext, historicalContext } = opts;
  
  if (!client) {
    console.log("[Validator] No OpenAI client - skipping validation");
    return {
      valid: true,
      label: "VALID",
      reason: "Validation skipped - no API key",
      repairHint: null,
    };
  }
  
  const config = loadModeConfig(mode);
  const groundTruth = extractRelevantSections(config, mode);
  
  const hasConversation = conversationContext && conversationContext.trim().length > 0;
  const hasHistory = historicalContext && historicalContext.trim().length > 0;
  const hasContext = hasConversation || hasHistory;
  
  const validationPrompt = `Je bent een validator. Je taak is om te beoordelen of een AI-response past bij deze verkoper en situatie.

MODE: ${mode}

DOEL (uit config):
${groundTruth}

${hasHistory ? `WAT WE WETEN OVER DEZE VERKOPER:
${historicalContext}

` : ""}${hasConversation ? `DIT GESPREK:
${conversationContext}

` : ""}RESPONSE OM TE VALIDEREN:
"${response}"

VALIDATIE CRITERIA:
1. Past deze response bij het DOEL?
${hasConversation ? `2. Reageert Hugo op wat de verkoper NET zei? (luistert hij echt?)
3. Als verkoper zegt dat iets goed gaat, respecteert Hugo dat dan?` : ''}
${hasHistory ? `4. Past deze response bij wat we WETEN over deze verkoper? (scores, patronen, eerdere gesprekken)` : ''}

Antwoord in JSON:
{
  "valid": true/false,
  "label": "VALID" | "WRONG_MODE" | "TOO_DIRECTIVE" | "MIXED_SIGNALS" | "NOT_LISTENING" | "IGNORES_HISTORY",
  "reason": "korte uitleg waarom",
  "repair_hint": "wat moet anders (of null als valid)"
}

Labels:
- VALID: Past bij doel${hasContext ? ', luistert naar verkoper, respecteert historie' : ''}
- WRONG_MODE: Gedraagt zich als een andere mode
- TOO_DIRECTIVE: Geeft oplossingen terwijl hij vragen moet stellen
- MIXED_SIGNALS: Inconsistente stijl
- NOT_LISTENING: Negeert wat verkoper net zei
- IGNORES_HISTORY: Negeert wat we weten over deze verkoper (bv. vraagt naar problemen terwijl verkoper hier sterk in is)

Alleen JSON antwoorden:`;

  try {
    const startTime = Date.now();
    
    const result = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "user", content: validationPrompt },
      ],
      max_completion_tokens: 500,
      response_format: { type: "json_object" },
    });
    
    const content = result.choices[0]?.message?.content;
    const validationTime = Date.now() - startTime;
    
    if (!content) {
      console.log("[Validator] Empty response from validator LLM");
      return {
        valid: true,
        label: "VALID",
        reason: "Validation failed - empty response",
        repairHint: null,
      };
    }
    
    const parsed = JSON.parse(content);
    
    console.log(`[Validator] ${mode} validation: ${parsed.label} (${validationTime}ms)`);
    if (!parsed.valid) {
      console.log(`[Validator] Reason: ${parsed.reason}`);
    }
    
    return {
      valid: parsed.valid,
      label: parsed.label || "VALID",
      reason: parsed.reason || "",
      repairHint: parsed.repair_hint || null,
    };
    
  } catch (error) {
    console.error("[Validator] Error during validation:", error);
    return {
      valid: true,
      label: "VALID",
      reason: "Validation error - defaulting to valid",
      repairHint: null,
    };
  }
}

export function clearValidatorCache(): void {
  configCache = {};
}
