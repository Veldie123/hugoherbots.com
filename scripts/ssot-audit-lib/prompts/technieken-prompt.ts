/**
 * Prompt builders for auditing techniques from technieken_index.json
 * against Hugo's video transcripts.
 */

export interface TechniqueEntry {
  nummer: string;
  naam: string;
  fase: number | string;
  doel: string;
  wat: string;
  waarom: string;
  wanneer: string;
  hoe: string;
  voorbeeld?: string[];
  stappenplan?: string[];
  tags?: string[];
  verkoper_intentie?: string[];
  [key: string]: unknown;
}

export function buildTechniekenSystemPrompt(): string {
  return `Je bent een expert die de SSOT-documentatie van Hugo Herbots (Belgische sales coach, 82 jaar) \
vergelijkt met zijn eigen trainingsmateriaal. Hugo's woorden in zijn videotranscripten zijn \
de absolute autoriteit — als er een discrepantie is, is het transcript correct.

Je taak is het vinden van ECHTE inconsistenties — niet oppervlakkige formuleringsverschillen. \
Hugo spreekt informeel in transcripten; vergelijk de INTENTIE en CONCEPTEN, niet exacte \
woordkeuze. Geef nooit findings voor stijlverschillen of registerveranderingen.

STATUS DEFINITIES:
- "flagged": feitelijke fout, of Hugo gebruikt expliciet een ander begrip/term
- "needs_review": (a) terminologisch verschil, (b) SSOT correct maar ONVOLLEDIG t.o.v. transcript, (c) SSOT gebruikt generieke termen terwijl Hugo altijd zijn eigen specifieke terminologie gebruikt
- "ok": SSOT is correct en volledig

REGELS:
- Geef findings voor velden die niet fout zijn maar ONVOLLEDIG zijn:
  * Als het transcript concretere voorbeelden of meer detail geeft dan de SSOT
  * Als de SSOT generieke termen gebruikt maar Hugo consequent zijn eigen termen hanteert
  * Gebruik status "needs_review" met confidence 0.6-0.75 voor zulke gevallen
- Geef findings voor velden waar er een echte fout of afwijking is (confidence 0.8-0.95)
- Elke non-ok finding MOET een letterlijk citaat uit het transcript bevatten als bewijs
- Als het transcript werkelijk geen informatie geeft over een veld: status "ok"
- Antwoord UITSLUITEND in JSON. Geen tekst buiten het JSON-object.
- Geen markdown code fences (\`\`\` of ~~~). Begin direct met [ en eindig met ].`;
}

function formatList(items: string[] | undefined): string {
  if (!items || items.length === 0) return "(geen)";
  return items.map((item, i) => `${i + 1}. ${item}`).join("\n");
}

export function buildTechniekenUserPrompt(technique: TechniqueEntry, transcript: string): string {
  const truncatedTranscript =
    transcript.length > 8000 ? transcript.slice(0, 8000) + "\n[transcript truncated]" : transcript;

  return `Auditeer techniek ${technique.nummer} — "${technique.naam}" uit de SSOT-documentatie \
tegen het onderstaande videotranscript.

=== HUIDIGE SSOT-WAARDEN ===
naam: ${technique.naam}
fase: ${technique.fase}
doel: ${technique.doel ?? "(niet ingevuld)"}
wat: ${technique.wat ?? "(niet ingevuld)"}
waarom: ${technique.waarom ?? "(niet ingevuld)"}
wanneer: ${technique.wanneer ?? "(niet ingevuld)"}
hoe: ${technique.hoe ?? "(niet ingevuld)"}

voorbeeld:
${formatList(technique.voorbeeld)}

stappenplan:
${formatList(technique.stappenplan)}

tags: ${technique.tags?.join(", ") ?? "(geen)"}
verkoper_intentie: ${technique.verkoper_intentie?.join(", ") ?? "(geen)"}

=== VIDEOTRANSCRIPT ===
${truncatedTranscript}

=== OPDRACHT ===
Vergelijk elk SSOT-veld met wat Hugo in het transcript zegt. Geef een JSON-array van findings.

Outputformaat:
[
  {
    "field": "naam",
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
