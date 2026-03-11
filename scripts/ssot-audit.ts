/**
 * SSOT Audit — Main Orchestration Script
 *
 * Audits Hugo Herbots' SSOT config files against video transcripts using Claude.
 *
 * Usage:
 *   npx tsx scripts/ssot-audit.ts [options]
 *
 * Options:
 *   --techniques 2.1.1,2.1.2    Only audit these technique IDs
 *   --config technieken          Only audit one config: technieken|klant_houdingen|rag|evaluator
 *   --dry-run                    Print scope, no API calls
 *   --output path/to/file.json   Override output path
 *   --min-confidence 0.7         Filter findings below this confidence (default: 0)
 */

import * as fs from "fs";
import * as path from "path";

import { AuditFinding, AuditReport } from "./ssot-audit-lib/types";
import { loadTranscripts, TranscriptMap } from "./ssot-audit-lib/transcript-loader";
import { withRetry, sleep, BASE_DELAY_MS } from "./ssot-audit-lib/rate-limiter";
import { callClaude, AUDIT_MODEL } from "./ssot-audit-lib/claude-client";
import {
  TechniqueEntry,
  buildTechniekenSystemPrompt,
  buildTechniekenUserPrompt,
} from "./ssot-audit-lib/prompts/technieken-prompt";
import {
  HoudingEntry,
  buildHoudingenSystemPrompt,
  buildHoudingenUserPrompt,
} from "./ssot-audit-lib/prompts/klant-houdingen-prompt";
import {
  HeuristicEntry,
  RagHeuristicBatchItem,
  findMissingAnchors,
  batchNeedsClaude,
  buildRagHeuristicsSystemPrompt,
  buildRagHeuristicsUserPrompt,
} from "./ssot-audit-lib/prompts/rag-heuristics-prompt";
import {
  EvaluatorEntry,
  EvaluatorBatchItem,
  buildEvaluatorSystemPrompt,
  buildEvaluatorUserPrompt,
} from "./ssot-audit-lib/prompts/evaluator-overlay-prompt";

// ---------------------------------------------------------------------------
// Project root: scripts/ is one level below project root
// ---------------------------------------------------------------------------
const PROJECT_ROOT = path.resolve(__dirname, "..");

// ---------------------------------------------------------------------------
// JSON file loader with descriptive error handling
// ---------------------------------------------------------------------------

function loadJsonFile(filePath: string, label: string): unknown {
  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(raw);
  } catch (err) {
    throw new Error(
      `[ssot-audit] Failed to load ${label} from "${filePath}": ${String(err)}`
    );
  }
}

// ---------------------------------------------------------------------------
// CLI argument parsing
// ---------------------------------------------------------------------------

interface CliArgs {
  techniques?: string[];     // filtered technique IDs
  config?: string;           // one of: technieken, klant_houdingen, rag, evaluator
  dryRun: boolean;
  output?: string;
  minConfidence: number;
}

const VALID_CONFIGS = ["technieken", "klant_houdingen", "rag", "evaluator"] as const;

function parseArgs(argv: string[]): CliArgs {
  const args = argv.slice(2); // drop "node" and script path
  const result: CliArgs = { dryRun: false, minConfidence: 0 };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--dry-run") {
      result.dryRun = true;
    } else if (arg === "--techniques" && args[i + 1]) {
      result.techniques = args[++i].split(",").map((s) => s.trim()).filter(Boolean);
    } else if (arg === "--config" && args[i + 1]) {
      result.config = args[++i];
    } else if (arg === "--output" && args[i + 1]) {
      result.output = args[++i];
    } else if (arg === "--min-confidence" && args[i + 1]) {
      const val = parseFloat(args[++i]);
      if (!isNaN(val)) result.minConfidence = val;
    }
  }

  if (result.config && !VALID_CONFIGS.includes(result.config as any)) {
    process.stderr.write(
      `[ssot-audit] Invalid --config value: "${result.config}". Valid options: ${VALID_CONFIGS.join(", ")}\n`
    );
    process.exit(1);
  }

  return result;
}

// ---------------------------------------------------------------------------
// parseFindings helper
// ---------------------------------------------------------------------------

function parseFindings(
  rawResponse: string,
  configFile: AuditFinding["config_file"],
  fallbackItemId: string
): AuditFinding[] {
  try {
    const parsed = JSON.parse(rawResponse);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((f) => f && typeof f === "object" && f.field)
      .map((f) => ({
        config_file: configFile,
        item_id: f.item_id ?? f.techniqueId ?? fallbackItemId,
        field: String(f.field),
        current_value: f.current_value ?? "",
        proposed_value: f.proposed_value,
        issue_description: String(f.issue_description ?? ""),
        transcript_evidence: Array.isArray(f.transcript_evidence) ? f.transcript_evidence : [],
        confidence: typeof f.confidence === "number" ? f.confidence : 0.5,
        status: (["ok", "needs_review", "flagged"] as const).includes(f.status)
          ? f.status
          : "needs_review",
        no_transcript_coverage: false,
      } as AuditFinding))
      // Safety: downgrade non-ok findings with no evidence
      .map((f) =>
        f.status !== "ok" && f.transcript_evidence.length === 0
          ? { ...f, status: "ok" as const }
          : f
      );
  } catch {
    process.stderr.write(`[ssot-audit] Failed to parse Claude response as JSON\n`);
    return [];
  }
}

// ---------------------------------------------------------------------------
// Audit: technieken_index.json
// ---------------------------------------------------------------------------

async function auditTechnieken(
  techniques: Record<string, TechniqueEntry>,
  transcriptMap: TranscriptMap,
  targetIds?: string[]
): Promise<AuditFinding[]> {
  const findings: AuditFinding[] = [];
  const systemPrompt = buildTechniekenSystemPrompt();

  for (const [id, technique] of Object.entries(techniques)) {
    // Skip fase entries
    if ((technique as unknown as { is_fase?: boolean }).is_fase) continue;
    // Filter by --techniques if specified
    if (targetIds && !targetIds.includes(id)) continue;

    const transcript = transcriptMap.transcripts.get(id);

    if (transcript === undefined) {
      // No transcript coverage — add informational finding, skip Claude
      findings.push({
        config_file: "technieken_index.json",
        item_id: id,
        field: "transcript_coverage",
        current_value: "",
        issue_description: `Geen videotranscript gevonden voor techniek ${id} — ${technique.naam}`,
        transcript_evidence: [],
        confidence: 1.0,
        status: "ok",
        no_transcript_coverage: true,
      });
      continue;
    }

    const userPrompt = buildTechniekenUserPrompt(technique, transcript);
    const raw = await withRetry(() => callClaude(systemPrompt, userPrompt));
    await sleep(BASE_DELAY_MS);

    const batchFindings = parseFindings(raw, "technieken_index.json", id).map((f) => ({
      ...f,
      item_id: f.item_id || id,
    }));
    findings.push(...batchFindings);
  }

  return findings;
}

// ---------------------------------------------------------------------------
// Audit: klant_houdingen.json
// ---------------------------------------------------------------------------

async function auditKlantHoudingen(
  houdingen: Record<string, HoudingEntry>,
  transcriptMap: TranscriptMap,
  targetIds?: string[]
): Promise<AuditFinding[]> {
  const findings: AuditFinding[] = [];
  const systemPrompt = buildHoudingenSystemPrompt();

  for (const houding of Object.values(houdingen)) {
    const houdingId = houding.id;
    if (!houdingId) continue;
    if (targetIds && !targetIds.includes(houdingId)) continue;

    // Gather transcripts from recommended technique IDs
    const aanbevolen: string[] =
      houding.recommended_technique_ids ?? houding.aanbevolen_technieken ?? [];

    const transcriptParts: string[] = [];
    for (const techId of aanbevolen.slice(0, 3)) {
      const t = transcriptMap.transcripts.get(techId);
      if (t) {
        transcriptParts.push(`--- [Techniek ${techId}] ---\n${t}`);
      }
    }

    const techniqueTranscripts = transcriptParts.join("\n\n");

    const userPrompt = buildHoudingenUserPrompt(houding, techniqueTranscripts);
    const raw = await withRetry(() => callClaude(systemPrompt, userPrompt));
    await sleep(BASE_DELAY_MS);

    const batchFindings = parseFindings(raw, "klant_houdingen.json", houdingId).map((f) => ({
      ...f,
      item_id: f.item_id || houdingId,
    }));
    findings.push(...batchFindings);
  }

  return findings;
}

// ---------------------------------------------------------------------------
// Audit: rag_heuristics.json
// ---------------------------------------------------------------------------

async function auditRagHeuristics(
  heuristics: Record<string, HeuristicEntry>,
  transcriptMap: TranscriptMap,
  targetIds?: string[]
): Promise<AuditFinding[]> {
  const findings: AuditFinding[] = [];
  const systemPrompt = buildRagHeuristicsSystemPrompt();

  // Build list of entries to process
  const entries = Object.entries(heuristics)
    .filter(([id]) => !targetIds || targetIds.includes(id));

  // Process in batches of 4 (reduced to avoid context window issues with large transcripts)
  const BATCH_SIZE = 4;
  for (let i = 0; i < entries.length; i += BATCH_SIZE) {
    const batchEntries = entries.slice(i, i + BATCH_SIZE);

    const batch: RagHeuristicBatchItem[] = batchEntries.map(([id, entry]) => {
      const transcript = transcriptMap.transcripts.get(id) ?? "";
      const allAnchors = entry.anchors ?? [];
      const missingAnchors = findMissingAnchors(allAnchors, transcript);
      return {
        techniqueId: id,
        entry,
        transcript,
        missingAnchors,
        allAnchors,
        supportTerms: entry.support ?? [],
      };
    });

    if (!batchNeedsClaude(batch)) continue;

    const userPrompt = buildRagHeuristicsUserPrompt(batch);
    if (!userPrompt) continue;

    const raw = await withRetry(() => callClaude(systemPrompt, userPrompt));
    await sleep(BASE_DELAY_MS);

    // Parse batch response — item_id comes from techniqueId field in response
    const batchFindings = parseFindings(raw, "rag_heuristics.json", batchEntries[0][0]);
    findings.push(...batchFindings);
  }

  return findings;
}

// ---------------------------------------------------------------------------
// Audit: evaluator_overlay.json
// ---------------------------------------------------------------------------

async function auditEvaluatorOverlay(
  evalEntries: Record<string, EvaluatorEntry>,
  transcriptMap: TranscriptMap,
  targetIds?: string[]
): Promise<AuditFinding[]> {
  const findings: AuditFinding[] = [];
  const systemPrompt = buildEvaluatorSystemPrompt();

  // Build list of entries that have eval_note and pass targetIds filter
  const entries = Object.entries(evalEntries)
    .filter(([id, entry]) => {
      if (targetIds && !targetIds.includes(id)) return false;
      return !!entry.eval_note; // skip entries without eval_note
    });

  // Process in batches of 4 (reduced to avoid context window issues with large transcripts)
  const BATCH_SIZE = 4;
  for (let i = 0; i < entries.length; i += BATCH_SIZE) {
    const batchEntries = entries.slice(i, i + BATCH_SIZE);

    const batch: EvaluatorBatchItem[] = batchEntries.map(([id, entry]) => ({
      techniqueId: id,
      entry,
      transcript: transcriptMap.transcripts.get(id) ?? "",
    }));

    const userPrompt = buildEvaluatorUserPrompt(batch);
    const raw = await withRetry(() => callClaude(systemPrompt, userPrompt));
    await sleep(BASE_DELAY_MS);

    // Parse batch response — item_id comes from techniqueId field in response
    const batchFindings = parseFindings(raw, "evaluator_overlay.json", batchEntries[0][0]);
    findings.push(...batchFindings);
  }

  return findings;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const startTime = Date.now();
  const cliArgs = parseArgs(process.argv);

  // Fail fast if API key missing (unless dry-run)
  if (!cliArgs.dryRun && !process.env.ANTHROPIC_API_KEY) {
    process.stderr.write(
      "[ssot-audit] Error: ANTHROPIC_API_KEY is not set. Export it or pass via .env.\n"
    );
    process.exit(1);
  }

  // Load transcripts
  const transcriptMap = loadTranscripts(PROJECT_ROOT);

  // Load SSOT config files
  const techniekenRaw = loadJsonFile(
    path.join(PROJECT_ROOT, "config", "ssot", "technieken_index.json"),
    "technieken_index.json"
  );
  const houdingRaw = loadJsonFile(
    path.join(PROJECT_ROOT, "config", "klant_houdingen.json"),
    "klant_houdingen.json"
  );
  const ragRaw = loadJsonFile(
    path.join(PROJECT_ROOT, "config", "rag_heuristics.json"),
    "rag_heuristics.json"
  );
  const evaluatorRaw = loadJsonFile(
    path.join(PROJECT_ROOT, "config", "ssot", "evaluator_overlay.json"),
    "evaluator_overlay.json"
  );

  // Extract data structures (cast to any — loadJsonFile already validated parse)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const techniekenAny = techniekenRaw as any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const houdingAny = houdingRaw as any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ragAny = ragRaw as any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const evaluatorAny = evaluatorRaw as any;

  const techniques: Record<string, TechniqueEntry> = techniekenAny.technieken ?? {};
  // klant_houdingen: nested under "houdingen" or flat
  const houdingen: Record<string, HoudingEntry> =
    houdingAny.houdingen ?? houdingAny;
  // rag_heuristics: nested under "techniques"
  const ragHeuristics: Record<string, HeuristicEntry> =
    ragAny.techniques ?? ragAny;
  // evaluator_overlay: nested under "technieken"
  const evalEntries: Record<string, EvaluatorEntry> =
    evaluatorAny.technieken ?? evaluatorAny;

  // Build full list of leaf technique IDs
  const allLeafIds = Object.entries(techniques)
    .filter(([, t]) => !(t as unknown as { is_fase?: boolean }).is_fase)
    .map(([id]) => id);

  // Compute uncovered technique IDs
  const uncoveredIds = allLeafIds.filter((id) => !transcriptMap.transcripts.has(id));
  transcriptMap.uncoveredTechniqueIds = uncoveredIds;

  // Determine which configs to audit
  const configFilter = cliArgs.config?.toLowerCase();
  const runTechnieken = !configFilter || configFilter === "technieken";
  const runHoudingen = !configFilter || configFilter === "klant_houdingen";
  const runRag = !configFilter || configFilter === "rag";
  const runEvaluator = !configFilter || configFilter === "evaluator";

  const configFilesAudited: string[] = [
    ...(runTechnieken ? ["technieken_index.json"] : []),
    ...(runHoudingen ? ["klant_houdingen.json"] : []),
    ...(runRag ? ["rag_heuristics.json"] : []),
    ...(runEvaluator ? ["evaluator_overlay.json"] : []),
  ];

  // Estimate API calls
  const targetLeafIds = cliArgs.techniques
    ? allLeafIds.filter((id) => cliArgs.techniques!.includes(id))
    : allLeafIds;
  const houdingCount = Object.keys(houdingen).length;
  const ragBatches = Math.ceil(Object.keys(ragHeuristics).length / 4);
  const evalBatches = Math.ceil(
    Object.entries(evalEntries).filter(([, e]) => !!e.eval_note).length / 4
  );

  const estimatedCalls =
    (runTechnieken ? targetLeafIds.length : 0) +
    (runHoudingen ? houdingCount : 0) +
    (runRag ? ragBatches : 0) +
    (runEvaluator ? evalBatches : 0);

  // Dry-run: print scope and exit
  if (cliArgs.dryRun) {
    process.stdout.write(`SSOT Audit — Dry Run\n`);
    process.stdout.write(`${"=".repeat(40)}\n`);
    process.stdout.write(`Project root:    ${PROJECT_ROOT}\n`);
    process.stdout.write(`Videos loaded:   ${transcriptMap.videoCount}\n`);
    process.stdout.write(`Leaf techniques: ${allLeafIds.length} total, ${allLeafIds.length - uncoveredIds.length} covered\n`);
    process.stdout.write(`Uncovered:       ${uncoveredIds.length} (${uncoveredIds.slice(0, 5).join(", ")}${uncoveredIds.length > 5 ? "..." : ""})\n`);
    process.stdout.write(`\nConfigs to audit:\n`);
    for (const cf of configFilesAudited) {
      process.stdout.write(`  - ${cf}\n`);
    }
    if (cliArgs.techniques) {
      process.stdout.write(`\nTargeted techniques: ${cliArgs.techniques.join(", ")}\n`);
    }
    process.stdout.write(`\nEstimated API calls: ~${estimatedCalls}\n`);
    process.exit(0);
  }

  // Run audits
  process.stdout.write(`[ssot-audit] Starting audit (${configFilesAudited.join(", ")})\n`);

  let allFindings: AuditFinding[] = [];

  if (runTechnieken) {
    process.stdout.write(`[ssot-audit] Auditing technieken_index.json (${targetLeafIds.length} techniques)...\n`);
    const f = await auditTechnieken(techniques, transcriptMap, cliArgs.techniques);
    process.stdout.write(`[ssot-audit]   → ${f.length} findings\n`);
    allFindings.push(...f);
  }

  if (runHoudingen) {
    process.stdout.write(`[ssot-audit] Auditing klant_houdingen.json (${houdingCount} houdingen)...\n`);
    const f = await auditKlantHoudingen(houdingen, transcriptMap, cliArgs.techniques);
    process.stdout.write(`[ssot-audit]   → ${f.length} findings\n`);
    allFindings.push(...f);
  }

  if (runRag) {
    process.stdout.write(`[ssot-audit] Auditing rag_heuristics.json (~${ragBatches} batches)...\n`);
    const f = await auditRagHeuristics(ragHeuristics, transcriptMap, cliArgs.techniques);
    process.stdout.write(`[ssot-audit]   → ${f.length} findings\n`);
    allFindings.push(...f);
  }

  if (runEvaluator) {
    process.stdout.write(`[ssot-audit] Auditing evaluator_overlay.json (~${evalBatches} batches)...\n`);
    const f = await auditEvaluatorOverlay(evalEntries, transcriptMap, cliArgs.techniques);
    process.stdout.write(`[ssot-audit]   → ${f.length} findings\n`);
    allFindings.push(...f);
  }

  // Apply --min-confidence filter
  if (cliArgs.minConfidence > 0) {
    allFindings = allFindings.filter(
      (f) => f.no_transcript_coverage || f.confidence >= cliArgs.minConfidence
    );
  }

  // Build summary
  const flagged = allFindings.filter((f) => f.status === "flagged").length;
  const needsReview = allFindings.filter((f) => f.status === "needs_review").length;
  const ok = allFindings.filter((f) => f.status === "ok").length;

  // Build AuditReport
  const auditDate = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const report: AuditReport = {
    audit_date: auditDate,
    video_count: transcriptMap.videoCount,
    ssot_technique_count: allLeafIds.length,
    techniques_with_coverage: allLeafIds.length - uncoveredIds.length,
    techniques_without_coverage: uncoveredIds,
    summary: {
      total: allFindings.length,
      flagged,
      needs_review: needsReview,
      ok,
    },
    findings: allFindings,
    metadata: {
      model: AUDIT_MODEL,
      script_version: "1.0.0",
      config_files_audited: configFilesAudited,
      run_duration_seconds: Math.round((Date.now() - startTime) / 1000),
      ...(cliArgs.techniques ? { techniques_targeted: cliArgs.techniques } : {}),
    },
  };

  // Determine output path
  const outputPath =
    cliArgs.output ?? path.join(PROJECT_ROOT, "docs", `ssot-audit-${auditDate}.json`);

  // Create output directory if needed
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });

  // Write output file atomically (tmp → rename) to prevent corruption on interrupt
  const tmpPath = outputPath + ".tmp";
  fs.writeFileSync(tmpPath, JSON.stringify(report, null, 2) + "\n", "utf-8");
  fs.renameSync(tmpPath, outputPath);

  // Print summary
  process.stdout.write(`\nSSOT Audit complete\n`);
  process.stdout.write(`Date: ${auditDate}\n`);
  process.stdout.write(
    `Videos: ${transcriptMap.videoCount} | Techniques covered: ${report.techniques_with_coverage} | Uncovered: ${uncoveredIds.length}\n`
  );
  process.stdout.write(`\nResults:\n`);
  process.stdout.write(`  Total findings: ${allFindings.length}\n`);
  process.stdout.write(`  Flagged:        ${flagged}\n`);
  process.stdout.write(`  Needs review:   ${needsReview}\n`);
  process.stdout.write(`  OK:            ${ok}\n`);
  process.stdout.write(`\nOutput: ${outputPath}\n`);

  // Exit 1 if there are flagged or needs_review findings
  if (flagged > 0 || needsReview > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  process.stderr.write(`[ssot-audit] Fatal error: ${String(err)}\n`);
  process.exit(1);
});
