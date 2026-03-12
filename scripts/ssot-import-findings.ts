/**
 * Import SSOT audit findings into the admin_corrections table for review
 * in AdminConfigReview. Each finding becomes a pending correction that
 * can be approved (applies the change to SSOT config files) or rejected.
 *
 * Usage:
 *   npm run ssot:import -- --input docs/ssot-audit-2026-03-12.json
 *   npm run ssot:import -- --input docs/ssot-audit-2026-03-12.json --dry-run
 *   npm run ssot:import -- --input docs/ssot-audit-2026-03-12.json --status flagged
 */

import * as fs from "fs";
import * as path from "path";
import { Pool } from "pg";
import type { AuditReport } from "./ssot-audit-lib/types";

const PROJECT_ROOT = path.resolve(__dirname, "..");

const FILE_MAP: Record<string, string> = {
  "technieken_index.json": "config/ssot/technieken_index.json",
  "klant_houdingen.json": "config/klant_houdingen.json",
  "rag_heuristics.json": "config/rag_heuristics.json",
  "evaluator_overlay.json": "config/ssot/evaluator_overlay.json",
};

interface CliArgs {
  input: string;
  dryRun: boolean;
  statusFilter: string | null;
}

function parseArgs(argv: string[]): CliArgs {
  const args = argv.slice(2);
  let input = "";
  let dryRun = false;
  let statusFilter: string | null = null;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--input" && args[i + 1]) input = args[++i];
    if (args[i] === "--dry-run") dryRun = true;
    if (args[i] === "--status" && args[i + 1]) statusFilter = args[++i];
  }

  if (!input) {
    process.stderr.write("[ssot-import] Error: --input <path> is required\n");
    process.exit(1);
  }

  return { input, dryRun, statusFilter };
}

function buildConnectionString(): string {
  const connStr = process.env.PostgreSQL_connection_string_supabase;
  const password = process.env.SUPABASE_YOUR_PASSWORD;
  if (!connStr) {
    throw new Error(
      "PostgreSQL_connection_string_supabase not set. Make sure .env is loaded."
    );
  }
  let resolved = connStr;
  if (password && resolved.includes("[YOUR-PASSWORD]")) {
    resolved = resolved.replace("[YOUR-PASSWORD]", password);
  }
  if (resolved.includes("[YOUR-PASSWORD]")) {
    throw new Error("SUPABASE_YOUR_PASSWORD not set — cannot build connection string.");
  }
  // Convert direct URL to session pooler URL (same as db.ts)
  try {
    const url = new URL(resolved);
    const hostMatch = url.hostname.match(/^db\.([a-z0-9]+)\.supabase\.co$/);
    if (hostMatch) {
      const projectRef = hostMatch[1];
      const pwd = decodeURIComponent(url.password);
      const region = process.env.SUPABASE_DB_REGION || "aws-1-eu-west-3";
      return `postgresql://postgres.${projectRef}:${encodeURIComponent(pwd)}@${region}.pooler.supabase.com:5432/postgres`;
    }
  } catch {
    // fall through to original
  }
  return resolved;
}

async function main(): Promise<void> {
  const { input, dryRun, statusFilter } = parseArgs(process.argv);

  const inputPath = path.isAbsolute(input)
    ? input
    : path.join(PROJECT_ROOT, input);

  if (!fs.existsSync(inputPath)) {
    process.stderr.write(`[ssot-import] Error: File not found: ${inputPath}\n`);
    process.exit(1);
  }

  const report: AuditReport = JSON.parse(fs.readFileSync(inputPath, "utf-8"));

  const USELESS_PATTERNS = [
    "geen informatie beschikbaar",
    "no transcript coverage",
    "no information available",
  ];

  // Filter to importable findings only
  const importable = report.findings.filter((f) => {
    if (f.status === "ok") return false;
    if (f.no_transcript_coverage) return false;
    if (f.proposed_value === undefined || f.proposed_value === null || f.proposed_value === "") return false;
    if (statusFilter && f.status !== statusFilter) return false;
    const newVal = Array.isArray(f.proposed_value)
      ? f.proposed_value.join(" ").toLowerCase()
      : String(f.proposed_value).toLowerCase();
    if (USELESS_PATTERNS.some((p) => newVal.includes(p))) return false;
    return true;
  });

  const flaggedCount = importable.filter((f) => f.status === "flagged").length;
  const reviewCount = importable.filter((f) => f.status === "needs_review").length;

  process.stdout.write(`[ssot-import] Audit: ${report.audit_date}\n`);
  process.stdout.write(
    `[ssot-import] Importable findings: ${importable.length} (${flaggedCount} flagged, ${reviewCount} needs_review)\n`
  );

  if (dryRun) {
    process.stdout.write(`[ssot-import] Dry run — no changes made.\n`);
    process.stdout.write(`\nSample findings that would be imported:\n`);
    for (const f of importable.slice(0, 5)) {
      process.stdout.write(
        `  ${f.item_id}::${f.field} | ${f.naam ?? "—"} | ${f.status} (${f.confidence})\n`
      );
      process.stdout.write(`    ${f.current_value} → ${f.proposed_value}\n`);
    }
    if (importable.length > 5) {
      process.stdout.write(`  ... and ${importable.length - 5} more\n`);
    }
    return;
  }

  const connStr = buildConnectionString();
  const pool = new Pool({ connectionString: connStr, ssl: { rejectUnauthorized: false } });

  try {
    // Fetch existing ssot_audit fields for deduplication
    const { rows: existing } = await pool.query(
      `SELECT field FROM admin_corrections WHERE source = 'ssot_audit'`
    );
    const existingFields = new Set(existing.map((r: any) => r.field as string));

    let inserted = 0;
    let skipped = 0;

    for (const finding of importable) {
      const dedupeKey = `${finding.item_id}::${finding.field}`;

      if (existingFields.has(dedupeKey)) {
        skipped++;
        continue;
      }

      const targetFile = FILE_MAP[finding.config_file] ?? "";
      const originalValue = Array.isArray(finding.current_value)
        ? finding.current_value.join(", ")
        : String(finding.current_value ?? "");
      const newValue = Array.isArray(finding.proposed_value)
        ? (finding.proposed_value as string[]).join(", ")
        : String(finding.proposed_value ?? "");

      const context = JSON.stringify({
        naam: finding.naam,
        fieldName: finding.field,
        transcript_evidence: finding.transcript_evidence,
        confidence: finding.confidence,
        audit_status: finding.status,
        issue_description: finding.issue_description,
        config_file: finding.config_file,
      });

      const originalJson = JSON.stringify({ [finding.field]: finding.current_value });
      const newJson = JSON.stringify({ [finding.field]: finding.proposed_value });

      await pool.query(
        `INSERT INTO admin_corrections
          (type, source, field, original_value, new_value, target_file, target_key,
           original_json, new_json, context, submitted_by, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
        [
          "ssot_audit",
          "ssot_audit",
          dedupeKey,
          originalValue,
          newValue,
          targetFile,
          finding.item_id,
          originalJson,
          newJson,
          context,
          "ssot-audit",
          "pending",
        ]
      );

      inserted++;
    }

    process.stdout.write(
      `[ssot-import] Inserted: ${inserted} | Skipped (already imported): ${skipped}\n`
    );

    // Create one summary notification
    if (inserted > 0) {
      const title = `SSOT Audit ${report.audit_date}: ${inserted} findings`;
      const message = `${flaggedCount} flagged, ${reviewCount} needs_review. Open Config Review om te beoordelen.`;
      await pool.query(
        `INSERT INTO admin_notifications
          (type, title, message, category, severity, related_page)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        ["ssot_audit_import", title, message, "content", "warning", "admin-config-review"]
      );
      process.stdout.write(`[ssot-import] Notification created: "${title}"\n`);
    }
  } finally {
    await pool.end();
  }
}

main().catch((err: Error) => {
  process.stderr.write(`[ssot-import] Fatal: ${err.message}\n`);
  process.exit(1);
});
