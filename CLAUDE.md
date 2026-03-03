# HugoHerbots.com — Project Instructions

## Project Overview

Sales coaching platform voor Hugo Herbots (82 jaar, Belgische sales coach).
- **Stack:** React 19 + Vite 6 + Tailwind CSS v4, Express.js backend, Supabase (auth + DB), Daily.co (video)
- **Deploy:** Railway — auto-deploy vanuit GitHub push naar `main`
- **Build:** `npm run build` (Vite frontend + esbuild server bundle)

## Design System

### Kleuren — ALLEEN hh-* tokens

**NOOIT** hardcoded Tailwind kleuren gebruiken (`purple-500`, `blue-600`, `emerald-500`, etc.).
**ALTIJD** de `hh-*` design tokens uit `src/styles/globals.css`:

| Token | Hex | Gebruik |
|-------|-----|---------|
| `hh-primary` | #4F7396 (steel blue) | Interactieve elementen, links, actieve states |
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
| Primary accent | `hh-primary` (steel blue) | `hh-primary` (steel blue) |
| CTA buttons | `bg-hh-success` (emerald groen) | `bg-hh-primary` (steel blue) |
| Purple (#8B5CF6) | **NOOIT** | Mag als accent voor premium/speciale features |
| HOST badge | `bg-hh-primary` | `bg-hh-primary` |

### Typografie

- **Font:** Outfit (Google Fonts) — `wght@300;400;600;700`
- **Body:** `text-[14px]` of `text-[16px]`
- **Labels/badges:** `text-[11px]` of `text-[12px]` `font-medium`
- **H2 secties:** `text-[24px] leading-[32px] font-semibold`
- **H3 cards:** `text-[20px] leading-[28px] font-semibold`
- **H4 klein:** `text-[18px] leading-[26px] font-semibold`

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

## Code Conventions

- **Interface taal:** Nederlands (labels, placeholders, toasts, foutmeldingen)
- **Code taal:** Engels (variabelen, functies, comments)
- **Geen `console.log`** in productie code
- **Build check:** `npm run build` moet slagen voor elke commit
- **Commit message stijl:** Korte imperatief ("Fix X", "Add Y", "Update Z")

## Key Files

| Bestand | Beschrijving |
|---------|-------------|
| `src/styles/globals.css` | Design tokens, CSS variables |
| `src/live-coaching-design-handoff/design-tokens.css` | Spacing, radius, typografie tokens |
| `src/components/ui/` | shadcn UI componenten (Badge, Button, Dialog, etc.) |
| `src/components/HH/` | Alle app-specifieke componenten |
| `server/hugo-engine/api.ts` | Express.js API routes |
| `server/hugo-engine/db.ts` | Database queries (Supabase/Neon) |
