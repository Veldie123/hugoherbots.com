#!/usr/bin/env node
/**
 * visual-qa.mjs — Machine-enforced visuele QA voor Claude Code agents
 *
 * Gebruik:
 *   node visual-qa.mjs [url]                          # Basis (light + dark)
 *   node visual-qa.mjs [url] --no-dark                # Alleen light mode
 *   node visual-qa.mjs [url] --checklist="..."        # Extra checks
 *   node visual-qa.mjs --scenario=qa-scenarios/x.json # Interactieve states (popup, modal, dropdown)
 *
 * Exit codes:
 *   0 = PASS (alles ok — mag committen)
 *   1 = FAIL (visuele problemen — agent MAG NIET zeggen "klaar")
 *   2 = ERROR (technisch probleem)
 *
 * Vereisten in .env: SCREENSHOT_EMAIL, SCREENSHOT_PASSWORD, ANTHROPIC_API_KEY
 */

import { chromium } from "playwright";
import Anthropic from "@anthropic-ai/sdk";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";

const __dirname = dirname(fileURLToPath(import.meta.url));

// ─── Env laden (Claude Code leegt process.env) ────────────────────────────────
function loadEnv() {
  const env = {};
  try {
    const content = readFileSync(join(__dirname, ".env"), "utf-8");
    for (const line of content.split("\n")) {
      const match = line.match(/^([^#=]+)=(.*)$/);
      if (match) {
        const key = match[1].trim();
        const val = match[2].trim().replace(/^["']|["']$/g, "");
        env[key] = val;
        if (!process.env[key]) process.env[key] = val;
      }
    }
  } catch { /* no .env */ }
  return env;
}
const fileEnv = loadEnv();

// ─── Args ─────────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const SCENARIO_FILE = args.find((a) => a.startsWith("--scenario="))?.split("=").slice(1).join("=");
const URL_ARG = args.find((a) => a.startsWith("http"));
const NO_DARK = args.includes("--no-dark");
const EXTRA_CHECKLIST = args.find((a) => a.startsWith("--checklist="))?.split("=").slice(1).join("=") || "";
const OUTPUT_DIR = join(__dirname, ".visual-qa");
const TIMESTAMP = new Date().toISOString().replace(/[:.]/g, "-");

// ─── Supabase auth ────────────────────────────────────────────────────────────
const SUPABASE_PROJECT_ID = "pckctmojjrrgzuufsqoo";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBja2N0bW9qanJyZ3p1dWZzcW9vIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYwOTg1MTUsImV4cCI6MjA4MTY3NDUxNX0.TrPovHz5PgSiwyxVCYplk-SA6cNi0gZkkMVGr3NdIuc";

async function getSupabaseSession() {
  const email = process.env.SCREENSHOT_EMAIL || fileEnv.SCREENSHOT_EMAIL;
  const password = process.env.SCREENSHOT_PASSWORD || fileEnv.SCREENSHOT_PASSWORD;
  if (!email || !password) {
    log("Geen SCREENSHOT_EMAIL/PASSWORD — enkel publieke pagina's", "warn");
    return null;
  }
  const supabase = createClient(`https://${SUPABASE_PROJECT_ID}.supabase.co`, SUPABASE_ANON_KEY);
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.session) {
    log(`Auth mislukt: ${error?.message || "geen sessie"}`, "warn");
    return null;
  }
  log(`Ingelogd als ${email}`, "pass");
  return data.session;
}

// ─── Visuele checklist ────────────────────────────────────────────────────────
const VISUAL_CHECKLIST = `
Controleer ELKE van deze punten en geef per punt een ✅ of ❌:

LAYOUT & ZICHTBAARHEID
1. Zijn alle UI-elementen zichtbaar en niet afgekneden of buiten het scherm?
2. Overlappen elementen elkaar op een onbedoelde manier?
3. Is er sprake van layout-shifts, broken grid, of verkeerde positionering?
4. Zijn buttons/links volledig zichtbaar en klikbaar (niet half verborgen onder andere elementen)?

CONTRAST & LEESBAARHEID
5. Is alle tekst leesbaar? (voldoende contrast met achtergrond)
6. Zijn er elementen die bijna onzichtbaar zijn (bv. donkere tekst op donkere achtergrond)?
7. Zijn placeholder-teksten, labels en headers duidelijk leesbaar?

DARK MODE (indien van toepassing)
8. Zijn popups/modals/dropdowns zichtbaar in dark mode? (geen donkere popup op donkere achtergrond)
9. Gebruikt de UI de correcte background-tokens voor floating panels (niet de pagina-achtergrond)?
10. Zijn icons en SVGs zichtbaar in dark mode?

VISUELE AFWERKING
11. Zijn borders, shadows en rounded corners consistent?
12. Zijn er onverwachte scrollbars, lege ruimtes of kapotte afbeeldingen?
13. Ziet de pagina er "af" uit, of zijn er duidelijke half-gebouwde secties?
${EXTRA_CHECKLIST ? `\nEXTRA CHECKS VOOR DEZE TAAK:\n${EXTRA_CHECKLIST}` : ""}
`.trim();

// ─── Helpers ──────────────────────────────────────────────────────────────────
function log(msg, type = "info") {
  const prefix = { info: "  ○", warn: "  ⚠", pass: "  ✅", fail: "  ❌", header: "\n══" }[type] || "  ";
  console.log(`${prefix} ${msg}`);
}

async function setupPage(browser, session) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  if (session) {
    await context.addInitScript((s) => {
      localStorage.setItem("hh-auth-token", JSON.stringify(s));
    }, session);
  }
  return page;
}

async function navigateTo(page, url, session) {
  if (session) {
    const origin = new URL(url).origin;
    await page.goto(origin, { waitUntil: "domcontentloaded", timeout: 10000 });
    await page.waitForTimeout(800);
  }
  await page.goto(url, { waitUntil: "networkidle", timeout: 20000 });
  await page.waitForTimeout(1500);
}

async function enableDarkMode(page) {
  await page.evaluate(() => {
    localStorage.setItem("hh-theme", "dark");
    document.documentElement.classList.add("dark");
  });
  await page.waitForTimeout(400);
}

async function runActions(page, actions = []) {
  for (const action of actions) {
    try {
      if (action.type === "click") {
        await page.click(action.selector, { timeout: 5000 });
      } else if (action.type === "hover") {
        await page.hover(action.selector, { timeout: 5000 });
      } else if (action.type === "wait") {
        await page.waitForTimeout(action.ms || 500);
      } else if (action.type === "waitForSelector") {
        await page.waitForSelector(action.selector, { timeout: 5000 });
      } else if (action.type === "type") {
        await page.fill(action.selector, action.value || "", { timeout: 5000 });
      }
    } catch (e) {
      log(`Action mislukt (${action.type} ${action.selector || ""}): ${e.message}`, "warn");
    }
  }
}

async function takeScreenshot(page, name) {
  mkdirSync(OUTPUT_DIR, { recursive: true });
  const path = join(OUTPUT_DIR, `${TIMESTAMP}-${name}.png`);
  await page.screenshot({ path, fullPage: true });
  return path;
}

async function analyzeWithClaude(screenshotPath, mode, scenarioName = "") {
  const client = new Anthropic();
  const imageData = readFileSync(screenshotPath).toString("base64");
  const context = scenarioName ? ` — staat: "${scenarioName}"` : "";

  const response = await client.messages.create({
    model: "claude-opus-4-5",
    max_tokens: 2000,
    messages: [{
      role: "user",
      content: [
        { type: "image", source: { type: "base64", media_type: "image/png", data: imageData } },
        {
          type: "text",
          text: `Je bent een strenge visuele QA-engineer. Analyseer deze screenshot (${mode} mode${context}) van een web UI.

${VISUAL_CHECKLIST}

Geef je antwoord ALTIJD in dit exacte JSON-formaat (geen markdown, geen uitleg erbuiten):
{
  "passed": true/false,
  "score": 0-100,
  "issues": [
    {
      "severity": "critical|major|minor",
      "check": "nummer van de check",
      "description": "wat er mis is",
      "fix": "hoe het opgelost moet worden"
    }
  ],
  "summary": "één zin samenvatting"
}

"passed" is false zodra er minstens één "critical" of "major" issue is.
Wees streng: als iets twijfelachtig is, markeer het als issue.`,
        },
      ],
    }],
  });

  const rawText = response.content[0].text.trim();
  try {
    return JSON.parse(rawText);
  } catch {
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (jsonMatch) return JSON.parse(jsonMatch[0]);
    throw new Error(`Claude gaf geen geldig JSON: ${rawText.slice(0, 200)}`);
  }
}

function printReport(result, mode, scenarioName = "") {
  const label = scenarioName ? `${mode.toUpperCase()} — ${scenarioName}` : mode.toUpperCase();
  log(`═══ QA RAPPORT (${label}) ═══`, "header");
  log(`Score: ${result.score}/100`);
  log(`Status: ${result.passed ? "✅ PASS" : "❌ FAIL"}`);
  log(`Samenvatting: ${result.summary}`);

  if (result.issues?.length > 0) {
    log("\n  GEVONDEN PROBLEMEN:");
    for (const issue of result.issues) {
      const icon = issue.severity === "critical" ? "🔴" : issue.severity === "major" ? "🟠" : "🟡";
      log(`${icon} [${issue.severity.toUpperCase()}] Check #${issue.check}: ${issue.description}`);
      log(`     Fix: ${issue.fix}`);
    }
  }

  return result.passed;
}

async function saveReport(allResults) {
  const reportPath = join(OUTPUT_DIR, `${TIMESTAMP}-report.json`);
  writeFileSync(reportPath, JSON.stringify({ timestamp: TIMESTAMP, results: allResults }, null, 2));
  log(`\n  Volledig rapport: ${reportPath}`);
}

// ─── Scenario mode ─────────────────────────────────────────────────────────────
async function runScenario(browser, session, scenarioDef) {
  const url = scenarioDef.url || URL_ARG || "http://localhost:5001";
  const scenarios = scenarioDef.scenarios || [{ name: "default", actions: [] }];
  const allResults = [];
  let overallPassed = true;

  for (const scenario of scenarios) {
    log(`\n  Scenario: "${scenario.name}"`, "info");

    // Fresh page per scenario to avoid state leakage
    const page = await setupPage(browser, session);
    await navigateTo(page, url, session);
    await runActions(page, scenario.actions || []);
    await page.waitForTimeout(500);

    // Light mode
    const lightPath = await takeScreenshot(page, `${scenario.name.replace(/\s+/g, "-")}-light`);
    const lightResult = await analyzeWithClaude(lightPath, "light", scenario.name);
    allResults.push({ scenario: scenario.name, mode: "light", ...lightResult });
    if (!printReport(lightResult, "light", scenario.name)) overallPassed = false;

    // Dark mode (tenzij --no-dark)
    if (!NO_DARK) {
      await enableDarkMode(page);
      await runActions(page, scenario.actions || []); // Herhaal actions in dark mode
      await page.waitForTimeout(500);
      const darkPath = await takeScreenshot(page, `${scenario.name.replace(/\s+/g, "-")}-dark`);
      const darkResult = await analyzeWithClaude(darkPath, "dark", scenario.name);
      allResults.push({ scenario: scenario.name, mode: "dark", ...darkResult });
      if (!printReport(darkResult, "dark", scenario.name)) overallPassed = false;
    }

    await page.close();
  }

  return { overallPassed, allResults };
}

// ─── Basis mode ────────────────────────────────────────────────────────────────
async function runBasic(browser, session, url) {
  const page = await setupPage(browser, session);
  await navigateTo(page, url, session);

  const allResults = [];
  let overallPassed = true;

  // Light mode
  log("\n  Light mode analyse...");
  const lightPath = await takeScreenshot(page, "light");
  const lightResult = await analyzeWithClaude(lightPath, "light");
  allResults.push({ mode: "light", ...lightResult });
  if (!printReport(lightResult, "light")) overallPassed = false;

  // Dark mode
  if (!NO_DARK) {
    log("\n  Dark mode analyse...");
    await enableDarkMode(page);
    const darkPath = await takeScreenshot(page, "dark");
    const darkResult = await analyzeWithClaude(darkPath, "dark");
    allResults.push({ mode: "dark", ...darkResult });
    if (!printReport(darkResult, "dark")) overallPassed = false;
  }

  await page.close();
  return { overallPassed, allResults };
}

// ─── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  log(`═══ VISUAL QA GESTART ═══`, "header");

  let url = URL_ARG || "http://localhost:5001";
  let scenarioDef = null;

  if (SCENARIO_FILE) {
    if (!existsSync(SCENARIO_FILE)) {
      log(`Scenario bestand niet gevonden: ${SCENARIO_FILE}`, "fail");
      process.exit(2);
    }
    scenarioDef = JSON.parse(readFileSync(SCENARIO_FILE, "utf-8"));
    url = scenarioDef.url || url;
    log(`Scenario: ${scenarioDef.name} (${scenarioDef.scenarios?.length || 1} states)`);
  }

  log(`URL: ${url}`);
  log(`Dark mode: ${NO_DARK ? "nee" : "ja"}`);

  const session = await getSupabaseSession();
  const browser = await chromium.launch();

  let overallPassed = true;
  let allResults = [];

  try {
    const result = scenarioDef
      ? await runScenario(browser, session, scenarioDef)
      : await runBasic(browser, session, url);

    overallPassed = result.overallPassed;
    allResults = result.allResults;
    await saveReport(allResults);
  } catch (err) {
    log(`\n  TECHNISCHE FOUT: ${err.message}`, "fail");
    await browser.close();
    process.exit(2);
  }

  await browser.close();

  log(`\n═══ EINDRESULTAAT ═══`, "header");
  if (overallPassed) {
    log("✅ VISUELE QA GESLAAGD — mag committen", "pass");
    process.exit(0);
  } else {
    log("❌ VISUELE QA GEFAALD — FIX DE PROBLEMEN HIERBOVEN EERST", "fail");
    log("   Agent: je mag dit NIET als klaar markeren. Fix alle critical/major issues en run opnieuw.", "fail");
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Onverwachte fout:", err);
  process.exit(2);
});
