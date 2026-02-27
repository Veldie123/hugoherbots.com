# HugoHerbots.ai — Technical Architecture

## Frontend
- React 18 + TypeScript + Vite 6
- Tailwind CSS v4
- Radix UI / Shadcn component library
- Single Page Application (SPA) with custom routing
- Dutch language UI

## Backend (3 services running in parallel)
### 1. Vite Dev Server (port 5000)
- Frontend hosting
- Proxies API calls to backend services

### 2. Video Processor (port 3001) — server/video-processor.js
- Video pipeline: Google Drive -> Mux -> Supabase
- AutoHeal: generates missing AI summaries/titles for videos
- AutoBatch: processes pending video jobs via Google Cloud Run worker
- Mux integration (video hosting/playback)
- RAG search endpoint
- Platform sync (user accounts, subscriptions)
- SSO authentication
- Stripe payment integration
- Admin-facing Daily.co endpoints (webinar management)
- Video mapping regeneration (config/video_mapping.json)

### 3. Hugo Engine V2 (port 3002) — server/hugo-engine/
- AI coaching engine (TypeScript/Express)
- OpenAI gpt-5.1 for all AI interactions
- Modules:
  - Coach Engine: main coaching logic
  - Context Engine: gathers user context for responses
  - Analysis Service: conversation analysis with speaker diarization
  - Evaluator: scores E.P.I.C. technique usage
  - RAG Service: retrieval-augmented generation from Hugo's content
  - Rich Response Builder: formats AI responses with cards, videos, suggestions
  - Intent Detector: classifies user intent (coaching, roleplay, question, etc.)
  - Roleplay Engine: manages roleplay sessions with AI customers
  - Customer Engine: generates realistic customer personas
  - Brief Generator: creates coaching briefs
  - Performance Tracker: tracks user progress over time
  - Historical Context: maintains conversation history
  - SSOT Context Builder: loads all config from JSON files

## Databases
### Supabase (PRIMARY — all production data)
- Authentication (Supabase Auth)
- User profiles and metadata
- Video ingest jobs (video_ingest_jobs table)
- RAG documents with pgvector embeddings
- Session management
- Admin notifications
- Admin corrections (config review flow)
- Subscription data

### Replit PostgreSQL (LOCAL — engine data only)
- conversation_analyses (uploaded conversation analysis results)
- admin_corrections (pending config changes)
- chat_feedback (user feedback on AI responses)
- config_proposals

## External Services
| Service | Purpose |
|---------|---------|
| OpenAI (gpt-5.1) | AI coaching, evaluation, analysis |
| Supabase | Auth, database, RAG storage |
| LiveKit Cloud | WebRTC audio transport |
| ElevenLabs | TTS (Hugo voice clone) + STT (Scribe) |
| HeyGen | Streaming video avatar (Hugo's digital twin) |
| Deepgram Nova 3 | Speech-to-Text for audio mode |
| Mux | Video hosting and playback |
| Daily.co | Video conferencing for live coaching/webinars |
| Google Cloud Run | Worker for heavy video processing |
| Google Drive | Source for Hugo's training videos |
| Stripe | Payments and subscriptions |

## SSOT Architecture (Critical Rule)
All AI behavior, prompts, persona data, coaching rules, evaluation criteria, and content are stored in JSON config files — NEVER hardcoded in TypeScript engine files.

Key config files:
- `config/ssot/hugo_persona.json` — Hugo's identity, personality, speaking style
- `config/ssot/coach_overlay_v3_1.json` — Coaching rules, admin mode rules
- `config/ssot/evaluator_overlay.json` — Evaluation/scoring criteria
- `config/ssot/technieken_index.json` — All 54 E.P.I.C. techniques (THE source of truth)
- `config/prompts/coach_prompt.json` — Coach prompt template
- `config/prompts/roleplay_prompt.json` — Roleplay prompt template
- `config/persona_templates.json` — Customer personas, behaviors, buying phases

## Admin Levels
- **Super Admin (Stephane)**: Full access to everything. Can approve config changes, manage all users, see all analytics.
- **Content Admin (Hugo)**: Filtered view. Can manage videos, webinars, view analytics. Config changes go through approval flow (admin_corrections -> notification -> Stephane approves).

## Video Pipeline Flow
1. Hugo uploads video to Google Drive
2. Video Processor detects new file, creates video_ingest_job in Supabase
3. Cloud Run worker processes: transcription, AI summary, technique detection
4. Mux asset created for playback
5. AutoHeal generates missing titles/summaries
6. Video appears in platform library linked to E.P.I.C. techniques
