# Security Audit Design — HugoHerbots.ai

**Datum**: 2026-03-02
**Status**: Pre-launch / Staging
**Doel**: Volledige security audit met geprioriteerd rapport
**Output**: Rapport eerst → dan samen fixen

---

## Scope

B2B SaaS Sales Coaching Platform met:
- React 18 + TypeScript frontend (Vite)
- Express 5 backend op 3 poorten (5000, 3001, 3002)
- Supabase Auth (JWT + OAuth)
- PostgreSQL (Supabase + Neon) met Drizzle ORM + pgvector
- 40+ REST API endpoints + WebSocket
- Externe integraties: OpenAI, ElevenLabs, HeyGen, LiveKit, Stripe, Mux, Daily.co
- Google Cloud Run deployment (video processor)
- File uploads via Multer/Mux

---

## Audit Structuur — 7 Parallelle Tracks

### Track 1: Authentication & Authorization
- Supabase client configuratie en session management
- OAuth flow (Google, Azure) + PKCE
- Role-based access control (super admin, team admin, user)
- Admin route protection en HOST_SECRET_KEY verificatie
- Dev-preview bypass routes (`/_dev/*`, `/_dark/*`)
- Demo credential fallbacks (`"demo-host-key"`)
- Token refresh en expiry handling

### Track 2: API Endpoint Security
- Auth guards op alle 40+ endpoints
- Input validation per endpoint (Zod schemas)
- CORS configuratie en allowed origins
- Error handling en information leakage
- Request size limits
- HTTP method restrictions
- Express middleware chain

### Track 3: Injection & XSS
- SQL injection via Drizzle ORM (parameterized queries check)
- XSS in user-generated content en coach responses
- HTML sanitization in rendering pipeline
- Command injection in video processing pipeline
- Template injection in AI prompt construction
- NoSQL injection in Supabase queries

### Track 4: Secrets & Configuration
- Hardcoded credentials in source code
- Supabase anon key exposure in frontend (verwacht maar verifiëren)
- .env coverage vs. vereiste secrets
- Google service account JSON handling
- API key exposure in client-side code
- Demo/fallback credentials in production paths

### Track 5: Dependencies
- `npm audit` voor Node.js packages
- Python dependency vulnerabilities
- Outdated packages met bekende CVEs
- Unused dependencies (aanvalsoppervlak reductie)
- Supply chain risico's

### Track 6: Infrastructure & Transport
- Cloud Run configuratie (allow-unauthenticated)
- Vite proxy configuratie en allowed hosts
- WebSocket security (LiveKit, custom WS)
- Content Security Policy (CSP) headers
- HTTPS enforcement
- Rate limiting
- HSTS, X-Frame-Options, X-Content-Type-Options headers

### Track 7: Business Logic
- IDOR: toegang tot andermans sessies, video progress, analyses
- Stripe webhook signature verification
- LiveKit token scoping (room access, permissions)
- Privilege escalation (user → admin)
- File upload abuse (type, size, content)
- RAG document access control
- Video/audio stream access control

---

## Severity Classificatie

| Severity | Criteria |
|----------|----------|
| **Critical** | Directe data breach of account takeover mogelijk |
| **High** | Significante impact, exploitation vereist enige kennis |
| **Medium** | Beperkte impact of specifieke omstandigheden vereist |
| **Low** | Best-practice afwijking, minimale directe impact |

---

## Rapport Format (per finding)

1. **ID** + **Severity** label (bijv. `SEC-001 [CRITICAL]`)
2. **Beschrijving** — wat is het probleem
3. **Locatie** — exact bestand + regelnummer
4. **Impact** — wat kan een aanvaller hiermee
5. **Aanbeveling** — concrete fix met code-voorbeeld
6. **Effort** — Quick-win / Medium / Large

Plus **Executive Summary** met totaal-overzicht en top-5 prioriteiten.

---

## Aanpak

- 7 gespecialiseerde agents analyseren elk een track parallel
- Resultaten worden samengevoegd in één geprioriteerd rapport
- Rapport wordt opgeslagen als `docs/security/SECURITY-AUDIT-2026-03-02.md`
- Na review samen beslissen welke fixes prioriteit krijgen
