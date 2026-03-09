# LangWatch Integration — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add LangWatch tracing (observability) and Scenario testing (agent simulations) to HugoClawV3 coaching mode.

**Architecture:** OpenTelemetry auto-instrumentation via LangWatch SDK captures all Claude API calls in `agent.ts`. Scenario tests run via Vitest calling the live V3 API through an HTTP adapter. Traces go to LangWatch SaaS; simulation results show in the LangWatch Simulations dashboard.

**Tech Stack:** `langwatch` + `@opentelemetry/sdk-node` (tracing), `@langwatch/scenario` + `vitest` (testing), Express.js middleware (metadata enrichment)

**Design doc:** `docs/plans/2026-03-09-langwatch-integration-design.md`

---

### Task 1: Install Dependencies

**Files:**
- Modify: `package.json`

**Step 1: Install production dependencies**

Run:
```bash
npm install langwatch @opentelemetry/sdk-node @opentelemetry/context-async-hooks
```

Expected: packages added to `dependencies` in `package.json`

**Step 2: Install dev dependencies**

Run:
```bash
npm install -D @langwatch/scenario vitest @ai-sdk/anthropic
```

Expected: packages added to `devDependencies` in `package.json`

**Step 3: Verify build still passes**

Run:
```bash
npm run build
```

Expected: build succeeds with no errors

**Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "Add LangWatch + Scenario dependencies"
```

---

### Task 2: LangWatch Observability Setup

**Files:**
- Create: `server/hugo-engine/v3/observability.ts`

**Step 1: Create observability module**

Create `server/hugo-engine/v3/observability.ts`:

```typescript
/**
 * LangWatch Observability — OpenTelemetry auto-instrumentation for V3 agent.
 *
 * Captures all Anthropic Claude API calls (tokens, latency, cache hits)
 * and sends traces to LangWatch SaaS dashboard.
 *
 * MUST be called before any Anthropic SDK usage (i.e., at server startup).
 */
import { attributes } from "langwatch";

// Re-export for use in routes.ts metadata enrichment
export { attributes };

let observabilityHandle: { shutdown: () => Promise<void> } | null = null;

export async function initObservability(): Promise<void> {
  const apiKey = process.env.LANGWATCH_API_KEY;
  if (!apiKey) {
    console.warn("[LangWatch] LANGWATCH_API_KEY not set — tracing disabled.");
    return;
  }

  try {
    // Dynamic import to avoid issues when LANGWATCH_API_KEY is not set
    const { setupObservability } = await import("langwatch/observability/node");

    observabilityHandle = setupObservability({
      serviceName: "hugoclaw-v3",
      langwatch: {
        apiKey,
      },
      attributes: {
        "deployment.environment": process.env.NODE_ENV || "development",
        "service.version": "3.0",
      },
    });

    console.log("[LangWatch] Observability initialized — tracing active.");
  } catch (err: any) {
    console.error("[LangWatch] Failed to initialize:", err.message);
  }
}

export async function shutdownObservability(): Promise<void> {
  if (observabilityHandle) {
    await observabilityHandle.shutdown();
    console.log("[LangWatch] Observability shut down.");
  }
}
```

**Step 2: Verify TypeScript compiles**

Run:
```bash
npx tsc --noEmit server/hugo-engine/v3/observability.ts 2>&1 || echo "Check errors above"
```

Note: This may fail because of project tsconfig. That's okay — we'll verify via full build later.

**Step 3: Commit**

```bash
git add server/hugo-engine/v3/observability.ts
git commit -m "Add LangWatch observability module"
```

---

### Task 3: Initialize Observability at Server Startup

**Files:**
- Modify: `server/hugo-engine/standalone.ts`

**Step 1: Add observability init BEFORE the api import**

The key insight: OpenTelemetry must be initialized **before** any Anthropic SDK usage. In `standalone.ts`, the `import('./api')` call triggers all module loading. So we init observability first.

Edit `server/hugo-engine/standalone.ts` to become:

```typescript
process.env.PORT = '3002';
process.env.NODE_ENV = 'production';

import path from 'path';
import { fileURLToPath } from 'url';

console.log('[HugoEngine] Starting Hugo Engine backend on port 3002...');
console.log('[HugoEngine] Environment:', {
  SUPABASE_URL: process.env.SUPABASE_URL ? 'set' : 'NOT SET',
  SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY ? 'set' : 'NOT SET',
  AI_INTEGRATIONS_OPENAI_BASE_URL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL ? 'set' : 'NOT SET',
  AI_INTEGRATIONS_OPENAI_API_KEY: process.env.AI_INTEGRATIONS_OPENAI_API_KEY ? 'set' : 'NOT SET',
  DATABASE_URL: process.env.DATABASE_URL ? 'set' : 'NOT SET',
  LANGWATCH_API_KEY: process.env.LANGWATCH_API_KEY ? 'set' : 'NOT SET',
});

// Initialize LangWatch observability BEFORE importing api (which loads Anthropic SDK)
import { initObservability } from './v3/observability';

initObservability()
  .then(() => import('./api'))
  .catch(err => {
    console.error('[HugoEngine] Failed to start:', err.message);
    console.error('[HugoEngine] Stack:', err.stack);
    process.exit(1);
  });
```

**Step 2: Verify build**

Run:
```bash
npm run build
```

Expected: build succeeds

**Step 3: Commit**

```bash
git add server/hugo-engine/standalone.ts
git commit -m "Initialize LangWatch observability at server startup"
```

---

### Task 4: Add Trace Metadata Middleware to V3 Routes

**Files:**
- Modify: `server/hugo-engine/v3/routes.ts`

**Step 1: Add trace metadata enrichment to the stream endpoint**

We enrich traces with user context (userId, sessionId, mode) so they're filterable in the LangWatch dashboard.

Add this import at the top of `routes.ts` (after existing imports):

```typescript
import { trace, context } from "@opentelemetry/api";
```

Then add a helper function after the `SUPERADMIN_EMAIL` constant:

```typescript
/** Enrich the current OpenTelemetry span with V3 session metadata */
function enrichTraceMetadata(req: Request, sessionId: string, mode: string): void {
  try {
    const span = trace.getActiveSpan();
    if (!span) return;
    span.setAttributes({
      "langwatch.user.id": req.userId || "unknown",
      "langwatch.thread.id": sessionId,
      "hugoclaw.mode": mode,
      "hugoclaw.user_email": req.userEmail || "unknown",
      "hugoclaw.thinking_mode": req.body?.thinkingMode || "auto",
    });
  } catch {
    // Tracing is best-effort — never break the request
  }
}
```

Then add calls to `enrichTraceMetadata` in the three main endpoints:

**In POST /session (after session creation, line ~245):**
```typescript
enrichTraceMetadata(req, sessionId, sessionMode);
```

**In POST /session/:sessionId/message (after session load, line ~375):**
```typescript
enrichTraceMetadata(req, sessionId, session.mode);
```

**In POST /session/:sessionId/stream (after session load, line ~464):**
```typescript
enrichTraceMetadata(req, sessionId, session.mode);
```

**Step 2: Verify build**

Run:
```bash
npm run build
```

Expected: build succeeds. Note: `@opentelemetry/api` is a transitive dependency of `@opentelemetry/sdk-node` so it should be available. If not, install it: `npm install @opentelemetry/api`.

**Step 3: Commit**

```bash
git add server/hugo-engine/v3/routes.ts
git commit -m "Add LangWatch trace metadata to V3 routes"
```

---

### Task 5: Add LANGWATCH_API_KEY to Environment

**Files:**
- Modify: `.env`

**Step 1: Get API key from LangWatch**

1. Go to https://app.langwatch.ai and create a free account
2. Create a new project called "HugoClawV3"
3. Copy the API key from Settings → API Keys

**Step 2: Add to .env**

Add this line to `.env`:

```
LANGWATCH_API_KEY=your-api-key-here
```

**Step 3: Add to Railway environment variables**

In Railway dashboard → hugoherbots.com service → Variables, add:
- `LANGWATCH_API_KEY` = (the API key from step 1)

**Step 4: Do NOT commit .env** — it contains secrets.

---

### Task 6: Test Tracing End-to-End

**Step 1: Restart the local server**

Run:
```bash
# Kill existing processes
lsof -ti:5001 -ti:3001 -ti:3002 | xargs kill -9 2>/dev/null
# Unset ANTHROPIC_API_KEY (Claude Code conflict)
unset ANTHROPIC_API_KEY
# Start server
PORT=5001 node --env-file=.env server/production-server.js
```

**Step 2: Send a test coaching message**

In a separate terminal or via the UI, start a V3 coaching session and send a message.

**Step 3: Verify traces in LangWatch**

Go to https://app.langwatch.ai → your project → Traces. You should see:
- A trace for the Claude API call
- Metadata: userId, sessionId, mode
- Token counts (input, output)
- Latency

**Step 4: If traces don't appear, check:**
- Server logs for `[LangWatch] Observability initialized`
- `LANGWATCH_API_KEY` is set correctly
- No firewall blocking outbound HTTPS to `app.langwatch.ai`

---

### Task 7: Create Vitest Configuration for Scenarios

**Files:**
- Create: `vitest.config.scenarios.ts`

**Step 1: Create scenario-specific Vitest config**

Create `vitest.config.scenarios.ts`:

```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/scenarios/**/*.test.ts"],
    testTimeout: 120_000, // 2 minutes per scenario (LLM calls are slow)
    hookTimeout: 30_000,
    // Run scenarios sequentially to avoid API rate limits
    pool: "forks",
    poolOptions: {
      forks: { singleFork: true },
    },
  },
});
```

**Step 2: Add npm script**

Add to `package.json` scripts:

```json
"test:scenarios": "vitest run --config vitest.config.scenarios.ts"
```

**Step 3: Commit**

```bash
git add vitest.config.scenarios.ts package.json
git commit -m "Add Vitest config for LangWatch scenario tests"
```

---

### Task 8: Create V3 Agent Adapter for Scenario Tests

**Files:**
- Create: `tests/scenarios/agent-adapter.ts`

**Step 1: Create the agent adapter**

This adapter wraps the live V3 API so the Scenario framework can interact with HugoClawV3 as a black box. It creates a session, sends messages via the streaming endpoint, and collects the response.

Create `tests/scenarios/agent-adapter.ts`:

```typescript
/**
 * Agent adapter for LangWatch Scenario tests.
 *
 * Wraps the HugoClawV3 API (HTTP) so the Scenario framework can interact
 * with the full agent stack including tools, system prompts, and context compaction.
 *
 * Requires:
 * - V3 server running on BASE_URL (default: http://localhost:5001)
 * - Valid auth token (SCENARIO_AUTH_TOKEN env var)
 */
import { type AgentAdapter, AgentRole } from "@langwatch/scenario";

const BASE_URL = process.env.SCENARIO_BASE_URL || "http://localhost:5001";
const AUTH_TOKEN = process.env.SCENARIO_AUTH_TOKEN;

if (!AUTH_TOKEN) {
  throw new Error("SCENARIO_AUTH_TOKEN env var required for scenario tests");
}

/** Create a new V3 coaching session and return the sessionId + opening text */
async function createSession(): Promise<{ sessionId: string; openingText: string }> {
  const res = await fetch(`${BASE_URL}/api/v3/session`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${AUTH_TOKEN}`,
    },
    body: JSON.stringify({
      mode: "coaching",
      thinkingMode: "fast", // fast for speed in tests
    }),
  });

  if (!res.ok) {
    throw new Error(`Session creation failed: ${res.status} ${await res.text()}`);
  }

  const data = await res.json();
  return {
    sessionId: data.sessionId,
    openingText: data.opening.text,
  };
}

/** Send a message to V3 via SSE streaming endpoint, collect full response */
async function sendMessage(sessionId: string, message: string): Promise<string> {
  const res = await fetch(`${BASE_URL}/api/v3/session/${sessionId}/stream`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${AUTH_TOKEN}`,
    },
    body: JSON.stringify({
      message,
      thinkingMode: "fast",
    }),
  });

  if (!res.ok) {
    throw new Error(`Stream failed: ${res.status} ${await res.text()}`);
  }

  // Parse SSE stream to collect all text tokens
  const text = await res.text();
  const lines = text.split("\n");
  let fullResponse = "";

  for (const line of lines) {
    if (!line.startsWith("data: ")) continue;
    try {
      const event = JSON.parse(line.slice(6));
      if (event.type === "token" && event.content) {
        fullResponse += event.content;
      }
      if (event.type === "error") {
        throw new Error(`Agent error: ${event.content}`);
      }
    } catch (e) {
      // Skip malformed SSE lines
    }
  }

  return fullResponse;
}

/** Create a HugoClawV3 agent adapter for Scenario tests */
export function createHugoAgent(): AgentAdapter & { sessionId?: string } {
  let sessionId: string | undefined;

  return {
    role: AgentRole.AGENT,

    async call(input) {
      // First call: create session, ignore Scenario's first message (use Hugo's opening)
      if (!sessionId) {
        const session = await createSession();
        sessionId = session.sessionId;

        // If there are already messages from the user simulator, send the latest
        const userMessages = input.messages.filter((m) => m.role === "user");
        if (userMessages.length > 0) {
          const lastUserMsg = userMessages[userMessages.length - 1];
          const msgText = typeof lastUserMsg.content === "string"
            ? lastUserMsg.content
            : lastUserMsg.content.map((c: any) => c.text || "").join("");
          return await sendMessage(sessionId, msgText);
        }

        return session.openingText;
      }

      // Subsequent calls: send the latest user message
      const userMessages = input.messages.filter((m) => m.role === "user");
      const lastUserMsg = userMessages[userMessages.length - 1];
      if (!lastUserMsg) return "Ik luister.";

      const msgText = typeof lastUserMsg.content === "string"
        ? lastUserMsg.content
        : lastUserMsg.content.map((c: any) => c.text || "").join("");

      return await sendMessage(sessionId, msgText);
    },
  };
}
```

**Step 2: Commit**

```bash
mkdir -p tests/scenarios
git add tests/scenarios/agent-adapter.ts
git commit -m "Add V3 agent adapter for LangWatch Scenario tests"
```

---

### Task 9: Create Coaching Scenario Tests

**Files:**
- Create: `tests/scenarios/coaching.test.ts`

**Step 1: Create the test file**

Create `tests/scenarios/coaching.test.ts`:

```typescript
/**
 * LangWatch Scenario Tests — HugoClawV3 Coaching Mode
 *
 * Tests the coaching agent's ability to:
 * 1. Respond appropriately to different customer attitudes (H1-H9)
 * 2. Use correct SSOT technique names (no paraphrasing)
 * 3. Follow the LSD method (Listen, Summarize, Dig deeper)
 *
 * Prerequisites:
 * - V3 server running locally (npm run dev:local)
 * - SCENARIO_AUTH_TOKEN set (valid Supabase JWT)
 * - ANTHROPIC_API_KEY set (for the judge agent)
 *
 * Run: npm run test:scenarios
 */
import scenario from "@langwatch/scenario";
import { describe, it, expect } from "vitest";
import { createHugoAgent } from "./agent-adapter";

// Base judge criteria shared across all coaching scenarios
const BASE_COACHING_CRITERIA = [
  "Agent antwoordt in het Nederlands",
  "Agent geeft geen directe oplossing zonder eerst de situatie te begrijpen",
  "Agent gedraagt zich als een ervaren sales coach",
];

describe("HugoClawV3 Coaching — Klanthoudingen", () => {
  it("H1: Positieve klant — herkent positieve houding en vraagt door", async () => {
    const result = await scenario.run({
      name: "H1 - Positieve klant",
      description: `Je bent een verkoper die met een enthousiaste klant praat.
        De klant is positief over het product en geeft signalen van interesse.
        Je vraagt de coaching AI om advies over hoe je deze situatie het beste kunt benutten.`,
      agents: [
        createHugoAgent(),
        scenario.userSimulatorAgent(),
        scenario.judgeAgent({
          criteria: [
            ...BASE_COACHING_CRITERIA,
            "Agent herkent dat de klant positief is",
            "Agent adviseert om door te vragen en de positieve signalen te verdiepen",
            "Agent moedigt de verkoper aan om de klant niet te onderbreken",
          ],
        }),
      ],
      maxTurns: 6,
    });
    expect(result.success).toBe(true);
  });

  it("H5: Klant met bezwaar — adviseert wedervraag-techniek", async () => {
    const result = await scenario.run({
      name: "H5 - Klant met bezwaar",
      description: `Je bent een verkoper die coaching wilt over een klant die prijsbezwaren heeft.
        De klant zegt "Dat is veel te duur" en "Ik kan het budget niet verantwoorden".
        Vraag de coaching AI hoe je hiermee om moet gaan.`,
      agents: [
        createHugoAgent(),
        scenario.userSimulatorAgent(),
        scenario.judgeAgent({
          criteria: [
            ...BASE_COACHING_CRITERIA,
            "Agent adviseert NIET om meteen korting te geven",
            "Agent adviseert om het bezwaar eerst te valideren en doorvragen te stellen",
            "Agent suggereert een wedervraag-aanpak om het echte bezwaar te achterhalen",
          ],
        }),
      ],
      maxTurns: 6,
    });
    expect(result.success).toBe(true);
  });

  it("H8: Agressieve klant — adviseert de-escalatie", async () => {
    const result = await scenario.run({
      name: "H8 - Agressieve klant",
      description: `Je bent een verkoper die coaching wilt over een boze klant.
        De klant is geïrriteerd, verheft zijn stem en dreigt naar de concurrent te gaan.
        Vraag de coaching AI hoe je professioneel kunt reageren.`,
      agents: [
        createHugoAgent(),
        scenario.userSimulatorAgent(),
        scenario.judgeAgent({
          criteria: [
            ...BASE_COACHING_CRITERIA,
            "Agent adviseert een kalme, professionele aanpak",
            "Agent suggereert om de frustratie van de klant te erkennen",
            "Agent adviseert NIET om te argumenteren of defensief te reageren",
          ],
        }),
      ],
      maxTurns: 6,
    });
    expect(result.success).toBe(true);
  });
});

describe("HugoClawV3 Coaching — SSOT Compliance", () => {
  it("Gebruikt Nederlandse coaching termen en LSD methode", async () => {
    const result = await scenario.run({
      name: "SSOT - Nederlandse termen",
      description: `Je bent een nieuwe verkoper die wilt leren over verkooptechnieken.
        Vraag de coaching AI om de basis uit te leggen van een goed verkoopgesprek.
        Stel doorvragen over welke technieken je kunt gebruiken.`,
      agents: [
        createHugoAgent(),
        scenario.userSimulatorAgent(),
        scenario.judgeAgent({
          criteria: [
            "Agent antwoordt volledig in het Nederlands",
            "Agent verwijst naar concrete verkooptechnieken met specifieke namen",
            "Agent legt de LSD-methode uit of verwijst ernaar (Luisteren, Samenvatten, Doorvragen)",
            "Agent noemt fases van het verkoopgesprek (EPIC: Entree, Probleemanalyse, Implicatie, Commitment)",
          ],
        }),
      ],
      maxTurns: 6,
    });
    expect(result.success).toBe(true);
  });
});

describe("HugoClawV3 Coaching — Roleplay", () => {
  it("Start een roleplay sessie wanneer gevraagd", async () => {
    const result = await scenario.run({
      name: "Roleplay - Start",
      description: `Je bent een verkoper die wilt oefenen met een moeilijk gesprek.
        Vraag de coaching AI om een rollenspel te doen waar de klant prijsbezwaren heeft.
        Ga mee in het rollenspel wanneer het begint.`,
      agents: [
        createHugoAgent(),
        scenario.userSimulatorAgent(),
        scenario.judgeAgent({
          criteria: [
            ...BASE_COACHING_CRITERIA,
            "Agent biedt aan om een rollenspel te starten",
            "Agent neemt de rol van een klant aan in het rollenspel",
            "De klant-simulatie voelt realistisch en in karakter",
          ],
        }),
      ],
      maxTurns: 8,
    });
    expect(result.success).toBe(true);
  });
});
```

**Step 2: Commit**

```bash
git add tests/scenarios/coaching.test.ts
git commit -m "Add coaching scenario tests for LangWatch Simulations"
```

---

### Task 10: Verify Full Build and Run Scenarios

**Step 1: Verify build**

Run:
```bash
npm run build
```

Expected: build succeeds with no errors

**Step 2: Start the local server (in a separate terminal)**

```bash
unset ANTHROPIC_API_KEY
PORT=5001 node --env-file=.env server/production-server.js
```

**Step 3: Run scenario tests**

In another terminal:
```bash
SCENARIO_AUTH_TOKEN=<valid-jwt> ANTHROPIC_API_KEY=<your-key> npm run test:scenarios
```

Expected: Tests run and produce pass/fail results. Some may fail initially — that's expected and informative.

**Step 4: Check LangWatch dashboard**

Both the tracing from the server and the simulation results should appear in the LangWatch dashboard.

**Step 5: Final commit**

If any fixes were needed:
```bash
git add -A
git commit -m "Fix LangWatch integration issues found during testing"
```

---

### Task 11: Add esbuild External for OpenTelemetry

**Files:**
- Modify: `package.json`

**Step 1: Update the build script**

The esbuild command in `package.json` bundles the server. OpenTelemetry and LangWatch need to be external (not bundled) because they use dynamic requires.

Update the `build` script in `package.json` to add these externals:

```
--external:langwatch --external:@opentelemetry/* --external:@opentelemetry/sdk-node --external:@opentelemetry/context-async-hooks --external:@opentelemetry/api
```

Append these to the existing `--external:` flags in the build command.

**Step 2: Verify build**

Run:
```bash
npm run build
```

Expected: build succeeds

**Step 3: Commit**

```bash
git add package.json
git commit -m "Add LangWatch/OTel as esbuild externals"
```

---

## Summary

| Task | What | Files | Depends On |
|------|------|-------|------------|
| 1 | Install dependencies | package.json | — |
| 2 | Create observability module | observability.ts | 1 |
| 3 | Init at server startup | standalone.ts | 2 |
| 4 | Trace metadata middleware | routes.ts | 2 |
| 5 | Add API key to env | .env, Railway | 1 |
| 6 | Test tracing E2E | — | 3, 4, 5 |
| 7 | Vitest config for scenarios | vitest.config.scenarios.ts | 1 |
| 8 | Agent adapter | agent-adapter.ts | 7 |
| 9 | Coaching scenario tests | coaching.test.ts | 8 |
| 10 | Full verification | — | all |
| 11 | esbuild externals | package.json | 2, 3 |

**Parallel tracks:**
- Tasks 2-4 (tracing) and Tasks 7-9 (scenarios) are independent and can be done in parallel.
- Task 5 (API key) is a manual step that can happen anytime.
- Task 11 (esbuild) should happen before Task 6 (E2E test).
