/**
 * Prompt builders for auditing rag_heuristics.json anchor terms
 * against Hugo's video transcripts.
 *
 * Uses a hybrid approach: code pre-filters anchors that don't appear
 * in the transcript text, then Claude only evaluates the missing ones.
 */

export interface HeuristicEntry {
  naam: string;
  anchors: string[];
  support?: string[];
  min_anchor_matches?: number;
  [key: string]: unknown;
}

export interface RagHeuristicBatchItem {
  techniqueId: string;
  entry: HeuristicEntry;
  transcript: string;
  missingAnchors: string[];     // pre-filtered: anchors not found in transcript
  allAnchors: string[];
  supportTerms: string[];
}

/**
 * Pre-filter: returns which anchors are NOT present in the transcript text (case-insensitive).
 */
export function findMissingAnchors(anchors: string[], transcriptText: string): string[] {
  const lower = transcriptText.toLowerCase();
  return anchors.filter(a => !lower.includes(a.toLowerCase()));
}

export function buildRagHeuristicsSystemPrompt(): string {
  return `Je bent een expert die de RAG-heuristiekdocumentatie van Hugo Herbots (Belgische sales coach, 82 jaar) \
vergelijkt met zijn eigen trainingsmateriaal. Ankerterms worden gebruikt om trainingsinhoud automatisch \
te taggen; als ze niet kloppen, worden relevante fragmenten niet teruggevonden.

Je krijgt per techniek een lijst van ankerterms die NIET voorkomen in het transcript. \
Jouw taak: bepaal voor elke ontbrekende ankerterm of die echt afwezig is in Hugo's vocabulaire, \
of dat Hugo een equivalent begrip gebruikt dat als anchor toegevoegd zou moeten worden.

REGELS:
- Een ankerterm is "stale" als Hugo het concept expliciet anders benoemt of niet gebruikt
- Een ankerterm is "ok maar afwezig" als het concept zijdelings aanwezig is maar de exacte term ontbreekt
- Stel concrete vervangende of aanvullende anchor-termen voor op basis van Hugo's eigen woorden
- Bij twijfel: rapporteer niets — liever te weinig dan te veel flags
- Elke finding MOET een letterlijk citaat uit het transcript bevatten als bewijs (transcript_evidence veld)
- Antwoord UITSLUITEND in JSON. Geen tekst buiten het JSON-object.
- Geen markdown code fences (\`\`\` of ~~~). Begin direct met [ en eindig met ].`;
}

export function batchNeedsClaude(batch: RagHeuristicBatchItem[]): boolean {
  return batch.some(item => item.missingAnchors.length > 0);
}

export function buildRagHeuristicsUserPrompt(batch: RagHeuristicBatchItem[]): string {
  // Filter out items with no missing anchors — nothing for Claude to evaluate
  const filteredBatch = batch.filter(item => item.missingAnchors.length > 0);

  // If no items remain, signal to caller that this API call should be skipped
  if (filteredBatch.length === 0) {
    return "";
  }

  const items = filteredBatch.map(item => {
    const truncatedTranscript =
      item.transcript.length > 8000
        ? item.transcript.slice(0, 8000) + "\n[transcript truncated]"
        : item.transcript;

    return `--- TECHNIEK ${item.techniqueId}: ${item.entry.naam} ---
Ontbrekende ankerterms: ${item.missingAnchors.join(", ")}
Alle anchors: ${item.allAnchors.join(", ")}
Support-termen: ${item.supportTerms.length > 0 ? item.supportTerms.join(", ") : "(geen)"}

Transcript:
${truncatedTranscript}`;
  });

  return `Analyseer de onderstaande technieken en hun ontbrekende ankerterms.

${items.join("\n\n")}

=== OPDRACHT ===
Geef voor elke techniek met ontbrekende anchors een JSON-array van findings.

Outputformaat:
[
  {
    "techniqueId": "2.1.1",
    "field": "anchors",
    "current_value": "ontbrekende anchor term",
    "proposed_value": "voorgestelde vervanging of aanvulling",
    "issue_description": "Waarom deze anchor stale/onjuist is en wat Hugo zelf gebruikt",
    "transcript_evidence": ["letterlijk citaat waaruit het eigen vocabulaire blijkt..."],
    "confidence": 0.80,
    "status": "needs_review"
  }
]

Geef een LEGE array [] als er geen findings zijn.`;
}
