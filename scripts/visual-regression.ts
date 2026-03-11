/**
 * Visual regression testing with pixel-level comparison.
 *
 * Commands:
 *   save    — Take baseline screenshots of key pages
 *   compare — Compare current state against baselines, generate diffs
 *   update  — Overwrite baselines with current screenshots
 *
 * Usage:
 *   npx tsx scripts/visual-regression.ts save
 *   npx tsx scripts/visual-regression.ts compare
 *   npx tsx scripts/visual-regression.ts update
 *
 * npm scripts:
 *   npm run baseline:save
 *   npm run baseline:compare
 *   npm run baseline:update
 */
import { execSync } from "child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync, copyFileSync } from "fs";
import { resolve, basename } from "path";
import { PNG } from "pngjs";
import pixelmatch from "pixelmatch";

const ROOT = resolve(import.meta.dirname || __dirname, "..");
const BASELINE_DIR = resolve(ROOT, "screenshots/baseline");
const CURRENT_DIR = resolve(ROOT, "screenshots/current");
const DIFF_DIR = resolve(ROOT, "screenshots/diff");
const BASE_URL = "http://localhost:5001";

// Pages to capture (same as verify-ui.ts)
const PAGES = [
  { path: "/", name: "landing" },
  { path: "/landing-v2", name: "landing-v2" },
  { path: "/login", name: "login" },
  { path: "/dashboard", name: "dashboard" },
  { path: "/videos", name: "videos" },
  { path: "/talk-to-hugo", name: "talk-to-hugo" },
];

const DIFF_THRESHOLD = 0.005; // 0.5% pixel difference = warning

function ensureDir(dir: string) {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

function captureScreenshots(outputDir: string) {
  ensureDir(outputDir);
  console.log(`\nCapturing screenshots to ${outputDir}/\n`);

  for (const page of PAGES) {
    const output = resolve(outputDir, `${page.name}.png`);
    try {
      execSync(
        `npx tsx "${ROOT}/scripts/screenshot.ts" "${BASE_URL}${page.path}" "${output}"`,
        { cwd: ROOT, encoding: "utf-8", timeout: 30000, stdio: "pipe" }
      );
      console.log(`  ✅ ${page.name} → ${basename(output)}`);
    } catch (err: any) {
      console.error(`  ❌ ${page.name}: ${err.message.split("\n")[0]}`);
    }
  }
}

function comparePNG(baselinePath: string, currentPath: string, diffPath: string): { diffPercent: number; diffPixels: number; totalPixels: number } {
  const baselineData = PNG.sync.read(readFileSync(baselinePath));
  const currentData = PNG.sync.read(readFileSync(currentPath));

  // Handle size mismatch by using the smaller dimensions
  const width = Math.min(baselineData.width, currentData.width);
  const height = Math.min(baselineData.height, currentData.height);

  if (baselineData.width !== currentData.width || baselineData.height !== currentData.height) {
    console.log(`    ⚠️  Size changed: ${baselineData.width}x${baselineData.height} → ${currentData.width}x${currentData.height}`);
  }

  // Crop both images to common size if needed
  const baselineCropped = cropPNG(baselineData, width, height);
  const currentCropped = cropPNG(currentData, width, height);

  const diff = new PNG({ width, height });
  const diffPixels = pixelmatch(
    baselineCropped,
    currentCropped,
    diff.data,
    width,
    height,
    { threshold: 0.1 }
  );

  const totalPixels = width * height;
  const diffPercent = diffPixels / totalPixels;

  writeFileSync(diffPath, PNG.sync.write(diff));

  return { diffPercent, diffPixels, totalPixels };
}

function cropPNG(png: PNG, width: number, height: number): Buffer {
  if (png.width === width && png.height === height) return png.data;

  const cropped = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y++) {
    const srcOffset = y * png.width * 4;
    const dstOffset = y * width * 4;
    png.data.copy(cropped, dstOffset, srcOffset, srcOffset + width * 4);
  }
  return cropped;
}

// ── Commands ────────────────────────────────────────────────────────────────

function cmdSave() {
  console.log("━━━ Saving Baselines ━━━");
  captureScreenshots(BASELINE_DIR);
  console.log(`\nBaselines saved to: ${BASELINE_DIR}/`);
  console.log("Run 'npm run baseline:compare' after changes to detect visual diffs.");
}

function cmdCompare() {
  console.log("━━━ Visual Regression Compare ━━━");

  if (!existsSync(BASELINE_DIR)) {
    console.error("No baselines found. Run 'npm run baseline:save' first.");
    process.exit(1);
  }

  // Capture current screenshots
  captureScreenshots(CURRENT_DIR);
  ensureDir(DIFF_DIR);

  console.log("\n━━━ Comparing ━━━\n");

  let totalDiffs = 0;
  let warnings = 0;
  const baselineFiles = readdirSync(BASELINE_DIR).filter(f => f.endsWith(".png"));

  for (const file of baselineFiles) {
    const baselinePath = resolve(BASELINE_DIR, file);
    const currentPath = resolve(CURRENT_DIR, file);
    const diffPath = resolve(DIFF_DIR, file);
    const name = file.replace(".png", "");

    if (!existsSync(currentPath)) {
      console.log(`  ❌ ${name}: no current screenshot (page removed?)`);
      totalDiffs++;
      continue;
    }

    const { diffPercent, diffPixels, totalPixels } = comparePNG(baselinePath, currentPath, diffPath);

    if (diffPercent === 0) {
      console.log(`  ✅ ${name}: identical`);
    } else if (diffPercent < DIFF_THRESHOLD) {
      console.log(`  ✅ ${name}: ${(diffPercent * 100).toFixed(2)}% diff (${diffPixels}/${totalPixels} px) — below threshold`);
    } else {
      console.log(`  ⚠️  ${name}: ${(diffPercent * 100).toFixed(2)}% diff (${diffPixels}/${totalPixels} px) — REVIEW diff: ${diffPath}`);
      warnings++;
    }
  }

  // Check for new pages not in baseline
  const currentFiles = readdirSync(CURRENT_DIR).filter(f => f.endsWith(".png"));
  for (const file of currentFiles) {
    if (!baselineFiles.includes(file)) {
      console.log(`  🆕 ${file.replace(".png", "")}: new page (no baseline)`);
    }
  }

  console.log(`\n${baselineFiles.length} pages compared, ${warnings} need review`);

  if (warnings > 0) {
    console.log(`\nDiff images saved to: ${DIFF_DIR}/`);
    console.log("Review each diff with: Read tool on the PNG file");
    console.log("Red pixels = changed areas. Update baselines with: npm run baseline:update");
  }
}

function cmdUpdate() {
  console.log("━━━ Updating Baselines ━━━");
  captureScreenshots(BASELINE_DIR);
  console.log("\nBaselines updated.");
}

// ── Main ────────────────────────────────────────────────────────────────────

const command = process.argv[2];

switch (command) {
  case "save":
    cmdSave();
    break;
  case "compare":
    cmdCompare();
    break;
  case "update":
    cmdUpdate();
    break;
  default:
    console.log("Usage: npx tsx scripts/visual-regression.ts <save|compare|update>");
    process.exit(1);
}
