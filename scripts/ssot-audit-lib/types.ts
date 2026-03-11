export type AuditStatus = "ok" | "needs_review" | "flagged";

export interface AuditFinding {
  config_file: "technieken_index.json" | "klant_houdingen.json" | "rag_heuristics.json" | "evaluator_overlay.json";
  item_id: string;              // e.g. "2.1.1", "H6"
  field: string;                // e.g. "naam", "fase", "semantic_markers", "anchors"
  current_value: string | string[];
  proposed_value?: string | string[];
  issue_description: string;
  transcript_evidence: string[];  // Literal quotes from transcript (REQUIRED for non-ok findings)
  confidence: number;             // 0.0–1.0
  status: AuditStatus;
  approved?: boolean;             // Set by human reviewer
  no_transcript_coverage?: boolean;
}

export interface AuditReport {
  audit_date: string;             // ISO date
  video_count: number;
  ssot_technique_count: number;
  techniques_with_coverage: number;
  techniques_without_coverage: string[];  // technique IDs with no transcript
  summary: {
    total: number;
    flagged: number;
    needs_review: number;
    ok: number;
  };
  findings: AuditFinding[];
  metadata: {
    model: string;
    script_version: string;
    config_files_audited: string[];
    run_duration_seconds: number;
    techniques_targeted?: string[];  // if --techniques flag was used
  };
}
