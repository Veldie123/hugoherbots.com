# HugoHerbots.ai Sales Coach App

## Overview
The HugoHerbots.ai Sales Coach App is an AI-powered platform designed to deliver personalized and scalable sales coaching. It offers AI Chat (text, audio, video), a Video Platform, Live Coaching, Roleplay, and Transcript Uploads. The platform leverages Hugo Herbots' training content and EPIC sales methodology to enhance sales performance, aiming to become a leading AI sales coaching solution with a substantial user base.

## User Preferences
1. **SUPABASE IS DE ENIGE DATABASE** - Er is GEEN lokale PostgreSQL voor productiedata. Alle database operaties gaan via Supabase. Schema wijzigingen moeten in de Supabase SQL Editor. **BELANGRIJK: NOOIT de execute_sql_tool gebruiken** - deze gaat naar een automatische Replit dev database, NIET naar Supabase. Query Supabase altijd via de backend API endpoints of Python scripts met de Supabase client.
2. **NOOIT bestaande frontend componenten verwijderen of herschrijven** - het ontwerp staat vast
3. **Dummy data stapsgewijs vervangen** - één voor één, pas als de backend werkt
4. **Dummies die nog niet functioneel zijn blijven staan** - tot de functionaliteit gebouwd is
5. **Geen nieuwe UI toevoegen zonder overleg** - focus op het werkend maken van bestaande designs
6. **Cloud Run worker voor video processing** - Alle zware video verwerking gebeurt op Google Cloud Run, niet lokaal
7. **Archief folder wordt NOOIT verwerkt** - Videos in de "archief" map worden geskipt bij sync én processing
8. **Service role key voor backend operaties** - Frontend gebruikt anon key, backend endpoints gebruiken service role
9. **Technieken komen uit technieken_index.json** - Dit is de single source of truth voor alle 54 sales technieken. **NA ELKE WIJZIGING** moet `python scripts/sync_ssot_to_rag.py` worden uitgevoerd om embeddings te synchroniseren.
10. **Test altijd met echte data** - Geen mock data in productie, gebruik altijd de echte Supabase/Mux/Drive data
11. **SSOT ARCHITECTUUR — ABSOLUTE REGEL (NOOIT OVERTREDEN)**
    - **NOOIT hard-coded gedrag, prompts, instructies, of Nederlandse tekst in `.ts` engine bestanden plaatsen.** Alle gedragsinstructies, prompts, trigger-woorden, persona-beschrijvingen, evaluatiecriteria, en coachingregels MOETEN in de juiste JSON config bestanden staan (`config/ssot/*.json`, `config/prompts/*.json`, `config/*.json`).
    - **`.ts` bestanden zijn ALLEEN voor logica** — ze laden data uit JSON configs en bouwen daar prompts mee op. Ze bevatten NOOIT letterlijke instructietekst als `"Je bent Hugo Herbots..."` of `"KRITIEKE REGEL: JE BENT EEN SALES COACH"`.
    - **Mapping van content naar JSON configs:**
        - Hugo's identiteit, persoonlijkheid, spreekstijl → `config/ssot/hugo_persona.json`
        - Coachingregels, admin modus regels, sales coach gedrag → `config/ssot/coach_overlay_v3_1.json`
        - Evaluatie/scoring criteria → `config/ssot/evaluator_overlay.json`
        - Technieken data → `config/ssot/technieken_index.json`
        - Trigger-woorden voor intent detection → `config/detectors.json`
        - Klanthoudingen → `config/klant_houdingen.json`
        - Customer persona's, gedragsstijlen, koopfases → `config/persona_templates.json`
        - Customer dynamics → `config/customer_dynamics.json`
        - Coach prompt template → `config/prompts/coach_prompt.json`
        - Context gathering prompt → `config/prompts/context_prompt.json`
        - Roleplay prompt → `config/prompts/roleplay_prompt.json`
        - Feedback prompt → `config/prompts/feedback_prompt.json`
        - RAG heuristics → `config/rag_heuristics.json`
        - Video mapping → `config/video_mapping.json`
        - EPIC slides → `config/epic_slides.json`
        - Video context labels, inline defaults → `config/global_config.json`
    - **Als een prompt config nog niet bestaat** (bijv. voor analysis of brief prompts), maak deze EERST aan als JSON config en verwijs ernaar vanuit de .ts file. Nooit direct in .ts schrijven.
    - **NOOIT SSOT JSON bestanden wijzigen** (`config/ssot/*.json`) zonder EERST de gebruiker te tonen: (1) huidige waarde, (2) voorgestelde nieuwe waarde, (3) waarom de wijziging nodig is. Wacht op expliciete goedkeuring. Dit geldt voor `evaluator_overlay.json`, `technieken_index.json`, `coach_overlay.json`, `coach_overlay_v3.json`, `coach_overlay_v3_1.json`, en `hugo_persona.json`.
    - **Audit-verplichting**: Bij elke wijziging aan engine bestanden, controleer of er hard-coded content is toegevoegd die in een JSON config thuishoort.
12. **VISUELE VERIFICATIE PROTOCOL (VERPLICHT VOOR ELKE HANDOFF)** — Dit is de belangrijkste regel. De gebruiker betaalt $500/maand voor dit product. Elke pagina moet die prijs waard zijn.
    - **STAP 1: IMPACT ANALYSE** — Voordat je werk oplevert, maak een lijst van ALLE pagina's en states die mogelijk beïnvloed zijn door je wijzigingen. Denk breed: als je een component wijzigt, welke pagina's gebruiken die component? Als je styling aanpast, waar is die styling nog meer zichtbaar?
    - **STAP 2: SCREENSHOT ELKE GETROFFEN PAGINA** — Screenshot ELKE pagina/state uit stap 1. Niet alleen de "hoofd" pagina. Als een pagina alleen bereikbaar is via interactie (klik, modal, dialog), dan MOET je een directe dev URL maken (query param, route) zodat je die state kunt screenshotten. Geen excuses als "ik kan niet klikken via screenshots" — maak de state toegankelijk.
    - **STAP 3: KRITISCHE ANALYSE** — Bekijk elke screenshot alsof je een klant bent die €500/maand betaalt. Check: (a) Spacing en alignment — is alles netjes uitgelijnd? Geen tekst die in elkaar loopt? (b) Typografie — zijn titels, labels, body text consistent en leesbaar? (c) Kleuren en contrast — past alles bij het HugoHerbots design system? (d) Responsiveness — ziet het er professioneel uit? (e) Data presentatie — geen vreemde formatting, afgekapte tekst, lege states? (f) Interactie hints — zijn knoppen, links, hover states duidelijk?
    - **STAP 4: FIX EN HERHAAL** — Als IETS niet aan de $500/maand standaard voldoet, FIX het. Screenshot opnieuw. Herhaal tot je trots zou zijn om dit aan een klant te laten zien.
    - **STAP 5: PAS DAN HANDOFF** — Alleen als ALLE pagina's door stap 3 komen, lever je op. De gebruiker is GEEN screenshot-dienst en GEEN QA-tester.
13. **DEV TOEGANG ALTIJD BESCHIKBAAR** — Er is ALTIJD dev toegang via `/_dev/{pagina-naam}` (bijv. `/_dev/techniques`, `/_dev/live`, `/_dev/dashboard`). Dit bypass de login. NOOIT zeggen "ik heb geen toegang want er is een login" — gebruik gewoon de dev URL! Voor pagina's die interactie vereisen (bijv. video watch page, modals), voeg query params toe zoals `?watch=first` zodat die states direct bereikbaar zijn voor visuele verificatie. Dark mode dev preview: `/_dark/{pagina-naam}`.
14. **Mobiel altijd card/grid view** — Op mobiel (< 768px) is card/grid view de standaard, niet tabel/lijst view. De `useMobileViewMode` hook in `src/hooks/useMobileViewMode.ts` regelt dit automatisch.
15. **KLEURENSCHEMA VERIFICATIE (VERPLICHT)** — Er bestaan TWEE kleurenschema's. Voordat je "done" zegt, ALTIJD checken of je het juiste schema hebt gebruikt:
    - **USER VIEW (steel blue)**: Primaire accent in Steel Blue (`#4F7396` / `hh-primary`). Sidebar active = solid `backgroundColor: '#4F7396'` + `text-white` (geen subtiele border, maar volle kleur). KPI card icons: eigen levendige kleuren per metric (blauw `#2563eb` voor Totaal, groen `#059669` voor Geanalyseerd, oranje `#ea580c` voor Duur, cyan `#0284c7` voor Score). Tabel # badges: groen (`#10B981`). Sidebar collapsed: `w-[60px]`, expanded: `w-[200px]`. View toggle: `navigate("admin-dashboard")` (geen page mapping). Gebruikt voor: Dashboard, Video's, Technieken, Webinars, Chat, Analyse, Settings.
    - **ADMIN VIEW (paars)**: Primaire knoppen/accenten in Purple (`purple-500/600/700`), borders `purple-300`, backgrounds `purple-50`, hover `purple-100`. Badges, status indicators, action buttons — alles paars. View toggle: `navigate("analysis")` (geen page mapping). Gebruikt voor: ALLE admin pagina's (Video Management, Users, Analytics, Sessions, Uploads, etc.).
    - **VERGEET-CHECK**: Zoek in je code naar `emerald-*`, `green-*`, `blue-*` kleuren op admin pagina's — die horen daar NIET (behalve success/error states). Admin = paars. User = blauw. Geen uitzonderingen.
    - **UITZONDERING**: Semantische kleuren (rood voor errors, oranje voor warnings, groen voor success) zijn overal toegestaan.

## System Architecture

### UI/UX Decisions
The frontend employs a "final" design consistent with HugoHerbots branding, utilizing Radix UI / Shadcn components. It supports both light and dark themes and defaults to Dutch language. User interfaces are distinct (blue for user views, purple for admin views), with green indicating success states. Mobile views consistently adopt a card/grid layout.

### Technical Implementations
The frontend is built with React 18, TypeScript, Vite 6, and Tailwind CSS v4. Sales techniques are centrally managed via `config/ssot/technieken_index.json` as a Single Source of Truth.

### Backend Architecture
The Replit project features three main services:
-   **Vite Dev Server** (port 5000): Frontend hosting.
-   **Video Processor** (port 3001): Manages the video pipeline, Mux integration, RAG search, platform sync, SSO, Stripe, admin dashboard stats (`/api/admin/dashboard-stats`), and admin Daily.co endpoints.
-   **Hugo Engine V2** (port 3002): An AI coaching engine (TypeScript/Express) handling nested prompts, RAG-grounding, validation, LiveKit audio, HeyGen video, analysis, roleplay, and user Daily.co Live Coaching endpoints.

### Core V2 Engine Components
The Hugo Engine V2 is a modular system including a Coach Engine, Context Engine, Analysis Service, Evaluator, RAG Service, Rich Response Builder, Intent Detector, and Roleplay Engine, among others, to provide comprehensive AI coaching.

### SSOT Configuration
All AI engine and content configurations, including Hugo's persona, coaching rules, evaluation criteria, sales techniques, intent detection triggers, customer attitudes, personas, dynamics, RAG heuristics, video mappings, EPIC slides, and global settings, are stored in JSON files under `config/ssot/` and `config/prompts/`. This ensures `.ts` engine files contain only logic.

### Frontend Routes
Public routes are for authentication and onboarding. User pages include a dashboard, techniques, videos, live coaching, conversation analysis, AI chat, and settings. Admin pages cover video management, user management, session tracking, analytics, and content libraries. Development access is available via `/_dev/{page-name}`.

### Multi-Modal Capabilities
The platform supports:
-   **Chat Mode**: Text-based coaching with rich content and audio analysis.
-   **Audio Mode**: Utilizes WebRTC, Deepgram Nova 3 for STT, and ElevenLabs for TTS.
-   **Video Mode**: Integrates HeyGen Streaming Avatar SDK for interactive video.

### Database Usage
Supabase is the primary remote database. A local Replit PostgreSQL instance is used for `conversation_analyses`, `admin_corrections`, `admin_notifications`, `chat_feedback`, and `config_proposals`, accessed directly by `hugo-engine/api.ts`.

### Automated Video Pipeline
The `server/video-processor.js` manages AutoHeal for generating missing AI summaries and titles, and AutoBatch for processing pending video jobs via Google Cloud Run, excluding archived videos. It also populates `config/video_mapping.json` from Supabase.

### Feature Specifications
Key features include a unified video system (Google Drive to Mux), Live Coaching via Daily.co, an AI-powered Roleplay System, an AI Chat/RAG System using `pgvector`, a two-stage Analysis System for sales conversations, Admin Analytics dashboards, and a specialized Hugo Onboarding Mode. Stripe manages subscriptions, and Supabase Auth handles user profile data.

## External Dependencies
-   **OpenAI (gpt-5.1)**: AI engine for coaching, evaluation, and analysis.
-   **Supabase**: Authentication, database (BaaS), RAG storage, session management.
-   **LiveKit Cloud**: WebRTC audio transport.
-   **ElevenLabs**: Text-to-Speech (Hugo voice clone) and Speech-to-Text (Scribe).
-   **HeyGen**: Streaming video avatar integration.
-   **Deepgram Nova 3**: Speech-to-Text for audio mode.
-   **Mux**: Video hosting and playback.
-   **Daily.co**: Video conferencing for Live Coaching.
-   **Google Cloud Run**: External worker for video processing.
-   **Google Drive**: Source for Hugo's training videos.
-   **Stripe**: Payments and subscriptions.
-   **Replit PostgreSQL**: Local database for specific analytics and feedback tables.

## Sessie Logboek Protocol
**VERPLICHT** bij het afsluiten van elke sessie/taak:
1. Schrijf een entry naar `SESSIE_LOG.md` in de root van het project
2. Formaat per entry:
   - `## DATUM — Korte titel`
   - `**Vraag:**` de originele vraag van de gebruiker (ingekort indien nodig)
   - `> **Conclusie:**` ingesprongen bullets met wat er gedaan is, welke bestanden, en de kosten
3. Dit document is het permanente overzicht voor de gebruiker om snel terug te vinden wat er gedaan is
4. Doe dit ALTIJD, ook als er geen code wijzigingen waren (bijv. "geen wijzigingen nodig — was al geïmplementeerd")