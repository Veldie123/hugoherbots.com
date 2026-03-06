# V3 Production Roadmap: State-of-the-Art AI Coaching Platform

## Status: CONCEPT — na Fase 0 (admin fix plan)

## Overzicht

| Fase | Naam | Prioriteit | Geschat |
|------|------|-----------|---------|
| **0** | V3 Admin Bruikbaar (apart plan) | P0 | 1 dag |
| **1** | Production Foundation | P0 | 3-4 dagen |
| **2** | Intelligence Upgrade | P1 | 2-3 dagen |
| **3** | Voice Agent | P1 | 3-4 dagen |
| **4** | Agent SDK Migratie | P2 | 2-3 dagen |
| **5** | Platform Intelligence | P3 | 2-3 dagen |

---

## V3 State-of-the-Art Gap Analyse

### Wat V3 al goed heeft
| Capability | Status | State of the Art? |
|-----------|--------|-------------------|
| Agentic tool use | Ja (max 5 rondes) | Goed, kan beter met Agent SDK |
| Cross-session memory (pgvector) | Ja | Cutting edge |
| Deterministische methodologie-regels | Ja (pure code) | Slim — AI + regels combo |
| Modulair tool systeem | Ja | Volgt Anthropic best practices |
| Compact system prompt | Ja (~1.5KB) | Excellent vs V2's 15KB dump |

### Wat V3 mist
| Prioriteit | Gap | Impact |
|-----------|-----|--------|
| P0 | Streaming (SSE) | UX onacceptabel zonder |
| P0 | Session persistence | Niet deploybaar zonder |
| P1 | Real-time voice (ElevenLabs) | Game-changer coaching UX |
| P1 | Extended/Adaptive Thinking | Betere coaching kwaliteit |
| P2 | Claude Agent SDK migratie | Robuuster, minder custom code |
| P2 | Multimodal (document/image) | Unieke differentiator |
| P3 | MCP integratie | Toekomstbestendig |

---

## Fase 1: Production Foundation (P0)

### 1A. SSE Streaming
- Nieuw endpoint: `POST /api/v3/session/:id/stream`
- `client.messages.stream()` van @anthropic-ai/sdk
- SSE events: `token`, `tool_start`, `tool_end`, `done`
- Frontend: token-by-token rendering in TalkToHugoAI + AdminChatExpertMode

### 1B. Session Persistence
- Supabase tabel `v3_sessions`: id, user_id, mode, messages (JSONB), metadata
- Write-through cache: in-memory Map + async Supabase write
- Session restore bij component mount
- TTL: auto-archive na 7 dagen

### 1C. Access Control Uitbreiden
- `requireSuperAdmin` → `requireAuth` + feature flag
- Admin toggle per user
- Graduele rollout

---

## Fase 2: Intelligence Upgrade (P1)

### 2A. Adaptive Thinking
- `thinking: { type: "enabled", budget_tokens: 10000 }` voor evaluaties
- Thinking tokens niet naar user streamen

### 2B. Context Compaction
- Bij >100K tokens: samenvatting van eerdere turns
- Volledige historie in Supabase, compact in context

### 2C. Multimodal Input
- File upload in chat (images, PDF)
- Image als base64 in Claude messages
- Max 5MB, alleen image/pdf

---

## Fase 3: Voice Agent (P1 — Game Changer)

### Architectuur
```
User (browser) ↔ WebRTC ↔ ElevenLabs Conversational AI ↔ V3 Backend (Claude + Tools) → TTS Hugo's stem → WebRTC terug
```

### Waarom ElevenLabs
- Hugo's stem al gekloond (voice ID: sOsTzBXVBqNYMd5L4sCU)
- Custom LLM webhook: ElevenLabs → ons endpoint → Claude → terug
- STT + TTS + WebRTC handling door ElevenLabs
- Latency <400ms

### Implementatie
- 3A: ElevenLabs Agent configuratie
- 3B: Voice LLM endpoint (`/api/v3/voice/llm`)
- 3C: Frontend VoiceCoach component
- 3D: Voice-specific aanpassingen (kortere responses, lagere max_tokens)

---

## Fase 4: Agent SDK Migratie (P2)

- `@anthropic-ai/claude-agent-sdk` installeren
- Handgeschreven agentic loop (259 regels) → SDK's `query()`
- Built-in streaming, tool running, session management
- Subagent voor roleplay

**Note:** Optioneel — alleen als we tegen limieten aanlopen van de handgeschreven loop.

---

## Fase 5: Platform Intelligence (P3)

- MCP Server voor Hugo's trainingsmateriaal
- Analytics dashboard (token usage, coaching kwaliteit, costs)
- Multi-agent coaching (Hugo + klant simulatie + real-time analyse)

---

## Key Files

### Bestaand (aan te passen)
| Bestand | Wijziging |
|---------|-----------|
| `server/hugo-engine/v3/agent.ts` | Streaming, adaptive thinking |
| `server/hugo-engine/v3/routes.ts` | Stream endpoint, session persistence |
| `server/hugo-engine/v3/anthropic-client.ts` | Model updates |
| `src/services/hugoApi.ts` | V3 streaming consumer |
| `src/components/HH/TalkToHugoAI.tsx` | Streaming + voice toggle |
| `src/components/HH/AdminChatExpertMode.tsx` | Streaming |

### Nieuw
| Bestand | Doel |
|---------|------|
| `server/hugo-engine/v3/session-store.ts` | Supabase session persistence |
| `server/hugo-engine/v3/compaction.ts` | Context window management |
| `server/hugo-engine/v3/voice-routes.ts` | ElevenLabs webhook endpoints |
| `server/hugo-engine/v3/voice-adapter.ts` | OpenAI ↔ Claude format bridge |
| `src/components/HH/VoiceCoach.tsx` | Voice UI component |
| `src/supabase/migrations/006_v3_sessions.sql` | Session tabel |

## Totaal geschat: ~12-15 dagen (Fase 1-5)
