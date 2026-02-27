import { chromium } from '@playwright/test';
import path from 'path';
import fs from 'fs';

const BASE_URL = `http://localhost:${process.env.PORT || 5000}`;

const VIEWPORTS = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'mobile', width: 375, height: 812 },
];

// All pages in new-user journey order
const PUBLIC_PAGES = [
  'landing', 'about', 'pricing', 'login', 'signup', 'onboarding', 'privacy-policy',
];

const USER_PAGES = [
  'dashboard',
  'technieken',
  'videos',
  'live',
  'team',
  'analytics',
  'analysis',
  'upload-analysis',
  'analysis-results',
  'talk-to-hugo',
  'hugo-overview',
  'coaching',
  'roleplay',
  'roleplaychat',
  'overviewprogress',
  'builder',
  'library',
  'notifications',
  'resources',
  'help',
  'settings',
];

const ADMIN_PAGES = [
  'admin-dashboard',
  'admin-users',
  'admin-videos',
  'admin-techniques',
  'admin-live',
  'admin-sessions',
  'admin-transcripts',
  'admin-uploads',
  'admin-content',
  'admin-resources',
  'admin-help',
  'admin-analytics',
  'admin-progress',
  'admin-analysis-results',
  'admin-upload-analysis',
  'admin-chat-expert',
  'admin-rag-review',
  'admin-config-review',
  'admin-conflicts',
  'admin-notifications',
  'admin-settings',
];

const ALL_PAGES = [...PUBLIC_PAGES, ...USER_PAGES, ...ADMIN_PAGES];

function ensureDir(dirPath: string) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

async function screenshotPage(
  page: any,
  pageName: string,
  viewport: { name: string; width: number; height: number },
  outDir: string
): Promise<{ pageName: string; viewport: string; success: boolean; error?: string }> {
  const url = `${BASE_URL}/_dev/${pageName}`;
  const outPath = path.join(outDir, viewport.name, `${pageName}.png`);

  try {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto(url, { waitUntil: 'load', timeout: 15000 });
    // Extra wait for React render + animations
    await page.waitForTimeout(800);
    await page.screenshot({
      path: outPath,
      fullPage: true,
      animations: 'disabled',
    });
    console.log(`  ✓ ${viewport.name}/${pageName}.png`);
    return { pageName, viewport: viewport.name, success: true };
  } catch (err: any) {
    console.error(`  ✗ ${viewport.name}/${pageName} — ${err.message}`);
    return { pageName, viewport: viewport.name, success: false, error: err.message };
  }
}

async function main() {
  const outDir = path.resolve(process.cwd(), 'screenshots');

  // Create output directories
  for (const vp of VIEWPORTS) {
    ensureDir(path.join(outDir, vp.name));
  }

  console.log(`\n🎬 HugoHerbots.ai — Design Audit Screenshots`);
  console.log(`📁 Output: ${outDir}`);
  console.log(`📄 Pages: ${ALL_PAGES.length} | Viewports: ${VIEWPORTS.length}`);
  console.log(`📸 Total screenshots: ${ALL_PAGES.length * VIEWPORTS.length}\n`);

  // Check dev server is running
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    await page.goto(BASE_URL, { waitUntil: 'load', timeout: 8000 });
  } catch {
    console.error(`\n❌ Cannot reach ${BASE_URL}`);
    console.error(`   Make sure the Vite dev server is running: npm run dev\n`);
    await browser.close();
    process.exit(1);
  }

  const results: Array<{ pageName: string; viewport: string; success: boolean; error?: string }> = [];

  // Screenshot all pages at each viewport
  for (const vp of VIEWPORTS) {
    console.log(`\n── ${vp.name.toUpperCase()} (${vp.width}×${vp.height}) ──`);

    for (const pageName of ALL_PAGES) {
      const result = await screenshotPage(page, pageName, vp, outDir);
      results.push(result);
    }
  }

  await browser.close();

  // Summary
  const succeeded = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success);

  console.log(`\n✅ Done: ${succeeded}/${results.length} screenshots captured`);

  if (failed.length > 0) {
    console.log(`\n⚠️  Failed pages (${failed.length}):`);
    failed.forEach(f => console.log(`   - ${f.viewport}/${f.pageName}: ${f.error}`));
  }

  // Write summary JSON for report generator
  const summaryPath = path.join(outDir, '_summary.json');
  fs.writeFileSync(summaryPath, JSON.stringify({ results, capturedAt: new Date().toISOString() }, null, 2));
  console.log(`\n📋 Summary saved to screenshots/_summary.json`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
