# HugoHerbots.ai Sales Coach App

## Overview
This project is an AI-powered sales coaching platform that unifies hugoherbots.com and hugoherbots.ai functionalities. Built with React, TypeScript, and Vite, its core purpose is to deliver comprehensive, scalable, and personalized sales coaching. It offers AI Chat (text, audio, video), a Video Platform, Live Coaching, Roleplay, and Transcript Uploads. The platform leverages HugoHerbots' training videos and EPIC sales techniques, aiming to engage a large user base with advanced AI capabilities.

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
The frontend features a "final" design with HugoHerbots branding, a light theme (with dark mode), and Dutch language content. Radix UI / Shadcn components are used. The color scheme is distinct: User views are blue, and Admin views are purple, with green reserved for success states. Dark mode is persistent via localStorage.

### Technical Implementations
The frontend is built with React 18, TypeScript, Vite 6, and Tailwind CSS v4. Sales techniques are centrally managed in `config/ssot/technieken_index.json` (Single Source of Truth), requiring a synchronization script upon modification.

### Backend Architecture
The system employs three services:
-   **Vite Dev Server** (port 5000): Hosts the frontend application.
-   **Video Processor** (port 3001): Manages video pipeline, Mux integration, RAG search, platform sync, SSO, and Stripe.
-   **Hugo Engine V2** (port 3002): An AI coaching engine (TypeScript/Express) offering nested prompts, RAG-grounding, validation loops, LiveKit audio, HeyGen video, analysis, and roleplay functionalities.

### Core V2 Engine Components
The Hugo Engine V2 (`server/hugo-engine/`) includes modules for Coach Engine, Context Engine, Analysis Service, Evaluator, RAG Service, Rich Response Builder, Intent Detector, Content Assets, Response Repair/Validator, SSOT Context Builder, Roleplay Engine, Customer Engine, Detailed Metrics, Performance Tracker, Historical Context Service, Artifact Service, Brief Generator Service, and Context Layers Service.

### SSOT Configuration Files
AI engine and content configuration are centralized in JSON files under `config/ssot/` and `config/prompts/`. These files define Hugo's persona, coaching rules, evaluation criteria, sales techniques, intent detection triggers, customer attitudes, personas, dynamics, RAG heuristics, video mappings, EPIC slides, and global settings. The SSOT architecture dictates that `.ts` engine files contain only logic, loading all instructional content and behavioral rules from these JSON configurations to ensure maintainability and auditability.

### Frontend Routes
The application provides public routes for authentication and onboarding. User-specific pages include dashboard, techniques, videos, live coaching, conversation analysis, AI chat, analysis uploads, resources, and settings. Administrative pages cover video management, user management, session tracking, uploads, expert chat mode, config review, notifications, RAG review, analytics, billing, and content libraries.

### Multi-Modal Capabilities
-   **Chat Mode**: Text-based coaching with rich content streaming and audio analysis.
-   **Audio Mode**: Utilizes LiveKit Cloud WebRTC, Deepgram Nova 3 for STT, and ElevenLabs for Hugo's TTS voice.
-   **Video Mode**: Integrates HeyGen Streaming Avatar SDK for interactive video experiences.

### Database Usage
Supabase serves as the primary remote database for all application data, encompassing sessions, user context, RAG documents, activity logs, and video progress. A local Replit PostgreSQL instance is specifically used for `conversation_analyses`, `admin_corrections`, and `chat_feedback`.

### Feature Specifications
Key features include a unified video system integrating Google Drive with Mux for streaming and AI analysis, Live Coaching with Daily.co (virtual backgrounds with time-based Hugo's kantoor images, hand-raise/Q&A system, waiting room/lobby with host admit/deny), an AI-powered Roleplay System, an AI Chat/RAG System with `pgvector` for semantic search, an Analysis System for sales conversations, Admin Analytics dashboards, and a specialized Hugo Onboarding Mode.

### System Design Choices
The architecture emphasizes modularity, data consistency (Single Source of Truth), scalability, and security. Supabase is exclusively used for all database operations, authentication, and storage. Heavy video processing is offloaded to a Google Cloud Run worker, while the Hugo Engine V2 operates within the deployment environment.

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
-   **Replit PostgreSQL**: Local database for specific analytical data.