/**
 * Prompt builders for auditing klant_houdingen.json entries
 * against Hugo's video transcripts.
 */

export interface HoudingEntry {
  id: string;           // "H1" through "H9"
  naam: string;
  beschrijving?: string;
  houding_beschrijving?: string;
  semantic_markers?: string[];
  aanbevolen_technieken?: string[];
  recommended_technique_ids?: string[];
  generation_examples?: string[];
  [key: string]: unknown;
}

export function buildHoudingenSystemPrompt(): string {
  return `Je bent een expert die de klanthouding-documentatie van Hugo Herbots (Belgische sales coach, 82 jaar) \
vergelijkt met zijn eigen trainingsmateriaal. Hugo's woorden in zijn videotranscripten zijn \
de absolute autoriteit — als er een discrepantie is, is het transcript correct.

Je taak is het vinden van ECHTE inconsistenties in hoe klanthoudingen zijn beschreven en gedetecteerd. \
Focussen op: zijn de semantic_markers representatief voor Hugo's vocabulaire? \
Zijn de generation_examples realistisch voor een Belgische B2B-salescontext? \
Klopt de beschrijving met hoe Hugo de houding definieert?

REGELS:
- Geef ALLEEN findings voor velden waar er een echte feitelijke of terminologische fout is
- Bij twijfel: status "ok" — liever te weinig dan te veel flags
- Elke non-ok finding MOET een letterlijk citaat uit het transcript bevatten als bewijs
- Als het transcript geen informatie geeft over een veld, geef dan status "ok" (niet "needs_review")
- Antwoord UITSLUITEND in JSON. Geen tekst buiten het JSON-object.`;
}

export function buildHoudingenUserPrompt(houding: HoudingEntry, techniqueTranscripts: string): string {
  const truncatedTranscripts =
    techniqueTranscripts.length > 8000
      ? techniqueTranscripts.slice(0, 8000) + "\n[transcript truncated]"
      : techniqueTranscripts;

  const beschrijving = houding.houding_beschrijving ?? houding.beschrijving ?? "(niet ingevuld)";
  const markers = houding.semantic_markers?.join(", ") ?? "(geen)";
  const aanbevolen =
    houding.recommended_technique_ids ?? houding.aanbevolen_technieken ?? [];
  const examples = houding.generation_examples ?? [];

  return `Auditeer klanthouding ${houding.id} — "${houding.naam}" uit de SSOT-documentatie \
tegen de onderstaande videotranscripten van aanbevolen technieken.

=== HUIDIGE SSOT-WAARDEN ===
id: ${houding.id}
naam: ${houding.naam}
beschrijving: ${beschrijving}
semantic_markers: ${markers}
aanbevolen_technieken: ${aanbevolen.length > 0 ? aanbevolen.join(", ") : "(geen)"}

generation_examples:
${examples.length > 0 ? examples.map((e, i) => `${i + 1}. ${e}`).join("\n") : "(geen)"}

=== TRANSCRIPT CONTEXT (van aanbevolen technieken) ===
${truncatedTranscripts}

=== OPDRACHT ===
Controleer specifiek:
1. semantic_markers — zijn deze termen representatief voor Hugo's eigen vocabulaire en de Belgische B2B-context?
2. generation_examples — zijn deze realistisch en passen ze bij Hugo's stijl/context?
3. beschrijving — klopt dit met hoe Hugo de houding definieert?

Geef een JSON-array van findings.

Outputformaat:
[
  {
    "field": "semantic_markers",
    "current_value": "...",
    "proposed_value": "...",
    "issue_description": "...",
    "transcript_evidence": ["letterlijk citaat uit transcript..."],
    "confidence": 0.85,
    "status": "needs_review"
  }
]

Geef een LEGE array [] als er geen findings zijn.`;
}
