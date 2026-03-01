import fs from 'fs';
import path from 'path';

const COMPONENTS_DIR = path.resolve(process.cwd(), 'src/components/HH');
const SCREENSHOTS_DIR = path.resolve(process.cwd(), 'screenshots');
const OUTPUT_FILE = path.resolve(process.cwd(), 'DESIGN_AUDIT.md');

// Page groups matching screenshot-all.ts
const PUBLIC_PAGES = ['landing', 'about', 'pricing', 'login', 'signup', 'onboarding', 'privacy-policy'];
const USER_PAGES = [
  'dashboard', 'technieken', 'videos', 'live', 'team', 'analytics',
  'analysis', 'upload-analysis', 'analysis-results',
  'talk-to-hugo', 'hugo-overview', 'coaching',
  'roleplay', 'roleplaychat', 'overviewprogress', 'builder',
  'library', 'notifications', 'resources', 'help', 'settings',
];
const ADMIN_PAGES = [
  'admin-dashboard', 'admin-users', 'admin-videos', 'admin-techniques',
  'admin-live', 'admin-sessions', 'admin-transcripts', 'admin-uploads',
  'admin-content', 'admin-resources', 'admin-help', 'admin-analytics',
  'admin-progress', 'admin-analysis-results', 'admin-upload-analysis',
  'admin-chat-expert', 'admin-rag-review', 'admin-config-review',
  'admin-conflicts', 'admin-notifications', 'admin-settings',
];

interface ColorAnalysis {
  blues: string[];
  grays: string[];
  greens: string[];
  reds: string[];
  purples: string[];
  yellows: string[];
  whites: string[];
  custom: string[];
}

interface TypographyAnalysis {
  sizes: Map<string, number>;
  weights: Map<string, number>;
  families: string[];
}

interface ComponentAnalysis {
  buttonVariants: Map<string, number>;
  cardPatterns: Map<string, number>;
  darkModeClasses: number;
  totalClasses: number;
  responsiveClasses: Map<string, number>;
}

function readAllTsxFiles(dir: string): string[] {
  const files: string[] = [];
  if (!fs.existsSync(dir)) return files;

  const entries = fs.readdirSync(dir);
  for (const entry of entries) {
    const fullPath = path.join(dir, entry);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      files.push(...readAllTsxFiles(fullPath));
    } else if (entry.endsWith('.tsx') || entry.endsWith('.ts')) {
      files.push(fullPath);
    }
  }
  return files;
}

function extractTailwindClasses(content: string): string[] {
  const matches: string[] = [];
  const classNameRegex = /className[=\s]*[`"']([^`"']+)[`"']/g;
  let match;
  while ((match = classNameRegex.exec(content)) !== null) {
    const classes = match[1].split(/\s+/).filter(c => c.trim());
    matches.push(...classes);
  }
  return matches;
}

function analyzeColors(classes: string[]): ColorAnalysis {
  const colorClasses = classes.filter(c =>
    c.match(/^(bg|text|border|ring|shadow|fill|stroke)-(blue|slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|indigo|violet|purple|fuchsia|pink|rose|white|black)-/)
  );

  const result: ColorAnalysis = { blues: [], grays: [], greens: [], reds: [], purples: [], yellows: [], whites: [], custom: [] };

  colorClasses.forEach(c => {
    if (c.includes('blue') || c.includes('sky') || c.includes('cyan') || c.includes('indigo')) result.blues.push(c);
    else if (c.includes('gray') || c.includes('slate') || c.includes('zinc') || c.includes('neutral')) result.grays.push(c);
    else if (c.includes('green') || c.includes('emerald') || c.includes('teal') || c.includes('lime')) result.greens.push(c);
    else if (c.includes('red') || c.includes('rose') || c.includes('pink')) result.reds.push(c);
    else if (c.includes('purple') || c.includes('violet') || c.includes('fuchsia')) result.purples.push(c);
    else if (c.includes('yellow') || c.includes('amber') || c.includes('orange')) result.yellows.push(c);
    else if (c.includes('white')) result.whites.push(c);
  });

  const customColors = classes.filter(c => c.match(/^(bg|text|border)-\[/));
  result.custom.push(...customColors);

  return result;
}

function analyzeTypography(classes: string[]): TypographyAnalysis {
  const sizeMap = new Map<string, number>();
  const weightMap = new Map<string, number>();
  const families: string[] = [];

  classes.forEach(c => {
    const sizeMatch = c.match(/^text-(xs|sm|base|lg|xl|2xl|3xl|4xl|5xl|6xl)/);
    if (sizeMatch) {
      sizeMap.set(c, (sizeMap.get(c) || 0) + 1);
    }
    const weightMatch = c.match(/^font-(thin|extralight|light|normal|medium|semibold|bold|extrabold|black)/);
    if (weightMatch) {
      weightMap.set(c, (weightMap.get(c) || 0) + 1);
    }
    if (c.match(/^font-(sans|serif|mono)/)) {
      if (!families.includes(c)) families.push(c);
    }
  });

  return { sizes: sizeMap, weights: weightMap, families };
}

function analyzeComponents(classes: string[], content: string): ComponentAnalysis {
  const buttonVariants = new Map<string, number>();
  const cardPatterns = new Map<string, number>();

  const darkModeClasses = classes.filter(c => c.startsWith('dark:')).length;
  const totalClasses = classes.length;

  const responsiveMap = new Map<string, number>();
  ['sm:', 'md:', 'lg:', 'xl:', '2xl:'].forEach(bp => {
    const count = classes.filter(c => c.startsWith(bp)).length;
    if (count > 0) responsiveMap.set(bp, count);
  });

  const buttonMatches = content.match(/<Button[^>]*variant=['"]([\w-]+)['"]/g) || [];
  buttonMatches.forEach(m => {
    const variant = m.match(/variant=['"]([\w-]+)['"]/)?.[1] || 'unknown';
    buttonVariants.set(variant, (buttonVariants.get(variant) || 0) + 1);
  });

  const cardMatches = content.match(/<Card[A-Za-z]*\b/g) || [];
  cardMatches.forEach(m => {
    cardPatterns.set(m, (cardPatterns.get(m) || 0) + 1);
  });

  return { buttonVariants, cardPatterns, darkModeClasses, totalClasses, responsiveClasses: responsiveMap };
}

function screenshotExists(pageName: string, viewport: string): boolean {
  return fs.existsSync(path.join(SCREENSHOTS_DIR, viewport, `${pageName}.png`));
}

function screenshotMarkdown(pageName: string): string {
  const desktopExists = screenshotExists(pageName, 'desktop');
  const mobileExists = screenshotExists(pageName, 'mobile');

  if (!desktopExists && !mobileExists) {
    return '_Screenshots niet beschikbaar — run `npm run audit:screenshot` eerst._\n';
  }

  let md = '';
  if (desktopExists) {
    md += `![${pageName} desktop](screenshots/desktop/${pageName}.png)\n`;
  }
  if (mobileExists) {
    md += `![${pageName} mobile](screenshots/mobile/${pageName}.png)\n`;
  }
  return md;
}

function topN<K>(map: Map<K, number>, n: number): Array<[K, number]> {
  return Array.from(map.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, n);
}

function generateReport(): string {
  const now = new Date().toLocaleDateString('nl-BE', {
    year: 'numeric', month: 'long', day: 'numeric',
  });

  console.log('📊 Analyzing component files...');
  const tsxFiles = readAllTsxFiles(COMPONENTS_DIR);
  console.log(`   Found ${tsxFiles.length} component files`);

  let allClasses: string[] = [];
  let allContent = '';
  let darkModeTotal = 0;
  let totalClasses = 0;

  const perFileAnalysis: Array<{ file: string; darkRatio: number; responsiveClasses: number; buttonVariants: number }> = [];

  tsxFiles.forEach(filePath => {
    const content = fs.readFileSync(filePath, 'utf-8');
    const classes = extractTailwindClasses(content);
    const analysis = analyzeComponents(classes, content);
    allClasses.push(...classes);
    allContent += content;
    darkModeTotal += analysis.darkModeClasses;
    totalClasses += analysis.totalClasses;

    const responsiveCount = Array.from(analysis.responsiveClasses.values()).reduce((a, b) => a + b, 0);
    perFileAnalysis.push({
      file: path.basename(filePath),
      darkRatio: analysis.totalClasses > 0 ? analysis.darkModeClasses / analysis.totalClasses : 0,
      responsiveClasses: responsiveCount,
      buttonVariants: analysis.buttonVariants.size,
    });
  });

  const colorAnalysis = analyzeColors(allClasses);
  const typographyAnalysis = analyzeTypography(allClasses);
  const globalComponentAnalysis = analyzeComponents(allClasses, allContent);

  const lowDarkMode = perFileAnalysis
    .filter(f => f.darkRatio < 0.05 && f.file.startsWith('Admin'))
    .sort((a, b) => a.darkRatio - b.darkRatio)
    .slice(0, 10);

  const lowResponsive = perFileAnalysis
    .filter(f => f.responsiveClasses < 5)
    .sort((a, b) => a.responsiveClasses - b.responsiveClasses)
    .slice(0, 10);

  let md = '';

  // ─── HEADER ───────────────────────────────────────────────────────────────
  md += `# HugoHerbots.ai — Design Audit Rapport\n\n`;
  md += `**Datum:** ${now}  \n`;
  md += `**Scope:** Alle pagina's (public + user + admin)  \n`;
  md += `**Doel:** Design sprint input — pain points identificeren  \n`;
  md += `**Methode:** Playwright screenshots (375px mobile / 1440px desktop) + Tailwind class analyse\n\n`;
  md += `---\n\n`;

  // ─── TABLE OF CONTENTS ────────────────────────────────────────────────────
  md += `## Inhoudstafel\n\n`;
  md += `1. [Design System Overzicht](#1-design-system-overzicht)\n`;
  md += `2. [Nieuwe Gebruiker Journey — Public Pages](#2-nieuwe-gebruiker-journey--public-pages)\n`;
  md += `3. [User Platform](#3-user-platform)\n`;
  md += `4. [Admin Platform](#4-admin-platform)\n`;
  md += `5. [Cross-cutting Issues](#5-cross-cutting-issues)\n`;
  md += `6. [Prioriteitenmatrix](#6-prioriteitenmatrix)\n\n`;
  md += `---\n\n`;

  // ─── SECTION 1: DESIGN SYSTEM ─────────────────────────────────────────────
  md += `## 1. Design System Overzicht\n\n`;

  md += `### Kleurpalet\n\n`;
  md += `Gebaseerd op Tailwind class gebruik in ${tsxFiles.length} component bestanden:\n\n`;
  md += `| Kleurgroep | Meest gebruikte classes | Count |\n`;
  md += `|-----------|------------------------|-------|\n`;

  const uniqueBlues = [...new Set(colorAnalysis.blues)].slice(0, 3);
  const uniqueGrays = [...new Set(colorAnalysis.grays)].slice(0, 3);
  const uniqueGreens = [...new Set(colorAnalysis.greens)].slice(0, 3);
  const uniqueReds = [...new Set(colorAnalysis.reds)].slice(0, 3);
  const uniquePurples = [...new Set(colorAnalysis.purples)].slice(0, 3);

  md += `| 🔵 Blues/Indigo | ${uniqueBlues.join(', ')} | ${colorAnalysis.blues.length} |\n`;
  md += `| ⚫ Grays/Slate | ${uniqueGrays.join(', ')} | ${colorAnalysis.grays.length} |\n`;
  md += `| 🟢 Greens | ${uniqueGreens.join(', ')} | ${colorAnalysis.greens.length} |\n`;
  md += `| 🔴 Reds/Danger | ${uniqueReds.join(', ')} | ${colorAnalysis.reds.length} |\n`;
  md += `| 🟣 Purples | ${uniquePurples.join(', ')} | ${colorAnalysis.purples.length} |\n`;
  if (colorAnalysis.custom.length > 0) {
    md += `| 🎨 Custom [hex] | ${[...new Set(colorAnalysis.custom)].slice(0, 3).join(', ')} | ${colorAnalysis.custom.length} |\n`;
  }
  md += `\n`;

  md += `### Typografie\n\n`;
  md += `**Tekstgroottes (meest gebruikt):**\n\n`;
  topN(typographyAnalysis.sizes, 8).forEach(([cls, count]) => {
    md += `- \`${cls}\` — ${count}×\n`;
  });
  md += `\n**Font weights (meest gebruikt):**\n\n`;
  topN(typographyAnalysis.weights, 6).forEach(([cls, count]) => {
    md += `- \`${cls}\` — ${count}×\n`;
  });
  md += `\n`;

  md += `### Component Patronen\n\n`;
  md += `**Button varianten:**\n\n`;
  topN(globalComponentAnalysis.buttonVariants, 6).forEach(([variant, count]) => {
    md += `- \`variant="${variant}"\` — ${count}×\n`;
  });
  md += `\n**Card componenten:**\n\n`;
  topN(globalComponentAnalysis.cardPatterns, 6).forEach(([pattern, count]) => {
    md += `- \`${pattern}\` — ${count}×\n`;
  });
  md += `\n`;

  const darkCoverage = totalClasses > 0 ? ((darkModeTotal / totalClasses) * 100).toFixed(1) : '0';
  md += `### Dark Mode Coverage\n\n`;
  md += `- Totaal Tailwind classes: **${totalClasses.toLocaleString()}**\n`;
  md += `- Dark mode classes (\`dark:\`): **${darkModeTotal.toLocaleString()}** (${darkCoverage}% coverage)\n\n`;

  if (lowDarkMode.length > 0) {
    md += `**Admin componenten met lage dark mode coverage:**\n\n`;
    lowDarkMode.forEach(f => {
      md += `- \`${f.file}\` — ${(f.darkRatio * 100).toFixed(1)}% dark classes\n`;
    });
    md += `\n`;
  }

  md += `### Responsive Breakpoints\n\n`;
  ['sm:', 'md:', 'lg:', 'xl:', '2xl:'].forEach(bp => {
    const count = allClasses.filter(c => c.startsWith(bp)).length;
    md += `- \`${bp}\` — ${count} classes\n`;
  });
  md += `\n`;
  if (lowResponsive.length > 0) {
    md += `**Componenten met weinig responsive classes (mogelijke mobile problemen):**\n\n`;
    lowResponsive.forEach(f => {
      md += `- \`${f.file}\` — ${f.responsiveClasses} responsive classes\n`;
    });
    md += `\n`;
  }

  md += `---\n\n`;

  // ─── PAGE SECTION HELPER ──────────────────────────────────────────────────
  function pageSection(pageName: string, sectionTitle?: string): string {
    let s = `### ${sectionTitle || pageName}\n\n`;
    s += screenshotMarkdown(pageName);
    s += `\n**Aandachtspunten:**\n\n`;
    s += `- [ ] Mobiele layout correct?\n`;
    s += `- [ ] CTA duidelijk en prominent?\n`;
    s += `- [ ] Consistente typografie?\n`;
    s += `- [ ] Loading/empty states aanwezig?\n`;
    s += `- [ ] Dark mode volledig?\n`;
    s += `\n`;
    return s;
  }

  // ─── SECTION 2: PUBLIC PAGES ──────────────────────────────────────────────
  md += `## 2. Nieuwe Gebruiker Journey — Public Pages\n\n`;
  md += `_Stroom: Landing → About → Pricing → Signup → Onboarding → Dashboard_\n\n`;

  const publicTitles: Record<string, string> = {
    landing: 'Landing Page',
    about: 'Over Hugo Herbots',
    pricing: 'Pricing',
    login: 'Login',
    signup: 'Registratie (Sign Up)',
    onboarding: 'Onboarding Wizard',
    'privacy-policy': 'Privacy Policy',
  };
  PUBLIC_PAGES.forEach(p => {
    md += pageSection(p, publicTitles[p] || p);
  });

  md += `---\n\n`;

  // ─── SECTION 3: USER PLATFORM ─────────────────────────────────────────────
  md += `## 3. User Platform\n\n`;

  const userTitles: Record<string, string> = {
    dashboard: 'Dashboard',
    technieken: 'E.P.I.C. TECHNIQUE',
    videos: "Video's",
    live: 'Live Coaching',
    team: 'Team Sessies',
    analytics: 'Analytics & Progress',
    analysis: 'Gespreksanalyse — Overzicht',
    'upload-analysis': 'Gespreksanalyse — Upload',
    'analysis-results': 'Gespreksanalyse — Resultaten',
    'talk-to-hugo': 'Talk to Hugo AI',
    'hugo-overview': 'Hugo AI — Overzicht',
    coaching: 'Digitale Coaching',
    roleplay: 'Roleplay Training',
    roleplaychat: 'Roleplay Chat',
    overviewprogress: 'Voortgang Overzicht',
    builder: 'Scenario Builder',
    library: 'Contentbibliotheek',
    notifications: 'Meldingen',
    resources: 'Resources',
    help: 'Helpcentrum',
    settings: 'Instellingen',
  };
  USER_PAGES.forEach(p => {
    md += pageSection(p, userTitles[p] || p);
  });

  md += `---\n\n`;

  // ─── SECTION 4: ADMIN PLATFORM ────────────────────────────────────────────
  md += `## 4. Admin Platform\n\n`;

  const adminTitles: Record<string, string> = {
    'admin-dashboard': 'Admin Dashboard',
    'admin-users': 'Gebruikersbeheer',
    'admin-videos': "Video's Beheer",
    'admin-techniques': 'Technieken Beheer',
    'admin-live': 'Live Sessies Beheer',
    'admin-sessions': 'Sessies',
    'admin-transcripts': 'Transcripten',
    'admin-uploads': 'Uploads',
    'admin-content': 'Content Bibliotheek',
    'admin-resources': 'Resources Beheer',
    'admin-help': 'Helpcentrum Beheer',
    'admin-analytics': 'Admin Analytics',
    'admin-progress': 'Gebruikersvoortgang',
    'admin-analysis-results': 'Analyse Resultaten (Admin)',
    'admin-upload-analysis': 'Upload Analyse (Admin)',
    'admin-chat-expert': 'Expert Chat Modus',
    'admin-rag-review': 'RAG Review',
    'admin-config-review': 'Config Review',
    'admin-conflicts': 'Conflicten',
    'admin-notifications': 'Admin Meldingen',
    'admin-settings': 'Admin Instellingen',
  };
  ADMIN_PAGES.forEach(p => {
    md += pageSection(p, adminTitles[p] || p);
  });

  md += `---\n\n`;

  // ─── SECTION 5: CROSS-CUTTING ─────────────────────────────────────────────
  md += `## 5. Cross-cutting Issues\n\n`;

  md += `### Navigatie Consistentie\n\n`;
  md += `- [ ] AppLayout sidebar iconen consistent met paginatitels?\n`;
  md += `- [ ] AdminLayout vs AppLayout: aparte navigatiepatronen?\n`;
  md += `- [ ] Breadcrumbs aanwezig op diepere pagina's?\n`;
  md += `- [ ] Terug-navigatie (back button) consequent?\n`;
  md += `- [ ] Active state in sidebar correct per pagina?\n\n`;

  md += `### Mobile Responsiveness\n\n`;
  md += `- [ ] Sidebar collapst correct op mobile?\n`;
  md += `- [ ] Tabellen scrollbaar op mobile?\n`;
  md += `- [ ] Formulieren bruikbaar op 375px?\n`;
  md += `- [ ] Touch targets minimaal 44px?\n`;
  md += `- [ ] Modals/dialogs correct op mobile?\n\n`;

  md += `### Dark Mode Volledigheid\n\n`;
  md += `- [ ] Alle pagina's getest in dark mode?\n`;
  md += `- [ ] Admin pagina's hebben ${darkCoverage}% dark coverage — review nodig?\n`;
  md += `- [ ] Consistente dark mode kleuren (bg-background, text-foreground)?\n`;
  md += `- [ ] Charts/grafieken in dark mode correct?\n\n`;

  md += `### Loading & Empty States\n\n`;
  md += `- [ ] Skeleton loaders aanwezig voor data-heavy pagina's?\n`;
  md += `- [ ] Empty state illustraties/tekst bij geen data?\n`;
  md += `- [ ] Error states duidelijk gecommuniceerd?\n`;
  md += `- [ ] Upload progress feedback aanwezig?\n\n`;

  md += `### CTA Hiërarchie & Onboarding\n\n`;
  md += `- [ ] Primaire CTA visueel dominant per pagina?\n`;
  md += `- [ ] Onboarding flow duidelijk en friction-vrij?\n`;
  md += `- [ ] Tooltips/help text aanwezig voor complexe features?\n`;
  md += `- [ ] Notification badge correct zichtbaar?\n\n`;

  md += `### Typografie & Spacing Systeem\n\n`;
  md += `- [ ] Heading hiërarchie (h1→h2→h3) consequent?\n`;
  md += `- [ ] Consistente line-height en letter-spacing?\n`;
  md += `- [ ] Kaartcomponenten consistent padding?\n`;
  md += `- [ ] Icon grootte uniform (16px/20px/24px)?\n\n`;

  md += `---\n\n`;

  // ─── SECTION 6: PRIORITEITENMATRIX ────────────────────────────────────────
  md += `## 6. Prioriteitenmatrix voor Design Sprint\n\n`;
  md += `_Vul in na review van screenshots:_\n\n`;
  md += `| Issue | Pagina's | Impact (H/M/L) | Effort (H/M/L) | Prioriteit |\n`;
  md += `|-------|----------|----------------|----------------|------------|\n`;
  md += `| Mobile layout sidebar | Alle user pagina's | H | M | 🔴 P1 |\n`;
  md += `| Dark mode admin pages | Admin pagina's | M | M | 🟡 P2 |\n`;
  md += `| Empty states ontbreken | Dashboard, Techniques | M | L | 🟡 P2 |\n`;
  md += `| CTA hiërarchie | Landing, Pricing | H | L | 🔴 P1 |\n`;
  md += `| Typografie consistentie | App-breed | M | M | 🟡 P2 |\n`;
  md += `| _[vul aan na review]_ | | | | |\n\n`;

  md += `---\n\n`;
  md += `_Rapport gegenereerd op ${now} door \`npm run audit:report\`_\n`;

  return md;
}

function main() {
  console.log('\n📝 HugoHerbots.ai — Design Audit Rapport Genereren\n');

  const screenshotsExist = fs.existsSync(path.join(SCREENSHOTS_DIR, 'desktop')) ||
    fs.existsSync(path.join(SCREENSHOTS_DIR, 'mobile'));

  if (!screenshotsExist) {
    console.warn('⚠️  Screenshots folder niet gevonden. Run `npm run audit:screenshot` eerst.');
    console.warn('   Rapport wordt gegenereerd zonder embedded screenshots.\n');
  }

  const report = generateReport();

  fs.writeFileSync(OUTPUT_FILE, report, 'utf-8');

  console.log(`\n✅ Rapport opgeslagen: DESIGN_AUDIT.md`);
  console.log(`   Grootte: ${(fs.statSync(OUTPUT_FILE).size / 1024).toFixed(1)} KB`);
  console.log(`\n💡 Open DESIGN_AUDIT.md in een markdown viewer voor embedded screenshots.\n`);
}

main();
