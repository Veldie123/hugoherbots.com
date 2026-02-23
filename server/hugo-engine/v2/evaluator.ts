/**
 * evaluator.ts - Conceptual AI-based Evaluation
 * 
 * Uses AI to evaluate if seller applies correct techniques.
 * Replaces pattern matching with conceptual understanding.
 */

import OpenAI from 'openai';
import { CustomerSignal, EpicPhase } from './customer_engine';
import { getTrainingContext } from './rag-service';
import { getExamplesForTechnique, ReferenceAnswer } from './reference-answers';
import { getTechnique, getScoringRubric as getScoringRubricFromSsot, loadMergedTechniques } from '../ssot-loader';
import { loadDetectors, buildDetectorPatterns } from './prompt-context';
import * as fs from 'fs';
import * as path from 'path';

interface PromptTemplate {
  system: string;
  context_sections: {
    rag: string;
    ssot: string;
    golden: string;
  };
  evaluation_method: string;
  situation: string;
  rules: string;
  format: string;
}

interface EvaluatorOverlayConfig {
  prompt_template: PromptTemplate;
  technieken: Record<string, any>;
}

let cachedConfig: EvaluatorOverlayConfig | null = null;

/**
 * Load evaluator overlay config with STRICT validation
 * Throws error if config or required keys are missing
 */
function loadEvaluatorConfig(): EvaluatorOverlayConfig {
  if (cachedConfig) return cachedConfig;
  
  const overlayPath = path.join(process.cwd(), 'config/ssot/evaluator_overlay.json');
  
  if (!fs.existsSync(overlayPath)) {
    throw new Error(`[evaluator] STRICT: Config file missing: ${overlayPath}`);
  }
  
  const data = fs.readFileSync(overlayPath, 'utf-8');
  const parsed = JSON.parse(data);
  
  if (!parsed.prompt_template) {
    throw new Error('[evaluator] STRICT: Missing required key "prompt_template" in evaluator_overlay.json');
  }
  
  const pt = parsed.prompt_template;
  const requiredKeys = ['system', 'context_sections', 'evaluation_method', 'situation', 'rules', 'format'];
  for (const key of requiredKeys) {
    if (!(key in pt)) {
      throw new Error(`[evaluator] STRICT: Missing required key "prompt_template.${key}" in evaluator_overlay.json`);
    }
  }
  
  const requiredContextSections = ['rag', 'ssot', 'golden'];
  for (const key of requiredContextSections) {
    if (!(key in pt.context_sections)) {
      throw new Error(`[evaluator] STRICT: Missing required key "prompt_template.context_sections.${key}" in evaluator_overlay.json`);
    }
  }
  
  cachedConfig = {
    prompt_template: pt,
    technieken: parsed.technieken || {}
  };
  
  return cachedConfig;
}

/**
 * Load evaluator overlay technieken config
 */
function loadEvaluatorOverlay(): Record<string, any> {
  return loadEvaluatorConfig().technieken;
}

/**
 * Klant Houdingen config interface
 */
interface KlantHouding {
  id: string;
  naam: string;
  houding_beschrijving: string;
  recommended_technique_ids: string[];
  semantic_markers?: string[];
  fallback_response?: string;
}

interface KlantHoudingenConfig {
  houdingen: Record<string, KlantHouding>;
  expected_moves_scoring: {
    recommended_match_bonus: number;
    no_match_penalty: number;
  };
}

let cachedKlantHoudingen: KlantHoudingenConfig | null = null;

/**
 * Load klant_houdingen.json with expected moves data
 */
function loadKlantHoudingen(): KlantHoudingenConfig {
  if (cachedKlantHoudingen) return cachedKlantHoudingen;
  
  const filePath = path.join(process.cwd(), 'config/klant_houdingen.json');
  
  if (!fs.existsSync(filePath)) {
    throw new Error(`[evaluator] STRICT: Config file missing: ${filePath}`);
  }
  
  const data = fs.readFileSync(filePath, 'utf-8');
  const parsed = JSON.parse(data);
  
  if (!parsed.houdingen) {
    throw new Error('[evaluator] STRICT: Missing required key "houdingen" in klant_houdingen.json');
  }
  
  if (!parsed.expected_moves_scoring) {
    console.warn('[evaluator] Warning: Missing expected_moves_scoring in klant_houdingen.json, using defaults');
    parsed.expected_moves_scoring = {
      recommended_match_bonus: 5,
      no_match_penalty: 0
    };
  }
  
  cachedKlantHoudingen = {
    houdingen: parsed.houdingen,
    expected_moves_scoring: parsed.expected_moves_scoring
  };
  
  return cachedKlantHoudingen;
}

/**
 * Expected move with label for UI display
 */
export interface ExpectedMove {
  id: string;
  label: string;
  priority?: number;
}

/**
 * Get expected moves based on customer signal
 * Returns the recommended_technique_ids with labels from technieken_index.json
 */
export function getExpectedMoves(customerSignal: CustomerSignal): ExpectedMove[] {
  const config = loadKlantHoudingen();
  const houding = config.houdingen[customerSignal];
  
  if (!houding || !houding.recommended_technique_ids) {
    console.log(`[evaluator] No recommended techniques for signal: ${customerSignal}`);
    return [];
  }
  
  const expectedMoves: ExpectedMove[] = [];
  let priority = 1;
  
  for (const techId of houding.recommended_technique_ids) {
    const tech = getTechnique(techId);
    const label = tech ? `${tech.naam} (${techId})` : techId;
    
    expectedMoves.push({
      id: techId,
      label,
      priority: priority++
    });
  }
  
  console.log(`[evaluator] Expected moves for ${customerSignal}: ${expectedMoves.map(m => m.id).join(', ')}`);
  return expectedMoves;
}

/**
 * Check if detected technique matches any expected move
 * Returns bonus score if match found
 * 
 * Matching rules:
 * - Exact match: detected "2.1.4" = expected "2.1.4" → full bonus
 * - Child match: detected "2.1.4.1" is child of expected "2.1.4" → full bonus
 * - No partial/parent matching (detected "2.1" for expected "2.1.4" → no bonus)
 */
function calculateExpectedMoveBonus(
  detectedTechniqueIds: (string | null)[],
  expectedMoves: ExpectedMove[]
): { matches: boolean; bonus: number; matchedTechniqueId?: string } {
  if (expectedMoves.length === 0) {
    return { matches: false, bonus: 0 };
  }
  
  // Filter out null values
  const validIds = detectedTechniqueIds.filter((id): id is string => id !== null);
  if (validIds.length === 0) {
    return { matches: false, bonus: 0 };
  }
  
  const config = loadKlantHoudingen();
  const scoring = config.expected_moves_scoring;
  
  // Check ALL detected techniques for match (not just primary)
  for (const detectedId of validIds) {
    for (const expected of expectedMoves) {
      // Exact match
      if (detectedId === expected.id) {
        console.log(`[evaluator] Exact match! Detected ${detectedId} = Expected ${expected.id}`);
        return { matches: true, bonus: scoring.recommended_match_bonus, matchedTechniqueId: detectedId };
      }
      
      // Child match: detected is a child of expected (e.g., 2.1.4.1 is child of 2.1.4)
      if (detectedId.startsWith(expected.id + '.')) {
        console.log(`[evaluator] Child match! Detected ${detectedId} is child of Expected ${expected.id}`);
        return { matches: true, bonus: scoring.recommended_match_bonus, matchedTechniqueId: detectedId };
      }
    }
  }
  
  console.log(`[evaluator] No match: Detected [${validIds.join(', ')}] not in expected [${expectedMoves.map(m => m.id).join(', ')}]`);
  return { matches: false, bonus: scoring.no_match_penalty };
}

/**
 * Substitute placeholders in template string
 * Placeholders: {{rag_context}}, {{golden_examples}}, {{ssot_reference}}, {{customer_signal}}, {{epic_phase}}, {{customer_message}}, {{seller_message}}
 */
function substituteTemplatePlaceholders(template: string, values: Record<string, string>): string {
  let result = template;
  for (const [key, value] of Object.entries(values)) {
    result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
  }
  return result;
}

/**
 * Assemble full evaluation prompt from config template sections
 */
function assemblePromptFromTemplate(
  promptTemplate: PromptTemplate,
  values: Record<string, string>
): string {
  const sections: string[] = [];
  
  sections.push(promptTemplate.system);
  
  if (values.rag_context) {
    sections.push(substituteTemplatePlaceholders(promptTemplate.context_sections.rag, values));
  }
  if (values.golden_examples) {
    sections.push(values.golden_examples);
  }
  if (values.ssot_reference) {
    sections.push(values.ssot_reference);
  }
  
  sections.push(promptTemplate.evaluation_method);
  sections.push(substituteTemplatePlaceholders(promptTemplate.situation, values));
  sections.push(promptTemplate.rules);
  sections.push(promptTemplate.format);
  
  return sections.join('\n');
}

let openaiClient: OpenAI | null = null;

function getOpenAI(): OpenAI {
  if (!openaiClient) {
    openaiClient = new OpenAI({
      baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
      apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY
    });
  }
  return openaiClient;
}

/**
 * Single detected technique
 */
export interface DetectedTechnique {
  id: string;
  naam: string;
  quality: 'perfect' | 'goed' | 'bijna';
  score: number;
}

/**
 * Detection result for a seller message
 */
export interface DetectionResult {
  detected: boolean;
  moveId: string | null;
  moveLabel: string | null;
  score: number;
  feedback: string;
  quality?: 'perfect' | 'goed' | 'bijna' | 'gemist';
  rationale?: string;
  allExpected: any[];
  techniques?: DetectedTechnique[];
}

/**
 * Event log entry
 */
export interface EvaluationEvent {
  timestamp: Date;
  turnNumber: number;
  customerSignal: CustomerSignal;
  sellerMessage: string;
  detected: boolean;
  expectedMoves: string[];
  detectedMove: string | null;
  score: number;
  quality?: string;
}

/**
 * Get scoring rubric from SSOT
 */
function getScoringRubric(): Record<string, { score: number; label?: string }> {
  return getScoringRubricFromSsot();
}

/**
 * Get technique from SSOT (replaces getTechniqueConcept)
 */
function getTechniqueConcept(techniqueId: string): any {
  // Try exact match first
  let tech = getTechnique(techniqueId);
  if (tech) {
    return {
      naam: tech.naam,
      concept: tech.wat,
      doel: tech.waarom
    };
  }
  
  // Try parent technique (e.g., 2.1.1.1 -> 2.1.1 -> 2.1)
  const parts = techniqueId.split('.');
  while (parts.length > 1) {
    parts.pop();
    const parentId = parts.join('.');
    tech = getTechnique(parentId);
    if (tech) {
      return {
        naam: tech.naam,
        concept: tech.wat,
        doel: tech.waarom
      };
    }
  }
  
  return null;
}

/**
 * Build few-shot examples from golden standards (voortschrijdend inzicht)
 */
function buildGoldenExamples(techniqueId: string): string {
  try {
    const examples = getExamplesForTechnique(techniqueId, 3);
    if (examples.length === 0) return '';
    
    // Prioritize corrections - these are the most valuable learning examples
    const corrections = examples.filter(e => e.isCorrection);
    const normal = examples.filter(e => !e.isCorrection);
    
    let exampleText = '\n=== EXPERT VOORBEELDEN (GOLDEN STANDARDS) ===\n';
    exampleText += 'Deze voorbeelden zijn door Hugo (expert) gevalideerd:\n\n';
    
    // Add corrections first with special marking
    for (const ex of corrections.slice(0, 2)) {
      exampleText += `VOORBEELD (CORRECTIE - AI detecteerde ${ex.detectedTechnique}, expert zei ${ex.techniqueId}):\n`;
      exampleText += `Klant: "${ex.customerMessage}"\n`;
      exampleText += `Verkoper: "${ex.sellerResponse}"\n`;
      exampleText += `CORRECT ANTWOORD: ${ex.techniqueId}\n\n`;
    }
    
    // Add normal examples
    for (const ex of normal.slice(0, 2)) {
      exampleText += `VOORBEELD (${ex.techniqueId}):\n`;
      exampleText += `Verkoper: "${ex.sellerResponse}"\n\n`;
    }
    
    return exampleText;
  } catch (error) {
    console.log('[evaluator] Golden examples unavailable:', error);
    return '';
  }
}

/**
 * Build SSOT-based technique reference for the prompt
 * Dynamically loads techniques from technieken_index.json via ssot-loader
 */
function buildSsotTechniqueReference(techniqueId: string): string {
  const techniques = loadMergedTechniques();
  const overlay = loadEvaluatorOverlay();
  
  // Get the specific technique being evaluated
  const tech = getTechnique(techniqueId);
  let specificSection = '';
  
  if (tech) {
    specificSection = `\n=== HUIDIGE TECHNIEK: ${tech.nummer} ${tech.naam} ===\n`;
    specificSection += `WAT: ${tech.wat}\n`;
    specificSection += `HOE: ${tech.hoe}\n`;
    
    if (tech.stappenplan && tech.stappenplan.length > 0) {
      specificSection += `\nSTAPPENPLAN (evalueer of verkoper deze stappen volgt):\n`;
      tech.stappenplan.forEach((stap: string, i: number) => {
        specificSection += `  ${stap}\n`;
      });
    }
    
    if (tech.voorbeeld && tech.voorbeeld.length > 0) {
      specificSection += `\nVOORBEELD-ZINNEN (vergelijk met verkoper-uitspraak):\n`;
      tech.voorbeeld.forEach((vb: string) => {
        specificSection += `  - "${vb}"\n`;
      });
    }
    
    // Add eval note from overlay if present
    const overlayConfig = overlay[techniqueId];
    if (overlayConfig?.eval_note) {
      specificSection += `\nEVALUATIE-INSTRUCTIE: ${overlayConfig.eval_note}\n`;
    }
  }
  
  // Build compact catalog for phase detection
  let catalog = '\n=== TECHNIEK CATALOGUS (uit SSOT) ===\n';
  
  // Group by phase
  const byPhase: Record<string, any[]> = {};
  for (const [id, t] of Object.entries(techniques)) {
    const phase = (t as any).fase || '0';
    if (!byPhase[phase]) byPhase[phase] = [];
    byPhase[phase].push({ id, ...(t as any) });
  }
  
  // Build compact reference for fase 2 (most relevant for discovery)
  if (byPhase['2']) {
    catalog += '\nFASE 2 - ONTDEKKING:\n';
    for (const t of byPhase['2'].slice(0, 15)) {
      const example = t.voorbeeld?.[0] || t.wat || '';
      catalog += `- ${t.nummer} ${t.naam}: "${example.substring(0, 60)}..."\n`;
    }
  }
  
  return specificSection + catalog;
}

/**
 * Build evaluation prompt for AI with SSOT-based technique catalog
 * Loads all text from config/ssot/evaluator_overlay.json prompt_template
 */
async function buildEvaluationPrompt(
  sellerMessage: string,
  customerMessage: string,
  customerSignal: CustomerSignal,
  techniqueId: string,
  epicPhase: EpicPhase = 'explore',
  conversationContext?: string[]
): Promise<string> {
  
  const config = loadEvaluatorConfig();
  const promptTemplate = config.prompt_template;
  
  let ragContext = '';
  try {
    const trainingContext = await getTrainingContext(sellerMessage, techniqueId);
    if (trainingContext) {
      ragContext = trainingContext;
    }
  } catch (error) {
    console.log('[evaluator] RAG context unavailable, continuing without');
  }
  
  const goldenExamples = buildGoldenExamples(techniqueId);
  const ssotReference = buildSsotTechniqueReference(techniqueId);
  
  // Load detector patterns for this technique
  let detectorPatterns = '';
  try {
    detectorPatterns = buildDetectorPatterns(techniqueId);
    if (detectorPatterns) {
      detectorPatterns = '\n=== DETECTOR PATTERNS ===\n' + detectorPatterns;
    }
  } catch (error) {
    console.log('[evaluator] Detector patterns unavailable, continuing without');
  }

  const templateValues: Record<string, string> = {
    rag_context: ragContext,
    golden_examples: goldenExamples,
    ssot_reference: ssotReference + detectorPatterns,
    customer_signal: customerSignal,
    epic_phase: epicPhase,
    customer_message: customerMessage,
    seller_message: sellerMessage
  };

  return assemblePromptFromTemplate(promptTemplate, templateValues);
}

/**
 * Evaluate seller's response using AI (conceptual evaluation)
 * Now supports multiple techniques per turn and specific technique names
 * epicPhase parameter filters which techniques are expected based on EPIC progression
 */
export async function evaluateConceptually(
  sellerMessage: string,
  customerMessage: string,
  customerSignal: CustomerSignal,
  techniqueId: string,
  phase: number,
  epicPhase: EpicPhase = 'explore'
): Promise<DetectionResult> {
  
  const rubric = getScoringRubric();
  
  // Get expected moves based on customer signal
  const expectedMoves = getExpectedMoves(customerSignal);
  
  try {
    const prompt = await buildEvaluationPrompt(
      sellerMessage,
      customerMessage,
      customerSignal,
      techniqueId,
      epicPhase
    );
    
    const response = await getOpenAI().chat.completions.create({
      model: 'gpt-5.1',  // Changed from gpt-5-nano - was returning empty content
      messages: [{ role: 'user', content: prompt }],
      max_completion_tokens: 300,
    });
    
    const content = response.choices[0]?.message?.content?.trim() || '';
    
    let parsed: any;
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found in response');
      }
    } catch (parseError) {
      console.error('[evaluator] Failed to parse AI response:', content);
      return evaluateFirstTurn(sellerMessage, techniqueId, phase, customerSignal);
    }
    
    const quality = (parsed.overall_quality || parsed.quality) as 'perfect' | 'goed' | 'bijna' | 'gemist';
    const techniques: DetectedTechnique[] = (parsed.techniques || []).map((t: any) => {
      const ssotTech = t.id ? getTechnique(t.id) : null;
      return {
        id: t.id,
        naam: ssotTech ? ssotTech.naam : (t.naam || t.id || ''),
        quality: t.quality || 'goed',
        score: rubric[t.quality || 'goed']?.score ?? 5
      };
    });
    
    // Calculate base score
    let totalScore = techniques.length > 0 
      ? techniques.reduce((sum, t) => sum + t.score, 0)
      : rubric[quality]?.score ?? 0;
    
    const detected = quality !== 'gemist' && techniques.length > 0;
    const primaryTechnique = techniques[0] || null;
    
    // Calculate expected move bonus - check ALL detected techniques
    const detectedIds = techniques.map(t => t.id);
    const { matches, bonus } = calculateExpectedMoveBonus(detectedIds, expectedMoves);
    if (matches && bonus > 0) {
      totalScore += bonus;
      console.log(`[evaluator] Expected move bonus applied: +${bonus} (total: ${totalScore})`);
    }
    
    const techniqueLabels = techniques.map(t => t.naam).join(' + ');
    
    let feedback: string;
    if (quality === 'gemist' || techniques.length === 0) {
      feedback = `Gemist: ${parsed.rationale || 'Geen passende techniek gedetecteerd.'}`;
    } else if (matches) {
      feedback = `${techniqueLabels} (+${totalScore}) - Juiste reactie op klantsignaal!`;
    } else {
      feedback = `${techniqueLabels} (+${totalScore})`;
    }
    
    return {
      detected,
      moveId: primaryTechnique?.id || null,
      moveLabel: techniqueLabels || null,
      score: totalScore,
      feedback,
      quality,
      rationale: parsed.rationale,
      allExpected: expectedMoves,
      techniques
    };
    
  } catch (error: any) {
    console.error('[evaluator] AI evaluation failed:', error.message);
    return evaluateFirstTurn(sellerMessage, techniqueId, phase, customerSignal);
  }
}

/**
 * Evaluate first turn - check if seller is using valid Explore techniques
 * Uses pattern matching as fallback and for first turn where no customer signal exists.
 * Now returns techniques array for consistency with evaluateConceptually
 * customerSignal parameter added to support expected moves logic
 */
export function evaluateFirstTurn(
  sellerMessage: string,
  techniqueId: string,
  phase: number,
  customerSignal?: CustomerSignal
): DetectionResult {
  const lowerMessage = sellerMessage.toLowerCase();
  const rubric = getScoringRubric();
  
  // Get expected moves if customer signal is provided
  const expectedMoves = customerSignal ? getExpectedMoves(customerSignal) : [];
  
  // Explore technique opening patterns (Phase 2 Discovery questions)
  // Now with proper technique IDs for EPIC phase tracking
  // Labels are loaded dynamically from SSOT via getTechnique()
  const explorePatternDefs = [
    { id: '2.1.1.1', patterns: ['hoe bent u', 'hoe ben je', 'terecht gekomen', 'gevonden', 'gehoord over', 'via wie', 'hoe kwam je', 'bij ons gekomen', 'marketingkanaal'] },
    { id: '2.1.1.2', patterns: ['aanleiding', 'waarom nu', 'wat brengt', 'reden', 'waarom bent u', 'waarom kijk'] },
    { id: '2.1.1.3', patterns: ['ervaring', 'eerder', 'al eens', 'bekend met', 'ooit'] },
    { id: '2.1.1.4', patterns: ['verwacht', 'hoop', 'ideaal', 'belangrijk voor'] },
    { id: '2.1.1.5', patterns: ['andere', 'alternatieven', 'opties', 'vergelijk', 'ook gekeken'] },
    { id: '2.1.1.6', patterns: ['budget', 'investering', 'bedrag', 'grootorde'] },
    { id: '2.1.1.7', patterns: ['wanneer', 'timing', 'planning', 'termijn', 'deadline'] },
    { id: '2.1.1.8', patterns: ['wie beslist', 'beslissing', 'criteria', 'belangrijk voor de keuze'] },
    { id: '2.1.6', patterns: ['hoor ik u zeggen', 'begrijp ik goed', 'dus als ik', 'zegt u'] },
    { id: '2.1.2', patterns: ['wat vindt u', 'wat vind je', 'wat is uw mening', 'hoe kijkt u'] },
    { id: '2.2', patterns: ['stel je voor', 'stel dat', 'ik had laatst een klant', 'bijvoorbeeld', 'een ander verhaal'] },
    { id: '2.3', patterns: ['wat betekent dat voor', 'wat zijn de gevolgen', 'wat zou het effect zijn', 'wat kost het u'] },
    { id: '2.4', patterns: ['is dat belangrijk voor u', 'dus dat wilt u zeker', 'als ik het goed begrijp'] }
  ];
  
  const explorePatterns = explorePatternDefs.map(def => {
    const tech = getTechnique(def.id);
    const label = tech ? tech.naam : def.id;
    return { id: def.id, label, patterns: def.patterns };
  });
  
  for (const pattern of explorePatterns) {
    for (const p of pattern.patterns) {
      if (lowerMessage.includes(p)) {
        const technique: DetectedTechnique = {
          id: pattern.id,
          naam: pattern.label,
          quality: 'goed',
          score: rubric['goed']?.score ?? 5
        };
        
        // Calculate expected move bonus (only if customerSignal was provided)
        let totalScore = 5;
        let feedback = `${pattern.label} (+5)`;
        const { matches, bonus } = calculateExpectedMoveBonus([pattern.id], expectedMoves);
        if (matches && bonus > 0) {
          totalScore += bonus;
          feedback = `${pattern.label} (+${totalScore}) - Juiste reactie op klantsignaal!`;
        }
        
        return {
          detected: true,
          moveId: pattern.id,
          moveLabel: pattern.label,
          score: totalScore,
          feedback,
          quality: 'goed',
          allExpected: expectedMoves,
          techniques: [technique]
        };
      }
    }
  }
  
  return {
    detected: false,
    moveId: null,
    moveLabel: null,
    score: 0,
    feedback: 'Tip: Start met een open vraag om de klant te leren kennen.',
    quality: 'gemist',
    allExpected: expectedMoves,
    techniques: []
  };
}

/**
 * Generate summary feedback for a session
 */
export function generateSessionFeedback(events: EvaluationEvent[]): {
  totalScore: number;
  detected: number;
  missed: number;
  summary: string;
  details: string[];
} {
  const totalScore = events.reduce((sum, e) => sum + e.score, 0);
  const detected = events.filter(e => e.detected).length;
  const missed = events.filter(e => !e.detected).length;
  
  const details: string[] = [];
  
  // Group by quality
  const byQuality: Record<string, number> = {};
  for (const event of events) {
    const q = event.quality || (event.detected ? 'goed' : 'gemist');
    byQuality[q] = (byQuality[q] || 0) + 1;
  }
  
  if (byQuality.perfect) {
    details.push(`${byQuality.perfect}x perfect toegepast`);
  }
  if (byQuality.goed) {
    details.push(`${byQuality.goed}x goed`);
  }
  if (byQuality.bijna) {
    details.push(`${byQuality.bijna}x bijna goed - let hier op`);
  }
  if (byQuality.gemist) {
    details.push(`${byQuality.gemist}x gemist - focus hierop`);
  }
  
  const percentage = events.length > 0 ? Math.round((detected / events.length) * 100) : 0;
  
  // Load summary template from evaluator overlay config (STRICT - no fallbacks)
  const config = loadEvaluatorConfig();
  const templates = (config as any).summary_templates;
  if (!templates?.score_summary || !templates?.no_evaluations) {
    console.error('[evaluator] Missing summary_templates in evaluator_overlay.json');
    return { totalScore, detected, missed, summary: '', details };
  }
  
  const summary = events.length === 0
    ? templates.no_evaluations
    : templates.score_summary
        .replace('{{totalScore}}', String(totalScore))
        .replace('{{detected}}', String(detected))
        .replace('{{total}}', String(events.length))
        .replace('{{percentage}}', String(percentage));
  
  return { totalScore, detected, missed, summary, details };
}

/**
 * Clear cache (for testing)
 */
export function clearEvaluatorCache(): void {
  // Cache is now managed by ssot-loader
}
