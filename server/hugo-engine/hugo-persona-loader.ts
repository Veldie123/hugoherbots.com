import { readFileSync } from 'fs';
import { join } from 'path';

interface HugoPersona {
  _meta: {
    version: string;
    purpose: string;
    filosofie: string;
    architectuur: {
      deze_file: string;
      prompt_files: string;
      loader: string;
    };
  };
  hugo: {
    wie: string;
    kern: string;
  };
  rollen: {
    context_gathering: string;
    coaching: string;
    roleplay_klant: string;
    feedback: string;
  };
  rag: {
    instructie: string;
    placeholder: string;
  };
  injectie: {
    _note: string;
    technieken: string;
    rag_context: string;
    sessie_context: string;
    klant_data: string;
  };
}

type HugoRole = 'context_gathering' | 'coaching' | 'roleplay_klant' | 'feedback';

let cachedPersona: HugoPersona | null = null;

function loadPersona(): HugoPersona {
  if (cachedPersona) return cachedPersona;
  
  const personaPath = join(process.cwd(), 'config/ssot/hugo_persona.json');
  const content = readFileSync(personaPath, 'utf-8');
  cachedPersona = JSON.parse(content) as HugoPersona;
  return cachedPersona;
}

export function getHugoIdentity(): string {
  const persona = loadPersona();
  return `${persona.hugo.wie}\n\n${persona.hugo.kern}`;
}

export function getHugoRole(role: HugoRole): string {
  const persona = loadPersona();
  return persona.rollen[role];
}

export function buildHugoSystemPrompt(
  role: HugoRole,
  ragContext?: string
): string {
  const persona = loadPersona();
  
  const parts: string[] = [];
  
  parts.push(`JE BENT: ${persona.hugo.wie}`);
  parts.push(`\nKERN: ${persona.hugo.kern}`);
  parts.push(`\nROL: ${persona.rollen[role]}`);
  
  if (ragContext && ragContext.trim()) {
    parts.push(`\n\n${persona.rag.instructie}`);
    parts.push(`\n${ragContext}`);
  }
  
  return parts.join('');
}

export function buildContextGatheringPrompt(ragContext?: string): string {
  return buildHugoSystemPrompt('context_gathering', ragContext);
}

export function buildCoachingPrompt(ragContext?: string): string {
  return buildHugoSystemPrompt('coaching', ragContext);
}

export function buildFeedbackPrompt(ragContext?: string): string {
  return buildHugoSystemPrompt('feedback', ragContext);
}

export function buildRoleplayKlantPrompt(): string {
  const persona = loadPersona();
  return persona.rollen.roleplay_klant;
}

export function invalidatePersonaCache(): void {
  cachedPersona = null;
}
