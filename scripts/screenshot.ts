/**
 * Screenshot tool for visual UI verification.
 *
 * Usage:
 *   npx tsx scripts/screenshot.ts [url] [output-path] [--click "selector"]
 *
 * Examples:
 *   npx tsx scripts/screenshot.ts                                          # Landing page
 *   npx tsx scripts/screenshot.ts http://localhost:5001                     # Landing (no auth)
 *   npx tsx scripts/screenshot.ts http://localhost:5001 /tmp/shot.png      # Auth'd dashboard
 *   npx tsx scripts/screenshot.ts http://localhost:5001 /tmp/shot.png --click "Talk to Hugo"
 *
 * The --click flag navigates by clicking a link/button with matching text after page load.
 * Requires SCREENSHOT_EMAIL and SCREENSHOT_PASSWORD in .env for authenticated pages.
 */
import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { resolve } from "path";

// Parse args
const args = process.argv.slice(2);
let url = "http://localhost:5001";
let outputPath = "/tmp/ui-screenshot.png";
let clickText: string | null = null;

for (let i = 0; i < args.length; i++) {
  if (args[i] === "--click" && args[i + 1]) {
    clickText = args[++i];
  } else if (!args[i].startsWith("--")) {
    if (args[i].startsWith("http")) url = args[i];
    else outputPath = args[i];
  }
}

function loadEnv(): Record<string, string> {
  const env: Record<string, string> = {};
  try {
    const envPath = resolve(import.meta.dirname || __dirname, "../.env");
    const content = readFileSync(envPath, "utf-8");
    for (const line of content.split("\n")) {
      const match = line.match(/^([^#=]+)=(.*)$/);
      if (match) {
        env[match[1].trim()] = match[2].trim().replace(/^["']|["']$/g, "");
      }
    }
  } catch { /* no .env */ }
  return env;
}

async function getSupabaseSession(fileEnv: Record<string, string>) {
  const email = process.env.SCREENSHOT_EMAIL || fileEnv.SCREENSHOT_EMAIL;
  const password = process.env.SCREENSHOT_PASSWORD || fileEnv.SCREENSHOT_PASSWORD;

  if (!email || !password) {
    console.log("No SCREENSHOT_EMAIL/PASSWORD — public pages only.");
    return null;
  }

  const projectId = "pckctmojjrrgzuufsqoo";
  const anonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBja2N0bW9qanJyZ3p1dWZzcW9vIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYwOTg1MTUsImV4cCI6MjA4MTY3NDUxNX0.TrPovHz5PgSiwyxVCYplk-SA6cNi0gZkkMVGr3NdIuc";

  const supabase = createClient(`https://${projectId}.supabase.co`, anonKey);
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error || !data.session) {
    console.error("Auth failed:", error?.message || "No session");
    return null;
  }

  console.log(`Authenticated as ${email}`);
  return data.session;
}

async function main() {
  const fileEnv = loadEnv();
  const session = await getSupabaseSession(fileEnv);

  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();

  if (session) {
    await context.addInitScript((sessionData) => {
      localStorage.setItem("hh-auth-token", JSON.stringify(sessionData));
    }, session);
  }

  // For auth: first load origin to seed localStorage, then navigate to target
  if (session) {
    const origin = new URL(url).origin;
    await page.goto(origin, { waitUntil: "domcontentloaded", timeout: 10000 });
    await page.waitForTimeout(1000);
  }

  await page.goto(url, { waitUntil: "networkidle", timeout: 15000 });
  await page.waitForTimeout(2000);

  // Optional: navigate via click or CSS selector
  if (clickText) {
    try {
      let target;
      if (clickText.startsWith("css=") || clickText.startsWith("[") || clickText.startsWith(".") || clickText.startsWith("#")) {
        // CSS selector mode
        const selector = clickText.startsWith("css=") ? clickText.slice(4) : clickText;
        target = page.locator(selector).first();
      } else {
        // Text match: prefer buttons/links, then any text
        target = page.getByRole("button", { name: new RegExp(clickText, "i") })
          .or(page.getByRole("link", { name: new RegExp(clickText, "i") }))
          .first();
      }
      await target.click();
      await page.waitForTimeout(3000);
      console.log(`Clicked: "${clickText}"`);
    } catch (err: any) {
      console.error(`Could not click "${clickText}": ${err.message}`);
    }
  }

  await page.screenshot({ path: outputPath, fullPage: false });
  console.log(`Screenshot saved: ${outputPath}`);

  await browser.close();
}

main().catch((err) => {
  console.error("Screenshot failed:", err.message);
  process.exit(1);
});
