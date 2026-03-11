import * as fs from "fs";
import * as path from "path";

const PROJECT_ROOT = path.resolve(__dirname, "../..");

export interface TranscriptMap {
  transcripts: Map<string, string>;    // techniqueId → concatenated text
  videoCount: number;
  uncoveredTechniqueIds: string[];     // filled in by main script after loading all technique IDs
}

interface VideoEntry {
  file_name: string;
  techniek: string | number;
  is_hidden: boolean;
  has_transcript?: boolean;
  [key: string]: unknown;
}

interface VideoMapping {
  _meta?: unknown;
  videos: Record<string, VideoEntry>;
}

export function loadTranscripts(projectRoot: string = PROJECT_ROOT): TranscriptMap {
  const mappingPath = path.join(projectRoot, "config", "video_mapping.json");
  const mappingRaw = fs.readFileSync(mappingPath, "utf-8");
  const mapping: VideoMapping = JSON.parse(mappingRaw);

  const transcripts = new Map<string, string>();
  let videoCount = 0;

  if (!mapping.videos || typeof mapping.videos !== "object") {
    process.stderr.write(`[transcript-loader] Error: video_mapping.json has no "videos" object\n`);
    return { transcripts, videoCount: 0, uncoveredTechniqueIds: [] };
  }

  for (const [, entry] of Object.entries(mapping.videos)) {
    // Only process visible videos
    if (entry.is_hidden) continue;

    const techniqueId = String(entry.techniek ?? "");
    if (!techniqueId) continue;

    const stem = path.parse(entry.file_name).name;
    const transcriptPath = path.join(projectRoot, "data", "transcripts", `${stem}.txt`);

    if (!fs.existsSync(transcriptPath)) {
      process.stderr.write(`[transcript-loader] Warning: transcript not found for ${entry.file_name} (expected: ${transcriptPath})\n`);
      continue;
    }

    const transcriptText = fs.readFileSync(transcriptPath, "utf-8").trim();
    if (!transcriptText) {
      process.stderr.write(`[transcript-loader] Warning: empty transcript for ${entry.file_name}, skipping\n`);
      continue;
    }
    videoCount++;

    const existing = transcripts.get(techniqueId);
    if (existing) {
      transcripts.set(techniqueId, `${existing}\n\n--- [VIDEO: ${entry.file_name}] ---\n\n${transcriptText}`);
    } else {
      transcripts.set(techniqueId, transcriptText);
    }
  }

  return {
    transcripts,
    videoCount,
    uncoveredTechniqueIds: [],  // Filled in by main script
  };
}
