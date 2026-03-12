/**
 * Batch analyse: upload audiobestanden naar de V3 analyse pipeline.
 *
 * Gebruik:
 *   npx tsx scripts/batch-analyze.ts                                         # alle bestanden
 *   npx tsx scripts/batch-analyze.ts --files "Michiel.m4a,Robbe.m4a"        # subset
 *
 * Vereist SCREENSHOT_EMAIL en SCREENSHOT_PASSWORD in .env
 * Server moet draaien op http://localhost:5001
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync, writeFileSync, existsSync, readdirSync } from "fs";
import { resolve, basename } from "path";

const BASE_URL = "http://localhost:5001";
const GESPREKKEN_DIR = resolve(import.meta.dirname || __dirname, "../gesprekanalyse");
const PROGRESS_FILE = resolve(GESPREKKEN_DIR, "batch-progress.json");
const POLL_INTERVAL_MS = 30_000;
const MAX_WAIT_MS = 30 * 60 * 1000; // 30 min

// Parse args
const args = process.argv.slice(2);
let filterFiles: string[] | null = null;
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--files" && args[i + 1]) {
    filterFiles = args[++i].split(",").map((f) => f.trim());
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
  console.log(`Authenticated as ${email}`);
  return data.session.access_token;
}

interface ProgressEntry {
  file: string;
  conversationId: string;
  status: "completed" | "failed";
  completedAt?: string;
  error?: string;
}

interface Progress {
  completed: ProgressEntry[];
  failed: ProgressEntry[];
}

function loadProgress(): Progress {
  if (existsSync(PROGRESS_FILE)) {
    return JSON.parse(readFileSync(PROGRESS_FILE, "utf-8"));
  }
  return { completed: [], failed: [] };
}

function saveProgress(progress: Progress): void {
  writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2));
}

async function uploadFile(filePath: string, title: string, token: string): Promise<string> {
  const fileBuffer = readFileSync(filePath);
  const filename = basename(filePath);
  const mimeType = filename.endsWith(".mp4") ? "video/mp4" : "audio/m4a";

  for (let attempt = 0; attempt < 5; attempt++) {
    const formData = new FormData();
    formData.append("file", new Blob([fileBuffer], { type: mimeType }), filename);
    formData.append("title", title);
    formData.append("consentConfirmed", "true");

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 120_000);

    try {
      const response = await fetch(`${BASE_URL}/api/v2/analysis/upload`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (response.status === 429) {
        const waitS = (attempt + 1) * 30;
        console.warn(`\n  Rate limited bij upload. Wacht ${waitS}s (poging ${attempt + 1}/5)...`);
        await new Promise((r) => setTimeout(r, waitS * 1000));
        continue;
      }

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Upload mislukt (${response.status}): ${text}`);
      }

      const data = await response.json() as { conversationId: string };
      return data.conversationId;
    } catch (err: any) {
      clearTimeout(timeout);
      if (err.name === "AbortError") throw new Error("Upload timeout (>2 min)");
      throw err;
    }
  }
  throw new Error("Upload mislukt na 5 pogingen (aanhoudende rate limit)");
}

async function pollStatus(conversationId: string, token: string): Promise<void> {
  const startTime = Date.now();
  // Small initial delay to let the server settle after upload
  await new Promise((r) => setTimeout(r, 5_000));

  while (Date.now() - startTime < MAX_WAIT_MS) {
    let response;
    try {
      response = await fetch(`${BASE_URL}/api/v2/analysis/status/${conversationId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch (err: any) {
      console.warn(`\n  Verbindingsfout, wacht 15s: ${err.message}`);
      await new Promise((r) => setTimeout(r, 15_000));
      continue;
    }

    if (response.status === 429) {
      console.warn("\n  Rate limited door server, wacht 30s...");
      await new Promise((r) => setTimeout(r, 30_000));
      continue;
    }

    if (response.status === 404) {
      // Job still queued (pLimit), DB record not yet created — wait and retry
      process.stdout.write(`\r  Status: in wachtrij (${Math.round((Date.now() - startTime) / 1000)}s)...`);
      await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
      continue;
    }

    if (!response.ok) throw new Error(`Status check mislukt (${response.status})`);

    const status = await response.json() as { status: string; error?: string };
    if (status.status === "completed") return;
    if (status.status === "failed") throw new Error(status.error || "Analyse mislukt");

    const elapsed = Math.round((Date.now() - startTime) / 1000);
    process.stdout.write(`\r  Status: ${status.status} (${elapsed}s)...`);
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }

  throw new Error("Timeout: analyse duurde langer dan 30 minuten");
}

async function main() {
  const fileEnv = loadEnv();
  const token = await getAuthToken(fileEnv);
  const progress = loadProgress();

  const completedFiles = new Set(progress.completed.map((e) => e.file));
  const allFiles = readdirSync(GESPREKKEN_DIR)
    .filter((f) => f.endsWith(".m4a") || f.endsWith(".mp4") || f.endsWith(".m4a.mp4"))
    .filter((f) => !filterFiles || filterFiles.includes(f))
    .filter((f) => !completedFiles.has(f))
    .sort();

  if (allFiles.length === 0) {
    console.log("Niets te doen — alles al geanalyseerd of geen bestanden gevonden.");
    console.log(`Progress staat in: ${PROGRESS_FILE}`);
    return;
  }

  console.log(`\n${allFiles.length} bestand(en) te verwerken:`);
  allFiles.forEach((f, i) => console.log(`  ${i + 1}. ${f}`));
  console.log();

  for (let i = 0; i < allFiles.length; i++) {
    const filename = allFiles[i];
    const filePath = resolve(GESPREKKEN_DIR, filename);
    const title = filename.replace(/\.(m4a\.mp4|mp4|m4a)$/, "");

    console.log(`\n[${i + 1}/${allFiles.length}] ${filename}`);

    try {
      console.log("  Uploaden...");
      const conversationId = await uploadFile(filePath, title, token);
      console.log(`  ID: ${conversationId}`);
      console.log("  Wacht op analyse...");
      await pollStatus(conversationId, token);
      process.stdout.write("\n");

      progress.completed.push({
        file: filename,
        conversationId,
        status: "completed",
        completedAt: new Date().toISOString(),
      });
      saveProgress(progress);
      console.log("  Klaar!");
    } catch (err: any) {
      process.stdout.write("\n");
      console.error(`  FOUT: ${err.message}`);
      const existingFailed = progress.failed.find((e) => e.file === filename);
      if (!existingFailed) {
        progress.failed.push({ file: filename, conversationId: "unknown", status: "failed", error: err.message });
      }
      saveProgress(progress);
    }
  }

  console.log(`\nKlaar! ${progress.completed.length} voltooid, ${progress.failed.length} mislukt.`);
  console.log(`Progress: ${PROGRESS_FILE}`);
}

main().catch((err) => {
  console.error("Script mislukt:", err.message);
  process.exit(1);
});
