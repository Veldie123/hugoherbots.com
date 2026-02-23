# HugoHerbots.ai Design System Guidelines

## Project Overview
HugoHerbots.ai is een AI-salescoach platform voor B2B teams. Het platform gebruikt een avatar-gebaseerde AI coach om salesprofessionals te trainen via role-plays, gebaseerd op een methodologie van 4 fasen en 20 technieken.

**Brand Story**:
- Hugo Herbots = referentie in salestraining
- 40 jaar training; 20.000+ mensen getraind
- Laatste jaren exclusief voor een beperkt aantal bedrijven
- Live training = €2.000/halve dag voor kleine groep
- "In het laatste hoofdstuk van zijn leven" deelt hij nu zijn geheimen
- Kern van sales is 50 jaar onveranderd: **"People buy people"**
- Focus = menselijke psychologie en hoe je daarop inspeelt — nu beschikbaar als AI-coach

**Tone of Voice**:
- Eerlijk, direct, warm, persoonlijk (ik-vorm uit Hugo's perspectief waar logisch)
- Concreet, getalsmatig (noem 40 jaar, 20.000+, €2.000, etc.)
- Geen buzzwords ("synergie", "disruptie"), geen holle claims
- Zinnen kort-tot-middel, actief
- CTA's duidelijk en actiegericht

## Design Tokens (HH/) - Fresh & Energetic 2025 Redesign

### Brand Colors - Primary Palette
- **DEEP BLUE** (`#0F172A`): Primary dark/ink - hoofdtekst, dark elements (zachter dan pure zwart)
- **OCEAN BLUE** (`#0EA5E9`): Primary accent - CTA's, links, highlights (fresh sky blue)
- **INDIGO** (`#6366F1`): Secondary accent - modern indigo voor special CTAs
- **WHITE** (`#FFFFFF`): Pure white - backgrounds

### Neutral Scale - Slate Palette
- **SLATE 50** (`#F8FAFC`): Ultra light backgrounds
- **SLATE 100** (`#F1F5F9`): Light backgrounds, subtle fills
- **SLATE 200** (`#E2E8F0`): Borders, dividers, disabled states
- **SLATE 400** (`#94A3B8`): Muted text, secondary text
- **SLATE 500** (`#64748B`): Body text alternative
- **SLATE 600** (`#475569`): Strong body text

### Feedback Colors - Modern & Accessible
- **SUCCESS** (`#10B981`): Emerald green - positive feedback, success states
- **WARNING** (`#F59E0B`): Amber - warnings, attention items
- **ERROR** (`#EF4444`): Red - errors, destructive actions
- **INFO** (`#3B82F6`): Blue - informational messages

### Accent Colors - Special Highlights
- **TEAL** (`#14B8A6`): Special highlights, premium tier
- **PURPLE** (`#8B5CF6`): Premium features, advanced tools
- **CORAL** (`#FB7185`): Warm accents, emotional highlights

### Typography
**Fonts**: 
- **Primary**: Hypatia Sans Bold (voor titels, headings, buttons)
- **Secondary**: Hypatia Sans Light (voor body text, inputs, paragraphs)
- **Fallback**: Outfit (Google Fonts) - Replace met Hypatia Sans font files wanneer beschikbaar

**Scale**:
- **H1**: 48px/56px, Bold (700)
- **H2**: 32px/40px, Bold (700)
- **H3**: 24px/32px, Bold (700)
- **Body**: 16px/24px, Light (300)
- **Small**: 14px/20px, Light (300)
- **Mono**: 12px/16px, Medium (500) - voor codes/technische info

### Branding Assets
- **Logo Horizontal**: HUGO HERBOTS op één lijn - voor headers, navigation
- **Logo Vertical**: HUGO / HERBOTS gestapeld - voor hero sections, branding
- **Logo Icon**: HH handtekening - voor favicon, collapsed sidebar, small spaces
- **Component**: `<Logo variant="horizontal|vertical|icon" />`

### Effects
- **Elevations**: `.shadow-hh-sm`, `.shadow-hh-md`, `.shadow-hh-lg`
- **Focus**: 2px `#6B7A92` (SLATE GRAY) outline
- **Radius**: Default 16px voor cards/containers

### Grid System
- **Desktop**: 12 kolommen, 80px gap, 24px margin
- **Tablet**: 8 kolommen, 48px gap, 24px margin
- **Mobile**: 4 kolommen, 16px gap, 16px margin

## Component Library (HH/)

### Navigation
- **Sidebar**: Collapsible, active states, icons + labels
- **Topbar**: Search, notifications, user profile

### Data Display
- **KPITile**: Metric display met delta (up/down/neutral)
- **ProgressBar**: Skill/completion tracking (sm/md/lg sizes)
- **ListItem**: Titel, subtitle, meta, trailing content
- **TranscriptLine**: Coach vs You differentiation

### Feedback
- **HintPanel**: Technique coaching (do/don't/examples)
- **EmptyState**: Icon, title, body, CTAs
- **Toast**: Success/info/warn/error notifications

### Pricing
- **PricingTier**: Name, price, features, CTA, highlighted variant
- **Billing toggle**: Monthly/Yearly switch

### Scenario Builder
- **Nodes**: Question, CustomerReply, Branch, ScoreRule, End
- **Canvas**: Drag-and-drop, zoom, grid snap
- **Properties panel**: Condities, technieken, score rules

### Role-Play Components
- **ScenarioFlowTracker**: Visuele flow/boom structuur met fases en stappen
  - Fase indicators met status (completed/current/upcoming/locked)
  - Step indicators met dots en status kleuren
  - Highlight van huidige stap met accent border en background
  - Overall progress bar met completion percentage
  - Responsive: Permanent sidebar (desktop), drawer/sheet (mobile)

## Pages Structure

### Marketing (Public)
1. **Login** (`/components/HH/Login.tsx`)
   - Split layout: Form links / Brand message rechts
   - Form: Email + wachtwoord velden met icons
   - "Wachtwoord vergeten?" link
   - Password visibility toggle
   - Social login: Google, Microsoft
   - "Nog geen account? Start gratis met Hugo" link
   - Brand side: Logo vertical, 40 jaar pitch, 3 stats, testimonial card

2. **Signup** (`/components/HH/Signup.tsx`)
   - Split layout: Brand message links / Form rechts
   - Form: Voornaam, achternaam, email, bedrijf (opt), wachtwoord
   - Password visibility toggle
   - Terms & privacy checkbox (required)
   - Social signup: Google, Microsoft
   - "Al een account? Log in" link
   - Trust badges: 14 dagen gratis, geen creditcard, altijd opzegbaar
   - Brand side: Benefits (4 items), pricing comparison (€2.000 vs €149)

3. **Landing** (`/components/HH/Landing.tsx`)
   - **Sticky Header**: Fixed header, uitgelijnd met hero content (max-w-7xl, px-4 sm:px-6 lg:px-8)
   - **Hero Section**: min-h-[92vh] full-screen impact, 2-column grid (content left, video right)
     - Typography: H1 64px, subhead 32px, body 18px — grote, imposante sizes
     - Video: 16:9 aspect ratio, HeyGen embed, rounded-2xl met shadow
     - CTAs: Large buttons (h-14, text-18px) met gap-4
     - **Below the fold**: "Zo werkt het" sectie komt pas na scroll
   - Value propositions (ProductShowcase component)
   - Social proof testimonials
   - Pricing teaser (3 tiers)
   - FAQ section
   - Footer CTA (large, impactful) + navigation

4. **About** (`/components/HH/About.tsx`)
   - Hero: Hugo's verhaal + brand story
   - Stats: 40 jaar, 20.000+ mensen, €2.000 live
   - Philosophy: People buy people
   - Methodology: 4 fasen, 20 technieken
   - Recognition & impact
   - CTA section

5. **Pricing** (`/components/HH/Pricing.tsx`)
   - Billing toggle (monthly/yearly)
   - 3 tiers: Starter, Pro, Team
   - Feature comparison table
   - Trust badges (GDPR, SSL, Setup)
   - FAQ section
   - CTA card

### Flows & User Journey
**Authentication Flow:**
- **Landing CTA "Start gratis met Hugo"** → **App Preview** (interactive demo)
- **App Preview** → After 60 sec: Signup modal → **Signup** → **Onboarding** (3 steps) → **Dashboard**
- **Login** → **Dashboard** (direct, skip onboarding)

**App Preview Strategy:**
- Alle marketing CTAs ("Start gratis met Hugo") → navigate naar **preview** (niet direct signup)
- Preview = interactieve demo van volledige app (Dashboard, RolePlay, Library, etc.)
- **Sticky banner**: "Preview mode - Start gratis om je voortgang op te slaan"
- **Timer-based modals**:
  - Na 60 seconden: Eerste signup prompt
  - Na 3 minuten totaal: Reminder modal (als eerste gesloten werd)
- Modal kan gesloten worden → gebruiker kan verder verkennen
- Modal CTA: "Start gratis met Hugo" → navigate("signup")
- **Navigatie**: "Probeer de app" menu item in StickyHeader → direct naar preview

6. **App Preview** (`/components/HH/AppPreview.tsx`)
   - **Toegankelijk via**: Alle "Start gratis met Hugo" CTAs, "Probeer de app" menu
   - Interactieve demo van volledige app zonder account
   - Sticky banner: "Preview mode" badge + "Start gratis" CTA
   - Interne navigatie: Dashboard, RolePlay, Library, Builder, Videos, etc.
   - **Timer logic**: 60s → eerste modal, 3min → reminder modal
   - Modal: SignupModal component met 14 dagen gratis pitch
   - Alle data is sample data (read-only demo mode)

7. **SignupModal** (`/components/HH/SignupModal.tsx`)
   - Dialog overlay triggered vanuit AppPreview
   - Two variants: "first" (na 60s), "reminder" (na 3min)
   - Benefits: 14 dagen gratis, geen creditcard, alle features
   - CTA: "Start gratis met Hugo" → navigate("signup")
   - Kan gesloten worden → gebruiker blijft in preview

8. **Onboarding** (`/components/HH/Onboarding.tsx`)
   - **Alleen getoond na signup** (nieuw account)
   - Step 1: Goal selection (discovery/objections/closing/custom)
   - Step 2: Context (sector, pitch, ICP, bezwaren)
   - Step 3: Confirmation summary + mic permission
   - Progress bar (3 steps) + skip option
   - CTA: Start met Hugo → navigeert naar Dashboard

### App (Authenticated)
9. **Dashboard** (`/components/HH/Dashboard.tsx`)
   - Header: Welkom + week summary
   - 4 KPI tiles: Sessies, Score, Top techniek, Focus
   - Continue card: Resume sessie met progress
   - Recent feedback list (3 items)
   - Skills progress bars (4 vaardigheden)
   - Coach tip card van Hugo
   - Quick actions (3 cards)

10. **Role-Play** (`/components/HH/RolePlay.tsx`)
   - **Scenario Flow Tracker** (links): Permanente sidebar (desktop) / drawer (mobile) met volledige boomstructuur
     - Toont alle fases (Voorbereiding, Ontdekking, Kwalificatie, Voorstel, Afsluiting)
     - Elke fase heeft sub-stappen met status indicators
     - Huidige stap dynamisch gehighlight met accent kleur en pulse effect
     - Progress tracking: completed (✓), current (●), upcoming (○), locked (🔒)
     - Overall progress bar met percentage onderaan
     - Toggle button in status bar voor mobile visibility
   - Status bar: Timer, fase badges, mic status, flow tracker toggle
   - Video/avatar area (center) met states (idle/recording/completed)
   - Tip sidebar (rechts): Real-time tips panel met do's/don'ts
   - Bottom collapsible: Technique details (do's/don'ts/examples)
   - Post-session results modal: Overall score, sub-scores, highlights, Hugo's advies

11. **Library** (`/components/HH/Library.tsx`)
   - Search + filters (category, level)
   - Featured scenarios door Hugo
   - Scenario grid met cards
   - Card info: Title, description, techniques, stats, level
   - CTA: "Maak custom scenario" → navigeert naar ScenarioBuilder
   - Empty state: Reset filters + "Maak custom scenario"
   - Click scenario card → Start roleplay sessie

12. **Scenario Builder** (`/components/HH/ScenarioBuilder.tsx`)
   - **Toegankelijk via**: Library ("Maak custom scenario" button), Dashboard empty state
   - Left panel: Templates, persona, context, assets
   - Center canvas: Drag-drop nodes, connectors, zoom, grid
   - Right panel: Node properties, technieken, conditions
   - Toolbar: Zoom controls, validate, preview, publish
   - Node types: Question, CustomerReply, Branch, ScoreRule, End
   - Save & publish functionaliteit om scenario's toe te voegen aan bibliotheek

13. **Team Sessions** (`/components/HH/TeamSessions.tsx`)
   - Header: Team overview met totaal sessies deze week
   - 4 KPI tiles: Totaal sessies, Gemiddelde score, Actieve leden, Top performer
   - Search + filters: Naam, status (active/inactive/new), periode
   - Team table: Avatar, naam, rol, sessies, score met delta, top techniek, laatste sessie, status
   - Hugo's team tip: Persoonlijk advies gebaseerd op team performance

14. **Video Library** (`/components/HH/VideoLibrary.tsx`)
   - **Fase-gebaseerde video cursus** met 5 fases (-1, 1, 2, 3, 4)
   - Phase tabs: Voorbereiding, Openingsfase, Ontdekkingsfase, Aanbevelingsfase, Beslissingsfase
   - Video lijst per fase: Technieken met duur, completion status, locked state
   - Video player: Embedded video met controls, transcript, key takeaways
   - Progress tracking: Per fase en overall completion percentage
   - CTA naar roleplay: "Oefen deze techniek" button

15. **Live Coaching** (`/components/HH/LiveCoaching.tsx`)
   - **Weekly livestream** met Hugo (elke woensdag 14:00-15:00)
   - Live badge + viewer count tijdens actieve sessie
   - Video stream: Embedded livestream player (16:9 aspect ratio)
   - Chat panel: Real-time chat met Hugo (host badge), timestamps
   - Poll panel: Live polls met stemmen, percentage visualisatie
   - Session info: Datum, tijd, topic, niveau, duur
   - Upcoming sessions: Grid met aankomende sessies, reminder button
   - Past sessions: Recordings van vorige sessies met "Bekijk opname" CTA

16. **Analytics** (`/components/HH/Analytics.tsx`)
   - Header: Periode selector (week/maand/kwartaal/jaar) + export
   - 4 Performance tiles: Overall score, Sessies voltooid, Completion rate, Gemiddelde tijd
   - Skills breakdown: 6 technieken met score, sessies, trend (up/down)
   - Scenario performance: 4 scenarios met attempts, avg score, best score
   - Weekly activity: 4 weken met sessies en avg score
   - Hugo's analyse: Persoonlijk advies gebaseerd op data patterns

17. **Settings** (`/components/HH/Settings.tsx`)
    - Profile section: Avatar upload, naam, email, functie, bedrijf, bio
    - Notifications: Email toggles voor updates, weekly summary, nieuwe scenarios, team, marketing
    - Training preferences: Moeilijkheidsgraad, primaire focus, sessie lengte, real-time feedback, auto-play
    - Subscription: Current plan (Pro €149/mnd), volgende betaling, wijzig plan, betalingsmethode, facturen
    - Danger zone: Wis data, deactiveer account, verwijder account
    - Logout button



## Key Microcopy (Hugo Herbots branded)

### Headlines
- "40 jaar salesgeheimen, nu jouw dagelijkse coach."
- "Train elke dag. Win elke week. Met Hugo."
- "De waarde van 40 jaar training, voor een fractie van live"
- "People buy people — en de psychologie leer je hier."

### CTAs
- "Start gratis met Hugo"
- "Bekijk demo met Hugo"
- "Probeer 14 dagen gratis"
- "Plan een gesprek"
- "Begin role-play"
- "Herhaal met focus"
- "Deel met manager"

### Hero copy elementen
- "40 jaar training"
- "20.000+ mensen getraind"
- "€2.000 per halve dag voor live training"
- "4 fasen • 20 technieken • People buy people"

### Empty States
- "Nog geen sessies — start je eerste role-play en krijg binnen 2 min feedback."

### Errors
- "Microfoon geblokkeerd — geef toegang in je browserinstellingen."

### Navigation
- "Over Hugo" (niet "Over ons")
- "Bekijk demo met Hugo" (niet alleen "Demo")

## Interactivity & States

### Role-Play States
- **Idle**: Wachten op start
- **Recording**: Actieve sessie, mic indicator, flow tracker toont huidige stap
- **Completed**: Toon resultaten modal

### Scenario Flow States
- **Completed**: Groene vinkje, stap is afgerond
- **Current**: Accent border + background, pulse indicator, tijdsduur zichtbaar
- **Upcoming**: Grijze dot, normale tekst
- **Locked**: Lock icon, faded tekst, niet toegankelijk

### Onboarding States
- **Progress**: 3-step progress bar
- **Mic Permission**: pending/granted/denied states
- **Validation**: Error highlights op onvolledige velden

### Scenario Builder
- **Node Selection**: Highlight selected node
- **Validation**: Show errors in alert
- **Canvas**: Zoom (50-200%), snap to grid toggle

## A11y Requirements
- Focus rings op alle interactive elements (`.focus-hh`)
- AA contrast ratio (text vs backgrounds)
- Logische tab volgorde
- Labels op alle form inputs
- Esc sluit modals/drawers
- Keyboard shortcuts voor canvas (toekomstig)

## Mock Data Patterns

### User Names
- Jan de Vries, Sarah van Dijk, Mark Peters, Lisa de Jong

### Company Names
- Acme Inc, TechCorp, SalesForce, TechStart, ScaleUp BV, GrowCo

### EPIC Technieken (25 total, 4 fasen + algemeen)
**Bron data:** `/data/epicTechniques.ts` - Complete EPIC sales flow catalogus

**Fase 1 - Voorbereiding (4 technieken):**
- 1.1: Koopklimaat creëren
- 1.2: Gentleman's agreement
- 1.3: Firmavoorstelling + reference story
- 1.4: Instapvraag

**Algemeen (1 techniek):**
- A1: Antwoord op de vraag (van toepassing in alle fasen)

**Fase 2 - Ontdekking (8 technieken):**
- 2.1.1: Feitgerichte vragen
- 2.1.2: Meningsgerichte vragen (open vragen)
- 2.1.3: Feitgerichte vragen onder alternatieve vorm
- 2.1.4: Ter zijde schuiven
- 2.1.5: Pingpong techniek
- 2.1.6: Actief en empathisch luisteren
- 2.1.7: LEAD questioning (storytelling)
- 2.1.8: Lock questioning

**Fase 3 - Voorstel (5 technieken):**
- 3.1: Empathie tonen
- 3.2: Oplossing
- 3.3: Voordeel
- 3.4: Baat
- 3.5: Mening vragen / standpunt onder alternatieve vorm

**Fase 4 - Afsluiting (7 technieken):**
- 4.1: Proefafsluiting
- 4.2.1: Klant stelt vragen
- 4.2.2: Twijfels
- 4.2.3: Poging tot uitstel
- 4.2.4: Bezwaren
- 4.2.5: Angst / Bezorgdheden

**Helper functies beschikbaar:**
- `getTechniquesByPhase(phase)` - Alle technieken van een fase
- `getTechniqueByDetectorId(id)` - Vind techniek via detector ID
- `getTechniqueByNumber(number)` - Vind techniek via nummer
- `getPhaseLabel(phase)` - Readable label voor fase
- `EPIC_STATS` - Statistieken (totaal aantal per fase)

### Score Ranges
- **80-100%**: Excellent (green/success)
- **60-79%**: Good (yellow/warn)
- **0-59%**: Needs improvement (red/destructive)

## File Structure
```
/components/HH/
  ├── AppLayout.tsx         # Sidebar + Topbar wrapper
  ├── Logo.tsx              # Brand logo component (horizontal/vertical/icon)
  ├── KPITile.tsx           # Metric display tile
  ├── ProgressBar.tsx       # Skill progress component
  ├── ListItem.tsx          # List row component
  ├── TranscriptLine.tsx    # Role-play transcript line
  ├── HintPanel.tsx         # Technique coaching panel
  ├── PricingTier.tsx       # Pricing card component
  ├── EmptyState.tsx        # Empty state component
  ├── AppFooter.tsx         # App footer with links
  ├── StreakCard.tsx        # Training streak card
  ├── Login.tsx             # Marketing: Login page
  ├── Signup.tsx            # Marketing: Signup page (Start gratis)
  ├── Landing.tsx           # Marketing: Landing page
  ├── About.tsx             # Marketing: Over Hugo page
  ├── Pricing.tsx           # Marketing: Pricing page
  ├── AppPreview.tsx        # Preview: Interactive app demo (no account)
  ├── SignupModal.tsx       # Preview: Timer-based signup modal
  ├── Onboarding.tsx        # Flow: Onboarding wizard (after signup)
  ├── Dashboard.tsx         # App: Dashboard home
  ├── RolePlay.tsx          # App: Role-play session
  ├── ScenarioFlowTracker.tsx # App: Scenario flow/boom visualisatie component
  ├─ Library.tsx           # App: Scenario library
  ├── ScenarioBuilder.tsx   # App: Scenario builder
  ├── MySessions.tsx        # App: User's training sessions
  ├── VideoLibrary.tsx      # App: Fase-based video cursus
  ├── LiveCoaching.tsx      # App: Weekly livestream with chat & polls
  ├── TeamSessions.tsx      # App: Team training sessions
  ├── Analytics.tsx         # App: Analytics & progress
  └── Settings.tsx          # App: Settings & account
```

## Future Enhancements
- Dark mode toggle (tokens already defined)
- Team comparison/leaderboards
- Video playback voor sessions
- Advanced analytics charts
- Scenario library/marketplace
- Integration met CRM's (Salesforce, HubSpot)
- Mobile app versie