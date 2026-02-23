/**
 * reference-answers.ts
 * 
 * Stores "golden standard" answers from expert sessions.
 * When Hugo (the human) records a roleplay, his seller responses
 * are saved here as the correct reference for coaching.
 * 
 * Integrated via:
 * - POST /api/v2/session/save-reference (auto-saves during roleplay)
 * - AdminChatExpertMode.tsx ✓/✗ buttons for manual validation
 */

import fs from "fs";
import path from "path";

export interface ReferenceAnswer {
  id: string;
  techniqueId: string;           // Expert's selected technique (ground truth)
  customerSignal: string;
  customerMessage: string;
  sellerResponse: string;
  context: {
    sector?: string;
    product?: string;
    klantType?: string;
  };
  recordedAt: string;
  recordedBy: string;
  
  // Voortschrijdend inzicht fields - for learning from corrections
  detectedTechnique?: string;    // What AI detected (may differ from expert)
  detectedConfidence?: number;   // AI's confidence score (0-1)
  isCorrection?: boolean;        // True if expert disagreed with AI detection
  correctionNote?: string;       // Optional note explaining the correction
}

export interface ReferenceAnswerStore {
  version: string;
  answers: ReferenceAnswer[];
}

const STORE_PATH = path.join(process.cwd(), "data", "reference_answers.json");

function loadStore(): ReferenceAnswerStore {
  if (!fs.existsSync(STORE_PATH)) {
    const dir = path.dirname(STORE_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    return { version: "1.0", answers: [] };
  }
  return JSON.parse(fs.readFileSync(STORE_PATH, "utf-8"));
}

function saveStore(store: ReferenceAnswerStore): void {
  const dir = path.dirname(STORE_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(STORE_PATH, JSON.stringify(store, null, 2));
}

export function saveReferenceAnswer(answer: Omit<ReferenceAnswer, "id" | "recordedAt">): ReferenceAnswer {
  const store = loadStore();
  const newAnswer: ReferenceAnswer = {
    ...answer,
    id: `ref-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    recordedAt: new Date().toISOString(),
  };
  store.answers.push(newAnswer);
  saveStore(store);
  console.log(`[reference-answers] Saved reference answer for ${answer.techniqueId} / ${answer.customerSignal}`);
  
  // If this is a correction, run config consistency analysis
  // analyzeCorrection automatically saves any conflicts it finds
  if (newAnswer.isCorrection) {
    // Use async import and fire-and-forget pattern
    import('./config-consistency').then(({ analyzeCorrection }) => {
      const conflicts = analyzeCorrection(newAnswer);
      if (conflicts.length > 0) {
        console.log(`[reference-answers] Found ${conflicts.length} config conflicts for correction`);
      }
    }).catch((error) => {
      console.log('[reference-answers] Config consistency check unavailable:', error);
    });
  }
  
  return newAnswer;
}

export function getReferenceAnswers(techniqueId?: string, signal?: string): ReferenceAnswer[] {
  const store = loadStore();
  let answers = store.answers;
  
  if (techniqueId) {
    answers = answers.filter(a => a.techniqueId === techniqueId);
  }
  if (signal) {
    answers = answers.filter(a => a.customerSignal === signal);
  }
  
  return answers;
}

export function findBestReferenceAnswer(
  techniqueId: string, 
  customerSignal: string,
  context?: { sector?: string; product?: string }
): ReferenceAnswer | null {
  const answers = getReferenceAnswers(techniqueId, customerSignal);
  
  if (answers.length === 0) return null;
  
  // Prefer answers with matching context
  if (context?.sector) {
    const contextMatch = answers.find(a => 
      a.context.sector?.toLowerCase() === context.sector?.toLowerCase()
    );
    if (contextMatch) return contextMatch;
  }
  
  // Return most recent
  return answers[answers.length - 1];
}

export function deleteReferenceAnswer(id: string): boolean {
  const store = loadStore();
  const idx = store.answers.findIndex(a => a.id === id);
  if (idx === -1) return false;
  store.answers.splice(idx, 1);
  saveStore(store);
  return true;
}

export function getAllReferenceAnswersGrouped(): Record<string, Record<string, ReferenceAnswer[]>> {
  const store = loadStore();
  const grouped: Record<string, Record<string, ReferenceAnswer[]>> = {};
  
  for (const answer of store.answers) {
    if (!grouped[answer.techniqueId]) {
      grouped[answer.techniqueId] = {};
    }
    if (!grouped[answer.techniqueId][answer.customerSignal]) {
      grouped[answer.techniqueId][answer.customerSignal] = [];
    }
    grouped[answer.techniqueId][answer.customerSignal].push(answer);
  }
  
  return grouped;
}

// ============================================
// VOORTSCHRIJDEND INZICHT - Learning Functions
// ============================================

export interface MisclassificationReport {
  totalAnswers: number;
  totalCorrections: number;
  correctionRate: number;
  byMisclassification: Record<string, {
    detected: string;
    shouldBe: string;
    count: number;
    examples: Array<{
      sellerResponse: string;
      customerMessage: string;
    }>;
  }>;
}

/**
 * Get all corrections where expert disagreed with AI detection
 */
export function getCorrections(): ReferenceAnswer[] {
  const store = loadStore();
  return store.answers.filter(a => a.isCorrection === true);
}

/**
 * Get expert examples for a specific technique (for few-shot learning)
 * Prioritizes corrections as they represent edge cases the AI got wrong
 */
export function getExamplesForTechnique(techniqueId: string, limit: number = 5): ReferenceAnswer[] {
  const store = loadStore();
  const matching = store.answers.filter(a => a.techniqueId === techniqueId);
  
  // Sort: corrections first (most valuable for learning), then by recency
  matching.sort((a, b) => {
    if (a.isCorrection && !b.isCorrection) return -1;
    if (!a.isCorrection && b.isCorrection) return 1;
    return new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime();
  });
  
  return matching.slice(0, limit);
}

/**
 * Generate misclassification report showing where AI makes mistakes
 */
export function generateMisclassificationReport(): MisclassificationReport {
  const store = loadStore();
  const corrections = store.answers.filter(a => a.isCorrection === true);
  
  const byMisclassification: MisclassificationReport['byMisclassification'] = {};
  
  for (const correction of corrections) {
    const key = `${correction.detectedTechnique || 'unknown'} → ${correction.techniqueId}`;
    
    if (!byMisclassification[key]) {
      byMisclassification[key] = {
        detected: correction.detectedTechnique || 'unknown',
        shouldBe: correction.techniqueId,
        count: 0,
        examples: []
      };
    }
    
    byMisclassification[key].count++;
    if (byMisclassification[key].examples.length < 3) {
      byMisclassification[key].examples.push({
        sellerResponse: correction.sellerResponse,
        customerMessage: correction.customerMessage
      });
    }
  }
  
  return {
    totalAnswers: store.answers.length,
    totalCorrections: corrections.length,
    correctionRate: store.answers.length > 0 
      ? corrections.length / store.answers.length 
      : 0,
    byMisclassification
  };
}
