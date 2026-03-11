# HugoHerbots.com

Sales coaching platform powered by AI, built around Hugo Herbots' E.P.I.C. TECHNIQUE methodology.

## Stack

- **Frontend:** React 19 + Vite 6 + Tailwind CSS v4
- **Backend:** Express.js + Supabase (PostgreSQL + Auth)
- **AI:** Claude (Anthropic) for coaching, analysis, and admin assistant
- **Video:** Daily.co (live calls) + Mux (video hosting)
- **Deploy:** Railway (auto-deploy from `main`)

## Setup

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env
# Fill in required values (Supabase, Anthropic, Stripe, Daily, Mux)

# 3. Build
npm run build

# 4. Start (production mode)
PORT=5001 node --env-file=.env server/production-server.js

# 5. Or run in dev mode (3 processes)
npm run dev:local
```

### Architecture

`production-server.js` (port 5001) is the entry point. It spawns:
- `video-processor.js` (port 3001) — video upload & transcription
- `standalone.js` (port 3002) — API server (Hugo Engine)

Frontend is served as static files from the Vite build output.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Vite dev server (frontend only) |
| `npm run build` | Build frontend + bundle server |
| `npm test` | Run unit tests (vitest) |
| `npm run lint` | ESLint check |
| `npm run typecheck` | TypeScript check (frontend + server) |
| `npm run test:scenarios:auto` | Run AI coaching scenario tests |
| `npm run config-lint` | Validate SSOT config files |
| `npm run dev:local` | Run frontend + backend concurrently |

## Project Structure

```
src/                    # Frontend (React)
  components/HH/        # App components
  styles/globals.css     # Design tokens (hh-* system)
server/
  hugo-engine/           # Backend
    api.ts               # Main API routes
    v3/                  # V3 agentic coaching engine
    routes/              # Route modules (admin, stripe, rag)
config/
  ssot/                  # Source of truth (techniques, personas)
  klant_houdingen.json   # Customer attitude definitions
tests/
  unit/                  # Vitest unit tests
  scenarios/             # AI coaching quality tests
```

## Design System

All colors use `hh-*` CSS custom property tokens defined in `src/styles/globals.css`. Never use hardcoded Tailwind colors or hex values. See `CLAUDE.md` for the full design token reference.
