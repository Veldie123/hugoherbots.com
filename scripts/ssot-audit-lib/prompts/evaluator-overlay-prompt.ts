/**
 * Prompt builders for auditing evaluator_overlay.json entries
 * against Hugo's video transcripts.
 */

export interface EvaluatorEntry {
  techniek_id: string;
  eval_type?: string;
  eval_note?: string;
  voorbeeld_match?: string[];
  [key: string]: unknown;
}

export interface EvaluatorBatchItem {
  techniqueId: string;
  entry: EvaluatorEntry;
  transcript: string;
}

export function buildEvaluatorSystemPrompt(): string {
  return `Je bent een expert die de evaluator-overlay-documentatie van Hugo Herbots (Belgische sales coach, 82 jaar) \
vergelijkt met zijn eigen trainingsmateriaal. De eval_note wordt gebruikt door een AI-evaluator \
om de kwaliteit van coachingsessies te beoordelen — als deze niet klopt, worden verkopers \
incorrect beoordeeld.

Je taak: controleer of de eval_note nauwkeurig beschrijft wat Hugo daadwerkelijk onderwijst, \
en of de voorbeeld_match-zinnen representatief zijn voor correcte toepassing.

REGELS:
- Geef ALLEEN findings als de eval_note feitelijk onjuist of misleidend is t.o.v. het transcript
- Stijlverschillen of beknopte formuleringen zijn GEEN finding
- Elke non-ok finding MOET een letterlijk citaat uit het transcript bevatten als bewijs
- Als het transcript geen informatie geeft over een eval_note-veld, geef dan status "ok"
- Bij twijfel: status "ok" — liever te weinig dan te veel flags
- Antwoord UITSLUITEND in JSON. Geen tekst buiten het JSON-object.`;
}

export function buildEvaluatorUserPrompt(batch: EvaluatorBatchItem[]): string {
  const items = batch.map(item => {
    const truncatedTranscript =
      item.transcript.length > 8000
        ? item.transcript.slice(0, 8000) + "\n[transcript truncated]"
        : item.transcript;

    const voorbeelden = item.entry.voorbeeld_match ?? [];

    return `--- TECHNIEK ${item.techniqueId} ---
eval_type: ${item.entry.eval_type ?? "(niet ingevuld)"}
eval_note: ${item.entry.eval_note ?? "(niet ingevuld)"}
voorbeeld_match:
${voorbeelden.length > 0 ? voorbeelden.map((v, i) => `${i + 1}. ${v}`).join("\n") : "(geen)"}

Transcript:
${truncatedTranscript}`;
  });

  return `Auditeer de onderstaande evaluator-overlay-entries tegen de bijbehorende videotranscripten.

${items.join("\n\n")}

=== OPDRACHT ===
Controleer per techniek:
1. eval_note — beschrijft dit nauwkeurig wat Hugo onderwijst voor deze techniek?
2. voorbeeld_match — zijn deze voorbeeldzinnen representatief voor correcte toepassing?

Geef een JSON-array van findings.

Outputformaat:
[
  {
    "techniqueId": "2.1.1",
    "field": "eval_note",
    "current_value": "...",
    "proposed_value": "...",
    "issue_description": "Waarom de eval_note onjuist of onvolledig is",
    "transcript_evidence": ["letterlijk citaat uit transcript..."],
    "confidence": 0.80,
    "status": "needs_review"
  }
]

Geef een LEGE array [] als er geen findings zijn.`;
}
