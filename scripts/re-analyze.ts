/**
 * Re-analyse: hergebruik opgeslagen transcript, geen nieuwe Whisper transcriptie.
 *
 * Gebruik:
 *   npx tsx scripts/re-analyze.ts --id <conversationId>
 *   npx tsx scripts/re-analyze.ts --id <conversationId> --then-meta
 *
 * Vereist SCREENSHOT_EMAIL en SCREENSHOT_PASSWORD in .env
 * Server moet draaien op http://localhost:5001
 */
import { execSync } from "child_process";
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { resolve } from "path";

const BASE_URL = "http://localhost:5001";
const POLL_INTERVAL_MS = 30_000;
const MAX_WAIT_MS = 30 * 60 * 1000; // 30 min

// Parse args
const args = process.argv.slice(2);
let conversationId: string | null = null;
let thenMeta = false;

for (let i = 0; i < args.length; i++) {
  if (args[i] === "--id" && args[i + 1]) conversationId = args[++i];
  if (args[i] === "--then-meta") thenMeta = true;
}

if (!conversationId) {
  console.error("Gebruik: npx tsx scripts/re-analyze.ts --id <conversationId> [--then-meta]");
  process.exit(1);
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

async function triggerRetry(id: string, token: string): Promise<void> {
  const response = await fetch(`${BASE_URL}/api/v2/analysis/retry/${id}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Retry mislukt (${response.status}): ${text}`);
  }
  const data = await response.json() as { success: boolean; message?: string };
  if (!data.success) throw new Error("Retry niet gestart");
  console.log(`  ${data.message || "Re-analyse gestart"}`);
}

async function pollStatus(id: string, token: string): Promise<void> {
  const startTime = Date.now();
  await new Promise((r) => setTimeout(r, 5_000));

  while (Date.now() - startTime < MAX_WAIT_MS) {
    let response;
    try {
      response = await fetch(`${BASE_URL}/api/v2/analysis/status/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch (err: any) {
      console.warn(`\n  Verbindingsfout, wacht 15s: ${err.message}`);
      await new Promise((r) => setTimeout(r, 15_000));
      continue;
    }

    if (response.status === 429) {
      console.warn("\n  Rate limited, wacht 30s...");
      await new Promise((r) => setTimeout(r, 30_000));
      continue;
    }

    if (response.status === 404) {
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

  console.log(`\nRe-analyse starten: ${conversationId}`);
  await triggerRetry(conversationId!, token);
  console.log("  Wacht op analyse...");
  await pollStatus(conversationId!, token);
  process.stdout.write("\n");
  console.log("  Klaar!");

  if (thenMeta) {
    console.log("\nMeta-analyse starten...");
    const scriptPath = resolve(import.meta.dirname || __dirname, "meta-analysis.ts");
    execSync(`npx tsx "${scriptPath}" --ids "${conversationId}"`, { stdio: "inherit" });
  }
}

main().catch((err) => {
  console.error("Script mislukt:", err.message);
  process.exit(1);
});
