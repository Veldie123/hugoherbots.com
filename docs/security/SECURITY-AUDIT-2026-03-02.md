# Security Audit Report — HugoHerbots.ai

**Datum**: 2026-03-02
**Platform**: B2B SaaS Sales Coaching Platform
**Status**: Pre-launch / Staging
**Methode**: Handmatige code-audit over 7 domeinen, parallel uitgevoerd

---

## Executive Summary

Deze audit heeft **68 unieke bevindingen** geidentificeerd over 7 security-domeinen. Het overkoepelende probleem is dat de **Express API-server (ports 3001/3002) geen enkele vorm van authenticatie heeft** op 120+ endpoints. Dit maakt vrijwel alle andere bevindingen (IDOR, privilege escalation, financiele abuse) direct exploiteerbaar.

### Totaal per Severity

| Severity | Aantal | Beschrijving |
|----------|--------|-------------|
| **CRITICAL** | 8 | Directe data breach, account takeover, of financiele schade mogelijk |
| **HIGH** | 19 | Significante impact, vereist enige kennis |
| **MEDIUM** | 18 | Beperkte impact of specifieke omstandigheden |
| **LOW** | 8 | Best-practice afwijkingen |

### Top 5 Prioriteiten

| # | Finding | Severity | Impact |
|---|---------|----------|--------|
| 1 | **Geen authenticatie op 120+ Express API endpoints** | CRITICAL | Alle data en functionaliteit publiek toegankelijk |
| 2 | **`"demo-host-key"` hardcoded backdoor op 6 admin endpoints** | CRITICAL | Iedereen kan live coaching sessies aanmaken/starten |
| 3 | **IDOR: client-supplied userId op alle endpoints** | CRITICAL | Volledige impersonatie van elke gebruiker |
| 4 | **Geen rate limiting + unauthenticated AI/token endpoints** | CRITICAL | Onbeperkte financiele exposure (OpenAI, ElevenLabs, HeyGen, LiveKit) |
| 5 | **`VITE_VIDEO_PROCESSOR_SECRET` in frontend bundle** | CRITICAL | Admin video-operaties toegankelijk via browser devtools |

---

## Track 1: Authentication & Authorization

### SEC-001 [CRITICAL] — Express API heeft nul authenticatie op alle routes (~170 endpoints)

**Beschrijving**: De twee Express servers (`routes.ts` ~70 endpoints, `api.ts` ~100+ endpoints) hebben geen auth middleware. Geen JWT verificatie, geen Bearer token check, geen session validatie. De enige "auth" is de `demo-host-key` check op 6 live session endpoints.

**Locatie**:
- [server/hugo-engine/routes.ts](server/hugo-engine/routes.ts) (gehele bestand, ~4920 regels)
- [server/hugo-engine/api.ts](server/hugo-engine/api.ts) (gehele bestand, ~5500 regels)

**Voorbeelden onbeschermde admin endpoints**:
- `GET /api/v2/admin/feedback` — Leest alle negatieve user feedback
- `POST /api/v2/admin/corrections` — Wijzigt SSOT config bestanden
- `POST /api/sso/generate-token` — Genereert SSO tokens voor willekeurige users
- `DELETE /api/v2/admin/reference-answers/:id` — Verwijdert referentie-antwoorden
- `GET /api/admin/dashboard-stats` — Revenue, user counts, subscripties

**Impact**: Elke unauthenticated gebruiker kan alle API endpoints aanroepen: data lezen/wijzigen, admin configuratie aanpassen, dure API-calls triggeren, en SSO tokens genereren voor elke user.

**Aanbeveling**: Voeg JWT verificatie middleware toe (Supabase `auth.getUser()`). Het patroon bestaat al in `src/supabase/functions/server/middleware.tsx`.

**Effort**: Large

---

### SEC-002 [CRITICAL] — `"demo-host-key"` hardcoded backdoor op 6 admin endpoints

**Beschrijving**: Zes live-session endpoints accepteren de literal string `"demo-host-key"` als geldige authenticatie naast `HOST_SECRET_KEY`. Code comment: "Basic host authentication - in production use proper auth".

**Locatie**: [server/hugo-engine/routes.ts](server/hugo-engine/routes.ts) — regels 2692, 2784, 2855, 2936, 3042, 3152

```typescript
if (hostKey !== process.env.HOST_SECRET_KEY && hostKey !== "demo-host-key") {
  return res.status(403).json({ error: "Unauthorized" });
}
```

**Getroffen endpoints**:
1. `POST /api/live-sessions` — Aanmaken live sessies
2. `POST /api/live-sessions/:id/start` — Starten (maakt Daily.co rooms)
3. `POST /api/live-sessions/:id/end` — Beindigen sessies
4. `POST /api/live-sessions/:id/refresh-recording` — Recording status
5. `POST /api/live-sessions/:id/polls` — Polls aanmaken
6. `POST /api/seed/live-sessions` — Demo data seeden

**Impact**: Iedereen kan live coaching sessies aanmaken, starten en beindigen, Daily.co rooms creeren (kost geld), en demo data in productie seeden.

**Aanbeveling**: Verwijder `"demo-host-key"` volledig. Implementeer JWT-based admin auth.

**Effort**: Quick-win

---

### SEC-003 [HIGH] — `/_dev/`, `/_dark/`, `/_hugo/` routes bypassen auth in productie

**Beschrijving**: Elke bezoeker die `/_dev/admin-dashboard` bezoekt in de browser skipt de auth-check en krijgt automatisch admin + super admin privileges. Er is geen productie-guard op deze pad-gebaseerde routes.

**Locatie**: [src/App.tsx:65-128](src/App.tsx#L65-L128)

```typescript
const [isCheckingAuth, setIsCheckingAuth] = useState(!devPage); // Skip auth check
const [isAdmin, setIsAdmin] = useState(!!devPage); // dev mode = admin
const [isSuperAdmin, setIsSuperAdmin] = useState(!!devPage && !isHugoDevPath);
```

**Impact**: Elke gebruiker in productie kan `/_dev/admin-dashboard` bezoeken en het volledige admin UI zien met super admin privileges.

**Aanbeveling**: Voeg productie-check toe (`import.meta.env.DEV`) of verwijder deze routes uit productie builds.

**Effort**: Quick-win

---

### SEC-004 [HIGH] — SSO token generatie zonder authenticatie

**Beschrijving**: `POST /api/sso/generate-token` accepteert elke `userId` en genereert een handoff token via Supabase RPC met de service role key.

**Locatie**: [server/hugo-engine/api.ts:5299-5353](server/hugo-engine/api.ts#L5299-L5353)

**Impact**: Account takeover — een aanvaller kan SSO tokens genereren voor elke user.

**Aanbeveling**: Voeg JWT auth toe en verifieer dat de aanvrager overeenkomt met de `userId`.

**Effort**: Quick-win

---

### SEC-005 [HIGH] — Client-side-only role bepaling (email domain check)

**Beschrijving**: Admin rol wordt puur client-side bepaald via `email.endsWith('@hugoherbots.com')`. De backend heeft geen concept van rollen.

**Locatie**: [src/App.tsx:147-156](src/App.tsx#L147-L156), [src/components/HH/Login.tsx:44](src/components/HH/Login.tsx#L44)

**Impact**: Aangezien de backend geen auth heeft, is dit academisch — maar ook met auth zou client-side role checking onvoldoende zijn.

**Aanbeveling**: Sla rollen op in Supabase `app_metadata`. Handhaaf server-side met middleware.

**Effort**: Medium

---

### SEC-006 [MEDIUM] — Wildcard CORS (`*`) op alle servers

**Beschrijving**: Alle drie servers gebruiken `Access-Control-Allow-Origin: *`.

**Locatie**:
- [server/hugo-engine/api.ts:166](server/hugo-engine/api.ts#L166)
- [server/video-processor.js:1470](server/video-processor.js#L1470)
- [src/supabase/functions/server/index.tsx:42](src/supabase/functions/server/index.tsx#L42)

**Aanbeveling**: Beperk CORS origins tot de frontend domeinen.

**Effort**: Quick-win

---

### SEC-007 [MEDIUM] — Supabase service role key valt terug naar anon key

**Beschrijving**: Als `SUPABASE_SERVICE_ROLE_KEY` niet is ingesteld, valt de server stil terug naar de anon key.

**Locatie**: [server/hugo-engine/supabase-client.ts:5](server/hugo-engine/supabase-client.ts#L5)

**Aanbeveling**: Fail fast bij ontbrekende service role key.

**Effort**: Quick-win

---

### SEC-008 [MEDIUM] — Hardcoded Supabase anon key in source

**Beschrijving**: Anon key en project ID zijn hardcoded in `info.tsx` ipv. environment variables. Verwacht patroon, maar bemoeilijkt key rotation.

**Locatie**: [src/utils/supabase/info.tsx:3-4](src/utils/supabase/info.tsx#L3-L4)

**Aanbeveling**: Verplaats naar `VITE_SUPABASE_ANON_KEY` env var.

**Effort**: Quick-win

---

### SEC-009 [LOW] — OAuth state parameter (gemitigeerd door PKCE)

**Beschrijving**: PKCE flow is correct geconfigureerd, wat CSRF bescherming biedt. Laag risico.

**Locatie**: [src/utils/supabase/client.ts:53-70](src/utils/supabase/client.ts#L53-L70)

**Aanbeveling**: Verifieer Supabase redirect URL configuratie.

**Effort**: Quick-win

---

## Track 2: API Endpoint Security

### SEC-010 [HIGH] — User identity spoofing via request parameters

**Beschrijving**: Meerdere endpoints accepteren `userId` als query/body parameter. Zonder auth kan iedereen elke user impersoneren. Vele endpoints vallen terug naar `"demo-user"`.

**Locatie**:
- [server/hugo-engine/routes.ts:153](server/hugo-engine/routes.ts#L153): `const userId = (req.query.userId as string) || "demo-user"`
- [server/hugo-engine/api.ts:1563](server/hugo-engine/api.ts#L1563): `const userId = req.query.userId as string || "default"`

**Aanbeveling**: Extract user identity uit geverifieerde JWT.

**Effort**: Large (vereist SEC-001 fix)

---

### SEC-011 [HIGH] — Geen body size limit op video processor (port 3001)

**Beschrijving**: De video processor gebruikt raw `http.createServer()` met `body += chunk` zonder size limit. Willekeurig grote requests kunnen memory exhaustion veroorzaken.

**Locatie**: [server/video-processor.js](server/video-processor.js) — meerdere POST handlers

**Aanbeveling**: Voeg body size check toe (max 10MB).

**Effort**: Medium

---

### SEC-012 [HIGH] — 100MB JSON body limit op API server

**Beschrijving**: `express.json({ limit: "100mb" })` staat 100MB JSON payloads toe op alle endpoints.

**Locatie**: [server/hugo-engine/api.ts:161](server/hugo-engine/api.ts#L161)

**Aanbeveling**: Verlaag naar 1MB standaard; verhoog per-route waar nodig.

**Effort**: Quick-win

---

### SEC-013 [HIGH] — Admin endpoints in video processor zonder auth

**Beschrijving**: Destructieve admin endpoints (`POST /api/admin/sessions`, `DELETE /api/admin/sessions/:id`, `GET /api/admin/dashboard-stats`) missen `checkAuth`.

**Locatie**: [server/video-processor.js:1748-3946](server/video-processor.js#L1748)

**Aanbeveling**: Pas `checkAuth` consistent toe op alle admin endpoints.

**Effort**: Quick-win

---

### SEC-014 [HIGH] — Stripe subscription lookup zonder auth

**Beschrijving**: `GET /api/stripe/subscription?email=...` laat iedereen subscriptie-details opzoeken per email.

**Locatie**: [server/video-processor.js:6243](server/video-processor.js#L6243)

**Impact**: PII disclosure — email enumeratie en subscriptie-tier informatie.

**Aanbeveling**: Vereis authenticatie.

**Effort**: Medium

---

### SEC-015 [MEDIUM] — Supabase REST API URL injection

**Beschrijving**: `sessionId` wordt direct geinterpoleerd in een Supabase REST URL zonder encoding.

**Locatie**: [server/hugo-engine/routes.ts:61](server/hugo-engine/routes.ts#L61)

**Aanbeveling**: Gebruik `encodeURIComponent()` of de Supabase client library.

**Effort**: Quick-win

---

### SEC-016 [MEDIUM] — Error messages lekken interne details

**Beschrijving**: Vrijwel alle error handlers returnen `err.message` direct naar de client.

**Locatie**: Doorheen alle drie servers.

**Aanbeveling**: Return generieke error messages; log details server-side.

**Effort**: Medium

---

### SEC-017 [MEDIUM] — Global error handler gooit error opnieuw

**Beschrijving**: De error handler in `index.ts` doet `throw err` na het sturen van de response, wat de server kan crashen.

**Locatie**: [server/hugo-engine/index.ts:105-111](server/hugo-engine/index.ts#L105-L111)

**Aanbeveling**: Vervang `throw err` door `console.error(err)`.

**Effort**: Quick-win

---

### SEC-018 [MEDIUM] — Worker callback endpoint zonder auth

**Beschrijving**: `POST /api/worker-callback` ontvangt status updates van Cloud Run zonder auth check.

**Locatie**: [server/video-processor.js:4063](server/video-processor.js#L4063)

**Aanbeveling**: Valideer callbacks met shared secret (HMAC/Bearer).

**Effort**: Quick-win

---

### SEC-019 [MEDIUM] — Platform sync endpoints zonder auth

**Beschrijving**: Platform sync endpoints staan willekeurige berichten toe tussen .com en .ai platforms.

**Locatie**: [server/hugo-engine/api.ts:5179-5292](server/hugo-engine/api.ts#L5179-L5292)

**Aanbeveling**: Voeg shared-secret auth toe voor inter-platform communicatie.

**Effort**: Medium

---

### SEC-020 [MEDIUM] — Minimale input validatie

**Beschrijving**: De meeste endpoints doen alleen basic "required field" checks. Geen Zod schema validatie op request bodies.

**Locatie**: Alle endpoint handlers.

**Aanbeveling**: Voeg Zod schema validatie toe voor alle request bodies.

**Effort**: Large

---

### SEC-021 [MEDIUM] — Geen security headers (Helmet)

**Beschrijving**: Geen CSP, X-Frame-Options, X-Content-Type-Options, HSTS, Referrer-Policy, of Permissions-Policy.

**Locatie**: Afwezig in alle server bestanden.

**Aanbeveling**: Installeer en configureer `helmet`.

**Effort**: Quick-win

---

## Track 3: Injection & XSS

### SEC-022 [HIGH] — Command injection via FFmpeg `execAsync()`

**Beschrijving**: De `compressAudioFile` functie gebruikt `execAsync()` (shell execution) met string interpolatie van user-geleverde bestandsnamen.

**Locatie**: [server/hugo-engine/v2/audio-compressor.ts:80-81](server/hugo-engine/v2/audio-compressor.ts#L80-L81)

```typescript
await execAsync(
  `ffmpeg -i "${inputPath}" -vn -ac 1 -ar 16000 -b:a ${bitrate} -y "${outputPath}"`,
  { timeout: 300000 }
);
```

**Impact**: Remote Code Execution via crafted upload bestandsnamen.

**Aanbeveling**: Vervang `execAsync()` door `spawn()` (argument array, geen shell).

**Effort**: Medium

---

### SEC-023 [HIGH] — Command injection via `folderIds` in `spawn()`

**Beschrijving**: User-provided `folderIds` worden direct als argumenten aan `spawn()` doorgegeven.

**Locatie**: [server/video-processor.js:1688](server/video-processor.js#L1688)

**Aanbeveling**: Valideer `folderIds` met regex: `/^[a-zA-Z0-9_-]+$/`.

**Effort**: Quick-win

---

### SEC-024 [MEDIUM] — Prompt injection via `systemContext` request body

**Beschrijving**: `/api/v2/session/message` accepteert een `systemContext` veld en injecteert het direct als system message in de conversatie.

**Locatie**: [server/hugo-engine/api.ts:887-913](server/hugo-engine/api.ts#L887-L913)

**Impact**: Gebruikers kunnen AI coaching guardrails bypassen en proprietary prompts extraheren.

**Aanbeveling**: Verwijder client-side `systemContext` injectie of beperk tot admin users.

**Effort**: Quick-win

---

### SEC-025 [MEDIUM] — User input direct in OpenAI prompts (prompt injection)

**Beschrijving**: User messages worden zonder filtering of boundary markers in OpenAI prompts verwerkt. Website analyzer is kwetsbaar voor indirect prompt injection via malicious website content.

**Locatie**:
- [server/hugo-engine/v2/customer_engine.ts:439](server/hugo-engine/v2/customer_engine.ts#L439)
- [server/hugo-engine/v2/website-analyzer.ts:59-83](server/hugo-engine/v2/website-analyzer.ts#L59-L83)

**Aanbeveling**: Voeg duidelijke delimiters toe tussen system instructions en user input.

**Effort**: Large

---

### SEC-026 [MEDIUM] — Dynamische SQL kolom namen in `persistStatusToDb`

**Beschrijving**: Object keys worden direct als SQL kolom namen geinterpoleerd.

**Locatie**: [server/hugo-engine/v2/analysis-service.ts:1333-1351](server/hugo-engine/v2/analysis-service.ts#L1333-L1351)

**Aanbeveling**: Whitelist toegestane kolom namen.

**Effort**: Quick-win

---

### SEC-027 [MEDIUM] — Geen sanitization library of CSP headers

**Beschrijving**: Geen DOMPurify, sanitize-html, of Content-Security-Policy. React JSX escaping biedt baseline bescherming maar geen defense-in-depth.

**Locatie**: Application-wide (afwezigheid).

**Aanbeveling**: Voeg `helmet` toe + DOMPurify voor toekomstig gebruik.

**Effort**: Quick-win

---

### SEC-028 [LOW] — SSRF risico in website analyzer

**Beschrijving**: `analyzeCompanyWebsite` fetcht willekeurige URLs zonder IP-validatie. Interne IP's en cloud metadata endpoints zijn niet geblokkeerd.

**Locatie**: [server/hugo-engine/v2/website-analyzer.ts:14-51](server/hugo-engine/v2/website-analyzer.ts#L14-L51)

**Aanbeveling**: Blokkeer private/reserved IP ranges en metadata endpoints.

**Effort**: Medium

---

### Positieve observaties (Track 3)

- **Drizzle ORM** gebruikt consistent parameterized queries — geen SQL injection
- **React JSX** escaping biedt solide baseline XSS bescherming
- **Multer** configuratie heeft file size limits (24MB) en MIME type validatie
- **Geen `dangerouslySetInnerHTML`** op user-generated content (alleen chart CSS)

---

## Track 4: Secrets & Configuration

### SEC-029 [CRITICAL] — Video Processor Secret in frontend bundle met hardcoded fallback

**Beschrijving**: `VITE_VIDEO_PROCESSOR_SECRET` wordt gecompileerd in de client-side JavaScript bundle. Fallback: `"hugo-video-processor-2024"`.

**Locatie**:
- [src/components/HH/AdminVideoPipeline.tsx:212](src/components/HH/AdminVideoPipeline.tsx#L212)
- [src/components/HH/AdminVideoManagement.tsx:964](src/components/HH/AdminVideoManagement.tsx#L964)

**Impact**: Elke gebruiker kan via browser devtools de video processor secret extraheren en admin video-operaties uitvoeren.

**Aanbeveling**: Verwijder `VITE_VIDEO_PROCESSOR_SECRET` uit frontend. Authenticeer via Supabase session tokens.

**Effort**: Medium

---

### SEC-030 [CRITICAL] — OpenAI client met `'missing-key'` placeholder

**Beschrijving**: De OpenAI client wordt geinitialiseerd met `apiKey: '... || 'missing-key'`. Server start succesvol zonder geldige key.

**Locatie**: [server/hugo-engine/openai-client.ts:12](server/hugo-engine/openai-client.ts#L12)

**Aanbeveling**: Fail fast bij startup als geen geldige API key geconfigureerd is.

**Effort**: Quick-win

---

### SEC-031 [HIGH] — Geen `.env.example` bestand

**Beschrijving**: 20+ environment variables verspreid over meerdere services, zonder documentatie.

**Aanbeveling**: Maak `.env.example` met alle vereiste vars, gegroepeerd per service.

**Effort**: Quick-win

---

### SEC-032 [HIGH] — `.gitignore` mist service account JSON patterns

**Beschrijving**: Geen bescherming tegen per ongeluk committen van Google service account key bestanden.

**Locatie**: [.gitignore](.gitignore)

**Aanbeveling**: Voeg toe: `*-service-account*.json`, `*credentials*.json`, `service-account*.json`

**Effort**: Quick-win

---

### SEC-033 [HIGH] — Video Processor Secret: random fallback server-side

**Beschrijving**: Server genereert random secret bij startup als env var ontbreekt. Frontend hardcoded fallback matcht niet. Inconsistente staat.

**Locatie**: [server/video-processor.js:17](server/video-processor.js#L17)

**Aanbeveling**: Vereis expliciete `VIDEO_PROCESSOR_SECRET` env var. Fail bij ontbreken.

**Effort**: Quick-win

---

### SEC-034 [MEDIUM] — Inconsistente env var naamgeving

**Beschrijving**: Mix van `Elevenlabs_api_key`, `ELEVENLABS_API_KEY`, `Elevenlabs_Hugo_voice_clone` — verwarrend en foutgevoelig.

**Aanbeveling**: Standaardiseer naar SCREAMING_SNAKE_CASE.

**Effort**: Medium

---

### SEC-035 [MEDIUM] — ElevenLabs voice clone ID hardcoded

**Beschrijving**: Voice clone ID `sOsTzBXVBqNYMd5L4sCU` als fallback in server-side bestanden.

**Locatie**: [server/hugo-engine/streaming-response.ts:243](server/hugo-engine/streaming-response.ts#L243)

**Aanbeveling**: Verplaats naar environment variable.

**Effort**: Quick-win

---

### SEC-036 [MEDIUM] — Supabase project ID hardcoded in 6+ bestanden

**Locatie**: Meerdere bestanden (`info.tsx`, `videoApi.ts`, `useAnalytics.ts`, etc.)

**Aanbeveling**: Centraliseer in een enkele config source.

**Effort**: Medium

---

### SEC-037 [MEDIUM] — Test credentials in committed docs/scripts

**Beschrijving**: `test@hugoherbots.test` / `TestPassword123!` in documentatie.

**Locatie**: [src/SIGNUP_TESTING_INSTRUCTIONS.md:32](src/SIGNUP_TESTING_INSTRUCTIONS.md#L32)

**Aanbeveling**: Gebruik env vars voor test credentials in scripts.

**Effort**: Quick-win

---

### SEC-038 [LOW] — Hardcoded Replit fallback URLs in frontend

**Locatie**: [src/services/ssoHandoffService.ts:6](src/services/ssoHandoffService.ts#L6)

**Aanbeveling**: Vereis `VITE_HUGO_AI_URL` expliciet.

**Effort**: Quick-win

---

### SEC-039 [LOW] — GCP project ID hardcoded in scripts

**Locatie**: [scripts/deploy_cloud_run.py:17](scripts/deploy_cloud_run.py#L17)

**Effort**: Quick-win

---

## Track 5: Dependencies

### SEC-040 [CRITICAL] — `@supabase/supabase-js` wildcard versie `"*"`

**Beschrijving**: De primaire auth en data access library gebruikt versie `"*"`. Lock file heeft 2.89.0, latest is 2.98.0.

**Locatie**: [package.json:46](package.json#L46)

**Impact**: Supply chain risico — zonder lock file wordt elke versie geinstalleerd.

**Aanbeveling**: Pin naar `"^2.98.0"`.

**Effort**: Quick-win

---

### SEC-041 [HIGH] — 16 bekende npm vulnerabilities (7 high, 8 moderate, 1 low)

**Beschrijving**:
- `tar` — 4 CVEs (arbitrary file overwrite)
- `multer` — 2 DoS CVEs
- `rollup` — arbitrary file write
- `minimatch` — 3 ReDoS CVEs
- `hono` — 5 moderate vulns (XSS, IP spoofing, timing attack)
- `vite` — 3 server file exposure CVEs
- `lodash` — prototype pollution

**Aanbeveling**: Run `npm audit fix` (lost de meeste op). Verwijder `serve` (lost 4 vulnerabilities op).

**Effort**: Quick-win

---

### SEC-042 [HIGH] — Duplicate Supabase client package

**Beschrijving**: Zowel `@supabase/supabase-js` als `@jsr/supabase__supabase-js` in dependencies. JSR variant wordt niet geimporteerd.

**Aanbeveling**: Verwijder `@jsr/supabase__supabase-js`.

**Effort**: Quick-win

---

### SEC-043 [HIGH] — OpenAI SDK 2 major versies achter (4.x vs 6.x)

**Aanbeveling**: Plan upgrade naar v6.

**Effort**: Large

---

### SEC-044 [HIGH] — Python dependencies: alleen minimum-version pins (`>=`)

**Locatie**: [pyproject.toml:7-23](pyproject.toml#L7-L23)

**Aanbeveling**: Voeg upper bounds toe (`<NEXT_MAJOR`).

**Effort**: Quick-win

---

### SEC-045 [MEDIUM] — 13 volledig ongebruikte dependencies

**Beschrijving**: `serve`, `next-themes`, `@jsr/supabase__supabase-js`, `@daily-co/daily-react`, `@livekit/rtc-node`, `@livekit/components-react`, `embla-carousel-react`, `cmdk`, `input-otp`, `vaul`, `zod-validation-error`, `drizzle-zod`, `concurrently`.

**Impact**: Vergroot aanvalsoppervlak. `serve` alleen veroorzaakt 4 vulnerabilities.

**Aanbeveling**: Verwijder alle 13 packages.

**Effort**: Quick-win

---

### SEC-046 [MEDIUM] — Dev tools in production dependencies

**Beschrijving**: `nodemon`, `drizzle-kit`, `tsx`, `@types/*` packages in `dependencies` ipv. `devDependencies`.

**Aanbeveling**: Verplaats naar `devDependencies`.

**Effort**: Quick-win

---

### SEC-047 [MEDIUM] — Wildcard versies voor `clsx` en `tailwind-merge`

**Aanbeveling**: Pin naar expliciete semver ranges.

**Effort**: Quick-win

---

### SEC-048 [MEDIUM] — `stripe-replit-sync` niche package

**Beschrijving**: Klein package met beperkte community review, gebruikt in Stripe payment processing.

**Aanbeveling**: Audit source code. Overweeg vervanging door officieel Stripe webhook handling.

**Effort**: Medium

---

## Track 6: Infrastructure & Transport

### SEC-049 [CRITICAL] — Geen rate limiting op enig endpoint

**Beschrijving**: Geen `express-rate-limit` of equivalent op alle servers. Inclusief login, AI, file upload, en WebSocket endpoints.

**Impact**: Brute-force login, onbeperkte OpenAI/ElevenLabs/Mux kosten, DoS.

**Aanbeveling**: Installeer `express-rate-limit` met tiered limits:
- Auth: 5 attempts/IP/15min
- AI endpoints: 30 req/user/min
- File uploads: 10/user/uur
- General: 100 req/IP/min

**Effort**: Medium

---

### SEC-050 [CRITICAL] — WebSocket connecties zonder authenticatie

**Beschrijving**: `/ws/scribe` en `/ws/stream-response` accepteren connecties zonder JWT/session validatie. Elke connectie maakt upstream ElevenLabs/OpenAI verbindingen.

**Locatie**:
- [server/hugo-engine/elevenlabs-stt.ts:22-28](server/hugo-engine/elevenlabs-stt.ts#L22-L28)
- [server/hugo-engine/streaming-response.ts:92-98](server/hugo-engine/streaming-response.ts#L92-L98)

**Impact**: Onbeperkte financiele exposure via ElevenLabs STT + OpenAI + ElevenLabs TTS.

**Aanbeveling**: Vereis JWT als query parameter bij WebSocket upgrade. Max 2 connecties per user.

**Effort**: Medium

---

### SEC-051 [CRITICAL] — `--allow-unauthenticated` op Cloud Run

**Beschrijving**: De Cloud Run video processor is publiek toegankelijk. `/health` lekt configuratie details, `/test-supabase` kan database records wijzigen.

**Locatie**: [cloud-run/cloudbuild.yaml:26](cloud-run/cloudbuild.yaml#L26)

**Aanbeveling**: Verwijder `--allow-unauthenticated`. Gebruik IAM-based authenticatie.

**Effort**: Medium

---

### SEC-052 [HIGH] — Container draait als root

**Locatie**: [cloud-run/Dockerfile](cloud-run/Dockerfile)

**Aanbeveling**: Voeg `USER` directive toe voor non-root execution.

**Effort**: Quick-win

---

### SEC-053 [HIGH] — Geen HTTP-to-HTTPS redirect

**Locatie**: [server/production-server.js](server/production-server.js)

**Aanbeveling**: Check `X-Forwarded-Proto` header en redirect.

**Effort**: Quick-win

---

### SEC-054 [HIGH] — `allowedHosts: true` — DNS rebinding kwetsbaarheid

**Locatie**: [vite.config.ts:119](vite.config.ts#L119)

**Aanbeveling**: Vervang door expliciete allowlist.

**Effort**: Quick-win

---

### SEC-055 [HIGH] — Geen WebSocket connection limits

**Locatie**: [server/hugo-engine/elevenlabs-stt.ts:20](server/hugo-engine/elevenlabs-stt.ts#L20)

**Aanbeveling**: Voeg `maxConnections` check toe.

**Effort**: Quick-win

---

### SEC-056 [HIGH] — Unauthenticated `/test-supabase` endpoint op Cloud Run

**Locatie**: [cloud-run/worker.py:1744-1773](cloud-run/worker.py#L1744-L1773)

**Aanbeveling**: Verwijder of voeg `WORKER_SECRET` auth toe.

**Effort**: Quick-win

---

### SEC-057 [MEDIUM] — FFmpeg binary gedownload zonder checksum verificatie

**Locatie**: [cloud-run/Dockerfile:4-9](cloud-run/Dockerfile#L4-L9)

**Aanbeveling**: Verifieer SHA256 checksum na download.

**Effort**: Quick-win

---

### SEC-058 [MEDIUM] — Dev server bound to 0.0.0.0

**Locatie**: [vite.config.ts:118](vite.config.ts#L118)

**Aanbeveling**: Verander naar `localhost` tenzij device testing nodig.

**Effort**: Quick-win

---

### SEC-059 [MEDIUM] — Health endpoint lekt configuratie details

**Locatie**: [cloud-run/worker.py:1001-1028](cloud-run/worker.py#L1001-L1028)

**Aanbeveling**: Return alleen `{"status": "ok"}`.

**Effort**: Quick-win

---

### SEC-060 [MEDIUM] — Geen WebSocket message validatie

**Locatie**: [server/hugo-engine/streaming-response.ts:113-123](server/hugo-engine/streaming-response.ts#L113-L123)

**Aanbeveling**: Voeg schema validatie en message size limit toe.

**Effort**: Quick-win

---

### SEC-061 [MEDIUM] — Excessive Cloud Run timeout (3600s)

**Aanbeveling**: Evalueer of 1 uur nodig is. Voeg `--max-instances` toe.

**Effort**: Medium

---

## Track 7: Business Logic

### SEC-062 [CRITICAL] — IDOR: Session access zonder ownership verificatie

**Beschrijving**: Session endpoints checken alleen of een sessie bestaat, nooit of de aanvrager de eigenaar is. Session IDs zijn voorspelbaar (`session-<nanoid12>`).

**Locatie**: [server/hugo-engine/routes.ts:502-800](server/hugo-engine/routes.ts#L502-L800)

**Impact**: Elke gebruiker kan een ander's coaching gesprekken lezen, berichten injecteren, context resetten, en mode transitions triggeren.

**Aanbeveling**: Voeg `session.userId === authenticatedUserId` checks toe.

**Effort**: Quick-win (na SEC-001 fix)

---

### SEC-063 [HIGH] — LiveKit token: geen auth, onbeperkte room access

**Beschrijving**: LiveKit token endpoint genereert tokens met volledige publish/subscribe rechten zonder authenticatie. Geen TTL in `api.ts`.

**Locatie**:
- [server/hugo-engine/api.ts:1975-2018](server/hugo-engine/api.ts#L1975-L2018)
- [server/hugo-engine/routes.ts:4858-4909](server/hugo-engine/routes.ts#L4858-L4909)

**Aanbeveling**: Vereis auth, scope tokens per user, kortere TTL (15-30 min).

**Effort**: Quick-win

---

### SEC-064 [HIGH] — HeyGen avatar tokens zonder auth

**Locatie**: [server/hugo-engine/routes.ts:3398-3563](server/hugo-engine/routes.ts#L3398-L3563)

**Impact**: Financiele abuse — elke HeyGen sessie kost geld.

**Aanbeveling**: Vereis auth + rate limiting.

**Effort**: Quick-win

---

### SEC-065 [HIGH] — Analysis results: cross-user data exposure

**Beschrijving**: `GET /api/v2/analysis/list` zonder `userId` retourneert ALLE analyses van ALLE users inclusief PII.

**Locatie**: [server/hugo-engine/api.ts:3791-3875](server/hugo-engine/api.ts#L3791-L3875)

**Aanbeveling**: Filter queries op authenticated user ID.

**Effort**: Quick-win

---

### SEC-066 [HIGH] — AI endpoints: geen rate limiting, onbeperkte kosten

**Beschrijving**: Alle AI endpoints (coach, roleplay, analysis, RAG) zijn publiek toegankelijk en triggeren dure OpenAI calls.

**Impact**: Potentieel duizenden euro's schade in minuten.

**Aanbeveling**: Vereis auth + per-user rate limiting.

**Effort**: Medium

---

### SEC-067 [MEDIUM] — Mux videos: public playback policy

**Beschrijving**: Alle Mux assets gebruiken `playback_policy: ['public']`. Proprietary training video's zijn toegankelijk met alleen een playback ID.

**Locatie**: [src/services/mux.ts:25](src/services/mux.ts#L25)

**Aanbeveling**: Switch naar `signed` playback policy met server-side token generatie.

**Effort**: Medium

---

### SEC-068 [MEDIUM] — HeyGen knowledge base ID exposed in client

**Locatie**: [src/components/HH/HeyGenAvatar.tsx:15-16](src/components/HH/HeyGenAvatar.tsx#L15-L16)

**Aanbeveling**: Verplaats naar server-side endpoint.

**Effort**: Quick-win

---

### Positieve observatie: Stripe webhook correct beveiligd

De Stripe webhook handler gebruikt `stripe.webhooks.constructEventAsync()` voor cryptografische signature verificatie. Goed geimplementeerd.

---

## Remediation Roadmap

### Fase 1: Blokkerende Issues (Week 1) — Quick-wins

| # | Actie | Findings | Geschatte duur |
|---|-------|----------|---------------|
| 1 | Verwijder `"demo-host-key"` uit alle 6 endpoints | SEC-002 | 15 min |
| 2 | Gate `/_dev/` en `/_dark/` routes achter `import.meta.env.DEV` | SEC-003 | 15 min |
| 3 | Verwijder `VITE_VIDEO_PROCESSOR_SECRET` uit frontend | SEC-029 | 1 uur |
| 4 | Installeer `helmet` + configureer security headers | SEC-021, SEC-027 | 30 min |
| 5 | Beperk CORS tot frontend domeinen | SEC-006 | 15 min |
| 6 | Verlaag JSON body limit naar 1MB | SEC-012 | 5 min |
| 7 | Fix error handler `throw err` | SEC-017 | 5 min |
| 8 | Fail-fast op ontbrekende secrets (service role, OpenAI) | SEC-007, SEC-030, SEC-033 | 30 min |
| 9 | Voeg auth toe aan SSO token generatie | SEC-004 | 30 min |
| 10 | Verwijder/beveilig `/test-supabase` endpoint | SEC-056 | 15 min |
| 11 | Whitelist SQL kolom namen | SEC-026 | 15 min |
| 12 | Verwijder `systemContext` client injectie | SEC-024 | 15 min |
| 13 | Fix `.gitignore` voor service accounts | SEC-032 | 5 min |
| 14 | Run `npm audit fix` | SEC-041 | 15 min |
| 15 | Pin `@supabase/supabase-js` naar `^2.98.0` | SEC-040, SEC-047 | 5 min |
| 16 | Verwijder 13 ongebruikte dependencies | SEC-045 | 15 min |
| 17 | Verplaats dev tools naar devDependencies | SEC-046 | 10 min |
| 18 | Voeg WebSocket connection limits toe | SEC-055 | 30 min |
| 19 | Fix `allowedHosts` in vite.config | SEC-054 | 5 min |
| 20 | Voeg Dockerfile `USER` directive toe | SEC-052 | 10 min |

**Geschatte totale duur Fase 1**: ~5-6 uur

### Fase 2: Authenticatie Foundation (Week 2-3)

| # | Actie | Findings | Geschatte duur |
|---|-------|----------|---------------|
| 1 | **JWT auth middleware op Express servers** | SEC-001, SEC-010 | 2-3 dagen |
| 2 | Server-side role checks voor admin routes | SEC-005, SEC-013 | 1 dag |
| 3 | Session ownership verificatie | SEC-062 | 4 uur |
| 4 | Rate limiting met `express-rate-limit` | SEC-049, SEC-066 | 1 dag |
| 5 | WebSocket authenticatie | SEC-050 | 4 uur |
| 6 | Auth op LiveKit/HeyGen token endpoints | SEC-063, SEC-064 | 2 uur |
| 7 | Auth op analysis endpoints + user filtering | SEC-065 | 2 uur |
| 8 | HTTPS enforcement via X-Forwarded-Proto | SEC-053 | 1 uur |

### Fase 3: Hardening (Maand 1-2)

| # | Actie | Findings |
|---|-------|----------|
| 1 | Vervang `execAsync()` door `spawn()` in audio compressor | SEC-022 |
| 2 | Mux signed playback policy | SEC-067 |
| 3 | Verwijder `--allow-unauthenticated` van Cloud Run | SEC-051 |
| 4 | Zod request body validatie op alle endpoints | SEC-020 |
| 5 | OpenAI SDK upgrade naar v6 | SEC-043 |
| 6 | Prompt injection mitigatie | SEC-025 |
| 7 | SSRF bescherming in website analyzer | SEC-028 |
| 8 | Body size limits op video processor | SEC-011 |
| 9 | Stripe subscription endpoint auth | SEC-014 |
| 10 | User-scoped Supabase clients ipv. service role | Track 7 |
| 11 | Python dependency upper bounds | SEC-044 |

---

## Appendix: Severity Definitions

| Severity | Criteria | Voorbeelden |
|----------|----------|-------------|
| **CRITICAL** | Directe data breach, account takeover, of significante financiele schade mogelijk zonder speciale kennis | Onbeveiligde admin endpoints, hardcoded backdoors |
| **HIGH** | Significante impact; exploitation vereist enige kennis of specifieke voorwaarden | IDOR, ontbrekende auth op gevoelige endpoints |
| **MEDIUM** | Beperkte impact of vereist specifieke omstandigheden | Ontbrekende headers, verbose errors, information disclosure |
| **LOW** | Best-practice afwijking met minimale directe impact | Hardcoded non-secret IDs, suboptimale configuratie |
