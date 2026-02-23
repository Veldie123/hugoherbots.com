/**
 * config-consistency.ts
 * 
 * Checks for conflicts between golden standard corrections (from reference-answers.ts)
 * and the EPIC methodology config files (detectors.json, ssot/technieken_index.json, etc.)
 * 
 * When an expert disagrees with AI detection, this service analyzes WHY the conflict
 * occurred and suggests specific config changes to improve future detection.
 * 
 * Integrated via AdminConfigReview.tsx - shows pending/approved/rejected configs
 */

import fs from "fs";
import path from "path";
import { ReferenceAnswer } from "./reference-answers";

export interface ConflictFinding {
  id: string;
  correctionId: string;
  severity: 'high' | 'medium' | 'low';
  configFile: string;
  techniqueId: string;
  conflictType: 'pattern_overlap' | 'missing_definition' | 'conceptual_ambiguity' | 'detector_mismatch';
  description: string;
  suggestedChange?: string;
  createdAt: string;  // ISO timestamp when conflict was registered
  resolvedAt?: string;
  resolvedBy?: string;
  // Session context for customer response feedback
  sessionContext?: {
    sessionId: string;
    turnNumber: number;
    customerMessage: string;
    customerSignal: string;
    currentPhase: number;
    expertComment: string;
    context?: {
      sector?: string;
      product?: string;
      klantType?: string;
      persona?: {
        name?: string;
        behavior_style?: string;
        buying_clock_stage?: string;
        experience_level?: string;
        difficulty_level?: string;
      };
    };
    // Full conversation history for review
    conversationHistory?: Array<{
      role: 'user' | 'assistant' | 'system';
      content: string;
      signal?: string;
    }>;
  };
}

interface ConflictStore {
  version: string;
  conflicts: ConflictFinding[];
}

interface DetectorConfig {
  version: string;
  lexicon: Record<string, string[]>;
  semantics: Record<string, any>;
  techniques: Record<string, {
    naam: string;
    patterns: string[];
    semantic?: string[];
    confidence_threshold?: number;
    [key: string]: any;
  }>;
  themes?: Record<string, any>;
}

interface TechniqueConceptConfig {
  _meta: Record<string, string>;
  technieken: Record<string, {
    naam: string;
    concept: string;
    doel?: string;
    signalen_correct: string[];
    signalen_fout: string[];
    subtechnieken?: Record<string, any>;
    [key: string]: any;
  }>;
  attitude_responses?: Record<string, any>;
}

interface TechniekCatalogEntry {
  nummer: string;
  naam: string;
  fase: string;
  parent?: string;
  wat?: string;
  waarom?: string;
  wanneer?: string;
  hoe?: string;
  voorbeeld?: string[];
  [key: string]: any;
}

interface KlantHoudingConfig {
  _meta: Record<string, any>;
  houdingen: Record<string, {
    id: string;
    naam: string;
    beschrijving: string;
    signalen: string[];
    detection_patterns: string[];
    techniek_reactie: Record<string, any> | string;
    [key: string]: any;
  }>;
}

import { loadMergedTechniques, type MergedTechnique } from '../ssot-loader';

const CONFLICTS_PATH = path.join(process.cwd(), "data", "config_conflicts.json");
const DETECTORS_PATH = path.join(process.cwd(), "config", "detectors.json");
const HOUDINGEN_PATH = path.join(process.cwd(), "config", "klant_houdingen.json");

function loadConflictStore(): ConflictStore {
  if (!fs.existsSync(CONFLICTS_PATH)) {
    const dir = path.dirname(CONFLICTS_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    return { version: "1.0", conflicts: [] };
  }
  const store: ConflictStore = JSON.parse(fs.readFileSync(CONFLICTS_PATH, "utf-8"));
  
  // Backfill: Add createdAt to legacy conflicts without it
  let needsSave = false;
  for (const conflict of store.conflicts) {
    if (!conflict.createdAt) {
      // Use resolvedAt if available, otherwise use a fallback timestamp
      conflict.createdAt = conflict.resolvedAt || '2024-01-01T00:00:00.000Z';
      needsSave = true;
    }
  }
  if (needsSave) {
    fs.writeFileSync(CONFLICTS_PATH, JSON.stringify(store, null, 2));
    console.log('[config-consistency] Backfilled createdAt for legacy conflicts');
  }
  
  return store;
}

function saveConflictStore(store: ConflictStore): void {
  const dir = path.dirname(CONFLICTS_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(CONFLICTS_PATH, JSON.stringify(store, null, 2));
}

function loadDetectors(): DetectorConfig | null {
  if (!fs.existsSync(DETECTORS_PATH)) return null;
  return JSON.parse(fs.readFileSync(DETECTORS_PATH, "utf-8"));
}

function loadCatalog(): readonly MergedTechnique[] {
  return loadMergedTechniques();
}

function loadHoudingen(): KlantHoudingConfig | null {
  if (!fs.existsSync(HOUDINGEN_PATH)) return null;
  return JSON.parse(fs.readFileSync(HOUDINGEN_PATH, "utf-8"));
}

function generateConflictId(): string {
  return `conflict-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Helper to create a ConflictFinding with auto-generated id and createdAt
 */
function createFinding(data: Omit<ConflictFinding, 'id' | 'createdAt'>): ConflictFinding {
  return {
    ...data,
    id: generateConflictId(),
    createdAt: new Date().toISOString()
  };
}

/**
 * Check if any pattern from a list matches the text (case-insensitive)
 */
function patternsMatch(text: string, patterns: string[]): string[] {
  const lowerText = text.toLowerCase();
  return patterns.filter(p => lowerText.includes(p.toLowerCase()));
}

/**
 * Calculate similarity between two technique descriptions using word overlap
 */
function conceptSimilarity(concept1: string, concept2: string): number {
  const words1Arr = concept1.toLowerCase().split(/\s+/).filter(w => w.length > 3);
  const words2Arr = concept2.toLowerCase().split(/\s+/).filter(w => w.length > 3);
  const words1 = new Set(words1Arr);
  const words2 = new Set(words2Arr);
  
  const intersection = Array.from(words1).filter(w => words2.has(w)).length;
  const unionArr = Array.from(words1).concat(Array.from(words2));
  const union = new Set(unionArr).size;
  
  return union > 0 ? intersection / union : 0;
}

/**
 * Analyze a correction and detect config conflicts
 * 
 * @param correction - The reference answer where expert disagreed with AI
 * @returns Array of conflict findings
 */
export function analyzeCorrection(correction: ReferenceAnswer): ConflictFinding[] {
  if (!correction.isCorrection || !correction.detectedTechnique) {
    return [];
  }

  const findings: ConflictFinding[] = [];
  const detectors = loadDetectors();
  const catalog = loadCatalog();
  
  const correctTechnique = correction.techniqueId;
  const wrongTechnique = correction.detectedTechnique;
  const sellerText = correction.sellerResponse.toLowerCase();

  console.log(`[config-consistency] Analyzing correction: ${wrongTechnique} → ${correctTechnique}`);

  // ============================================
  // 1. Check for DETECTOR_MISMATCH
  // ============================================
  if (detectors) {
    const correctDetector = detectors.techniques[correctTechnique];
    const wrongDetector = detectors.techniques[wrongTechnique];

    // Check if the wrong technique's patterns match the seller response
    if (wrongDetector?.patterns) {
      const wrongMatches = patternsMatch(sellerText, wrongDetector.patterns);
      if (wrongMatches.length > 0) {
        findings.push(createFinding({
          correctionId: correction.id,
          severity: 'high',
          configFile: 'detectors.json',
          techniqueId: wrongTechnique,
          conflictType: 'detector_mismatch',
          description: `Pattern(s) "${wrongMatches.join('", "')}" in ${wrongTechnique} matched seller response, but expert says this is ${correctTechnique}`,
          suggestedChange: `Consider removing pattern(s) "${wrongMatches.join('", "')}" from technique ${wrongTechnique} or adding distinguishing patterns to ${correctTechnique}`
        }));
      }
    }

    // Check if correct technique patterns are missing from seller response
    if (correctDetector?.patterns) {
      const correctMatches = patternsMatch(sellerText, correctDetector.patterns);
      if (correctMatches.length === 0) {
        // Find potential patterns to add from the seller response
        const words = sellerText.split(/\s+/).filter(w => w.length > 2);
        const uniqueWords = Array.from(new Set(words)).slice(0, 3);
        
        findings.push(createFinding({
          correctionId: correction.id,
          severity: 'medium',
          configFile: 'detectors.json',
          techniqueId: correctTechnique,
          conflictType: 'detector_mismatch',
          description: `No patterns from ${correctTechnique} matched the seller response, yet expert classified it as ${correctTechnique}`,
          suggestedChange: `Consider adding new pattern(s) to ${correctTechnique}. Candidate words from response: "${uniqueWords.join('", "')}"`
        }));
      }
    }

    // Check if correct technique is missing from detectors entirely
    if (!correctDetector) {
      findings.push(createFinding({
        correctionId: correction.id,
        severity: 'high',
        configFile: 'detectors.json',
        techniqueId: correctTechnique,
        conflictType: 'missing_definition',
        description: `Technique ${correctTechnique} has no detector configuration`,
        suggestedChange: `Add detector entry for ${correctTechnique} in detectors.json with appropriate patterns`
      }));
    }
  }

  // ============================================
  // 2. Check for PATTERN_OVERLAP between techniques
  // ============================================
  if (detectors) {
    const correctPatterns = detectors.techniques[correctTechnique]?.patterns || [];
    const wrongPatterns = detectors.techniques[wrongTechnique]?.patterns || [];
    
    const overlap = correctPatterns.filter(p => 
      wrongPatterns.some(wp => wp.toLowerCase() === p.toLowerCase())
    );
    
    if (overlap.length > 0) {
      findings.push(createFinding({
        correctionId: correction.id,
        severity: 'high',
        configFile: 'detectors.json',
        techniqueId: correctTechnique,
        conflictType: 'pattern_overlap',
        description: `Pattern(s) "${overlap.join('", "')}" appear in both ${correctTechnique} and ${wrongTechnique}`,
        suggestedChange: `Remove overlapping patterns from one technique or add semantic constraints to differentiate`
      }));
    }

    // Check for partial pattern matches (one pattern contains another)
    for (const cp of correctPatterns) {
      for (const wp of wrongPatterns) {
        if (cp !== wp && (cp.includes(wp) || wp.includes(cp))) {
          findings.push(createFinding({
            correctionId: correction.id,
            severity: 'medium',
            configFile: 'detectors.json',
            techniqueId: correctTechnique,
            conflictType: 'pattern_overlap',
            description: `Pattern "${cp}" (${correctTechnique}) and "${wp}" (${wrongTechnique}) have substring overlap`,
            suggestedChange: `Make patterns more specific to avoid false matches`
          }));
        }
      }
    }
  }

  // ============================================
  // 3. Check SSOT CATALOG for missing technique
  // ============================================
  const catalogEntry = catalog.find(t => t.nummer === correctTechnique);
  if (!catalogEntry) {
    findings.push(createFinding({
      correctionId: correction.id,
      severity: 'high',
      configFile: 'ssot/technieken_index.json',
      techniqueId: correctTechnique,
      conflictType: 'missing_definition',
      description: `Technique ${correctTechnique} is not defined in the SSOT`,
      suggestedChange: `Add full technique definition for ${correctTechnique} in ssot/technieken_index.json`
    }));
  }

  // Store findings
  if (findings.length > 0) {
    const store = loadConflictStore();
    store.conflicts.push(...findings);
    saveConflictStore(store);
    console.log(`[config-consistency] Found ${findings.length} conflicts for correction ${correction.id}`);
  }

  return findings;
}

/**
 * Get all recorded conflicts
 */
export function getAllConflicts(): ConflictFinding[] {
  const store = loadConflictStore();
  return store.conflicts;
}

/**
 * Add a single conflict directly (for evaluation feedback, etc.)
 */
export function addConflict(conflict: Omit<ConflictFinding, 'id' | 'createdAt'>): ConflictFinding {
  const store = loadConflictStore();
  const newConflict: ConflictFinding = {
    ...conflict,
    id: generateConflictId(),
    createdAt: new Date().toISOString()
  };
  store.conflicts.push(newConflict);
  saveConflictStore(store);
  console.log(`[config-consistency] Added conflict ${newConflict.id}: ${newConflict.description}`);
  return newConflict;
}

/**
 * Get only unresolved conflicts
 */
export function getUnresolvedConflicts(): ConflictFinding[] {
  const store = loadConflictStore();
  return store.conflicts.filter(c => !c.resolvedAt);
}

/**
 * Mark a conflict as resolved
 */
export function resolveConflict(conflictId: string, resolvedBy: string): boolean {
  const store = loadConflictStore();
  const conflict = store.conflicts.find(c => c.id === conflictId);
  
  if (!conflict) {
    console.log(`[config-consistency] Conflict ${conflictId} not found`);
    return false;
  }

  conflict.resolvedAt = new Date().toISOString();
  conflict.resolvedBy = resolvedBy;
  saveConflictStore(store);
  
  console.log(`[config-consistency] Conflict ${conflictId} resolved by ${resolvedBy}`);
  return true;
}

/**
 * Generate a config patch suggestion for a specific conflict
 * Returns the file and proposed changes
 */
export function generateConfigPatch(conflictId: string): { file: string; patch: object } | null {
  const store = loadConflictStore();
  const conflict = store.conflicts.find(c => c.id === conflictId);
  
  if (!conflict) {
    console.log(`[config-consistency] Conflict ${conflictId} not found`);
    return null;
  }

  const detectors = loadDetectors();

  switch (conflict.conflictType) {
    case 'pattern_overlap': {
      if (!detectors) return null;
      
      // Suggest removing overlapping pattern from the wrong technique
      const wrongTechnique = conflict.description.match(/both (\d+\.\d+\.?\d*) and/)?.[1];
      const pattern = conflict.description.match(/Pattern\(s\) "([^"]+)"/)?.[1];
      
      if (wrongTechnique && pattern && detectors.techniques[wrongTechnique]) {
        const currentPatterns = detectors.techniques[wrongTechnique].patterns || [];
        const newPatterns = currentPatterns.filter(p => p !== pattern);
        
        return {
          file: 'config/detectors.json',
          patch: {
            operation: 'update',
            path: `techniques.${wrongTechnique}.patterns`,
            currentValue: currentPatterns,
            newValue: newPatterns,
            reason: `Remove overlapping pattern "${pattern}" to prevent false matches`
          }
        };
      }
      break;
    }

    case 'detector_mismatch': {
      if (!detectors) return null;
      
      if (conflict.description.includes('No patterns from')) {
        // Need to add patterns
        const candidates = conflict.suggestedChange?.match(/Candidate words from response: "([^"]+)"/)?.[1];
        if (candidates) {
          const newPatterns = candidates.split('", "');
          const currentPatterns = detectors.techniques[conflict.techniqueId]?.patterns || [];
          
          return {
            file: 'config/detectors.json',
            patch: {
              operation: 'add_patterns',
              path: `techniques.${conflict.techniqueId}.patterns`,
              currentValue: currentPatterns,
              newValue: [...currentPatterns, ...newPatterns],
              reason: `Add patterns to improve detection of ${conflict.techniqueId}`
            }
          };
        }
      }
      break;
    }

    case 'missing_definition': {
      const catalog = loadCatalog();
      const catalogEntry = catalog.find(t => t.nummer === conflict.techniqueId);
      
      if (conflict.configFile === 'detectors.json') {
        return {
          file: 'config/detectors.json',
          patch: {
            operation: 'create',
            path: `techniques.${conflict.techniqueId}`,
            newValue: {
              naam: catalogEntry?.naam || `Technique ${conflict.techniqueId}`,
              patterns: [],
              semantic: [],
              confidence_threshold: 0.7
            },
            reason: `Create detector entry for ${conflict.techniqueId}`
          }
        };
      }
      
      break;
    }
  }

  return null;
}

/**
 * Get conflicts grouped by technique
 */
export function getConflictsByTechnique(): Record<string, ConflictFinding[]> {
  const conflicts = getAllConflicts();
  const grouped: Record<string, ConflictFinding[]> = {};
  
  for (const conflict of conflicts) {
    if (!grouped[conflict.techniqueId]) {
      grouped[conflict.techniqueId] = [];
    }
    grouped[conflict.techniqueId].push(conflict);
  }
  
  return grouped;
}

/**
 * Get conflict statistics
 */
export function getConflictStats(): {
  total: number;
  unresolved: number;
  bySeverity: Record<string, number>;
  byType: Record<string, number>;
  byFile: Record<string, number>;
} {
  const conflicts = getAllConflicts();
  
  const bySeverity: Record<string, number> = { high: 0, medium: 0, low: 0 };
  const byType: Record<string, number> = {};
  const byFile: Record<string, number> = {};
  
  for (const conflict of conflicts) {
    bySeverity[conflict.severity]++;
    byType[conflict.conflictType] = (byType[conflict.conflictType] || 0) + 1;
    byFile[conflict.configFile] = (byFile[conflict.configFile] || 0) + 1;
  }
  
  return {
    total: conflicts.length,
    unresolved: conflicts.filter(c => !c.resolvedAt).length,
    bySeverity,
    byType,
    byFile
  };
}

/**
 * Analyze all existing corrections and find conflicts
 * Call this to perform a full analysis of the reference answers
 */
export function analyzeAllCorrections(): ConflictFinding[] {
  const refAnswersPath = path.join(process.cwd(), "data", "reference_answers.json");
  
  if (!fs.existsSync(refAnswersPath)) {
    console.log('[config-consistency] No reference answers file found');
    return [];
  }
  
  const store = JSON.parse(fs.readFileSync(refAnswersPath, "utf-8"));
  const corrections = store.answers.filter((a: ReferenceAnswer) => a.isCorrection === true);
  
  console.log(`[config-consistency] Analyzing ${corrections.length} corrections...`);
  
  const allFindings: ConflictFinding[] = [];
  
  for (const correction of corrections) {
    const findings = analyzeCorrection(correction);
    allFindings.push(...findings);
  }
  
  console.log(`[config-consistency] Total conflicts found: ${allFindings.length}`);
  return allFindings;
}

/**
 * Apply a config patch - actually update the config file
 * This is called when Hugo clicks the ✓ button to accept a patch
 */
export function applyConfigPatch(conflictId: string): { success: boolean; message: string; file?: string } {
  const patchData = generateConfigPatch(conflictId);
  
  if (!patchData) {
    return { success: false, message: 'Geen patch beschikbaar voor dit conflict' };
  }

  const { file, patch } = patchData;
  const fullPath = path.join(process.cwd(), file);
  
  if (!fs.existsSync(fullPath)) {
    return { success: false, message: `Config file niet gevonden: ${file}` };
  }

  try {
    const config = JSON.parse(fs.readFileSync(fullPath, 'utf-8'));
    const patchObj = patch as any;
    
    // Parse the path like "techniques.2.1.patterns" or "technieken.2.1"
    const pathParts = patchObj.path.split('.');
    
    // Navigate to parent and get final key
    let current = config;
    for (let i = 0; i < pathParts.length - 1; i++) {
      const part = pathParts[i];
      if (!current[part]) {
        current[part] = {};
      }
      current = current[part];
    }
    
    const finalKey = pathParts[pathParts.length - 1];
    
    // Apply the patch based on operation type
    switch (patchObj.operation) {
      case 'update':
      case 'add_patterns':
        current[finalKey] = patchObj.newValue;
        break;
        
      case 'create':
        current[finalKey] = patchObj.newValue;
        break;
        
      case 'clarify':
        // For clarify, we update the concept with enhanced description
        if (current[finalKey]) {
          current[finalKey].concept = patchObj.suggestion || current[finalKey].concept;
        }
        break;
        
      default:
        return { success: false, message: `Onbekende operatie: ${patchObj.operation}` };
    }
    
    // Write the updated config back
    fs.writeFileSync(fullPath, JSON.stringify(config, null, 2));
    
    // Mark the conflict as resolved
    resolveConflict(conflictId, 'Hugo (patch toegepast)');
    
    console.log(`[config-consistency] Patch applied to ${file} for conflict ${conflictId}`);
    
    return { 
      success: true, 
      message: `Patch succesvol toegepast op ${file}`,
      file
    };
    
  } catch (error: any) {
    console.error(`[config-consistency] Failed to apply patch:`, error);
    return { success: false, message: `Fout bij toepassen patch: ${error.message}` };
  }
}

/**
 * Reject a patch - mark as resolved without applying
 */
export function rejectPatch(conflictId: string): boolean {
  return resolveConflict(conflictId, 'Hugo (afgewezen)');
}

/**
 * Customer response feedback - when Hugo marks a customer response as incorrect
 */
export interface CustomerFeedback {
  sessionId: string;
  turnNumber: number;
  customerMessage: string;
  customerSignal: string;      // What the AI showed (e.g., "twijfel")
  currentPhase: number;
  techniqueId: string;
  expertComment: string;       // Hugo's feedback (e.g., "twijfel hoort niet in fase 2")
  context?: {
    sector?: string;
    product?: string;
    klantType?: string;
    persona?: any;
  };
  // Full conversation history for review context
  conversationHistory?: Array<{
    role: 'user' | 'assistant' | 'system';
    content: string;
    signal?: string;
  }>;
}

/**
 * Analyze customer response feedback and generate config conflicts
 * This is called when Hugo marks a customer response as incorrect
 */
export function analyzeCustomerResponseFeedback(feedback: CustomerFeedback): ConflictFinding[] {
  const findings: ConflictFinding[] = [];
  const houdingen = loadHoudingen();
  
  if (!houdingen) {
    console.log('[config-consistency] klant_houdingen.json not found');
    return findings;
  }
  
  const feedbackId = `feedback-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  // Build session context to attach to all findings
  const sessionContext: ConflictFinding['sessionContext'] = {
    sessionId: feedback.sessionId,
    turnNumber: feedback.turnNumber,
    customerMessage: feedback.customerMessage,
    customerSignal: feedback.customerSignal,
    currentPhase: feedback.currentPhase,
    expertComment: feedback.expertComment,
    context: feedback.context,
    conversationHistory: feedback.conversationHistory
  };
  
  // Check if the signal has phase restrictions that were violated
  const signalConfig = houdingen.houdingen?.[feedback.customerSignal];
  
  if (signalConfig) {
    const faseRestrictie = signalConfig.fase_restrictie;
    const allowedPhases = faseRestrictie?.allowed_phases || [1, 2, 3, 4];
    const isAllowedInPhase = faseRestrictie?.allowed_at_any_phase || allowedPhases.includes(feedback.currentPhase);
    
    if (!isAllowedInPhase) {
      // This is a phase violation - the attitude was shown in a wrong phase
      // But we already fixed this in the code, so now we need to check WHY it still happened
      findings.push(createFinding({
        correctionId: feedbackId,
        severity: 'high',
        configFile: 'server/v2/customer_engine.ts',
        techniqueId: feedback.techniqueId,
        conflictType: 'detector_mismatch',
        description: `Houding "${feedback.customerSignal}" (${signalConfig.id}) werd getoond in fase ${feedback.currentPhase}, maar is alleen toegestaan in fases ${allowedPhases.join(', ')}. Expert comment: "${feedback.expertComment}"`,
        suggestedChange: JSON.stringify({
          file: 'server/v2/customer_engine.ts',
          operation: 'update',
          target: 'sampleAttitude',
          issue: `Phase restriction not enforced for ${feedback.customerSignal}`,
          suggestion: `Ensure ALL_ATTITUDES.slice() correctly excludes ${feedback.customerSignal} from phase ${feedback.currentPhase}`
        }, null, 2),
        sessionContext
      }));
    } else {
      // Signal was allowed but expert still marked it as wrong - maybe contextually inappropriate
      findings.push(createFinding({
        correctionId: feedbackId,
        severity: 'medium',
        configFile: 'config/klant_houdingen.json',
        techniqueId: feedback.techniqueId,
        conflictType: 'conceptual_ambiguity',
        description: `Houding "${feedback.customerSignal}" is technisch toegestaan in fase ${feedback.currentPhase}, maar expert vindt het contextually onjuist. Expert comment: "${feedback.expertComment}"`,
        suggestedChange: JSON.stringify({
          file: 'config/klant_houdingen.json',
          operation: 'update',
          path: `houdingen.${feedback.customerSignal}.fase_restrictie`,
          currentValue: faseRestrictie,
          suggestion: `Review of fase_restrictie.allowed_phases moet worden aangepast op basis van expert feedback`,
          expertComment: feedback.expertComment
        }, null, 2),
        sessionContext
      }));
    }
  } else {
    // Unknown signal
    findings.push(createFinding({
      correctionId: feedbackId,
      severity: 'low',
      configFile: 'config/klant_houdingen.json',
      techniqueId: feedback.techniqueId,
      conflictType: 'missing_definition',
      description: `Onbekende houding "${feedback.customerSignal}" niet gevonden in klant_houdingen.json. Expert comment: "${feedback.expertComment}"`,
      suggestedChange: JSON.stringify({
        file: 'config/klant_houdingen.json',
        operation: 'create',
        path: `houdingen.${feedback.customerSignal}`,
        suggestion: `Add definition for ${feedback.customerSignal}`
      }, null, 2),
      sessionContext
    }));
  }
  
  // Also check if the persona weights might be wrong
  if (feedback.context?.persona) {
    findings.push(createFinding({
      correctionId: feedbackId,
      severity: 'low',
      configFile: 'config/persona_templates.json',
      techniqueId: feedback.techniqueId,
      conflictType: 'conceptual_ambiguity',
      description: `Persona weights mogelijk onjuist voor combinatie: behavior_style=${feedback.context.persona.behavior_style}, buying_clock=${feedback.context.persona.buying_clock_stage}. Expert comment: "${feedback.expertComment}"`,
      suggestedChange: JSON.stringify({
        file: 'config/persona_templates.json',
        operation: 'update',
        path: `houding_weights`,
        suggestion: `Review weights for ${feedback.customerSignal} in given persona combination`,
        expertComment: feedback.expertComment
      }, null, 2),
      sessionContext
    }));
  }
  
  // Save all findings
  if (findings.length > 0) {
    const store = loadConflictStore();
    store.conflicts.push(...findings);
    saveConflictStore(store);
    console.log(`[config-consistency] Saved ${findings.length} conflicts from customer response feedback`);
  }
  
  return findings;
}

/**
 * Clear resolved conflicts older than X days
 */
export function clearOldResolvedConflicts(daysOld: number = 30): number {
  const store = loadConflictStore();
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - daysOld);
  
  const originalCount = store.conflicts.length;
  store.conflicts = store.conflicts.filter(c => {
    if (!c.resolvedAt) return true;
    return new Date(c.resolvedAt) > cutoff;
  });
  
  const removed = originalCount - store.conflicts.length;
  if (removed > 0) {
    saveConflictStore(store);
    console.log(`[config-consistency] Cleared ${removed} old resolved conflicts`);
  }
  
  return removed;
}
