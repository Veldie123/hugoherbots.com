/**
 * V2 vs V3 pipeline vergelijking op hetzelfde gesprek.
 *
 * Gebruik:
 *   npx tsx scripts/compare-v2-v3.ts                        # meest recente analyse
 *   npx tsx scripts/compare-v2-v3.ts --id <conversationId>  # specifiek gesprek
 *
 * Server hoeft NIET te draaien. Werkt rechtstreeks via DB + Anthropic/OpenAI API.
 * Vereist ANTHROPIC_API_KEY, OPENAI_API_KEY, PostgreSQL_connection_string_supabase in .env
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { randomUUID } from "crypto";
import { Pool } from "pg";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ─── 1. Load .env BEFORE any server-module imports ───────────────────────────

function loadEnv(): Record<string, string> {
  const env: Record<string, string> = {};
  try {
    const envPath = resolve(__dirname, "../.env");
    const content = readFileSync(envPath, "utf-8");
    for (const line of content.split("\n")) {
      const match = line.match(/^([^#=]+)=(.*)$/);
      if (match) {
        const key = match[1].trim();
        const val = match[2].trim().replace(/^["']|["']$/g, "");
        env[key] = val;
        process.env[key] ??= val; // don't overwrite shell vars (e.g. ANTHROPIC_API_KEY)
      }
    }
  } catch {
    /* no .env */
  }
  return env;
}

const fileEnv = loadEnv();

// ─── 2. DB connection (own pool, avoids db.ts side-effects) ──────────────────

function buildConnStr(): string {
  let connStr = process.env.PostgreSQL_connection_string_supabase || "";
  const pw = process.env.SUPABASE_YOUR_PASSWORD;
  if (pw && connStr.includes("[YOUR-PASSWORD]")) {
    connStr = connStr.replace("[YOUR-PASSWORD]", pw);
  }
  if (!connStr || connStr.includes("[YOUR-PASSWORD]")) {
    throw new Error("Geen geldige DB-connectiestring. Zet PostgreSQL_connection_string_supabase (+ SUPABASE_YOUR_PASSWORD) in .env");
  }
  // Convert direct URL to session pooler URL if needed
  try {
    const url = new URL(connStr);
    const hostMatch = url.hostname.match(/^db\.([a-z0-9]+)\.supabase\.co$/);
    if (hostMatch) {
      const projectRef = hostMatch[1];
      const password = decodeURIComponent(url.password);
      const region = process.env.SUPABASE_DB_REGION || "aws-1-eu-west-3";
      connStr = `postgresql://postgres.${projectRef}:${encodeURIComponent(password)}@${region}.pooler.supabase.com:5432/postgres`;
    }
  } catch { /* not a standard URL, use as-is */ }
  return connStr;
}

const dbPool = new Pool({ connectionString: buildConnStr(), ssl: { rejectUnauthorized: false } });

// ─── 3. Auth ──────────────────────────────────────────────────────────────────

async function getSupabaseUserId(): Promise<{ userId: string; email: string }> {
  const email = process.env.SCREENSHOT_EMAIL || fileEnv.SCREENSHOT_EMAIL;
  const password = process.env.SCREENSHOT_PASSWORD || fileEnv.SCREENSHOT_PASSWORD;
  if (!email || !password) throw new Error("SCREENSHOT_EMAIL en SCREENSHOT_PASSWORD zijn vereist in .env");

  const projectId = "pckctmojjrrgzuufsqoo";
  const anonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBja2N0bW9qanJyZ3p1dWZzcW9vIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYwOTg1MTUsImV4cCI6MjA4MTY3NDUxNX0.TrPovHz5PgSiwyxVCYplk-SA6cNi0gZkkMVGr3NdIuc";
  const supabase = createClient(`https://${projectId}.supabase.co`, anonKey);
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.session) throw new Error(`Auth mislukt: ${error?.message || "No session"}`);
  return { userId: data.user!.id, email };
}

// ─── 4. List + fetch analyses ─────────────────────────────────────────────────

async function listRecentAnalyses(userId: string): Promise<Array<{ id: string; title: string; created_at: string }>> {
  const res = await dbPool.query(
    `SELECT id, title, created_at FROM conversation_analyses
     WHERE user_id = $1 AND status = 'completed' AND result IS NOT NULL
     ORDER BY created_at DESC LIMIT 10`,
    [userId]
  );
  return res.rows;
}

async function fetchFullResult(conversationId: string): Promise<any> {
  const res = await dbPool.query(
    "SELECT result FROM conversation_analyses WHERE id = $1",
    [conversationId]
  );
  if (!res.rows[0]?.result) throw new Error(`Geen resultaat gevonden voor ${conversationId}`);
  return typeof res.rows[0].result === "string" ? JSON.parse(res.rows[0].result) : res.rows[0].result;
}

async function pollUntilDone(id: string, label: string, timeoutMs = 10 * 60 * 1000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const res = await dbPool.query("SELECT status, error, result FROM conversation_analyses WHERE id = $1", [id]);
    const row = res.rows[0];
    if (!row) {
      process.stdout.write(`\r  [${label}] wachten op DB-entry...`);
    } else if (row.status === "completed" && row.result !== null) {
      process.stdout.write(`\n`);
      return;
    } else if (row.status === "failed") {
      throw new Error(`[${label}] Analyse mislukt: ${row.error || "onbekende fout"}`);
    } else {
      const elapsed = Math.round((Date.now() - start) / 1000);
      const statusLabel = row.status === "completed" && row.result === null ? "wachten op result..." : row.status;
      process.stdout.write(`\r  [${label}] ${statusLabel} (${elapsed}s)...`);
    }
    await new Promise((r) => setTimeout(r, 5000));
  }
  throw new Error(`[${label}] Timeout na ${timeoutMs / 60000} minuten`);
}

// ─── 5. Build comparison data for Opus ───────────────────────────────────────

function buildComparisonPayload(
  v3Result: any,
  v2Result: any,
  sourceTitle: string
): string {
  const transcript: any[] = v3Result.transcript || [];
  const v3Evals: any[] = v3Result.evaluations || [];
  const v2Evals: any[] = v2Result.evaluations || [];
  const v3Signals: any[] = v3Result.signals || [];
  const v2Signals: any[] = v2Result.signals || [];

  // Condensed transcript
  const transcriptLines = transcript.map((t: any) =>
    `T${t.idx} [${t.speaker}]: ${String(t.text || "").slice(0, 90)}`
  ).join("\n");

  // Map evaluations by turnIdx
  const v3EvalMap = new Map(v3Evals.map((e: any) => [e.turnIdx, e]));
  const v2EvalMap = new Map(v2Evals.map((e: any) => [e.turnIdx, e]));

  // Find all seller turn indices
  const sellerTurnIdxs = [...new Set([
    ...v3Evals.map((e: any) => e.turnIdx),
    ...v2Evals.map((e: any) => e.turnIdx),
  ])].sort((a, b) => a - b);

  // Build technique diff
  const evalDiffs: string[] = [];
  for (const idx of sellerTurnIdxs) {
    const v3e = v3EvalMap.get(idx);
    const v2e = v2EvalMap.get(idx);
    const v3Techs = (v3e?.techniques || []).map((t: any) => `${t.naam} (${t.quality})`).join(", ") || "geen techniek";
    const v2Techs = (v2e?.techniques || []).map((t: any) => `${t.naam} (${t.quality})`).join(", ") || "geen techniek";
    const turnText = transcript.find((t: any) => t.idx === idx)?.text?.slice(0, 80) || "";
    evalDiffs.push(`T${idx}: "${turnText}"\n  V3: ${v3Techs}\n  V2: ${v2Techs}${v3Techs !== v2Techs ? " ← VERSCHIL" : ""}`);
  }

  // Signal diff (customer turns)
  const v3SigMap = new Map(v3Signals.map((s: any) => [s.turnIdx, s]));
  const v2SigMap = new Map(v2Signals.map((s: any) => [s.turnIdx, s]));
  const allCustomerIdxs = [...new Set([
    ...v3Signals.map((s: any) => s.turnIdx),
    ...v2Signals.map((s: any) => s.turnIdx),
  ])].sort((a, b) => a - b);

  const sigDiffs: string[] = [];
  for (const idx of allCustomerIdxs) {
    const v3s = v3SigMap.get(idx);
    const v2s = v2SigMap.get(idx);
    const v3h = v3s?.houding || "niet gedetecteerd";
    const v2h = v2s?.houding || "niet gedetecteerd";
    const turnText = transcript.find((t: any) => t.idx === idx)?.text?.slice(0, 80) || "";
    if (v3h !== v2h) {
      sigDiffs.push(`T${idx}: "${turnText}"\n  V3: ${v3h}\n  V2: ${v2h} ← VERSCHIL`);
    }
  }

  // Score / insights comparison
  const v3i = v3Result.insights || {};
  const v2i = v2Result.insights || {};

  const scoreComp = [
    `Overall score: V3=${v3i.overallScore ?? "?"} | V2=${v2i.overallScore ?? "?"}`,
    `Fase 1: V3=${v3i.phaseCoverage?.phase1?.score ?? "?"} | V2=${v2i.phaseCoverage?.phase1?.score ?? "?"}`,
    `Fase 2: V3=${v3i.phaseCoverage?.phase2?.overall?.score ?? "?"} | V2=${v2i.phaseCoverage?.phase2?.overall?.score ?? "?"}`,
    `Fase 3: V3=${v3i.phaseCoverage?.phase3?.score ?? "?"} | V2=${v2i.phaseCoverage?.phase3?.score ?? "?"}`,
    `Fase 4: V3=${v3i.phaseCoverage?.phase4?.score ?? "?"} | V2=${v2i.phaseCoverage?.phase4?.score ?? "?"}`,
    `Gemiste kansen: V3=${v3i.missedOpportunities?.length ?? 0} | V2=${v2i.missedOpportunities?.length ?? 0}`,
    `Sterke punten: V3=${v3i.strengths?.length ?? 0} | V2=${v2i.strengths?.length ?? 0}`,
    `Verbeterpunten: V3=${v3i.improvements?.length ?? 0} | V2=${v2i.improvements?.length ?? 0}`,
  ].join("\n");

  const v3MissedTypes = (v3i.missedOpportunities || []).map((m: any) => m.type).join(", ") || "geen";
  const v2MissedTypes = (v2i.missedOpportunities || []).map((m: any) => m.type).join(", ") || "geen";

  const v3Strengths = (v3i.strengths || []).map((s: any) => s.text).slice(0, 3).join(" | ") || "geen";
  const v2Strengths = (v2i.strengths || []).map((s: any) => s.text).slice(0, 3).join(" | ") || "geen";

  const v3CoachDebrief = v3i.coachDebrief?.oneliner || v3i.summaryMarkdown?.slice(0, 200) || "geen";
  const v2CoachDebrief = v2i.coachDebrief?.oneliner || v2i.summaryMarkdown?.slice(0, 200) || "geen";

  return `
# VERGELIJKINGSDATA: "${sourceTitle}"

## TRANSCRIPT (${transcript.length} turns)
${transcriptLines}

## SCORES & FASE-DEKKING
${scoreComp}

## TECHNIEKDETECTIE PER SELLER-TURN (V3 vs V2)
${evalDiffs.join("\n\n")}

## KLANTHOUDING AFWIJKINGEN (alleen VERSCHIL turns)
${sigDiffs.length > 0 ? sigDiffs.join("\n\n") : "Geen afwijkingen"}

## GEMISTE KANSEN
V3 types: ${v3MissedTypes}
V2 types: ${v2MissedTypes}

## TOP STERKE PUNTEN
V3: ${v3Strengths}
V2: ${v2Strengths}

## COACH DEBRIEF (oneliner)
V3: ${v3CoachDebrief}
V2: ${v2CoachDebrief}
`.trim();
}

// ─── 6. Opus meta-analyse ─────────────────────────────────────────────────────

async function runOpusComparison(comparisonData: string): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY || fileEnv.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is vereist in .env");

  const client = new Anthropic({ apiKey });

  const systemPrompt = `Je bent een expert in sales coaching methodologie (E.P.I.C. TECHNIQUE, 9 klanthoudingen H1-H9, 47 SSOT-technieken) én AI-systeem evaluator. Je analyseert de output van twee AI-analyse-pipelines:
- V3: Claude-gebaseerd, narrative-first (begrijpt eerst het gesprek als geheel, detecteert dan technieken per turn in context)
- V2: GPT-gebaseerd, turn-blind (evalueert elke turn los, zonder conversationele context)

Schrijf je rapport in het Nederlands. Wees concreet en actionable.`;

  const userPrompt = `Hieronder staan de analyse-outputs van V3 en V2 op hetzelfde salesgesprek. Analyseer de verschillen systematisch.

${comparisonData}

---

Schrijf een vergelijkingsrapport met deze secties:

## 1. TECHNIEKDETECTIE — Systematische verschillen
- Welke technieken detecteert V2 die V3 NIET detecteert? Geef turn-nummers + citaten.
- Welke detecteert V3 die V2 NIET detecteert?
- Welke turns evalueert V3 als "geen techniek" maar V2 wél? Zijn dat terechte of onterechte evaluaties?
- Patronen: detecteert V2 vaker bepaalde technieken (bijv. fase-1 of fase-4)?

## 2. KLANTHOUDING CLASSIFICATIE
- Waar wijken H1-H9 attributies af? Welke versie is accurater (motiveer je antwoord)?
- Detecteert één versie structureel meer/minder houdingen?

## 3. FASE-ANALYSE & SCORES
- Wat verklaart de score-verschillen? Waar zijn ze het grootst?
- Welke versie heeft een betere fase-dekking analyse? Motiveer.

## 4. COACH RAPPORT KWALITEIT
- Vergelijk gemiste kansen: welke versie is nauwkeuriger/actiegerichter?
- Vergelijk coachdebrief en sterke punten: welke versie geeft betere actie-aanwijzingen?

## 5. STERKE PUNTEN V2 DIE V3 MIST
Specifiek: wat doet V2 beter? Concrete voorbeelden uit deze data.

## 6. STERKE PUNTEN V3 DIE V2 MIST
Specifiek: wat doet V3 beter?

## 7. INTEGRATIEMOGELIJKHEDEN
Welke elementen uit V2 zouden V3 versterken? Voor elk voorstel:
- **Wat:** wat moet worden geïntegreerd
- **Waar:** exact bestand + functie in V3 (bijv. \`evaluateSellerTurnsV3\` in \`v3/analysis-service.ts\`)
- **Hoe:** concrete prompt-toevoeging of structuurwijziging (max 3-5 zinnen)

## 8. AANBEVELINGEN (prioriteit)
Top-3 wijzigingen die de meeste kwaliteitsverbetering opleveren voor V3.`;

  console.log("\nOpus 4.6 meta-analyse starten...");
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

// ─── 7. Main ──────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  let sourceId: string | null = null;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--id" && args[i + 1]) sourceId = args[++i];
    else if (!args[i].startsWith("--")) sourceId = args[i];
  }

  console.log("\n[1/7] Authenticeren...");
  const { userId, email } = await getSupabaseUserId();
  console.log(`  Ingelogd als ${email} (${userId})`);

  // Pick source analysis
  if (!sourceId) {
    console.log("\n[2/7] Recente analyses ophalen...");
    const list = await listRecentAnalyses(userId);
    if (list.length === 0) throw new Error("Geen voltooide analyses gevonden voor deze gebruiker.");
    console.log("  Beschikbare analyses:");
    list.forEach((a, i) => console.log(`    ${i + 1}. [${a.id.slice(0, 8)}...] ${a.title} (${String(a.created_at).slice(0, 10)})`));
    sourceId = list[0].id;
    console.log(`\n  Automatisch gekozen: ${list[0].title}`);
  } else {
    console.log(`\n[2/7] Brongesprek: ${sourceId}`);
  }

  console.log("\n[3/7] Bron-analyse (V3) ophalen...");
  const v3Result = await fetchFullResult(sourceId);
  const transcript = v3Result.transcript;
  const sourceTitle = v3Result.conversation?.title || sourceId;
  console.log(`  Titel: "${sourceTitle}" — ${transcript?.length ?? 0} turns`);
  if (!transcript || transcript.length === 0) throw new Error("Geen transcript gevonden in het bron-resultaat.");

  console.log("\n[4/7] V2 re-analyse starten op hetzelfde transcript...");

  // Import FIRST — module's startup auto-recovery marks all non-completed rows as failed.
  const { reAnalyzeFromTranscriptV2 } = await import("../server/hugo-engine/v2/analysis-service.js") as any;
  // Wait for all async startup tasks (table creation, auto-recovery) to complete
  await new Promise((r) => setTimeout(r, 8000));

  const v2Id = randomUUID();
  const v2Title = `${sourceTitle} [V2-vergelijking]`;

  // Pre-insert with 'completed' + null result — auto-recovery skips completed rows.
  // reAnalyzeFromTranscriptV2 will UPDATE status to 'evaluating' as it runs, then
  // back to 'completed' with a non-null result when done. Poll checks both.
  await dbPool.query(
    `INSERT INTO conversation_analyses (id, user_id, title, status, created_at, result)
     VALUES ($1, $2, $3, 'completed', NOW(), NULL) ON CONFLICT DO NOTHING`,
    [v2Id, userId, v2Title]
  );

  // Fire-and-forget — function updates status + result in DB
  reAnalyzeFromTranscriptV2(v2Id, transcript, userId, v2Title)
    .catch((err: Error) => console.error(`\n  V2 mislukt: ${err.message}`));

  console.log(`  V2 ID: ${v2Id}`);
  console.log("  Wachten op V2...");
  await pollUntilDone(v2Id, "V2");
  console.log("  V2 klaar.");

  console.log("\n[5/7] Beide resultaten ophalen...");
  const v2Result = await fetchFullResult(v2Id);
  console.log(`  V2: ${v2Result.evaluations?.length ?? 0} evaluaties, score ${v2Result.insights?.overallScore ?? "?"}`);
  console.log(`  V3: ${v3Result.evaluations?.length ?? 0} evaluaties, score ${v3Result.insights?.overallScore ?? "?"}`);

  console.log("\n[6/7] Vergelijkingsdata samenstellen...");
  const comparisonPayload = buildComparisonPayload(v3Result, v2Result, sourceTitle);

  const rapport = await runOpusComparison(comparisonPayload);

  console.log("\n[7/7] Rapport opslaan...");
  const docsDir = resolve(__dirname, "../docs");
  if (!existsSync(docsDir)) mkdirSync(docsDir, { recursive: true });

  const safeTitle = sourceTitle.replace(/[^a-z0-9]/gi, "-").slice(0, 40).toLowerCase();
  const datum = new Date().toISOString().slice(0, 10);
  const outputPath = resolve(docsDir, `v2-vs-v3-${datum}-${safeTitle}.md`);

  const header = `# V2 vs V3 Pipeline Vergelijking\n\n**Gesprek:** ${sourceTitle}  \n**Datum:** ${datum}  \n**V3 ID:** ${sourceId}  \n**V2 ID:** ${v2Id}  \n\n---\n\n`;
  writeFileSync(outputPath, header + rapport);
  console.log(`  Rapport: ${outputPath}`);

  // Preview
  console.log("\n--- Preview (eerste 600 tekens) ---");
  console.log(rapport.slice(0, 600) + (rapport.length > 600 ? "\n..." : ""));
}

main().catch((err) => {
  console.error("\nScript mislukt:", err.message);
  process.exit(1);
});
