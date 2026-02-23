# Dashboard Design Handoff Package

**HugoHerbots.ai - Home Tab (Dashboard)**

Dit package bevat alle design elementen voor de Dashboard/Home tab van de HugoHerbots.ai app.

## 📦 Inhoud

### Core Files
- `Dashboard.tsx` - Hoofd dashboard component met 4 grote blokken (2x2 grid)
- `AppLayout.tsx` - Sidebar + Topbar layout wrapper
- `EmptyState.tsx` - Empty state component voor nieuwe gebruikers
- `Logo.tsx` - HH brand logo component

### UI Components (dependencies)
- `Card.tsx` - Card component (shadcn/ui)
- `Button.tsx` - Button component (shadcn/ui)
- `Badge.tsx` - Badge component (shadcn/ui)

### Styling
- `dashboard-styles.css` - CSS snippets voor Dashboard (toevoegen aan globals.css)

## 🎨 Design System

### Colors (HH Tokens)
```css
--hh-text: #1C2535;      /* MIRAGE - Primary dark text */
--hh-ink: #2B3748;       /* INDIAN INK - Secondary dark */
--hh-primary: #6B7A92;   /* SLATE GRAY - Primary accent */
--hh-muted: #B1B2B5;     /* FRENCH GRAY - Muted text */
--hh-border: #E4E4E4;    /* PLATINUM - Borders */
--hh-bg: #FFFFFF;        /* WHITE - Backgrounds */
--hh-success: #00C389;   /* Success green */
--hh-warn: #FFB020;      /* Warning orange */
--hh-ui-50: #F9FAFB;     /* Light gray background */
--hh-ui-200: #E5E7EB;    /* Medium gray */
```

### Typography
- **H1**: 48px/56px (desktop), 32px/40px (mobile)
- **H2**: 32px/40px (desktop), 24px/32px (mobile)
- **H3**: 20px/28px
- **Body**: 16px/24px
- **Small**: 14px/20px
- **Tiny**: 12px/16px

### Spacing
- Desktop: p-8 (32px)
- Tablet: p-6 (24px)
- Mobile: p-4 (16px)
- Gap tussen blokken: 24px (desktop), 16px (mobile)

## 🏗️ Layout Structuur

### Dashboard Grid
```
[Streak Card - rechts uitgelijnd op desktop]

[2x2 Grid van 4 hoofdblokken:]
┌─────────────────────┬─────────────────────┐
│  Rollenspel         │  Video Cursus       │
│  Training           │                     │
├─────────────────────┼─────────────────────┤
│  Live Coaching      │  Jouw Vooruitgang   │
│                     │                     │
└─────────────────────┴─────────────────────┘

[Hugo's Tip Card - full width onderaan]
```

### 4 Hoofdblokken

**1. Rollenspel Training**
- Icon: Play (primary)
- Badge: "3 sessies" (success)
- Volgende scenario card met fase badge
- Progress bar (1/8 voltooid)
- CTA: "Start volgende sessie"

**2. Video Cursus**
- Icon: Video (warn)
- Badge: "45% compleet" (warn)
- Huidige video card met play button
- Progress bar (5/12 video's)
- CTA: "Ga verder met kijken"

**3. Live Coaching**
- Icon: Radio (destructive, pulse animation)
- Badge: "Eerstvolgende" (destructive)
- Sessie info met datum/tijd
- Upcoming count (2 sessies deze maand)
- CTA: "Herinnering instellen"

**4. Jouw Vooruitgang**
- Icon: BarChart3 (success)
- Badge: "+12% groei" (success)
- 2x2 stats grid (Gem. score, Sessies, Top techniek, Streak)
- CTA: "Bekijk alle statistieken"

### Streak Card (header rechts)
- Fire emoji in subtiele primary achtergrond (geen gradient!)
- 7 dagen streak met motiverende tekst
- Desktop: rechts uitgelijnd, Mobile: onder header

### Hugo's Tip Card
- HH avatar circle (primary)
- Coach badge
- Persoonlijk advies met highlight op technieken

## 🎯 Interactions

### Hover States
- Cards: `hover:shadow-hh-lg` (shadow groeit)
- Buttons: Border/text kleur veranderen naar accent kleur
- Arrow icons: `translate-x-1` (shift rechts)

### Responsive
- **Desktop (≥1024px)**: 2x2 grid, streak rechts
- **Tablet (768-1023px)**: 2x2 grid, streak onder header
- **Mobile (<768px)**: 1 kolom, stack van blokken

### Click Actions
- Rollenspel Training → navigate("roleplay")
- Video Cursus → navigate("videos")
- Live Coaching → navigate("live")
- Jouw Vooruitgang → navigate("analytics")

## 📊 Mock Data

### User
- Naam: "Jan"
- Streak: 7 dagen
- Gemiddelde score: 82 (+8%)
- Sessies deze week: 12 (+3)
- Top techniek: E.P.I.C

### Scenario
- Fase 2 • Ontdekkingsfase
- "SPIN Questioning bij SaaS Prospect"
- Duur: 15-20 min
- Niveau: Gemiddeld
- Voortgang: 1/8 voltooid (12.5%)

### Video
- Fase 2 • Ontdekkingsfase
- "Lock Questioning Techniek"
- Voortgang: 12:34 van 18:45
- Fase voortgang: 5/12 video's (42%)

### Live Session
- Datum: Woensdag 22 januari 2025
- Tijd: 14:00 - 15:00 uur (60 min)
- Topic: "Live Q&A: Discovery Technieken"
- Upcoming: 2 sessies deze maand

## 🚀 Installatie in Replit

1. Kopieer alle `.tsx` bestanden naar `/components/HH/`
2. Voeg `dashboard-styles.css` snippets toe aan `/styles/globals.css`
3. Zorg dat shadcn/ui components geïnstalleerd zijn:
   - `npx shadcn-ui@latest add card`
   - `npx shadcn-ui@latest add button`
   - `npx shadcn-ui@latest add badge`
4. Installeer lucide-react: `npm install lucide-react`
5. Import Dashboard in je main App:
   ```tsx
   import { Dashboard } from './components/HH/Dashboard';
   ```

## 🎨 Design Principes

- **Subtiel maar motiverend**: Geen schreeuwerige kleuren
- **Data-driven**: Concrete cijfers en vooruitgang
- **Action-oriented**: Elke sectie heeft duidelijke CTA
- **Hugo's aanwezigheid**: Persoonlijke tips onderaan
- **Clean grid**: 2x2 structuur volgt sidebar navigatie

## 📝 Notes

- Streak card gebruikt **subtiele primary kleur** (geen oranje/rode gradient!)
- Alle icons komen van `lucide-react`
- Empty state wordt getoond als `hasData={false}`
- AppLayout zorgt voor sidebar + topbar wrapper
- Responsive breakpoints: sm (640px), lg (1024px)

---

**Versie**: v1.0  
**Datum**: December 2024  
**Status**: Production Ready
