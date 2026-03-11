/**
 * Post-build UI verification script.
 *
 * Runs automated checks after a build:
 * 1. Design token violations (check-design-tokens.sh)
 * 2. Route health checks (HTTP 200 for key pages)
 * 3. Screenshots of key pages (with visual output paths)
 *
 * Usage:
 *   npx tsx scripts/verify-ui.ts                    # Full check
 *   npx tsx scripts/verify-ui.ts --skip-screenshots # Skip screenshots (faster)
 *   npx tsx scripts/verify-ui.ts --pages dashboard  # Only specific pages
 *
 * npm script: npm run verify:ui
 */
import { execSync } from "child_process";
import { existsSync, readFileSync } from "fs";
import { resolve } from "path";

const BASE_URL = "http://localhost:5001";
const SCREENSHOT_DIR = "/tmp/verify-ui";
const ROOT = resolve(import.meta.dirname || __dirname, "..");

// Pages to verify (public + authenticated)
const PUBLIC_PAGES = [
  { path: "/", name: "landing" },
  { path: "/landing-v2", name: "landing-v2" },
  { path: "/login", name: "login" },
];

const AUTH_PAGES = [
  { path: "/dashboard", name: "dashboard" },
  { path: "/videos", name: "videos" },
  { path: "/talk-to-hugo", name: "talk-to-hugo" },
];

// Parse args
const args = process.argv.slice(2);
const skipScreenshots = args.includes("--skip-screenshots");
const pagesFilter = args.includes("--pages")
  ? args[args.indexOf("--pages") + 1]?.split(",")
  : null;

interface CheckResult {
  check: string;
  status: "pass" | "fail" | "warn";
  detail: string;
}

const results: CheckResult[] = [];

function log(emoji: string, msg: string) {
  console.log(`${emoji} ${msg}`);
}

// ── Check 1: Design token violations ────────────────────────────────────────

function checkDesignTokens(): CheckResult {
  log("🎨", "Checking design token violations...");
  try {
    const output = execSync(`bash "${ROOT}/scripts/check-design-tokens.sh"`, {
      cwd: ROOT,
      encoding: "utf-8",
      timeout: 10000,
    });

    const match = output.match(/Total violations:\s*(\d+)/);
    const violations = match ? parseInt(match[1]) : 0;

    if (violations === 0) {
      return { check: "Design tokens", status: "pass", detail: "0 violations" };
    }
    return {
      check: "Design tokens",
      status: violations > 50 ? "fail" : "warn",
      detail: `${violations} violations found`,
    };
  } catch (err: any) {
    return { check: "Design tokens", status: "fail", detail: err.message.slice(0, 100) };
  }
}

// ── Check 2: Route health checks ────────────────────────────────────────────

async function checkRouteHealth(): Promise<CheckResult[]> {
  log("🌐", "Checking route health...");
  const checks: CheckResult[] = [];

  for (const page of PUBLIC_PAGES) {
    if (pagesFilter && !pagesFilter.includes(page.name)) continue;
    try {
      const res = await fetch(`${BASE_URL}${page.path}`, {
        redirect: "follow",
        signal: AbortSignal.timeout(5000),
      });
      checks.push({
        check: `Route ${page.path}`,
        status: res.ok ? "pass" : "fail",
        detail: `HTTP ${res.status}`,
      });
    } catch (err: any) {
      checks.push({
        check: `Route ${page.path}`,
        status: "fail",
        detail: err.message.slice(0, 80),
      });
    }
  }

  return checks;
}

// ── Check 3: Screenshots ────────────────────────────────────────────────────

function takeScreenshots(): CheckResult[] {
  if (skipScreenshots) {
    log("⏭️", "Skipping screenshots (--skip-screenshots)");
    return [{ check: "Screenshots", status: "warn", detail: "Skipped" }];
  }

  log("📸", "Taking screenshots...");
  execSync(`mkdir -p "${SCREENSHOT_DIR}"`, { encoding: "utf-8" });

  const allPages = [...PUBLIC_PAGES, ...AUTH_PAGES];
  const checks: CheckResult[] = [];

  for (const page of allPages) {
    if (pagesFilter && !pagesFilter.includes(page.name)) continue;
    const output = `${SCREENSHOT_DIR}/${page.name}.png`;
    try {
      execSync(
        `npx tsx "${ROOT}/scripts/screenshot.ts" "${BASE_URL}${page.path}" "${output}"`,
        { cwd: ROOT, encoding: "utf-8", timeout: 30000, stdio: "pipe" }
      );
      checks.push({
        check: `Screenshot ${page.name}`,
        status: existsSync(output) ? "pass" : "fail",
        detail: output,
      });
    } catch (err: any) {
      checks.push({
        check: `Screenshot ${page.name}`,
        status: "fail",
        detail: err.message.slice(0, 80),
      });
    }
  }

  return checks;
}

// ── Check 4: Build output exists ────────────────────────────────────────────

function checkBuildOutput(): CheckResult {
  const indexPath = resolve(ROOT, "build/index.html");
  if (existsSync(indexPath)) {
    return { check: "Build output", status: "pass", detail: "build/index.html exists" };
  }
  return { check: "Build output", status: "fail", detail: "build/index.html not found — run npm run build" };
}

// ── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log("\n━━━ UI Verification ━━━\n");

  // Build output check
  results.push(checkBuildOutput());

  // Design tokens
  results.push(checkDesignTokens());

  // Route health
  const routeChecks = await checkRouteHealth();
  results.push(...routeChecks);

  // Screenshots
  const screenshotChecks = takeScreenshots();
  results.push(...screenshotChecks);

  // ── Report ──────────────────────────────────────────────────────────────

  console.log("\n━━━ Results ━━━\n");

  const passed = results.filter((r) => r.status === "pass");
  const warned = results.filter((r) => r.status === "warn");
  const failed = results.filter((r) => r.status === "fail");

  for (const r of results) {
    const icon = r.status === "pass" ? "✅" : r.status === "warn" ? "⚠️" : "❌";
    console.log(`${icon} ${r.check}: ${r.detail}`);
  }

  console.log(`\n${passed.length} passed, ${warned.length} warnings, ${failed.length} failed`);

  if (!skipScreenshots) {
    console.log(`\nScreenshots saved to: ${SCREENSHOT_DIR}/`);
    console.log("Review with: Read tool on each PNG file");
  }

  if (failed.length > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Verification failed:", err.message);
  process.exit(1);
});
