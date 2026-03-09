# LangWatch Integration Design — HugoClawV3

**Datum:** 2026-03-09
**Status:** Approved
**Scope:** Coaching mode (user-facing chat)

## Doel

LangWatch integreren in HugoClawV3 voor:
1. **Runtime tracing** — Observability voor elke Claude call, tool execution, token usage
2. **Agent simulaties** — Automated scenario tests voor coaching kwaliteit en regressie

## Beslissingen

| Beslissing | Keuze | Reden |
|-----------|-------|-------|
| Hosting | SaaS nu, self-hosted later | Snelle start, migratie als waarde bewezen |
| Aanpak | Auto-instrumentation (OpenTelemetry) | Minimale code changes, maximale waarde |
| Scope fase 1 | Coaching mode only | Gebruikers-impact eerst, admin later |
| Test framework | @langwatch/scenario + Vitest | Multi-turn testing, judge-based evaluatie |

## Architectuur

```
PRODUCTION (Runtime Tracing)
─────────────────────────────
standalone.ts
  └─ setupObservability("hugoclaw-v3")
       └─ OpenTelemetry → LangWatch SaaS

routes.ts (middleware)
  └─ span.setAttributes({ userId, sessionId, mode, thinkingMode })

agent.ts (auto-instrumented)
  └─ Claude API calls → automatisch getraceerd
  └─ Tool calls → child spans

Traces → app.langwatch.ai dashboard


DEVELOPMENT (Scenario Testing)
─────────────────────────────
tests/scenarios/coaching.test.ts
  └─ AgentAdapter wraps V3 chat() via HTTP
  └─ Scenario sets: H1-H9, roleplay, SSOT compliance

tests/scenarios/agent-adapter.ts
  └─ call() → HTTP POST /api/v3/session/stream
  └─ Parses SSE → text

Run: npx vitest run tests/scenarios/
Results → LangWatch Simulations dashboard
```

## Bestanden

### Wijzigingen

| Bestand | Wijziging |
|---------|-----------|
| `server/hugo-engine/standalone.ts` | `setupObservability()` init |
| `server/hugo-engine/v3/routes.ts` | Trace metadata middleware |
| `.env` | `LANGWATCH_API_KEY` toevoegen |
| `package.json` | Dependencies toevoegen |

### Nieuwe bestanden

| Bestand | Doel |
|---------|------|
| `server/hugo-engine/v3/observability.ts` | LangWatch setup + helpers |
| `tests/scenarios/agent-adapter.ts` | AgentAdapter wrapper rond V3 API |
| `tests/scenarios/coaching.test.ts` | Coaching scenario tests |
| `vitest.config.scenarios.ts` | Vitest config voor scenario tests |

## Dependencies

```bash
# Runtime (production)
npm install langwatch @opentelemetry/sdk-node @opentelemetry/context-async-hooks

# Development (testing)
npm install -D @langwatch/scenario vitest
```

## Tracing: Wat wordt gecaptured

### Automatisch (via OpenTelemetry)
- Claude API calls (model, tokens, latency, cache hits)
- Request/response content (configureerbaar: full/input-only/none)

### Handmatig (via metadata middleware)
- `langwatch.user.id` — Supabase user ID
- `langwatch.thread.id` — V3 session ID
- `mode` — "coaching" of "admin"
- `thinkingMode` — "fast" / "auto" / "deep"
- `toolsUsed` — Lijst van aangeroepen tools

## Scenario Tests: Coaching Mode

### Scenario Sets

#### Set 1: Klanthoudingen (H1-H9)
Test of de coaching AI correct reageert op elk type klant.

| Scenario | Houding | Judge Criteria |
|----------|---------|----------------|
| Positieve klant | H1 | Herkent positieve houding, vraagt door (LSD) |
| Onzekere klant | H2 | Waarschuwt, bouwt vertrouwen op |
| Nieuwsgierige klant | H3 | Verdiept met open vragen |
| Achterdochtige klant | H4 | Verdiept, valideert zorgen |
| Klant met bezwaar | H5 | Gebruikt wedervraag-technieken |
| Prijs-georiënteerd | H6 | Lock-techniek, geen directe korting |
| Ongeïnteresseerd | H7 | Lock-techniek, herkadering |
| Agressief | H8 | De-escalatie, professioneel |
| Afwijzend | H9 | Lock-techniek, respectvolle afsluiting |

#### Set 2: SSOT Compliance
Test of de AI correcte technieknamen gebruikt (geen parafrases).

| Scenario | Test |
|----------|------|
| Techniek herkenning | Noemt exacte namen uit technieken_index.json |
| Fase-correctheid | Technieken passen bij juiste EPIC fase |
| Geen verzonnen technieken | AI verzint geen nieuwe technieknamen |

#### Set 3: Roleplay Kwaliteit
Test of de roleplay customer simulator realistisch is.

| Scenario | Test |
|----------|------|
| Klant blijft in karakter | Simulator wijkt niet af van beschreven houding |
| Natuurlijke dialoog | Geen robotachtige of onrealistische reacties |
| Progressie | Klant evolueert realistisch tijdens gesprek |

### Agent Adapter

```typescript
// tests/scenarios/agent-adapter.ts
const adapter: AgentAdapter = {
  role: AgentRole.AGENT,
  call: async (input) => {
    // 1. Create V3 session via HTTP
    // 2. Send messages from input.messages
    // 3. Collect SSE stream response
    // 4. Return final text
  }
};
```

### Judge Criteria (voorbeeld)

```typescript
scenario.judgeAgent({
  criteria: [
    "Agent gebruikt correcte SSOT technieknamen (geen parafrases)",
    "Agent herkent de klanthouding correct",
    "Agent past de LSD-methode toe (Luisteren, Samenvatten, Doorvragen)",
    "Agent geeft geen directe oplossing zonder eerst te begrijpen",
    "Antwoord is in het Nederlands",
  ]
});
```

## LangWatch Dashboard — Verwachte Views

### Traces
- Per-sessie breakdown: Claude calls, tool chains, token usage
- Filtering op userId, mode, thinkingMode
- Latency heatmap per endpoint
- Cache hit ratio over tijd

### Simulations
- Pass/fail grid per scenario set
- Regressie-detectie na prompt wijzigingen
- Per-criteria breakdown (welke criteria falen het meest)

## Risico's en Mitigatie

| Risico | Mitigatie |
|--------|----------|
| LangWatch SaaS downtime | Tracing is fire-and-forget; geen impact op agent functionaliteit |
| Token data naar extern | Configureerbaar: `dataCapture: "none"` voor gevoelige data |
| Extra latency door tracing | OpenTelemetry is async, <1ms overhead |
| Scenario tests kosten API credits | Gebruik claude-haiku voor judge, beperkt scenario count |
| ANTHROPIC_API_KEY conflict | Scenario tests draaien via HTTP adapter, niet direct via SDK |

## Toekomstige uitbreidingen (niet in fase 1)

- Admin mode tracing + scenario's
- Custom evaluators voor SSOT compliance (programmatic, niet LLM-judge)
- Self-hosted LangWatch op Railway
- Automated CI/CD pipeline: scenario tests bij elke PR
- Live session replay in LangWatch dashboard
