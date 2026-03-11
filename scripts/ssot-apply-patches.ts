/**
 * SSOT Apply Patches — Applies approved audit findings to SSOT config files.
 *
 * After running ssot-audit.ts, a human reviewer sets `approved: true` on specific
 * findings in the output JSON. This script reads those findings and patches the
 * actual config files.
 *
 * Usage:
 *   npx tsx scripts/ssot-apply-patches.ts --input docs/ssot-audit-2026-03-11.json [--dry-run]
 *
 * Options:
 *   --input path/to/audit.json   Path to the audit report JSON (required)
 *   --dry-run                    Print what would change, don't write files
 */

import * as fs from "fs";
import * as path from "path";

import { AuditFinding, AuditReport } from "./ssot-audit-lib/types";

// ---------------------------------------------------------------------------
// Project root: scripts/ is one level below project root
// ---------------------------------------------------------------------------
const PROJECT_ROOT = path.resolve(__dirname, "..");

// ---------------------------------------------------------------------------
// Config file locations
// ---------------------------------------------------------------------------

interface ConfigFileInfo {
  /** Absolute path to the config file */
  filePath: string;
  /** Top-level key in the JSON that holds the item map (e.g. "technieken") */
  itemsKey: string;
  /** Alternative key to try if itemsKey is absent (flat structure) */
  fallbackKey?: string;
}

const CONFIG_FILE_MAP: Record<AuditFinding["config_file"], ConfigFileInfo> = {
  "technieken_index.json": {
    filePath: path.join(PROJECT_ROOT, "config", "ssot", "technieken_index.json"),
    itemsKey: "technieken",
  },
  "klant_houdingen.json": {
    filePath: path.join(PROJECT_ROOT, "config", "klant_houdingen.json"),
    itemsKey: "houdingen",
    fallbackKey: undefined,
  },
  "rag_heuristics.json": {
    filePath: path.join(PROJECT_ROOT, "config", "rag_heuristics.json"),
    itemsKey: "techniques",
  },
  "evaluator_overlay.json": {
    filePath: path.join(PROJECT_ROOT, "config", "ssot", "evaluator_overlay.json"),
    itemsKey: "technieken",
  },
};

// ---------------------------------------------------------------------------
// CLI argument parsing
// ---------------------------------------------------------------------------

interface CliArgs {
  input: string;
  dryRun: boolean;
}

function parseArgs(argv: string[]): CliArgs {
  const args = argv.slice(2); // drop "node" and script path
  let input: string | undefined;
  let dryRun = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--input" && args[i + 1]) {
      input = args[++i];
    } else if (arg === "--dry-run") {
      dryRun = true;
    }
  }

  if (!input) {
    process.stderr.write("[ssot-apply-patches] Error: --input is required\n");
    process.stderr.write(
      "Usage: npx tsx scripts/ssot-apply-patches.ts --input docs/ssot-audit-2026-03-11.json [--dry-run]\n"
    );
    process.exit(1);
  }

  return { input, dryRun };
}

// ---------------------------------------------------------------------------
// JSON helpers
// ---------------------------------------------------------------------------

function loadJsonFile(filePath: string, label: string): unknown {
  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(raw);
  } catch (err) {
    throw new Error(
      `[ssot-apply-patches] Failed to load ${label} from "${filePath}": ${String(err)}`
    );
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function writeJsonFile(filePath: string, data: any): void {
  const tmpPath = filePath + ".tmp";
  fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2) + "\n", "utf-8");
  fs.renameSync(tmpPath, filePath);
}

// ---------------------------------------------------------------------------
// Value display helpers
// ---------------------------------------------------------------------------

function displayValue(value: string | string[] | undefined | null): string {
  if (value === undefined || value === null) return "(undefined)";
  if (Array.isArray(value)) return `[array of ${value.length}]`;
  const str = String(value);
  if (str.length > 60) return `"${str.slice(0, 57)}..."`;
  return `"${str}"`;
}

// ---------------------------------------------------------------------------
// Patch application
// ---------------------------------------------------------------------------

interface PatchResult {
  configFile: AuditFinding["config_file"];
  itemId: string;
  field: string;
  success: boolean;
  warning?: string;
}

/**
 * Resolve item map from a parsed JSON object using the config file info.
 * Handles both nested (e.g. { technieken: { "2.1.1": {...} } }) and
 * flat structures ({ "H1": {...} }).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function resolveItemMap(data: any, info: ConfigFileInfo): Record<string, any> | null {
  if (data && typeof data === "object" && data[info.itemsKey]) {
    return data[info.itemsKey] as Record<string, unknown>;
  }
  // klant_houdingen can be flat — fall back to top-level object
  if (info.fallbackKey !== undefined) {
    return null;
  }
  // For klant_houdingen.json specifically: if no "houdingen" key, treat as flat
  if (info.itemsKey === "houdingen" && data && typeof data === "object") {
    return data as Record<string, unknown>;
  }
  return null;
}

/**
 * Apply a dot-notation field path to set a value on an item object.
 * Supports simple keys only (no array indices in the path).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function applyFieldPatch(item: Record<string, any>, field: string, value: string | string[]): void {
  const parts = field.split(".");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let current: any = item;
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    if (current[part] === undefined || current[part] === null || typeof current[part] !== "object") {
      current[part] = {};
    }
    current = current[part];
  }
  current[parts[parts.length - 1]] = value;
}

/**
 * Apply all approved findings to the loaded config objects.
 * Returns a list of patch results (success/warning per finding).
 */
function applyPatches(
  approvedFindings: AuditFinding[],
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  configData: Map<AuditFinding["config_file"], any>,
  dryRun: boolean
): PatchResult[] {
  const results: PatchResult[] = [];

  for (const finding of approvedFindings) {
    const result: PatchResult = {
      configFile: finding.config_file,
      itemId: finding.item_id,
      field: finding.field,
      success: false,
    };

    // Validate proposed_value
    if (finding.proposed_value === undefined || finding.proposed_value === null) {
      result.warning = "proposed_value is undefined/null — skipped";
      results.push(result);
      continue;
    }

    const info = CONFIG_FILE_MAP[finding.config_file];
    if (!info) {
      result.warning = `Unknown config_file "${finding.config_file}" — skipped`;
      results.push(result);
      continue;
    }

    const data = configData.get(finding.config_file);
    if (!data) {
      result.warning = `Config file data not loaded — skipped`;
      results.push(result);
      continue;
    }

    const itemMap = resolveItemMap(data, info);
    if (!itemMap) {
      result.warning = `Could not resolve item map for "${finding.config_file}" — skipped`;
      results.push(result);
      continue;
    }

    // Find item by item_id (direct key lookup)
    if (!(finding.item_id in itemMap)) {
      result.warning = `item_id "${finding.item_id}" not found in "${finding.config_file}" — skipped`;
      results.push(result);
      continue;
    }

    const item = itemMap[finding.item_id];
    if (!item || typeof item !== "object") {
      result.warning = `item "${finding.item_id}" is not an object — skipped`;
      results.push(result);
      continue;
    }

    // Apply the patch (in-place mutation — only during actual apply, not dry-run)
    if (!dryRun) {
      applyFieldPatch(item, finding.field, finding.proposed_value);
    }

    result.success = true;
    results.push(result);
  }

  return results;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const cliArgs = parseArgs(process.argv);

  // Resolve input path (relative to cwd)
  const inputPath = path.isAbsolute(cliArgs.input)
    ? cliArgs.input
    : path.resolve(process.cwd(), cliArgs.input);

  // Load audit report
  const reportRaw = loadJsonFile(inputPath, "audit report");
  const report = reportRaw as AuditReport;

  if (!report.findings || !Array.isArray(report.findings)) {
    process.stderr.write(
      `[ssot-apply-patches] Error: audit file does not contain a "findings" array\n`
    );
    process.exit(1);
  }

  // Filter approved findings
  const approvedFindings = report.findings.filter((f) => f.approved === true);

  if (approvedFindings.length === 0) {
    process.stdout.write(
      `[ssot-apply-patches] No approved findings in "${inputPath}". Nothing to do.\n`
    );
    process.exit(0);
  }

  // Group findings by config_file
  const byConfigFile = new Map<AuditFinding["config_file"], AuditFinding[]>();
  for (const finding of approvedFindings) {
    const group = byConfigFile.get(finding.config_file) ?? [];
    group.push(finding);
    byConfigFile.set(finding.config_file, group);
  }

  // Load each referenced config file once
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const configData = new Map<AuditFinding["config_file"], any>();
  for (const configFile of byConfigFile.keys()) {
    const info = CONFIG_FILE_MAP[configFile];
    if (!info) {
      process.stderr.write(
        `[ssot-apply-patches] Warning: unknown config_file "${configFile}" — will skip its findings\n`
      );
      continue;
    }
    const data = loadJsonFile(info.filePath, configFile);
    configData.set(configFile, data);
  }

  // Dry-run: print what would change
  if (cliArgs.dryRun) {
    process.stdout.write(`[DRY RUN] Would apply ${approvedFindings.length} patches:\n`);

    for (const finding of approvedFindings) {
      const info = CONFIG_FILE_MAP[finding.config_file];
      const data = configData.get(finding.config_file);
      let currentDisplay = displayValue(finding.current_value);

      // Try to get the live current value from config for accurate display
      if (data && info) {
        const itemMap = resolveItemMap(data, info);
        if (itemMap && finding.item_id in itemMap) {
          const item = itemMap[finding.item_id];
          if (item && typeof item === "object") {
            // Walk dot-notation path
            const parts = finding.field.split(".");
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            let cur: any = item;
            for (const part of parts) {
              if (cur && typeof cur === "object" && part in cur) {
                cur = cur[part];
              } else {
                cur = undefined;
                break;
              }
            }
            if (cur !== undefined) {
              currentDisplay = displayValue(Array.isArray(cur) ? cur : String(cur));
            }
          }
        }
      }

      const proposedDisplay = displayValue(finding.proposed_value);
      process.stdout.write(
        `  ${finding.config_file} / ${finding.item_id} / ${finding.field}: ${currentDisplay} → ${proposedDisplay}\n`
      );
    }

    process.exit(0);
  }

  // Actual apply: patch in-memory, then write files
  const results = applyPatches(approvedFindings, configData, false);

  // Write back each modified config file
  const writtenFiles = new Set<AuditFinding["config_file"]>();
  for (const [configFile, data] of configData.entries()) {
    const hasSuccessfulPatch = results.some(
      (r) => r.configFile === configFile && r.success
    );
    if (hasSuccessfulPatch) {
      const info = CONFIG_FILE_MAP[configFile];
      writeJsonFile(info.filePath, data);
      writtenFiles.add(configFile);
    }
  }

  // Print summary
  const successCount = results.filter((r) => r.success).length;
  const warnCount = results.filter((r) => !r.success).length;

  process.stdout.write(`Applied ${successCount} patches:\n`);
  for (const result of results) {
    if (result.success) {
      process.stdout.write(
        `  ${result.configFile} / ${result.itemId} / ${result.field} \u2713\n`
      );
    } else {
      process.stdout.write(
        `  ${result.configFile} / ${result.itemId} / ${result.field} \u26A0  WARNING: ${result.warning}\n`
      );
    }
  }

  if (warnCount > 0) {
    process.stdout.write(`\n${warnCount} patch(es) skipped — see warnings above.\n`);
  }

  if (writtenFiles.size > 0) {
    process.stdout.write(`\nModified files:\n`);
    for (const f of writtenFiles) {
      process.stdout.write(`  ${CONFIG_FILE_MAP[f].filePath}\n`);
    }
  }
}

main().catch((err) => {
  process.stderr.write(`[ssot-apply-patches] Fatal error: ${String(err)}\n`);
  process.exit(1);
});
