# HugoHerbots.ai - Complete Design Brief

**Versie:** 1.0  
**Datum:** 18 december 2024  
**Voor:** Replit Development Team  
**Platform:** AI Sales Coach voor B2B Teams

---

## 1. Project Overview

### Wat is HugoHerbots.ai?
HugoHerbots.ai is een AI-salescoach platform met avatar voor B2B sales training. Het platform gebruikt een pratende AI-avatar (HeyGen) om salesprofessionals te trainen via role-plays, gebaseerd op de methodologie van Hugo Herbots: 4 fasen en 25 technieken.

### Brand Story
- **Hugo Herbots** = referentie in salestraining in Nederland/België
- **40 jaar ervaring**, 20.000+ mensen getraind
- Live training kost **€2.000 per halve dag** voor kleine groep
- Nu beschikbaar als **AI-coach voor €149/maand**
- Kernfilosofie: **"People buy people"** - focus op menselijke psychologie

### EPIC Sales Flow Methodologie
Het platform is gebouwd rondom de **EPIC sales flow** met **25 technieken** verdeeld over **4 fasen + algemeen**:

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

**Data Locatie:** `/data/epicTechniques.ts` - Complete catalogus met AI evaluation points per techniek

---

## 2. Design System

### 2.1 Color Palette

#### Primary Colors
```css
--hh-deep-blue: #0F172A;    /* Primary dark/ink - hoofdtekst */
--hh-ocean-blue: #0EA5E9;   /* Primary accent - CTA's, links */
--hh-indigo: #6366F1;        /* Secondary accent - special CTAs */
--hh-white: #FFFFFF;         /* Pure white backgrounds */
```

#### Neutral Scale (Slate)
```css
--hh-slate-50: #F8FAFC;      /* Ultra light backgrounds */
--hh-slate-100: #F1F5F9;     /* Light backgrounds, subtle fills */
--hh-slate-200: #E2E8F0;     /* Borders, dividers, disabled states */
--hh-slate-400: #94A3B8;     /* Muted text, secondary text */
--hh-slate-500: #64748B;     /* Body text alternative */
--hh-slate-600: #475569;     /* Strong body text */
```

#### Feedback Colors
```css
--hh-success: #10B981;       /* Emerald green - positive feedback */
--hh-warning: #F59E0B;       /* Amber - warnings */
--hh-error: #EF4444;         /* Red - errors, destructive actions */
--hh-info: #3B82F6;          /* Blue - informational messages */
```

#### Accent Colors
```css
--hh-teal: #14B8A6;          /* Special highlights, premium tier */
--hh-purple: #8B5CF6;        /* Premium features */
--hh-coral: #FB7185;         /* Warm accents, emotional highlights */
```

### 2.2 Typography

**Font Family:**
- Primary: **Hypatia Sans Bold** (headings, buttons)
- Secondary: **Hypatia Sans Light** (body text, inputs)
- Fallback: **Outfit** (Google Fonts)

**Type Scale:**
```
H1: 48px/56px, Bold (700)
H2: 32px/40px, Bold (700)
H3: 24px/32px, Bold (700)
Body: 16px/24px, Light (300)
Small: 14px/20px, Light (300)
Mono: 12px/16px, Medium (500) - voor codes/technische info
```

### 2.3 Spacing & Layout

**Grid System:**
- Desktop: 12 kolommen, 80px gap, 24px margin
- Tablet: 8 kolommen, 48px gap, 24px margin
- Mobile: 4 kolommen, 16px gap, 16px margin

**Border Radius:**
- Default cards/containers: 16px
- Small elements: 12px
- Buttons: 8px

**Shadows:**
- Small: `0 1px 2px rgba(0,0,0,0.05)`
- Medium: `0 4px 6px rgba(0,0,0,0.07)`
- Large: `0 10px 15px rgba(0,0,0,0.1)`

---

## 3. Site Structure & User Flows

### 3.1 Marketing Pages (Public)

#### A. Landing Page (`/`)
**Layout:**
- Sticky header met logo + navigatie (Over Hugo, Pricing, Login, Start gratis)
- Hero section: 
  - Min-h-[92vh] full-screen impact
  - 2-column grid: content links, video rechts
  - Video: 16:9 aspect ratio, HeyGen embed, rounded-2xl
  - Typography: H1 64px, subhead 32px, body 18px
  - CTAs: Large buttons (h-14, text-18px)
  - Below the fold: "Zo werkt het" sectie komt pas na scroll
- Value propositions (ProductShowcase component)
- Social proof testimonials
- Pricing teaser (3 tiers)
- FAQ section
- Footer CTA + navigation

**Key Copy:**
- "40 jaar salesgeheimen, nu jouw dagelijkse coach."
- "Train elke dag. Win elke week. Met Hugo."
- "4 fasen • 20 technieken • People buy people"

**Primary CTA:** "Start gratis met Hugo" → App Preview

#### B. Pricing Page (`/pricing`)
**Layout:**
- Billing toggle: Monthly/Yearly (save 20%)
- 3 pricing tiers:
  - **Starter** (€49/mnd): Basis role-plays, 10 sessies/mnd
  - **Pro** (€149/mnd): Onbeperkt, alle features, analytics
  - **Team** (€399/mnd): Team dashboard, admin panel, white-label
- Feature comparison table
- Trust badges (GDPR, SSL, 14 dagen gratis)
- FAQ section
- CTA card: "Start gratis met Hugo"

#### C. Over Hugo (`/about`)
**Layout:**
- Hero: Hugo's verhaal + brand story
- Stats section: 40 jaar, 20.000+ mensen, €2.000 live training
- Philosophy: "People buy people" - psychologie
- Methodology: 4 fasen overzicht
- Recognition & impact
- CTA section

#### D. Login Page (`/login`)
**Layout:**
- Split layout: Form links / Brand message rechts
- Form:
  - Email + wachtwoord velden met icons
  - "Wachtwoord vergeten?" link
  - Password visibility toggle
  - Social login: Google, Microsoft
  - "Nog geen account? Start gratis met Hugo" link
- Brand side:
  - Logo vertical
  - 40 jaar pitch
  - 3 stats
  - Testimonial card

**Flow:** Login → Dashboard (direct, skip onboarding)

#### E. Signup Page (`/signup`)
**Layout:**
- Split layout: Brand message links / Form rechts
- Form:
  - Voornaam, achternaam, email, bedrijf (optioneel), wachtwoord
  - Password visibility toggle
  - Terms & privacy checkbox (required)
  - Social signup: Google, Microsoft
  - "Al een account? Log in" link
- Trust badges:
  - 14 dagen gratis
  - Geen creditcard
  - Altijd opzegbaar
- Brand side:
  - 4 benefits
  - Pricing comparison (€2.000 vs €149)

**Flow:** Signup → Onboarding (3 steps) → Dashboard

---

### 3.2 Preview/Demo Flow

#### App Preview (`/preview`)
**Doel:** Interactieve demo van volledige app zonder account

**Layout:**
- Sticky banner: "Preview mode - Start gratis om je voortgang op te slaan"
- Volledige app navigatie: Dashboard, Digital Coaching, Live Coaching, Gesprek Analyse, Team, Analytics, Settings
- Alle data = sample data (read-only demo)

**Timer Logic:**
```
- Na 60 seconden: Eerste signup prompt (SignupModal)
- Na 3 minuten totaal: Reminder modal (als eerste gesloten werd)
- Modal kan gesloten worden → gebruiker kan verder verkennen
```

**SignupModal Content:**
- Variant "first" (na 60s): "Probeer Hugo 14 dagen gratis"
- Variant "reminder" (na 3min): "Nog maar 1 stap van jouw persoonlijke sales coach"
- Benefits:
  - 14 dagen gratis
  - Geen creditcard nodig
  - Alle features beschikbaar
- CTA: "Start gratis met Hugo" → navigate("/signup")
- Close button → blijf in preview

**Toegang:**
- Alle "Start gratis met Hugo" CTAs op marketing pages
- "Probeer de app" menu item in header

---

### 3.3 Onboarding Flow

#### Onboarding (`/onboarding`)
**Wanneer:** Alleen na signup (nieuw account)

**3 Steps:**

**Step 1: Goal Selection**
- Keuze uit 4 doelen:
  - Discovery - Ontdek klantbehoeften
  - Objections - Bezwaren omzetten
  - Closing - Deals sluiten
  - Custom - Eigen scenario

**Step 2: Context**
- Sector (dropdown)
- Pitch/product (textarea)
- ICP - Ideal Customer Profile (textarea)
- Bezwaren/uitdagingen (textarea)

**Step 3: Confirmation**
- Summary van keuzes
- Microfoon permission request
- "Start met Hugo" CTA → Dashboard

**Features:**
- Progress bar (3 steps)
- Skip option (ga direct naar Dashboard)
- Validation: error highlights op onvolledige velden

---

### 3.4 App Pages (Authenticated)

#### A. Dashboard (`/dashboard`)
**Layout:**
- Header: "Welkom terug, [Naam]" + week summary
- 4 KPI tiles (grid 2x2):
  - Sessies deze week (aantal + delta)
  - Gemiddelde score (percentage + trend icon)
  - Top techniek (naam + aantal keer gebruikt)
  - Focus deze week (aanbeveling)
- Continue card: Resume laatste sessie met progress
- Recent feedback list (3 items):
  - Techniek naam
  - Feedback snippet
  - Datum
  - "Bekijk volledig" link
- Skills progress bars (4 vaardigheden):
  - Discovery (progress bar + percentage)
  - Qualification
  - Proposal
  - Closing
- Coach tip card: Hugo's persoonlijke advies
- Quick actions (3 cards):
  - Start nieuwe role-play
  - Bekijk video library
  - Team sessies

**Navigation:** Sidebar met 7 menu items
- Dashboard (home icon)
- Digital Coaching (mic icon)
- Live Coaching (video icon)
- Gesprek Analyse (bar-chart icon)
- Team (users icon)
- Analytics (trending-up icon)
- Settings (settings icon)

#### B. Digital Coaching (`/roleplay`)
**Doel:** Avatar-based AI role-play sessies

**Layout:**

**Scenario Selection Phase:**
- Search bar + filters (fase, niveau, techniek)
- Featured scenarios door Hugo (carousel)
- Scenario grid met cards:
  - Title, description
  - Technieken (badges)
  - Stats (gemiddelde score, attempts)
  - Niveau (beginner/intermediate/advanced)
  - "Start sessie" CTA
- "Maak custom scenario" button → ScenarioBuilder
- Empty state: Reset filters + "Maak custom scenario"

**Active Session Phase:**
- Scenario Flow Tracker (links):
  - Desktop: Permanente sidebar met volledige boomstructuur
  - Mobile: Drawer/sheet met toggle button
  - Toont alle fases met sub-stappen
  - Status indicators: completed (✓), current (●), upcoming (○), locked (🔒)
  - Overall progress bar onderaan
- Status bar (top):
  - Timer
  - Fase badges
  - Mic status indicator
  - Flow tracker toggle (mobile)
- Video/avatar area (center):
  - States: idle / recording / completed
  - HeyGen avatar embed (16:9 aspect ratio)
- Tip sidebar (rechts):
  - Real-time tips panel
  - Do's/don'ts voor huidige techniek
- Bottom collapsible:
  - Technique details
  - Do's/don'ts/examples

**Post-Session:**
- Results modal:
  - Overall score (large, centered)
  - Sub-scores per techniek
  - Highlights (wat ging goed)
  - Hugo's advies (wat te verbeteren)
  - CTAs: Herhaal, Nieuwe sessie, Bekijk transcript

#### C. Live Coaching (`/live-coaching`)
**Doel:** Weekly livestream met Hugo + community

**Layout:**
- Live badge + viewer count (tijdens actieve sessie)
- Video stream: Embedded livestream player (16:9)
- Chat panel (rechts):
  - Real-time chat met Hugo
  - Host badge voor Hugo
  - Timestamps
  - User avatars
- Poll panel:
  - Live polls tijdens sessie
  - Stemmen + percentage visualisatie
  - Results in real-time
- Session info card:
  - Datum, tijd
  - Topic: "Bezwaren omzetten in kansen"
  - Niveau: Intermediate
  - Duur: 60 min
- Upcoming sessions grid:
  - Aankomende 4 sessies
  - Datum + topic
  - "Reminder instellen" button
- Past sessions:
  - Recordings van vorige sessies
  - Thumbnail, title, datum
  - "Bekijk opname" CTA

**States:**
- Live (rood badge, viewer count, chat actief)
- Upcoming (countdown, reminder button)
- Past (recording beschikbaar)

#### D. Gesprek Analyse (`/analysis`) - COMING SOON
**Doel:** Upload echte klantgesprekken voor EPIC analyse

**Layout:**

**2 Main Actions (side by side grid):**

**1. Upload Rollenspel:**
- Drag & drop zone (audio/video)
- Supported formats: MP3, WAV, M4A, MP4, MOV (max 500MB)
- Context form:
  - Titel gesprek (required)
  - Context (optioneel maar aanbevolen)
- "Start analyse" CTA

**2. Live Analyse:**
- Real-time coaching tijdens gesprekken
- Status: "Klaar om te starten" / "Live aan het luisteren"
- "Start live coaching" button
- Features tijdens sessie:
  - Live transcript (jij vs klant)
  - Real-time tips van Hugo (categorieën: wedervraag, lock, waarschuwing, open vraag, positief)
  - Status bar met timer
  - Quick action test buttons

**Privacy Notice (onder beide kaarten):**
- Alert: Privacy & toestemming
- Tekst: "Upload alleen gesprekken waarvoor je toestemming hebt..."
- Link naar privacy beleid

**Jouw Analyses (library):**
- List van geüploade analyses
- Card per analyse:
  - Title
  - Metadata: datum, duur, type (audio/video)
  - Status: processing / completed / failed
  - Results (if completed):
    - Score + trend (up/down)
    - Top techniek
    - Fase badge
  - Actions:
    - Bekijk (completed)
    - Opnieuw (failed)
    - Delete
- States:
  - Processing: Spinner + "Analyseren..."
  - Completed: Groene vinkje + results
  - Failed: Error icon + "Opnieuw proberen"

#### E. Team (`/team`)
**Doel:** Team performance overview (alleen voor Team plan)

**Layout:**
- Header: Team overview met totaal sessies deze week
- 4 KPI tiles:
  - Totaal sessies
  - Gemiddelde score
  - Actieve leden
  - Top performer
- Search + filters:
  - Naam search
  - Status dropdown (active/inactive/new)
  - Periode selector
- Team table:
  - Kolommen: Avatar, Naam, Rol, Sessies, Score (+ delta), Top techniek, Laatste sessie, Status
  - Sortable columns
  - Row actions: View details, Settings
- Hugo's team tip:
  - Persoonlijk advies gebaseerd op team performance
  - "Dit team doet het goed bij discovery, maar kan beter in closing"

#### F. Analytics (`/analytics`)
**Doel:** Persoonlijke training analytics

**Layout:**
- Header: Periode selector (week/maand/kwartaal/jaar) + export button
- 4 Performance tiles:
  - Overall score (percentage + trend)
  - Sessies voltooid (aantal + delta)
  - Completion rate (percentage)
  - Gemiddelde tijd per sessie
- Skills breakdown (6 technieken):
  - Techniek naam
  - Score (0-100%)
  - Aantal sessies
  - Trend (up/down icon)
- Scenario performance (4 scenarios):
  - Scenario naam
  - Attempts (aantal keer gedaan)
  - Avg score
  - Best score
- Weekly activity (4 weken):
  - Week nummer
  - Aantal sessies
  - Avg score
  - Visualisatie (mini bar chart)
- Hugo's analyse:
  - Persoonlijk advies gebaseerd op data patterns
  - "Je scoort consistent goed op discovery, maar ik zie dat closing nog uitdaging is. Probeer scenario X."

#### G. Settings (`/settings`)
**Sections:**

**1. Profile:**
- Avatar upload (drag & drop)
- Naam, email, functie, bedrijf, bio
- "Opslaan" button

**2. Notifications:**
- Email toggles:
  - Platform updates
  - Weekly summary
  - Nieuwe scenarios
  - Team activiteit
  - Marketing emails

**3. Training Preferences:**
- Moeilijkheidsgraad (dropdown: beginner/intermediate/advanced)
- Primaire focus (dropdown: discovery/qualification/proposal/closing)
- Sessie lengte (dropdown: 5 min/10 min/15 min)
- Real-time feedback (toggle)
- Auto-play volgende stap (toggle)

**4. Subscription:**
- Current plan card:
  - Plan naam (Pro)
  - Prijs (€149/mnd)
  - Volgende betaling datum
  - "Wijzig plan" button
- Betalingsmethode:
  - Creditcard ****1234
  - "Wijzig" button
- Facturen:
  - Lijst van facturen (datum, bedrag, status)
  - Download links

**5. Danger Zone:**
- Wis training data (button)
- Deactiveer account (button)
- Verwijder account (button + confirmation)

**Logout:**
- Logout button onderaan sidebar

---

## 4. Component Library

### 4.1 Navigation Components

**Sidebar:**
- Collapsible (desktop: expanded/collapsed, mobile: drawer)
- Logo (horizontal in collapsed, vertical in expanded)
- Menu items met icons + labels
- Active state: accent border + background
- User profile section onderaan
- Logout button

**Topbar:**
- Search bar (global search)
- Notifications icon + badge
- User avatar + dropdown
  - Profile
  - Settings
  - Logout

### 4.2 Data Display

**KPITile:**
- Metric value (large, bold)
- Metric label (small, muted)
- Delta indicator:
  - Up (green arrow + percentage)
  - Down (red arrow + percentage)
  - Neutral (minus icon)
- Optional icon (top-right)

**ProgressBar:**
- Label + percentage
- Bar fill (0-100%)
- Color variants: primary, success, warning
- Sizes: sm (h-2), md (h-3), lg (h-4)

**ListItem:**
- Title (bold)
- Subtitle (muted)
- Meta info (date, category)
- Trailing content (badge, button, icon)
- Hover state

**TranscriptLine:**
- Speaker differentiation:
  - Coach: Primary color accent
  - You: Default text color
- Timestamp (small, muted)
- Text content

### 4.3 Feedback Components

**HintPanel:**
- Technique coaching panel
- Sections:
  - Do's (green checkmarks)
  - Don'ts (red X marks)
  - Examples (quote blocks)
- Collapsible on mobile

**EmptyState:**
- Icon (large, centered, muted)
- Title (bold)
- Body text (muted)
- Primary CTA
- Secondary CTA (optional)

**Toast:**
- Variants: success, info, warning, error
- Auto-dismiss (3s default)
- Icon + message
- Optional action button

### 4.4 Pricing Components

**PricingTier:**
- Plan name
- Price (large, bold)
  - Monthly/Yearly toggle
  - Save badge (yearly)
- Features list (checkmarks)
- CTA button
- Highlighted variant (most popular, scale + shadow)

**BillingToggle:**
- Monthly / Yearly switch
- Save percentage badge

### 4.5 Role-Play Components

**ScenarioFlowTracker:**
- Fase indicators met status
- Step indicators (dots) met status kleuren
- Completed: groene vinkje
- Current: accent border + background + pulse
- Upcoming: grijze dot
- Locked: lock icon + faded
- Overall progress bar onderaan
- Responsive:
  - Desktop: Permanent sidebar
  - Mobile: Drawer/sheet met toggle button

---

## 5. User Journeys

### 5.1 New User Journey (Happy Path)

```
1. Landing page
   ↓ (CTA: "Start gratis met Hugo")
2. App Preview
   ↓ (Explore app, after 60s: SignupModal)
3. Signup
   ↓
4. Onboarding (3 steps)
   ↓
5. Dashboard
   ↓ (CTA: "Start nieuwe role-play")
6. Digital Coaching - Scenario Selection
   ↓ (Select scenario)
7. Digital Coaching - Active Session
   ↓ (Complete session)
8. Results Modal
   ↓ (CTA: "Nieuwe sessie" or "Bekijk Analytics")
9. Dashboard / Analytics
```

### 5.2 Returning User Journey

```
1. Login
   ↓
2. Dashboard
   ↓ (Continue card: "Resume sessie")
3. Digital Coaching - Active Session
   ↓ (Complete)
4. Results Modal
   ↓ (Check progress)
5. Analytics
```

### 5.3 Preview to Signup Journey

```
1. Landing page
   ↓ (CTA: "Start gratis met Hugo")
2. App Preview
   ↓ (Explore: Dashboard, RolePlay, Library, etc.)
3. Timer: 60s
   ↓ (SignupModal appears)
4. User closes modal
   ↓ (Continue exploring)
5. Timer: 3min total
   ↓ (Reminder modal appears)
6. User clicks "Start gratis met Hugo"
   ↓
7. Signup
   ↓
8. Onboarding
   ↓
9. Dashboard (now with real account + data persistence)
```

---

## 6. Responsive Design Strategy

### Breakpoints
```css
/* Mobile-first approach */
sm: 640px   /* Tablet portrait */
md: 768px   /* Tablet landscape */
lg: 1024px  /* Desktop */
xl: 1280px  /* Large desktop */
2xl: 1536px /* Extra large desktop */
```

### Layout Adaptations

**Desktop (lg+):**
- Sidebar: Expanded, always visible
- Grid layouts: 2-3 columns
- Hero: 2 columns (content + video side by side)
- Scenario Flow Tracker: Permanent sidebar
- Filters: Horizontal row

**Tablet (md - lg):**
- Sidebar: Collapsible
- Grid layouts: 2 columns
- Hero: 2 columns (stacked on smaller tablets)
- Scenario Flow Tracker: Drawer
- Filters: Horizontal row (may wrap)

**Mobile (< md):**
- Sidebar: Drawer (hamburger menu)
- Grid layouts: 1 column (stack)
- Hero: 1 column (video below content)
- Scenario Flow Tracker: Bottom drawer with toggle
- Filters: Vertical stack
- Tables: Horizontal scroll or card view

---

## 7. Key Interactions & States

### 7.1 Role-Play States

**Idle:**
- Avatar: Neutral pose, breathing animation
- Mic button: Default state, "Start sessie"
- Scenario Flow: Shows full tree, current step highlighted

**Recording:**
- Avatar: Active, responding to audio
- Mic button: Active state, pulsing red, "Opname..."
- Real-time transcript appears
- Tips sidebar updates live
- Current step in flow tracker pulses

**Completed:**
- Avatar: Congratulatory pose
- Results modal slides up
- Confetti animation (on good score)
- CTA: "Bekijk resultaten", "Herhaal", "Nieuwe sessie"

### 7.2 Onboarding States

**Step Progress:**
- Progress bar: Fills 33% → 66% → 100%
- Completed steps: Checkmark icon
- Current step: Accent color
- Upcoming steps: Muted

**Mic Permission:**
- Pending: "Vraag toestemming" button
- Requesting: Spinner + "Wachten op toestemming..."
- Granted: Green checkmark + "Microfoon toegestaan"
- Denied: Red X + "Toestemming geweigerd" + help text

**Validation:**
- Empty required field: Red border + error message below
- Valid field: Green checkmark icon (inline)
- Form submit disabled until all required fields valid

### 7.3 Preview Mode States

**Banner:**
- Always visible at top
- "Preview mode" badge (yellow/orange)
- "Start gratis om je voortgang op te slaan" text
- "Start gratis" CTA button

**Timer Modals:**
- 60s: First modal
  - Title: "Probeer Hugo 14 dagen gratis"
  - Benefits list
  - CTA: "Start gratis met Hugo"
  - Close button: "X" (continue preview)
- 3min: Reminder modal (only if first was closed)
  - Title: "Nog maar 1 stap van jouw persoonlijke sales coach"
  - Same benefits + CTA
  - Close button available

**Data Indicators:**
- All data is sample/demo data
- No "save" or "persist" actions work
- Clicking "save" → shows toast: "Preview mode - Maak account om te bewaren"

---

## 8. Accessibility (A11y)

### Focus Management
- All interactive elements have visible focus rings (`.focus-hh`)
- Tab order is logical and follows visual layout
- Modals trap focus until dismissed
- Skip links for keyboard navigation

### Color Contrast
- AA contrast ratio minimum (4.5:1 for text)
- Text on backgrounds meets WCAG standards
- Icons have sufficient contrast
- Error states use color + icon (not color alone)

### Screen Readers
- All images have alt text
- Form inputs have labels (not just placeholders)
- Status messages announced (aria-live)
- Navigation landmarks (header, nav, main, footer)

### Keyboard Shortcuts
- Esc: Close modals/drawers
- Enter: Submit forms, activate buttons
- Space: Toggle checkboxes, activate buttons
- Arrow keys: Navigate lists (future feature)

---

## 9. Performance Considerations

### Loading States
- Skeleton screens for content loading
- Spinner for actions (uploads, processing)
- Progressive image loading
- Lazy load video embeds (HeyGen)

### Optimizations
- Images: WebP format with fallbacks
- Fonts: Preload critical fonts (Hypatia Sans)
- Code splitting: Route-based chunks
- Debounce search inputs (300ms)

### Error Handling
- Network errors: Retry button + error message
- File upload errors: Clear message + suggestions
- Form validation: Real-time feedback
- API errors: User-friendly messages (not technical)

---

## 10. Integration Points (Technical)

### External Services
1. **HeyGen API**: Avatar video generation
   - Endpoint: Real-time avatar streaming
   - Fallback: Static video if API unavailable

2. **OpenAI API**: 
   - Role-play conversation analysis
   - Real-time coaching tips
   - EPIC scoring

3. **Firebase/Supabase**:
   - User authentication (email + social)
   - Database (user profiles, sessions, analytics)
   - File storage (uploaded audio/video)

4. **Payment**: Stripe
   - Subscription management
   - Invoices
   - Billing portal

### Authentication Flow
```
1. Signup/Login
   ↓
2. Create Firebase user
   ↓
3. Store user profile in database
   ↓
4. Generate session token
   ↓
5. Redirect to onboarding (new) or dashboard (returning)
```

### Data Models (High-level)

**User:**
- id, email, name, avatar, role, company
- subscription: plan, status, next_billing
- preferences: difficulty, focus, notifications
- created_at, last_login

**Session:**
- id, user_id, scenario_id
- transcript (array of {speaker, text, timestamp})
- scores (overall, per_technique)
- feedback (array of tips)
- status: in_progress, completed
- created_at, completed_at

**Scenario:**
- id, title, description, difficulty
- techniques (array)
- flow (tree structure of steps)
- author: hugo | user
- is_featured

**Analysis:**
- id, user_id, title, type (audio|video)
- file_url, status (processing|completed|failed)
- results: scores, top_technique, phase
- uploaded_at, processed_at

---

## 11. Design File Structure

```
/components/HH/
├── AppLayout.tsx              # Sidebar + Topbar wrapper
├── Logo.tsx                   # Brand logo (horizontal/vertical/icon)
├── KPITile.tsx                # Metric display
├── ProgressBar.tsx            # Progress component
├── ListItem.tsx               # List row
├── TranscriptLine.tsx         # Transcript line
├── HintPanel.tsx              # Coaching panel
├── PricingTier.tsx            # Pricing card
├── EmptyState.tsx             # Empty state
├── AppFooter.tsx              # Footer
├── StreakCard.tsx             # Training streak
├── Login.tsx                  # Marketing: Login
├── Signup.tsx                 # Marketing: Signup
├── Landing.tsx                # Marketing: Landing
├── About.tsx                  # Marketing: About
├── Pricing.tsx                # Marketing: Pricing
├── AppPreview.tsx             # Preview: Demo app
├── SignupModal.tsx            # Preview: Signup modal
├── Onboarding.tsx             # Flow: Onboarding
├── Dashboard.tsx              # App: Dashboard
├── RolePlay.tsx               # App: Digital Coaching
├── ScenarioFlowTracker.tsx    # App: Flow visualizer
├── Library.tsx                # App: Scenario library
├── ScenarioBuilder.tsx        # App: Builder (custom scenarios)
├── MySessions.tsx             # App: User sessions
├── VideoLibrary.tsx           # App: Video cursus
├── LiveCoaching.tsx           # App: Livestream
├── TeamSessions.tsx           # App: Team dashboard
├── ConversationAnalysis.tsx   # App: Gesprek analyse
└── Settings.tsx               # App: Settings

/components/ui/
└── [shadcn components]        # Button, Card, Input, etc.

/styles/
└── globals.css                # Tailwind config + custom tokens
```

---

## 12. Brand Assets & Copy

### Logo Variants
- **Horizontal**: "HUGO HERBOTS" op één lijn (header, nav)
- **Vertical**: "HUGO / HERBOTS" gestapeld (hero, branding)
- **Icon**: "HH" handtekening (favicon, collapsed sidebar)

### Key Headlines
- "40 jaar salesgeheimen, nu jouw dagelijkse coach."
- "Train elke dag. Win elke week. Met Hugo."
- "De waarde van 40 jaar training, voor een fractie van live"
- "People buy people — en de psychologie leer je hier."

### CTAs
- "Start gratis met Hugo" (primary CTA)
- "Bekijk demo met Hugo"
- "Probeer 14 dagen gratis"
- "Plan een gesprek"
- "Begin role-play"
- "Herhaal met focus"
- "Deel met manager"

### Trust Badges
- "14 dagen gratis"
- "Geen creditcard nodig"
- "Altijd opzegbaar"
- "GDPR compliant"
- "SSL beveiligd"
- "24/7 support"

---

## 13. Next Steps for Development

### Phase 1: Marketing + Preview
1. Build marketing pages (Landing, Pricing, About, Login, Signup)
2. Implement App Preview with timer logic
3. Add SignupModal with variants
4. Set up authentication (Firebase/Supabase)
5. Build Onboarding flow

### Phase 2: Core App
1. Build Dashboard with KPI tiles
2. Implement Digital Coaching (scenario selection)
3. Add ScenarioFlowTracker component
4. Integrate HeyGen avatar (test mode first)
5. Build Settings page

### Phase 3: Advanced Features
1. Gesprek Analyse (upload + live)
2. Live Coaching (livestream integration)
3. Team dashboard
4. Analytics with charts
5. VideoLibrary

### Phase 4: Integrations
1. OpenAI integration (scoring + tips)
2. HeyGen production integration
3. Stripe payment flow
4. Email notifications
5. Database migrations

### Phase 5: Polish + Launch
1. Performance optimization
2. A11y audit
3. SEO optimization
4. Mobile testing
5. Beta launch

---

## 14. Contact & Support

Voor vragen over dit design:
- **Design System**: Zie `/styles/globals.css` voor alle tokens
- **Guidelines**: Zie `/Guidelines.md` voor volledige documentatie
- **Components**: Alle componenten in `/components/HH/`

---

**Einde van Design Brief**  
Versie 1.0 - 18 december 2024