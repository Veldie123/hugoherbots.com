# Fase 1: Production Foundation — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add SSE streaming, Supabase session persistence, and gradual access control to V3.

**Architecture:** Streaming via Anthropic SDK's `client.messages.stream()` + SSE endpoint. Session write-through cache: in-memory Map + async Supabase writes. Access control via `v3_access` table with middleware.

**Tech Stack:** @anthropic-ai/sdk (streaming), @supabase/supabase-js (persistence), Express SSE (transport)

**Design doc:** `docs/plans/2026-03-06-fase1-production-foundation-design.md`

---

### Task 1: Database Migration — v3_sessions + v3_access tables

**Files:**
- Create: `src/supabase/migrations/008_v3_sessions_and_access.sql`

**Step 1: Create migration file**

```sql
-- V3 Session Persistence
CREATE TABLE IF NOT EXISTS v3_sessions (
  id TEXT PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  mode TEXT NOT NULL CHECK (mode IN ('coaching', 'admin')),
  messages JSONB NOT NULL DEFAULT '[]',
  user_profile JSONB,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_v3_sessions_user ON v3_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_v3_sessions_updated ON v3_sessions(updated_at);

-- V3 Access Control
CREATE TABLE IF NOT EXISTS v3_access (
  user_email TEXT PRIMARY KEY,
  admin_v3 BOOLEAN DEFAULT false,
  coaching_v3 BOOLEAN DEFAULT false,
  enabled_at TIMESTAMPTZ DEFAULT now(),
  enabled_by TEXT
);

-- Seed: superadmin altijd toegang
INSERT INTO v3_access (user_email, admin_v3, coaching_v3, enabled_by)
VALUES ('stephane@hugoherbots.com', true, true, 'system')
ON CONFLICT (user_email) DO NOTHING;
```

**Step 2: Run migration on Supabase**

Run de SQL via de Supabase credentials uit `.env` (SUPABASE_YOUR_PASSWORD).

**Step 3: Commit**

```
git add src/supabase/migrations/008_v3_sessions_and_access.sql
git commit -m "Add v3_sessions and v3_access tables migration"
```

---

### Task 2: Backend — chatStream() generator in agent.ts

**Files:**
- Modify: `server/hugo-engine/v3/agent.ts`

**Step 1: Add V3StreamEvent type en chatStream() export**

Na de bestaande `V3Response` interface (regel 66-72), voeg toe:

```typescript
export interface V3StreamEvent {
  type: "thinking" | "tool_start" | "tool_result" | "token" | "done" | "error";
  content?: string;
  name?: string;        // tool name
  usage?: { inputTokens: number; outputTokens: number };
  toolsUsed?: string[];
}
```

**Step 2: Implementeer chatStream() als async generator**

Na de bestaande `chat()` functie (regel 141-243), voeg `chatStream()` toe:

```typescript
export async function* chatStream(
  session: V3SessionState,
  userMessage: string
): AsyncGenerator<V3StreamEvent> {
  const client = getAnthropicClient();
  const tools = getAllToolDefinitions(session.mode);
  const systemPrompt = getSystemPrompt(session);
  const model = COACHING_MODEL;

  const messages: Anthropic.MessageParam[] = session.messages.map((m) => ({
    role: m.role,
    content: m.content,
  }));
  messages.push({ role: "user", content: userMessage });

  const toolsUsed: string[] = [];
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let finalText = "";

  let currentMessages = [...messages];
  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    yield { type: "thinking" };

    const stream = client.messages.stream({
      model,
      max_tokens: session.mode === "admin" ? 4096 : 1024,
      system: systemPrompt,
      tools,
      messages: currentMessages,
    });

    // Collect full response for tool handling
    let currentText = "";
    const contentBlocks: Anthropic.ContentBlock[] = [];
    let stopReason: string | null = null;

    stream.on("text", (text) => {
      currentText += text;
    });

    const finalMessage = await stream.finalMessage();
    totalInputTokens += finalMessage.usage.input_tokens;
    totalOutputTokens += finalMessage.usage.output_tokens;
    stopReason = finalMessage.stop_reason;

    // Process content blocks
    const toolUseBlocks = finalMessage.content.filter(
      (block): block is Anthropic.ToolUseBlock => block.type === "tool_use"
    );

    if (toolUseBlocks.length === 0 || stopReason === "end_turn") {
      // Stream text tokens from the final text
      const textBlocks = finalMessage.content.filter(
        (block): block is Anthropic.TextBlock => block.type === "text"
      );
      const text = textBlocks.map((b) => b.text).join("");

      // Yield token by token (split into small chunks for smooth rendering)
      const chunkSize = 4; // characters per token event
      for (let i = 0; i < text.length; i += chunkSize) {
        yield { type: "token", content: text.slice(i, i + chunkSize) };
      }

      session.messages.push({ role: "user", content: userMessage });
      session.messages.push({ role: "assistant", content: text });

      yield {
        type: "done",
        usage: { inputTokens: totalInputTokens, outputTokens: totalOutputTokens },
        toolsUsed,
      };
      return;
    }

    // Tool execution round
    currentMessages.push({ role: "assistant", content: finalMessage.content });

    const toolResults: Anthropic.ToolResultBlockParam[] = [];
    for (const toolUse of toolUseBlocks) {
      toolsUsed.push(toolUse.name);
      yield { type: "tool_start", name: toolUse.name };

      let result: string;
      try {
        result = await executeTool(toolUse.name, toolUse.input as Record<string, any>, session);
      } catch (err: any) {
        console.error(`[V3 Agent] Tool ${toolUse.name} threw:`, err.message);
        result = JSON.stringify({ error: `Tool ${toolUse.name} failed: ${err.message}` });
      }

      toolResults.push({ type: "tool_result", tool_use_id: toolUse.id, content: result });
      yield { type: "tool_result", name: toolUse.name };
    }

    currentMessages.push({ role: "user", content: toolResults });
  }

  // Max rounds fallback
  const fallback = session.mode === "admin"
    ? "Ik heb even te veel opgezocht. Kun je je vraag herhalen?"
    : "Ik heb even te veel informatie opgezocht. Kun je je vraag herhalen?";
  yield { type: "token", content: fallback };
  yield { type: "done", usage: { inputTokens: totalInputTokens, outputTokens: totalOutputTokens }, toolsUsed };
}
```

**Step 3: Verify build**

Run: `npm run build`
Expected: Succeeds

**Step 4: Commit**

```
git add server/hugo-engine/v3/agent.ts
git commit -m "Add chatStream() async generator with tool call events"
```

---

### Task 3: Backend — SSE Stream Endpoint in routes.ts

**Files:**
- Modify: `server/hugo-engine/v3/routes.ts`

**Step 1: Import chatStream**

Wijzig de import op regel 9:

```typescript
import { chat, chatStream, createSession, type V3SessionState, type V3StreamEvent } from "./agent";
```

**Step 2: Add streaming endpoint**

Na het bestaande `POST /session/:sessionId/message` endpoint, voeg toe:

```typescript
/** Stream a message response via SSE */
router.post(
  "/session/:sessionId/stream",
  requireAuth,
  requireSuperAdmin,
  async (req: Request, res: Response) => {
    const sessionId = req.params.sessionId as string;
    const { message } = req.body;

    if (!message || typeof message !== "string" || message.trim().length === 0) {
      return res.status(400).json({ error: "Message is verplicht." });
    }

    const session = sessions.get(sessionId);
    if (!session) {
      return res.status(404).json({ error: "Sessie niet gevonden. Start een nieuwe sessie." });
    }

    // SSE headers
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");

    let clientDisconnected = false;
    req.on("close", () => { clientDisconnected = true; });

    try {
      for await (const event of chatStream(session, message.trim())) {
        if (clientDisconnected) break;
        res.write(`data: ${JSON.stringify(event)}\n\n`);
      }
    } catch (err: any) {
      console.error("[V3] Stream error:", err.message);
      if (!clientDisconnected) {
        res.write(`data: ${JSON.stringify({ type: "error", content: err.message })}\n\n`);
      }
    }

    res.end();
  }
);
```

**Step 3: Verify build**

Run: `npm run build`
Expected: Succeeds

**Step 4: Commit**

```
git add server/hugo-engine/v3/routes.ts
git commit -m "Add SSE streaming endpoint POST /session/:id/stream"
```

---

### Task 4: Backend — Session Persistence (Supabase write-through)

**Files:**
- Modify: `server/hugo-engine/v3/routes.ts`

**Step 1: Import supabase client**

Voeg toe aan imports:

```typescript
import { supabase } from "../supabase-client";
```

**Step 2: Add session save/load helpers**

Na de `sessions` Map declaratie, voeg toe:

```typescript
/** Save session to Supabase (async, non-blocking) */
async function persistSession(session: V3SessionState): Promise<void> {
  try {
    await supabase.from("v3_sessions").upsert({
      id: session.sessionId,
      user_id: session.userId,
      mode: session.mode,
      messages: session.messages,
      user_profile: session.userProfile || null,
      metadata: { engineVersion: session.engineVersion },
      updated_at: new Date().toISOString(),
    }, { onConflict: "id" });
  } catch (err: any) {
    console.error("[V3] Session persist failed:", err.message);
  }
}

/** Load session from Supabase if not in memory */
async function loadSession(sessionId: string): Promise<V3SessionState | null> {
  // Check memory first
  const cached = sessions.get(sessionId);
  if (cached) return cached;

  // Try Supabase
  try {
    const { data, error } = await supabase
      .from("v3_sessions")
      .select("*")
      .eq("id", sessionId)
      .single();

    if (error || !data) return null;

    const session: V3SessionState = {
      sessionId: data.id,
      userId: data.user_id,
      mode: data.mode as "coaching" | "admin",
      messages: data.messages || [],
      userProfile: data.user_profile,
      engineVersion: "v3",
    };

    sessions.set(sessionId, session);
    return session;
  } catch {
    return null;
  }
}
```

**Step 3: Update session creation to persist**

In het `POST /session` endpoint, na `sessions.set(sessionId, session)`, voeg toe:

```typescript
persistSession(session); // async, non-blocking
```

**Step 4: Update message endpoints to use loadSession**

In `POST /session/:sessionId/message` en `POST /session/:sessionId/stream`, vervang:

```typescript
const session = sessions.get(sessionId);
```

met:

```typescript
const session = await loadSession(sessionId);
```

**Step 5: Persist after each message**

In het `POST /session/:sessionId/message` endpoint, na `const response = await chat(...)`, voeg toe:

```typescript
persistSession(session); // async, non-blocking
```

In het stream endpoint, na de for-await loop, voeg toe:

```typescript
persistSession(session); // async, non-blocking
```

**Step 6: Update GET /session/:sessionId to use loadSession**

Verander de handler van sync naar async, gebruik `loadSession()`.

**Step 7: Verify build**

Run: `npm run build`
Expected: Succeeds

**Step 8: Commit**

```
git add server/hugo-engine/v3/routes.ts
git commit -m "Add Supabase session persistence with write-through cache"
```

---

### Task 5: Backend — Access Control Middleware

**Files:**
- Modify: `server/hugo-engine/v3/routes.ts`

**Step 1: Add v3 access check middleware**

Vervang de `requireSuperAdmin` functie met:

```typescript
/** V3 access control — check v3_access table with in-memory cache */
const accessCache = new Map<string, { admin_v3: boolean; coaching_v3: boolean; ts: number }>();
const ACCESS_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

async function getV3Access(email: string): Promise<{ admin_v3: boolean; coaching_v3: boolean }> {
  // Superadmin always has access
  if (email.toLowerCase() === SUPERADMIN_EMAIL) {
    return { admin_v3: true, coaching_v3: true };
  }

  // Check cache
  const cached = accessCache.get(email);
  if (cached && Date.now() - cached.ts < ACCESS_CACHE_TTL) {
    return { admin_v3: cached.admin_v3, coaching_v3: cached.coaching_v3 };
  }

  // Check Supabase
  try {
    const { data } = await supabase
      .from("v3_access")
      .select("admin_v3, coaching_v3")
      .eq("user_email", email.toLowerCase())
      .single();

    const access = {
      admin_v3: data?.admin_v3 || false,
      coaching_v3: data?.coaching_v3 || false,
    };
    accessCache.set(email, { ...access, ts: Date.now() });
    return access;
  } catch {
    return { admin_v3: false, coaching_v3: false };
  }
}

function requireV3Access(mode: "admin" | "coaching") {
  return async (req: Request, res: Response, next: Function) => {
    const email = req.userEmail;
    if (!email) {
      return res.status(401).json({ error: "Niet ingelogd." });
    }

    const access = await getV3Access(email);
    const hasAccess = mode === "admin" ? access.admin_v3 : access.coaching_v3;

    if (!hasAccess) {
      return res.status(403).json({ error: "V3 is niet beschikbaar voor dit account." });
    }
    next();
  };
}
```

**Step 2: Replace requireSuperAdmin usage**

Vervang alle `requireSuperAdmin` in de router registraties:

- `POST /session` → `requireV3Access("admin")` (admin sessies) of dynamisch op basis van mode
- `POST /session/:sessionId/message` → gebruik `requireAuth` + check sessie ownership
- `POST /session/:sessionId/stream` → zelfde
- `GET /session/:sessionId` → zelfde
- `POST /memory/save` → `requireV3Access("admin")`

**Let op:** De mode (admin/coaching) wordt bepaald door de sessie, niet de endpoint. Dus voor message/stream endpoints: check of de user eigenaar is van de sessie.

**Step 3: Add access check endpoint**

```typescript
/** Check V3 access for current user */
router.get("/access", requireAuth, async (req: Request, res: Response) => {
  const email = req.userEmail;
  if (!email) return res.json({ admin_v3: false, coaching_v3: false });

  const access = await getV3Access(email);
  res.json(access);
});
```

**Step 4: Verify build**

Run: `npm run build`

**Step 5: Commit**

```
git add server/hugo-engine/v3/routes.ts
git commit -m "Add V3 access control with gradual rollout support"
```

---

### Task 6: Frontend — Streaming Consumer in hugoApi.ts

**Files:**
- Modify: `src/services/hugoApi.ts`

**Step 1: Add V3StreamEvent type**

```typescript
interface V3StreamEvent {
  type: "thinking" | "tool_start" | "tool_result" | "token" | "done" | "error";
  content?: string;
  name?: string;
  usage?: { inputTokens: number; outputTokens: number };
  toolsUsed?: string[];
}
```

**Step 2: Update sendMessageStream() for V3**

Vervang het V3 blok (regels 331-336):

```typescript
if (this.useV3) {
  const response = await fetch(`${API_BASE}/v3/session/${this.currentSessionId}/stream`, {
    method: "POST",
    headers: await getAuthHeaders(),
    body: JSON.stringify({ message: content }),
  });

  if (!response.ok) {
    throw new Error(`Failed to stream V3 message: ${response.statusText}`);
  }

  const reader = response.body?.getReader();
  if (!reader) throw new Error("No response body");

  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      if (line.startsWith("data: ")) {
        try {
          const event: V3StreamEvent = JSON.parse(line.slice(6));
          if (event.type === "token" && event.content) {
            onToken(event.content);
          } else if (event.type === "tool_start" && event.name) {
            onToken(`\n⚡ ${event.name}...\n`);
          } else if (event.type === "done") {
            if (onDone) onDone(event);
          } else if (event.type === "error") {
            throw new Error(event.content || "Stream error");
          }
        } catch (e: any) {
          if (e.message && !e.message.includes("JSON")) throw e;
        }
      }
    }
  }
  return;
}
```

**Step 3: Update startSessionStream() for V3**

Vervang het V3 blok (regels 207-213). De opening message komt nog steeds non-streaming (dat is prima — de POST /session endpoint is niet streaming):

```typescript
if (this.useV3) {
  const result = await this.startSessionV3(request);
  if (result.message) onToken(result.message);
  if (onDone) onDone();
  return result.sessionId;
}
```

(Dit blijft hetzelfde — opening message hoeft niet te streamen.)

**Step 4: Add V3 access check method**

```typescript
async checkV3Access(): Promise<{ admin_v3: boolean; coaching_v3: boolean }> {
  try {
    const response = await fetch(`${API_BASE}/v3/access`, {
      headers: await getAuthHeaders(),
    });
    if (!response.ok) return { admin_v3: false, coaching_v3: false };
    return response.json();
  } catch {
    return { admin_v3: false, coaching_v3: false };
  }
}
```

**Step 5: Verify build**

Run: `npm run build`

**Step 6: Commit**

```
git add src/services/hugoApi.ts
git commit -m "Add V3 SSE streaming consumer and access check"
```

---

### Task 7: Frontend — Token Rendering in AdminChatExpertMode.tsx

**Files:**
- Modify: `src/components/HH/AdminChatExpertMode.tsx`

**Step 1: Update message sending to use streaming**

Zoek de huidige `sendMessage` logica voor V3 mode. Het component gebruikt al `hugoApi.sendMessageStream()` voor V2 — verifieer dat V3 mode ook via streaming gaat.

Key change: De onToken callback voegt tokens toe aan het laatste AI message in de messages array. De tool_start events worden weergegeven als tijdelijke indicators.

**Step 2: Remove localStorage persistence (Fase 0 Fix 6)**

Verwijder:
- `V3_SESSION_KEY` en `V3_MESSAGES_KEY` constants
- De save effect (`useEffect` die localStorage schrijft)
- De restore logic bij mount (localStorage check)
- localStorage clear bij model switch

Session persistence is nu server-side.

**Step 3: Verify build**

Run: `npm run build`

**Step 4: Commit**

```
git add src/components/HH/AdminChatExpertMode.tsx
git commit -m "Wire V3 streaming in admin chat, remove localStorage persistence"
```

---

### Task 8: Frontend — ModelSelector V3 Access Check

**Files:**
- Modify: `src/components/HH/ModelSelector.tsx`

**Step 1: Add access check**

ModelSelector moet `hugoApi.checkV3Access()` aanroepen en V3 optie alleen tonen als user access heeft (admin_v3 voor admin view, coaching_v3 voor user view).

**Step 2: Verify build**

Run: `npm run build`

**Step 3: Commit**

```
git add src/components/HH/ModelSelector.tsx
git commit -m "Show V3 option only for users with access"
```

---

### Task 9: End-to-End Verificatie

**Step 1: Build**

Run: `npm run build`
Expected: Succeeds

**Step 2: Server herstarten**

```bash
unset ANTHROPIC_API_KEY
PORT=5001 node --env-file=.env server/production-server.js
```

**Step 3: Test streaming**

1. Open admin V3 chat
2. Stuur een bericht
3. Verwacht: tokens verschijnen één voor één
4. Bij tool calls: "⚡ get_onboarding_status..." indicator

**Step 4: Test session persistence**

1. Start V3 sessie, stuur een paar berichten
2. Herstart server
3. Open V3 chat weer → sessie moet hersteld zijn

**Step 5: Test access control**

1. Ga naar Supabase dashboard
2. Voeg Hugo's email toe aan `v3_access` met `admin_v3: true`
3. Verifieer dat Hugo V3 kan gebruiken

**Step 6: Final commit + push**

```
git add -A
git commit -m "Fase 1 complete: SSE streaming, session persistence, access control"
git push
```

---

## Kritieke Bestanden Samenvatting

| Bestand | Tasks |
|---------|-------|
| `src/supabase/migrations/008_v3_sessions_and_access.sql` | Task 1 |
| `server/hugo-engine/v3/agent.ts` | Task 2 |
| `server/hugo-engine/v3/routes.ts` | Tasks 3, 4, 5 |
| `src/services/hugoApi.ts` | Task 6 |
| `src/components/HH/AdminChatExpertMode.tsx` | Task 7 |
| `src/components/HH/ModelSelector.tsx` | Task 8 |
