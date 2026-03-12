# HugoHerbots.com — Project Instructions

## Project Overview

Sales coaching platform voor Hugo Herbots (82 jaar, Belgische sales coach).
- **Stack:** React 18 + Vite 6 + Tailwind CSS v4, Express.js backend, Supabase (auth + DB), Daily.co (video)
- **Deploy:** Railway — auto-deploy vanuit GitHub push naar `main`
- **Build:** `npm run build` (Vite frontend + esbuild server bundle)

## Design System

### Kleuren — ALLEEN hh-* tokens (STRIKT)

**NOOIT** gebruiken:
- Hardcoded Tailwind kleuren (`purple-500`, `blue-600`, `emerald-500`, `bg-white`, `bg-black`)
- Hex kleuren in inline styles (`style={{ color: '#xxx' }}`, `style={{ backgroundColor: '#xxx' }}`)
- `rgb()`/`rgba()` waarden in component code
- Enige kleur die niet via een `hh-*` token loopt

**ALTIJD** de `hh-*` design tokens uit `src/styles/globals.css`.
**Ontbreekt een kleur?** Voeg een token toe aan `globals.css`, gebruik dan die token.
**Check:** Run `bash scripts/check-design-tokens.sh` om violations op te sporen.

| Token | Hex | Gebruik |
|-------|-----|---------|
| `hh-primary` | #4F7396 (steel blue) | Interactieve elementen, links, actieve states. In `.admin-session` context: #8B5CF6 (purple) |
| `hh-success` | #10B981 (emerald) | Positieve acties, CTA buttons, bevestigingen |
| `hh-error` | #EF4444 | Foutmeldingen, destructieve acties |
| `hh-warning` | #F59E0B | Waarschuwingen |
| `hh-text` / `hh-ink` | #0F1826 (mirage) | Body text, headings |
| `hh-muted` | #9CA3AF | Secundaire tekst, timestamps, placeholders |
| `hh-border` | #D1D5DB | Randen, dividers |
| `hh-bg` | #FFFFFF | Achtergronden |
| `hh-ui-50` | #F8FAFC | Lichte achtergrond (hover, actieve tab bg) |
| `hh-ui-200` | #E2E8F0 | Lichtgrijze achtergronden, progress bars |

### User View vs Admin View

| Aspect | User View | Admin View |
|--------|-----------|------------|
| Primary accent | `hh-primary` (steel blue) | `hh-primary` overridden naar purple via `.admin-session` class |
| CTA buttons | `bg-hh-success` (emerald groen) | `bg-hh-primary` (purple in admin-session context) |
| Purple (#8B5CF6) | **NOOIT** | Automatisch via `.admin-session` CSS class op host/admin components |
| HOST badge | `bg-hh-primary` | `bg-hh-primary` |

### Typografie

- **Font:** Outfit (Google Fonts) — `wght@300;400;600;700`
- **Body:** `text-[14px]` of `text-[16px]`
- **Labels/badges:** `text-[11px]` of `text-[12px]` `font-medium`
- **H2 secties:** `text-[24px] leading-[32px] font-medium`
- **H3 cards:** `text-[20px] leading-[28px] font-medium`
- **H4 klein:** `text-[18px] leading-[26px] font-medium`

### Badges & Tags

- **Minimum padding:** `px-3 py-1` (12px × 4px) — NOOIT krapper dan dit
- **Pill badges:** `rounded-full`
- **Status badges:** `rounded-md` (default shadcn Badge component)
- **Subtiele/info badge:** `bg-hh-primary/10 text-hh-primary border border-hh-primary/20`
- **Tekst:** altijd `text-[11px]` of `text-[12px]` met `font-medium`
- **Counters/nummers:** `text-[10px]` mag, maar dan met `px-2 py-0.5` minimum

### Cards & Containers

- **Border radius:** `rounded-[16px]` voor cards, `rounded-lg` voor interne elementen
- **Shadow:** `shadow-hh-md` voor kaarten, `shadow-hh-sm` voor subtiele elementen
- **Border:** `border border-hh-border`

### Buttons

- **Ronde toggles (video controls):** `w-12 h-12 rounded-full p-0` (48px)
- **CTA (user):** `bg-hh-success hover:bg-hh-success/90 text-white rounded-full`
- **CTA (admin):** `bg-hh-primary hover:bg-hh-primary/90 text-white`
- **Destructive:** alleen voor camera uit, mic uit, sessie verlaten

### Dark Mode

- **Elk nieuw component MOET werken in dark mode.** Test altijd visueel met dark mode aan.
- Gebruik NOOIT hardcoded `bg-white`, `bg-black`, of hex kleuren — gebruik `bg-hh-bg`, `text-hh-text`, etc. Deze tokens schakelen automatisch in dark mode.
- Voor shade backgrounds: gebruik de `-50`/`-100`/`-200` tokens (bijv. `bg-hh-primary-100`) — deze hebben dark mode overrides in `src/index.css`.

### Layout Regels

- **Control bars:** `justify-center` — elementen die verschijnen/verdwijnen NOOIT in dezelfde flex-rij als stabiele elementen (gebruik een aparte rij)
- **Video containers:** `minHeight` max `50vh`, altijd een `maxHeight` met `calc(100vh - Xrem)`
- **Responsief:** `hidden sm:flex` voor desktop-only elementen, nooit `!important`

## Components & Libraries

| Functie | Library/Component |
|---------|-------------------|
| Toast notificaties | `sonner` (`toast.success`, `toast.error`, `toast.info`) |
| Icons | `lucide-react` |
| Dialogs | shadcn `Dialog` |
| Select dropdowns | shadcn `Select` |
| Badges | shadcn `Badge` |
| Tabs | shadcn `Tabs` |
| Video calls | `@daily-co/daily-js` + `CustomDailyCall` component |

## SSOT Terminologie (STRIKT)

- **Methodologie:** Altijd "E.P.I.C. TECHNIQUE" — met puntjes, met TECHNIQUE erachter. NOOIT "EPIC", "Epic", "E.P.I.C." zonder TECHNIQUE.
- **Technieken:** Bij elke referentie naar een verkooptechniek ALLEEN de exacte benaming uit `config/ssot/technieken_index.json`. NOOIT parafraseren, vertalen, of generieke alternatieven gebruiken. Voorbeeld: "Feitgerichte vragen (2.1.1)" niet "stel open vragen".
- **Klanthoudingen:** ALLEEN de exacte 9 namen uit `config/klant_houdingen.json` (H1-H9). NOOIT "de klant twijfelt" als je "Twijfel (H6)" bedoelt.
- **Check:** Zoek de exacte naam op in de SSOT files voor je een techniek of houding noemt.

## Code Conventions

- **Interface taal:** Nederlands (labels, placeholders, toasts, foutmeldingen)
- **Code taal:** Engels (variabelen, functies, comments)
- **Geen `console.log`** in productie code
- **Build check:** `npm run build` moet slagen voor elke commit
- **Visuele verificatie (VERPLICHT — zie sectie hieronder)**
- **Hergebruik bestaande patronen:** Zoek ALTIJD eerst of een UI-element, flow, of functionaliteit al bestaat in het platform. Kopieer en hergebruik die implementatie — bouw NOOIT van nul als het al bestaat.
- **Commit message stijl:** Korte imperatief ("Fix X", "Add Y", "Update Z")

## Visuele Verificatie (VERPLICHT — machine-enforced)

Na ELKE UI-wijziging voer je **verplicht** dit commando uit:

```bash
node visual-qa.mjs http://localhost:5001/[GEWIJZIGDE_PAGINA]
```

### Regels die NIET onderhandelbaar zijn

1. Je gebruikt ALTIJD `node visual-qa.mjs` — geen manuele screenshots, geen eigen beoordeling
2. Je presenteert NOOIT een resultaat als exit code ≠ 0 — het script beslist, niet jij
3. Je plakt de **volledige script-output** in je antwoord — inclusief alle ❌ en ✅ en scores
4. Bij FAIL: fix alle "critical" en "major" issues en run opnieuw — pas dan ga je verder
5. Je zegt NOOIT "visueel geverifieerd" zonder de script-output te tonen

### Bij interactieve UI (popup, modal, dropdown, tooltip)

Maak of update `qa-scenarios/[pagina].json` met de click-sequence om de state te openen, dan:

```bash
node visual-qa.mjs --scenario=qa-scenarios/[pagina].json
```

**De agent schrijft het scenario-bestand als onderdeel van de feature — niet achteraf.**

### Gebruik

```bash
# Basis (light + dark mode, auth automatisch via .env):
node visual-qa.mjs http://localhost:5001/dashboard
node visual-qa.mjs http://localhost:5001/admin/videos

# Interactieve states (popup open, dropdown actief, etc.):
node visual-qa.mjs --scenario=qa-scenarios/admin-videos.json

# Met extra context voor specifieke wijziging:
node visual-qa.mjs http://localhost:5001/admin/live-sessions --checklist="Kalender-icon zichtbaar in filterbar?"

# Enkel light mode:
node visual-qa.mjs http://localhost:5001 --no-dark
```

### Server + design token check (ook verplicht)

```bash
# Server starten (als nog niet actief):
unset ANTHROPIC_API_KEY && PORT=5001 node --env-file=.env server/production-server.js

# Design token check:
bash scripts/check-design-tokens.sh  # moet 0 violations geven
```

**Vereiste .env vars:** `SCREENSHOT_EMAIL`, `SCREENSHOT_PASSWORD` (worden automatisch geladen door het script)

## Local Development Server

- **Na elke build/commit:** Herstart de lokale server automatisch (kill poorten 5001/3001/3002, dan `PORT=5001 node --env-file=.env server/production-server.js`)
- **Architectuur:** `production-server.js` (port 5001) spawnt `video-processor.js` (3001) en `standalone.js` (3002)
- **Productie:** Railway auto-deployt bij push naar `main` — geen handmatige restart nodig

## Database & Migrations

- **NOOIT de gebruiker vragen om SQL handmatig te draaien.** Voer migrations zelf uit via de credentials in `.env`.
- **Eén database: Supabase PostgreSQL.** Connectie via `PostgreSQL_connection_string_supabase` + `SUPABASE_YOUR_PASSWORD` env vars. `db.ts` verbindt via Supabase session pooler.
- **Twee access patterns, zelfde database:**
  - `pool` / `db` (Drizzle ORM + raw SQL via `pg`) — voor server-side queries
  - `supabase` client (REST API) — voor live_sessions, profiles, auth, storage
- Migration bestanden opslaan in `src/supabase/migrations/` voor documentatie.

## Key Files

| Bestand | Beschrijving |
|---------|-------------|
| `src/styles/globals.css` | Design tokens, CSS variables |
| `src/live-coaching-design-handoff/design-tokens.css` | Spacing, radius, typografie tokens |
| `src/components/ui/` | shadcn UI componenten (Badge, Button, Dialog, etc.) |
| `src/components/HH/` | Alle app-specifieke componenten |
| `server/hugo-engine/api.ts` | Express.js API routes |
| `server/hugo-engine/db.ts` | Database connectie (Supabase PostgreSQL via session pooler) |
