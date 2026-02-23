// EPIC Sales Flow - Complete Techniekencatalogus
// Single Source of Truth: technieken_index.json

import techniekenIndex from './technieken_index.json';

export interface TechniquePractice {
  default_mode: string;
  roleplay_capable: boolean;
  roleplay_default: boolean;
  notes: string;
}

export interface EpicTechnique {
  nummer: string;
  naam: string;
  fase: string;
  is_fase?: boolean;
  parent?: string;
  wat?: string;
  waarom?: string;
  wanneer?: string;
  hoe?: string;
  doel?: string;
  voorbeeld?: string[];
  stappenplan?: string[];
  themas?: string[];
  tags?: string[];
  context_requirements?: string[];
  verkoper_intentie?: string[];
  dos?: string[];
  donts?: string[];
  ai_eval_points?: string[];
  detector_id?: string;
  practice?: TechniquePractice;
}

// Convert object format to array and type the imported JSON
const techniekenData = techniekenIndex.technieken as Record<string, any>;

export const EPIC_TECHNIQUES: EpicTechnique[] = Object.values(techniekenData).map((t: any) => ({
  nummer: t.nummer,
  naam: t.naam,
  fase: t.fase,
  is_fase: t.is_fase,
  parent: t.parent,
  wat: t.wat,
  waarom: t.waarom,
  wanneer: t.wanneer,
  hoe: t.hoe,
  doel: t.doel,
  voorbeeld: t.voorbeeld,
  stappenplan: t.stappenplan,
  themas: t.themas,
  tags: t.tags,
  context_requirements: t.context_requirements,
  verkoper_intentie: t.verkoper_intentie,
  dos: t["do's"],
  donts: t["dont's"],
  ai_eval_points: t.ai_eval_points,
  detector_id: t.detector_id,
  practice: t.practice,
}));

// Helper functies
export const getTechniquesByPhase = (phase: string): EpicTechnique[] => {
  return EPIC_TECHNIQUES.filter(t => t.fase === phase);
};

export const getTechniqueByDetectorId = (detectorId: string): EpicTechnique | undefined => {
  return EPIC_TECHNIQUES.find(t => t.detector_id === detectorId);
};

export const getTechniqueByNumber = (number: string): EpicTechnique | undefined => {
  if (!number) return undefined;
  const cleanNumber = number.replace(/^techniek_/, '');
  return EPIC_TECHNIQUES.find(t => t.nummer === cleanNumber);
};

export const getTechniqueDetails = (nummer: string): EpicTechnique | undefined => {
  return EPIC_TECHNIQUES.find(t => t.nummer === nummer);
};

export const getAllPhases = (): string[] => {
  return ["0", "1", "2", "3", "4"];
};

export const getPhaseLabel = (phase: string): string => {
  const labels: Record<string, string> = {
    "0": "Fase 0 - Pre-contactfase",
    "1": "Fase 1 - Openingsfase",
    "2": "Fase 2 - Ontdekkingsfase",
    "3": "Fase 3 - Aanbevelingsfase",
    "4": "Fase 4 - Beslissingsfase",
    "*": "Algemeen"
  };
  return labels[phase] || phase;
};

export const getPhaseTechniqueCount = (phase: string): number => {
  return EPIC_TECHNIQUES.filter(t => t.fase === phase && !t.is_fase).length;
};

export const getSubTechniques = (parentNumber: string): EpicTechnique[] => {
  return EPIC_TECHNIQUES.filter(t => t.parent === parentNumber);
};

export const isPhaseHeader = (technique: EpicTechnique): boolean => {
  return technique.is_fase === true || ["0", "1", "2", "3", "4"].includes(technique.nummer);
};

export const getTechniqueOptions = (): EpicTechnique[] => {
  return EPIC_TECHNIQUES.filter(t => !isPhaseHeader(t));
};

export const getPhaseHeaders = (): EpicTechnique[] => {
  return EPIC_TECHNIQUES.filter(t => t.is_fase === true);
};

const compareNummerStrings = (a: string, b: string): number => {
  const partsA = a.split('.').map(p => parseInt(p, 10) || 0);
  const partsB = b.split('.').map(p => parseInt(p, 10) || 0);
  const maxLen = Math.max(partsA.length, partsB.length);
  for (let i = 0; i < maxLen; i++) {
    const valA = partsA[i] || 0;
    const valB = partsB[i] || 0;
    if (valA !== valB) return valA - valB;
  }
  return 0;
};

export const getFlowStepsForPhase = (phase: string): EpicTechnique[] => {
  return EPIC_TECHNIQUES.filter(t => t.fase === phase && !t.is_fase).sort((a, b) => {
    return compareNummerStrings(a.nummer, b.nummer);
  });
};

export { compareNummerStrings };

export const EPIC_STATS = {
  totalTechniques: EPIC_TECHNIQUES.filter(t => !t.is_fase).length,
  phase0Count: getTechniquesByPhase("0").filter(t => !t.is_fase).length,
  phase1Count: getTechniquesByPhase("1").filter(t => !t.is_fase).length,
  phase2Count: getTechniquesByPhase("2").filter(t => !t.is_fase).length,
  phase3Count: getTechniquesByPhase("3").filter(t => !t.is_fase).length,
  phase4Count: getTechniquesByPhase("4").filter(t => !t.is_fase).length,
  generalCount: getTechniquesByPhase("*").filter(t => !t.is_fase).length
};
