# Fase 1: Production Foundation — Design Document

## Status: GOEDGEKEURD

## Context

V3 admin is bruikbaar na Fase 0 maar mist drie productie-vereisten:
1. **Streaming** — antwoorden komen als één blok ipv token-by-token
2. **Session persistence** — sessies verdwijnen bij server restart
3. **Access control** — alleen hardcoded superadmin, geen rollout mogelijk

## Design

### 1A. SSE Streaming (met tool call events)

**Endpoint:** `POST /api/v3/session/:id/stream`

**SSE Event Protocol:**
```
data: { type: "thinking" }                          // agent start thinking
data: { type: "tool_start", name: "get_onboarding_status" }  // tool call begint
data: { type: "tool_result", name: "get_onboarding_status" } // tool klaar
data: { type: "token", content: "Dag Hugo" }        // tekst delta
data: { type: "done", usage: {...}, toolsUsed: [...] }       // klaar
data: { type: "error", message: "..." }             // fout
```

**Backend:**
- `agent.ts`: Nieuwe `chatStream()` generator functie. Gebruikt `client.messages.stream()` van Anthropic SDK. Yield events per delta/tool call.
- `routes.ts`: Nieuw streaming endpoint met SSE headers (`Content-Type: text/event-stream`, `X-Accel-Buffering: no`). Client disconnect handling.
- Bestaande `chat()` blijft voor non-streaming calls (opening message, tests).

**Frontend:**
- `hugoApi.ts`: `sendMessageStream()` gebruikt nieuw endpoint. Parst SSE events met ReadableStream reader.
- `AdminChatExpertMode.tsx`: Token-by-token rendering. Tool indicator ("⚡ Onboarding status ophalen...").
- `TalkToHugoAI.tsx`: Zelfde streaming integratie als admin view.

### 1B. Session Persistence (Supabase)

**Tabel:** `v3_sessions` in Supabase (migration 008).

```sql
CREATE TABLE v3_sessions (
  id TEXT PRIMARY KEY,                    -- 'v3_{uuid}'
  user_id UUID REFERENCES auth.users(id),
  mode TEXT NOT NULL CHECK (mode IN ('coaching', 'admin')),
  messages JSONB NOT NULL DEFAULT '[]',
  user_profile JSONB,
  metadata JSONB,                         -- tokenCounts, toolsUsed, model
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_v3_sessions_user ON v3_sessions(user_id);
CREATE INDEX idx_v3_sessions_updated ON v3_sessions(updated_at);
```

**Write-through cache:**
- In-memory Map (snel lezen, bestaand) + async Supabase write na elke message
- Bij server restart: load session uit Supabase bij eerste request
- Session lifetime: geen auto-archivering (voorlopig)

**Frontend:**
- Verwijder localStorage hack (Fase 0 Fix 6)
- Session restore via `GET /api/v3/session/:id` (al bestaand, moet nu DB checken)

### 1C. Access Control (Graduele Rollout)

**Rollout stappen:**
1. Stéphane (superadmin) — huidige staat
2. Stéphane + Hugo — admin V3 voor beiden
3. Alle users — V3 coaching in user view

**Tabel:** `v3_access` in Supabase.

```sql
CREATE TABLE v3_access (
  user_email TEXT PRIMARY KEY,
  admin_v3 BOOLEAN DEFAULT false,
  coaching_v3 BOOLEAN DEFAULT false,
  enabled_at TIMESTAMPTZ DEFAULT now(),
  enabled_by TEXT                          -- wie heeft toegang gegeven
);

-- Seed: superadmin altijd toegang
INSERT INTO v3_access (user_email, admin_v3, coaching_v3, enabled_by)
VALUES ('stephane@hugoherbots.com', true, true, 'system');
```

**Middleware:** `requireV3Access(mode)` vervangt `requireSuperAdmin`.
- Check `v3_access` tabel voor user email
- Superadmin hardcoded fallback (altijd toegang)
- Cache in-memory (5 min TTL) om DB calls te beperken

**Frontend:**
- `GET /api/v3/access` endpoint: returns { admin_v3, coaching_v3 }
- `ModelSelector.tsx`: Toont V3 optie alleen als user coaching_v3 of admin_v3 heeft
- Geen admin UI voor access management (handmatig via Supabase dashboard voorlopig)

## Kritieke Bestanden

### Te wijzigen
| Bestand | Wijziging |
|---------|-----------|
| `server/hugo-engine/v3/agent.ts` | Nieuwe `chatStream()` generator |
| `server/hugo-engine/v3/routes.ts` | Stream endpoint + session persistence + access control |
| `server/hugo-engine/v3/anthropic-client.ts` | Export streaming client config |
| `src/services/hugoApi.ts` | Streaming consumer voor V3 |
| `src/components/HH/AdminChatExpertMode.tsx` | Token rendering + tool indicator |
| `src/components/HH/TalkToHugoAI.tsx` | Token rendering |
| `src/components/HH/ModelSelector.tsx` | V3 access check |

### Nieuw
| Bestand | Doel |
|---------|------|
| `src/supabase/migrations/008_v3_sessions.sql` | v3_sessions + v3_access tabellen |

## Verificatie

1. `npm run build` slaagt
2. Server herstarten
3. Admin V3 → tokens verschijnen één voor één
4. Tool calls tonen indicator ("bezig met...")
5. Navigeer weg, kom terug → sessie hervat vanuit DB
6. Server restart → sessie hervat vanuit DB
7. Hugo's email toevoegen aan v3_access → Hugo kan V3 gebruiken
8. User zonder v3_access → ziet alleen V2
