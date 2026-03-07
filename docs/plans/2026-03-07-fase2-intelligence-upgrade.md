# Fase 2: Intelligence Upgrade — Implementation Plan

**Goal:** Add adaptive thinking, context compaction, and multimodal input to V3.

**Architecture:** Extended thinking via Anthropic SDK param. Context compaction via summary-based message trimming. Multimodal via multer + base64 content blocks.

---

### Task 1: Adaptive Thinking — agent.ts types + thinking config

**Files:** `server/hugo-engine/v3/agent.ts`

- Add `thinkingTokens: number` to `V3Response` interface
- In `chat()`: increase max_tokens (admin: 16384, coaching: 8192), add `thinking: { type: "enabled", budget_tokens: 10000/5000 }`
- Track thinking tokens from response usage
- In `chatStream()`: same thinking config, same max_tokens increase
- Thinking blocks already filtered by existing `block.type === "text"` checks
- Keep thinking blocks in `currentMessages` for tool rounds (Claude expects them)

### Task 2: Adaptive Thinking — routes.ts + frontend types

**Files:** `server/hugo-engine/v3/routes.ts`, `src/services/hugoApi.ts`

- Routes: add `thinkingTokens` to usage response in POST /session and POST /session/:id/message
- hugoApi.ts: add `thinkingTokens?` to `V3StreamEvent.usage`

### Task 3: Context Compaction — compaction.ts

**New file:** `server/hugo-engine/v3/compaction.ts`

- `estimateTokens(content)` — heuristic: 1 token ≈ 4 chars
- `needsCompaction(messages)` — threshold: 80K tokens
- `compactMessages(messages, existingSummary?)` — Claude call to summarize old messages
- `buildCompactedMessages(messages, summary?)` — returns compacted array (summary + last 10 messages)

### Task 4: Context Compaction — integrate into agent + persist

**Files:** `server/hugo-engine/v3/agent.ts`, `server/hugo-engine/v3/routes.ts`

- Add `messageSummary?: string` to `V3SessionState`
- In `chat()` and `chatStream()`: call `buildCompactedMessages()` before API call
- In `persistSession()`: store summary in `metadata.messageSummary`
- In `loadSession()`: restore summary from metadata

### Task 5: Multimodal — V3Message type + agent signatures

**Files:** `server/hugo-engine/v3/agent.ts`

- Add `V3ContentBlock` type (text, image, document)
- Change `V3Message.content` to `string | V3ContentBlock[]`
- Update `chat()` and `chatStream()` signatures to accept `string | V3ContentBlock[]`
- Update compaction.ts `estimateTokens` for content blocks (images ≈ 1600 tokens)

### Task 6: Multimodal — multer endpoint in routes.ts

**Files:** `server/hugo-engine/v3/routes.ts`

- Import multer, configure memory storage (5MB limit, image/* + application/pdf)
- Update `/session/:id/stream` to conditionally parse multipart FormData
- Convert file buffers to base64 V3ContentBlock array
- Pass content blocks to chatStream()

### Task 7: Multimodal — frontend FormData + wire file uploads

**Files:** `src/services/hugoApi.ts`, `src/components/HH/TalkToHugoAI.tsx`

- hugoApi.ts: add optional `files?: File[]` param to `sendMessageStream()`
- When files present: send as FormData (no Content-Type header, let browser set boundary)
- TalkToHugoAI.tsx: in V3 mode, pass `attachedFiles.map(f => f.file)` to sendMessageStream
- File picker UI already exists (dead code) — just needs wiring

### Task 8: Build + verify + commit

- `npm run build` must pass
- Verify: adaptive thinking enabled (check server logs for thinking token counts)
- Verify: file upload paperclip button works in V3 user view
- Commit and push

---

## Kritieke Bestanden

| Bestand | Tasks |
|---------|-------|
| `server/hugo-engine/v3/agent.ts` | 1, 4, 5 |
| `server/hugo-engine/v3/routes.ts` | 2, 4, 6 |
| `server/hugo-engine/v3/compaction.ts` (nieuw) | 3 |
| `src/services/hugoApi.ts` | 2, 7 |
| `src/components/HH/TalkToHugoAI.tsx` | 7 |

## Verificatie

1. `npm run build` slaagt
2. Server herstarten → V3 sessie start (met thinking)
3. Lange sessie (50+ berichten) → compaction triggert
4. File upload in user view → afbeelding wordt verwerkt door Claude
