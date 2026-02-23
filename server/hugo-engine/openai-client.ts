// OpenAI client using Replit AI Integrations
// SIMPLIFIED for V2 engine - V1 functions archived to server/_archive/openai-v1.ts
import OpenAI from "openai";

const openai = new OpenAI({
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY
});

/**
 * Get the configured OpenAI client instance.
 * Used by V2 engine modules.
 */
export function getOpenAI(): OpenAI {
  return openai;
}

// ==========================================
// V1 STUBS - These functions are archived
// Original code in server/_archive/openai-v1.ts
// ==========================================

export type DebugInfo = any;

export async function getChatCompletionStream(...args: any[]): Promise<any> {
  throw new Error("V1 getChatCompletionStream archived - use V2 engine");
}

export async function getChatCompletion(...args: any[]): Promise<any> {
  throw new Error("V1 getChatCompletion archived - use V2 engine");
}

export async function generateDynamicGreeting(...args: any[]): Promise<string> {
  throw new Error("V1 generateDynamicGreeting archived - use V2 engine");
}

export function parseHugoResponse(...args: any[]): any {
  throw new Error("V1 parseHugoResponse archived - use V2 engine");
}

export function sanitizeRoleplayCustomerText(text: string): string {
  // Keep this as it's used for basic cleanup
  let cleaned = text.trim();
  cleaned = cleaned.replace(/```[\s\S]*?```/g, '').trim();
  cleaned = cleaned.replace(/\{[\s\S]*\}$/g, '').trim();
  return cleaned || text.trim();
}

export async function getEvaluationCompletion(...args: any[]): Promise<any> {
  throw new Error("V1 getEvaluationCompletion archived - use V2 engine");
}
