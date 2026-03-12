/**
 * Meta-analyse: systematische gaps identificeren over meerdere gespreksanalyses.
 *
 * Gebruik:
 *   npx tsx scripts/meta-analysis.ts                                     # alle in batch-progress.json
 *   npx tsx scripts/meta-analysis.ts --ids "uuid1,uuid2"                 # specifieke IDs
 *   npx tsx scripts/meta-analysis.ts --ids "uuid" --compare-with <pad>   # vergelijk met vorig rapport
 *
 * Vereist SCREENSHOT_EMAIL, SCREENSHOT_PASSWORD, en ANTHROPIC_API_KEY in .env
 * Server moet draaien op http://localhost:5001
 */
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";
import { readFileSync, writeFileSync, existsSync, readdirSync } from "fs";
import { resolve } from "path";

const BASE_URL = "http://localhost:5001";
const GESPREKKEN_DIR = resolve(import.meta.dirname || __dirname, "../gesprekanalyse");
const PROGRESS_FILE = resolve(GESPREKKEN_DIR, "batch-progress.json");

// Parse args
const args = process.argv.slice(2);
let filterIds: string[] | null = null;
let compareWithPath: string | null = null;

for (let i = 0; i < args.length; i++) {
  if (args[i] === "--ids" && args[i + 1]) {
    filterIds = args[++i].split(",").map((id) => id.trim());
  }
  if (args[i] === "--compare-with" && args[i + 1]) {
    compareWithPath = args[++i];
  }
}

function loadEnv(): Record<string, string> {
  const env: Record<string, string> = {};
  try {
    const envPath = resolve(import.meta.dirname || __dirname, "../.env");
    const content = readFileSync(envPath, "utf-8");
    for (const line of content.split("\n")) {
      const match = line.match(/^([^#=]+)=(.*)$/);
      if (match) env[match[1].trim()] = match[2].trim().replace(/^["']|["']$/g, "");
    }
  } catch { /* no .env */ }
  return env;
}

async function getAuthToken(fileEnv: Record<string, string>): Promise<string> {
  const email = process.env.SCREENSHOT_EMAIL || fileEnv.SCREENSHOT_EMAIL;
  const password = process.env.SCREENSHOT_PASSWORD || fileEnv.SCREENSHOT_PASSWORD;
  if (!email || !password) throw new Error("SCREENSHOT_EMAIL en SCREENSHOT_PASSWORD zijn vereist in .env");

  const projectId = "pckctmojjrrgzuufsqoo";
  const anonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBja2N0bW9qanJyZ3p1dWZzcW9vIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYwOTg1MTUsImV4cCI6MjA4MTY3NDUxNX0.TrPovHz5PgSiwyxVCYplk-SA6cNi0gZkkMVGr3NdIuc";

  const supabase = createClient(`https://${projectId}.supabase.co`, anonKey);
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.session) throw new Error(`Auth mislukt: ${error?.message || "No session"}`);
  return data.session.access_token;
}

async function fetchResult(conversationId: string, token: string): Promise<any> {
  const response = await fetch(`${BASE_URL}/api/v2/analysis/results/${conversationId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) throw new Error(`Results ophalen mislukt (${response.status})`);
  const data = await response.json() as any;
  if (data.status) throw new Error(`Analyse nog niet klaar: ${data.status}`);
  return data;
}

function compressResult(result: any): object {
  const evaluations: any[] = result.evaluations || [];
  const signals: any[] = result.signals || [];
  const insights = result.insights || {};
  const transcript: any[] = result.transcript || [];

  // Houding-verdeling
  const houdingCount: Record<string, number> = {};
  for (const sig of signals) {
    const h = sig.houding || "neutraal";
    houdingCount[h] = (houdingCount[h] || 0) + 1;
  }

  // Quality-verdeling over alle technieken
  const qualityCount = { perfect: 0, goed: 0, bijna: 0, gemist: 0 };
  const techniqueCount: Record<string, number> = {};
  const techniquesByPhase: Record<string, string[]> = {};

  for (const ev of evaluations) {
    for (const tech of (ev.techniques || [])) {
      if (tech.quality in qualityCount) (qualityCount as any)[tech.quality]++;
      techniqueCount[tech.id] = (techniqueCount[tech.id] || 0) + 1;

      // Groepeer op fase (prefix van ID: "1.", "2.", "3.", "4.")
      const fase = tech.id?.split(".")[0] || "?";
      if (!techniquesByPhase[fase]) techniquesByPhase[fase] = [];
      techniquesByPhase[fase].push(tech.id);
    }
  }

  const topTechnieken = Object.entries(techniqueCount)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 8)
    .map(([id, count]) => ({ id, count }));

  // Speaker verdeling
  const sellerTurns = transcript.filter((t) => t.speaker === "seller").length;
  const customerTurns = transcript.filter((t) => t.speaker === "customer").length;

  // Missed opportunities samenvatting
  const missedOpps = (insights.missedOpportunities || []).map((m: any) => m.type || m.category || "onbekend");

  return {
    title: result.conversation?.title,
    overallScore: insights.overallScore,
    turnCount: { seller: sellerTurns, customer: customerTurns, total: transcript.length },
    signalCount: signals.length,
    houdingVerdeling: houdingCount,
    qualityVerdeling: qualityCount,
    techniquesByPhase: Object.fromEntries(
      Object.entries(techniquesByPhase).map(([fase, ids]) => [fase, ids.length])
    ),
    topTechnieken,
    phaseCoverage: {
      overall: insights.phaseCoverage?.overall,
      fase1: insights.phaseCoverage?.phase1?.score,
      fase2: insights.phaseCoverage?.phase2?.overall?.score,
      fase3: insights.phaseCoverage?.phase3?.score,
      fase4: insights.phaseCoverage?.phase4?.score,
    },
    missedOpportunities: missedOpps,
    strengths: (insights.strengths || []).length,
    improvements: (insights.improvements || []).length,
  };
}

async function runMetaAnalysis(
  items: Array<{ file: string; conversationId: string; data: object }>,
  fileEnv: Record<string, string>,
  previousReport?: string
): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY || fileEnv.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is vereist in .env");

  const client = new Anthropic({ apiKey });

  const systemPrompt = `Je bent een senior sales coaching expert en AI-systeem evaluator. Je analyseert de output van de HugoHerbots V3 analyse-pipeline (E.P.I.C. TECHNIQUE methodologie, 9 klanthoudingen H1-H9, 47 verkooptechnieken in SSOT).

Jouw taak: systematische kwaliteitsgaps identificeren in de pipeline-output en concrete verbeteringen voorstellen. Schrijf je rapport in het Nederlands. Wees specifiek en actionable — geen algemeenheden.`;

  const comparisonSection = previousReport
    ? `\n\n---\n## VORIG RAPPORT (ter vergelijking)\n\n${previousReport.slice(0, 3000)}${previousReport.length > 3000 ? "\n... [ingekort]" : ""}\n---\n`
    : "";

  const verdictInstruction = previousReport
    ? `\n\n## 8. VERDICT (verplicht als laatste sectie)\nVergelijk met het vorige rapport hierboven. Zijn de top-3 gaps van de vorige ronde opgelost?\n- **TOP3_FIXED** — alle top-3 gaps significant verbeterd → klaar voor volgend gesprek\n- **GAPS_REMAIN** — 1 of meer top-3 gaps nog aanwezig → nog een iteratie nodig\n\nGeef exact één van deze twee labels als eerste woord van deze sectie, gevolgd door je toelichting.`
    : `\n\n## 8. VERDICT (verplicht als laatste sectie)\nDit is de eerste analyse van dit gesprek. Beoordeel:\n- **GAPS_REMAIN** — er zijn duidelijke systematische gaps → iteratie nodig voor verbetering\n- **TOP3_FIXED** — de pipeline scoort al goed op dit gesprek (weinig gaps)\n\nGeef exact één van deze twee labels als eerste woord van deze sectie, gevolgd door je toelichting.`;

  const userPrompt = `Hier zijn ${items.length} gecomprimeerde analyse-resultaten van echte salesgesprekken:

${JSON.stringify(items.map((c) => ({ gesprek: c.file, ...c.data })), null, 2)}
${comparisonSection}
Schrijf een systematisch kwaliteitsrapport met deze secties:

## 1. Houding-classificatie kwaliteit
- Verdeling H1-H9 vs "neutraal" over alle gesprekken (geef percentages)
- Welke houdingen worden nooit of zelden gedetecteerd? Wat zou dat betekenen?
- Hypothese: waarom classificeert de pipeline zo veel als "neutraal"?

## 2. EPIC sequentie compliance
- Worden fase-3 technieken (Oplossing/Voordeel/Baat) gebruikt zonder dat fase-2 (Impact + Commitment) is afgerond?
- Zijn er tekenen van premature oplossingen in de data?
- Worden de technieken in logische volgorde gescoord of willekeurig?

## 3. Kwaliteits-verdeling per fase
- Wat is de verdeling perfect/goed/bijna/gemist over alle gesprekken?
- Welke fase scoort het laagst? Hoe significant is het verschil?
- Zijn er gesprekken met opvallend hoge of lage scores? Wat maakt ze anders?

## 4. Signaal-kwaliteit
- Hoeveel klant-signalen worden gemiddeld per gesprek gedetecteerd (verhouding tot turns)?
- Zijn er gesprekken met ongewoon weinig signalen? Wijst dit op mis-detectie?

## 5. Top-3 systematische gaps
Per gap:
- **Probleem:** wat gaat er mis?
- **Bewijs uit de data:** specifiek voorbeeld of patroon
- **Root cause:** waarom doet de prompt dit verkeerd?
- **Fix:** exacte tekst/structuur die aan de prompt in \`analysis-service.ts\` moet worden toegevoegd of aangepast (zo concreet mogelijk)

## 6. Prioriteitsmatrix
Rangschik de gaps op **impact × haalbaarheid**.
Welke 1-2 wijzigingen leveren de meeste kwaliteitsverbetering voor de volgende ronde?

## 7. Actielijst voor volgende ronde
Bullet-per-bullet: wat moet er gewijzigd worden in \`server/hugo-engine/v3/analysis-service.ts\`?
${verdictInstruction}`;

  console.log("Opus aan het werk...");
  const response = await client.messages.create({
    model: "claude-opus-4-20250514",
    max_tokens: 8000,
    system: systemPrompt,
    messages: [{ role: "user", content: userPrompt }],
  });

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") throw new Error("Geen tekst in Opus response");
  return textBlock.text;
}

async function main() {
  const fileEnv = loadEnv();
  const token = await getAuthToken(fileEnv);

  let entries: Array<{ file: string; conversationId: string }> = [];

  if (filterIds) {
    entries = filterIds.map((id) => ({ file: id, conversationId: id }));
  } else {
    if (!existsSync(PROGRESS_FILE)) {
      throw new Error(`${PROGRESS_FILE} niet gevonden. Run eerst batch-analyze.ts.`);
    }
    const progress = JSON.parse(readFileSync(PROGRESS_FILE, "utf-8"));
    entries = progress.completed || [];
  }

  if (entries.length === 0) {
    console.log("Geen voltooide analyses gevonden.");
    return;
  }

  console.log(`\n${entries.length} analyse(s) ophalen...`);
  const items: Array<{ file: string; conversationId: string; data: object }> = [];

  for (const entry of entries) {
    try {
      process.stdout.write(`  ${entry.file}...`);
      const result = await fetchResult(entry.conversationId, token);
      items.push({ file: entry.file, conversationId: entry.conversationId, data: compressResult(result) });
      console.log(" OK");
    } catch (err: any) {
      console.log(` FOUT: ${err.message}`);
    }
  }

  if (items.length === 0) {
    console.log("Geen resultaten opgehaald.");
    return;
  }

  // Load previous report for comparison (--compare-with)
  let previousReport: string | undefined;
  if (compareWithPath) {
    const absPath = compareWithPath.startsWith("/") ? compareWithPath : resolve(GESPREKKEN_DIR, compareWithPath);
    if (existsSync(absPath)) {
      previousReport = readFileSync(absPath, "utf-8");
      console.log(`Vergelijking met: ${absPath}`);
    } else {
      console.warn(`--compare-with: bestand niet gevonden: ${absPath}`);
    }
  }

  console.log(`\n${items.length} resultaten opgehaald. Meta-analyse starten (Opus)...`);
  const rapport = await runMetaAnalysis(items, fileEnv, previousReport);

  const datum = new Date().toISOString().slice(0, 10);
  const bestaandeRapports = existsSync(GESPREKKEN_DIR)
    ? readdirSync(GESPREKKEN_DIR).filter((f) => f.startsWith("meta-analysis-")).length
    : 0;
  const rondeNr = bestaandeRapports + 1;
  const outputPath = resolve(GESPREKKEN_DIR, `meta-analysis-${datum}-ronde${rondeNr}.md`);

  writeFileSync(outputPath, rapport);
  console.log(`\nRapport opgeslagen: ${outputPath}`);

  // Extract and print verdict
  const verdictMatch = rapport.match(/##\s*8\.\s*VERDICT[\s\S]*?\n(TOP3_FIXED|GAPS_REMAIN)/i);
  const verdict = verdictMatch ? verdictMatch[1].toUpperCase() : null;
  if (verdict) {
    const icon = verdict === "TOP3_FIXED" ? "✅" : "⚠️";
    console.log(`\n${icon} VERDICT: ${verdict}`);
    if (verdict === "TOP3_FIXED") {
      console.log("   → Klaar voor volgend gesprek (cross-validatie)");
    } else {
      console.log("   → Pas analysis-service.ts aan, dan: npx tsx scripts/re-analyze.ts --id <uuid> --then-meta");
    }
  }

  // Preview
  const preview = rapport.slice(0, 500);
  console.log("\n--- Preview ---");
  console.log(preview + (rapport.length > 500 ? "\n..." : ""));
}

main().catch((err) => {
  console.error("Script mislukt:", err.message);
  process.exit(1);
});
