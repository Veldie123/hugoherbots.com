# HugoHerbots.ai Sales Coach App

### Overview
This project is an AI-powered sales coaching platform built with React, TypeScript, and Vite. Its core purpose is to deliver comprehensive, scalable, and personalized sales coaching through features like AI Chat (text/audio/video modes), Video Platform, Live Coaching, Roleplay, and Transcript Uploads. It leverages HugoHerbots' training videos and EPIC sales techniques as its primary knowledge base, aiming for a market of 10,000+ highly engaged users. The platform merges the functionalities of hugoherbots.com and hugoherbots.ai into a single codebase.

### User Preferences
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
11. **VISUELE VERIFICATIE PROTOCOL (VERPLICHT VOOR ELKE HANDOFF)** — Dit is de belangrijkste regel. De gebruiker betaalt $500/maand voor dit product. Elke pagina moet die prijs waard zijn.
    - **STAP 1: IMPACT ANALYSE** — Voordat je werk oplevert, maak een lijst van ALLE pagina's en states die mogelijk beïnvloed zijn door je wijzigingen. Denk breed: als je een component wijzigt, welke pagina's gebruiken die component? Als je styling aanpast, waar is die styling nog meer zichtbaar?
    - **STAP 2: SCREENSHOT ELKE GETROFFEN PAGINA** — Screenshot ELKE pagina/state uit stap 1. Niet alleen de "hoofd" pagina. Als een pagina alleen bereikbaar is via interactie (klik, modal, dialog), dan MOET je een directe dev URL maken (query param, route) zodat je die state kunt screenshotten. Geen excuses als "ik kan niet klikken via screenshots" — maak de state toegankelijk.
    - **STAP 3: KRITISCHE ANALYSE** — Bekijk elke screenshot alsof je een klant bent die €500/maand betaalt. Check: (a) Spacing en alignment — is alles netjes uitgelijnd? Geen tekst die in elkaar loopt? (b) Typografie — zijn titels, labels, body text consistent en leesbaar? (c) Kleuren en contrast — past alles bij het HugoHerbots design system? (d) Responsiveness — ziet het er professioneel uit? (e) Data presentatie — geen vreemde formatting, afgekapte tekst, lege states? (f) Interactie hints — zijn knoppen, links, hover states duidelijk?
    - **STAP 4: FIX EN HERHAAL** — Als IETS niet aan de $500/maand standaard voldoet, FIX het. Screenshot opnieuw. Herhaal tot je trots zou zijn om dit aan een klant te laten zien.
    - **STAP 5: PAS DAN HANDOFF** — Alleen als ALLE pagina's door stap 3 komen, lever je op. De gebruiker is GEEN screenshot-dienst en GEEN QA-tester.
12. **DEV TOEGANG ALTIJD BESCHIKBAAR** — Er is ALTIJD dev toegang via `/_dev/{pagina-naam}` (bijv. `/_dev/techniques`, `/_dev/live`, `/_dev/dashboard`). Dit bypass de login. NOOIT zeggen "ik heb geen toegang want er is een login" — gebruik gewoon de dev URL! Voor pagina's die interactie vereisen (bijv. video watch page, modals), voeg query params toe zoals `?watch=first` zodat die states direct bereikbaar zijn voor visuele verificatie. Dark mode dev preview: `/_dark/{pagina-naam}`.
13. **Mobiel altijd card/grid view** — Op mobiel (< 768px) is card/grid view de standaard, niet tabel/lijst view. De `useMobileViewMode` hook in `src/hooks/useMobileViewMode.ts` regelt dit automatisch.
14. **KLEURENSCHEMA VERIFICATIE (VERPLICHT)** — Er bestaan TWEE kleurenschema's. Voordat je "done" zegt, ALTIJD checken of je het juiste schema hebt gebruikt:
    - **USER VIEW (blauw)**: Primaire knoppen/accenten in Steel Blue (`blue-500/600`), CTAs in Dark Dark Blue, badges in `blue-*` of `emerald-*`. Sidebar/header in standaard blauw. Gebruikt voor: Dashboard, Video's, Technieken, Live, Chat, Analyse, Settings.
    - **ADMIN VIEW (paars)**: Primaire knoppen/accenten in Purple (`purple-500/600/700`), borders `purple-300`, backgrounds `purple-50`, hover `purple-100`. Badges, status indicators, action buttons — alles paars. Gebruikt voor: ALLE admin pagina's (Video Management, Users, Analytics, Sessions, Uploads, etc.).
    - **VERGEET-CHECK**: Zoek in je code naar `emerald-*`, `green-*`, `blue-*` kleuren op admin pagina's — die horen daar NIET (behalve success/error states). Admin = paars. User = blauw. Geen uitzonderingen.
    - **UITZONDERING**: Semantische kleuren (rood voor errors, oranje voor warnings, groen voor success) zijn overal toegestaan.

### System Architecture

**UI/UX Decisions:**
The frontend adheres to a "final" design with HugoHerbots branding, a light theme (with optional dark mode), and all text in Dutch. Radix UI / Shadcn are used for components. Custom UI elements prioritize user-friendliness. The design uses two distinct color schemes: **User view** uses three blue shades (Dark Dark Blue for prominent CTAs, Steel Blue for secondary buttons, Webinar Blue for primary UI elements); **Admin view** uses purple consistently (purple-500/600/700 for buttons, purple-300 for borders, purple-50 for backgrounds). Green accents are reserved for success states only. Dark mode is implemented via `ThemeProvider` with localStorage persistence; the Landing page is always light mode.

**Technical Implementations:**
The frontend uses React 18, TypeScript, Vite 6, and Tailwind CSS v4. Sales techniques are centrally managed in `config/ssot/technieken_index.json` and mirrored in `src/data/technieken_index.json`. Modifications to `technieken_index.json` require running `python scripts/sync_ssot_to_rag.py`. The database stores only technique numbers, with frontend retrieving details from the SSOT.

**Backend Architecture:**
The system comprises three concurrent services:
-   **Vite Dev Server** (port 5000): Frontend React application.
-   **Video Processor** (port 3001): Handles video pipeline, Mux integration, RAG search, platform sync, SSO, and Stripe.
-   **Hugo Engine V2** (port 3002): AI coaching engine (TypeScript/Express), featuring nested-prompts, RAG-grounding, validation-loop, LiveKit audio, HeyGen video, analysis, and roleplay. It uses `require("openai")` for the OpenAI client due to tsx compatibility.

**Core V2 Engine Components (`server/hugo-engine/`):**
Key components include the Coach Engine, Context Engine, Analysis Service, Evaluator, RAG Service, Rich Response Builder, Intent Detector, Content Assets, Response Repair/Validator, SSOT Context Builder, Roleplay Engine, Customer Engine, Detailed Metrics, Performance Tracker, Historical Context Service, Artifact Service, Brief Generator Service, and Context Layers Service.

**SSOT Configuration Files:**
Central configuration is managed through files like `config/ssot/technieken_index.json` (EPIC sales techniques), `config/ssot/coach_overlay_v3_1.json` (coaching rules), `config/ssot/evaluator_overlay.json` (evaluator scoring), `config/ssot/hugo_persona.json` (Hugo's personality), `config/video_mapping.json` (technique-to-video mappings), and `config/prompts/*.json` (prompt templates).

**Frontend Routes:**
Public routes include Landing, About, Pricing, Login, Signup, Onboarding, AuthCallback, and SSO Validate.
User-specific pages include Dashboard, E.P.I.C. Technieken, Video's, Live Coaching, Gespreksanalyse, Talk to Hugo AI, Hugo AI Overview, Upload Analysis, Analysis Results, Resources, and Instellingen.
Admin pages cover Admin Dashboard, Video Management, Technique Management, User Management, Sessions, Upload Management, Chat Expert Mode, Config Review, Notifications, RAG Review, Analytics, Billing, Content Library, Help Center, Resource Library, Organization Management, and Session Transcripts.

**Multi-Modal Capabilities:**
-   **Chat Mode**: Text-based coaching with streaming responses, rich inline content (video, webinars, analysis cards), and audio file attachment for analysis.
-   **Audio Mode**: LiveKit Cloud WebRTC, Deepgram Nova 3 STT (Dutch), ElevenLabs TTS (Hugo voice clone), Silero VAD, barge-in, and ElevenLabs Scribe STT.
-   **Video Mode**: HeyGen Streaming Avatar SDK with WebRTC video transport.

**Database Usage:**
-   **Replit PostgreSQL (local)**: Used for `conversation_analyses`, `admin_corrections`, and `chat_feedback`.
-   **Supabase (remote, primary)**: Used for all primary application data including `v2_sessions`, `session_artifacts`, `user_context`, `user_stats`, `user_training_profile`, `technique_mastery`, `technique_sessions`, `rag_documents`, `activity_log`, `users`, `sessions`, `turns`, `persona_history`, `lock_events`, `video_progress`, `videos`, `live_sessions`, `live_session_attendees`, `live_chat_messages`, `live_polls`, `live_poll_options`, `live_poll_votes`.

**Feature Specifications:**
-   **Unified Video System**: Integrates Google Drive processed videos with Mux streaming. A Python pipeline handles automatic processing including greenscreen removal, audio extraction, transcription, OpenAI embeddings for RAG, and AI technique auto-matching (50% folder name + 50% AI transcript analysis). Videos can have multiple detected techniques with confidence scores. Real-time technique timeline generation segments transcripts to identify techniques discussed at specific timestamps.
-   **Live Coaching**: Uses Daily.co for video conferencing, scheduling, real-time chat, polls, cloud recording, and progress tracking.
-   **Roleplay System**: Allows users to practice sales techniques with AI customer personas, supporting audio/video uploads for analysis.
-   **AI Chat/RAG System**: Implements Retrieval-Augmented Generation using `pgvector` for semantic search on Hugo's knowledge base.
-   **Analysis System**: Provides AI analysis of uploaded sales conversations with detailed metrics and percentile rankings.
-   **Admin Analytics**: Dashboards for KPIs on video views, watch time, live session participation, and video processing statuses.
-   **Hugo Onboarding Mode**: A simplified interface for specific users (e.g., `hugo@hugoherbots.com`) accessible via URL prefix, localStorage, or query parameter, showing essential features.

**System Design Choices:**
The architecture emphasizes modularity, data consistency (SSOT), scalability, and security (admin-only authorizations, JWT, rate limiting). Automated session lifecycle management is in place. All heavy video processing is offloaded to a Google Cloud Run external worker to manage resources and includes a self-healing batch queue. Supabase is exclusively used for all database operations, authentication, and storage. The project maintains a unified single codebase, with the Hugo Engine V2 now running locally within this deployment.

### External Dependencies
-   **OpenAI (gpt-5.1)**: AI engine for coaching, evaluation, analysis.
-   **Supabase**: Authentication, database (BaaS), RAG storage, session management.
-   **LiveKit Cloud**: WebRTC audio transport for multi-modal features.
-   **ElevenLabs**: Text-to-Speech (Hugo voice clone) and Speech-to-Text (Scribe).
-   **HeyGen**: Streaming video avatar integration.
-   **Deepgram Nova 3**: Speech-to-Text for audio mode (via LiveKit inference).
-   **Mux**: Video hosting and playback for training videos (client-side player).
-   **Daily.co**: Video conferencing for Live Coaching.
-   **Google Cloud Run**: External worker for video processing.
-   **Google Drive**: Source for Hugo's sorted videos.
-   **Stripe**: Payments and subscriptions.
-   **Recharts**: Charting library for analytics.
-   **Replit PostgreSQL**: Local database for analyses, corrections, and feedback.