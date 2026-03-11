# Preflight Brain Architecture — Hugo's Voorbereiding

## Context

**Probleem:** De V3 agent denkt na over strategie, context, en klantpersona TIJDENS het gesprek. Dit veroorzaakt:
- Trage tool calls (recall_memories 500-1500ms, search_training_materials 500-2000ms)
- Voice mode onbruikbaar (10-20s latency)
- Inconsistente coaching (Sonnet moet per beurt uitzoeken wat de strategie is)
- Oppervlakkige rollenspellen (generieke klant ipv sector-specifiek)

**Inzicht (Stéphane):** Een echte coach bereidt zich voor. Een echte klant verzint antwoorden niet ter plekke — die zitten al klaar. De AI moet hetzelfde doen: EERST denken (bij login), DAARNA coachen (tijdens gesprek).

**Doel:** Betere coaching die ook sneller is — niet "goedkoper model met minder tools" maar "beter voorbereide coach die daardoor ook sneller is."

---

## Architectuur: Twee Fasen

### Fase 1: Preflight (bij login, achtergrond, ~15-30s)

Sonnet + extended thinking verwerkt ALLE beschikbare data en genereert Hugo's **"Brain"** — zijn sessienotities, coachingplan, en een kant-en-klare klantpersona met vooraf bedachte antwoorden.

**Input (~8-10K tokens):**
- `buildUserBriefing()` output (profiel, mastery, activiteit, memories)
- Laatste 10 verloren deals met verliesredenen (uit context gathering / analyses)
- Laatste 10 gewonnen deals met koopredenen (baten, niet voordelen — EPIC keten: oplossing → voordeel → baat)
- Alle user_memories (laatste 15, inclusief admin_corrections van Hugo)
- Samenvattingen recente sessies + analyses
- Compacte SSOT referentie (47 technieken, 9 houdingen)

**Output: Brain Document (~4-5K tokens):**

```
═══ HUGO'S BRAIN — [naam] ═══

── SELLER ──
[profiel, bedrijf, sector, product, klanttype, ervaring]
[sessie-stats, mastery highlights, laatste activiteit]

── COACHING STRATEGIE ──
[Doel vandaag — gebaseerd op mastery gaps + memories + sessiegeschiedenis]
[Focus technieken — zwakste scores, dalende trends, niet-geoefend maar relevant]
[Aanpak — coaching vs rollenspel vs script, welke volgorde]
[Als seller X vraagt → coaching richting Y]
[Als seller wil oefenen → begin met techniek Z, persona A]

── STERKE PUNTEN ──
[Per techniek: score, trend, waarom sterk]

── WERKPUNTEN ──
[Per techniek: score, trend, concreet probleem, oefenrichting]

── HERINNERINGEN ──
[doelen, struggles, persoonlijke context, admin corrections]

── SECTOR DATA (reverse engineered uit échte deals) ──
Top koopredenen (BATEN, niet voordelen):
1. [baat] ← gebaseerd op echte gewonnen deals
2. [baat]
3. [baat]
Top verliesredenen:
1. [reden + houding type] ← gebaseerd op echte verloren deals
2. [reden + houding type]
3. [reden + houding type]
Concurrenten: [uit echte data]

── KLANTPERSONA (roleplay-ready) ──
[Naam, leeftijd, beroep, gedragsstijl, koopklok-fase, ervaring, moeilijkheidsgraad]
[Reden: waarom dit persona past bij seller's leerdoel]
[Achtergrondverhaal: situatie, motivatie, budget, tijdslijn]

Geselecteerde baten (3): [uit sector data — dit zijn de baten die seller moet VINDEN]
Geselecteerde verliesredenen (2-3): [dit zijn de bezwaren die de klant gaat uiten]

Win-conditie: Als seller alle 3 baten vindt en bezwaar X correct behandelt →
klant committeert. Als niet → klant stelt uit / haakt af.

Vooraf bedachte antwoorden (15-20):
- "Hoe bij ons gekomen?" → "[specifiek antwoord gebaseerd op sector]"
- "Wat sprak aan?" → "[baat-gerelateerd antwoord]"
- "Huidige situatie?" → "[achtergrondverhaal detail]"
- "Budget?" → "[realistisch voor sector]"
- "Tijdslijn?" → "[context-specifiek]"
- "Wie beslist mee?" → "[relevant voor sector]"
- "Ervaring met concurrenten?" → "[gebaseerd op echte concurrent-data]"
- "Bezwaar prijs (H7)" → "[sector-specifiek, gebaseerd op echte verliesreden]"
- "Twijfel (H6)" → "[gebaseerd op echte twijfels uit data]"
- "Uitstel (H8)" → "[gebaseerd op echte uitstellen uit data]"
- [... 5-10 meer sector-specifieke antwoorden]

Debrief template:
"Je vond [X] van de 3 baten. [Baat Y] miste je. Met [techniek Z] had je
gevraagd: '[voorbeeldvraag]' en dan had ik je verteld: '[baat-antwoord]'.
Dat had bezwaar [W] minder doorslaggevend gemaakt."

═══ EINDE BRAIN ═══
```

### Fase 2: Runtime (per gesprekbeurt, Sonnet, snel)

- Brain document zit in het system prompt → Sonnet leest en handelt ernaar
- Beschikbare tools: alleen snelle (<50ms):
  - `start_roleplay`, `process_roleplay_turn`, `end_roleplay` (state management)
  - `select_customer_attitude`, `classify_customer_signal`, `get_recommended_techniques`, `evaluate_technique` (methodology)
  - `search_methodology` (SSOT lookup)
  - `save_insight` (async, fire-and-forget — voor VOLGENDE brain generatie)
- **Verwijderd:** recall_memories, get_user_profile, search_training_materials, suggest_video, get_technique_script
- Voice: 1-3 zinnen, geen thinking, max 500 tokens
- Tekst: langere antwoorden, geen thinking nodig (brain geeft richting)

---

## Zelflerend Systeem — Twee Lagen

### Laag 1: Data verbetert Brain Inhoud (automatisch)

```
Seller activiteit → nieuwe data → brain hergenereert → betere coaching
                                                          ↓
Hugo admin review → admin_correction memories → brain leest correcties
                                                          ↓
Golden standard sessies → referentie-data → brain gebruikt als voorbeeld
```

- Elke sessie produceert nieuwe memories (via save_insight)
- Hugo's admin reviews produceren admin_corrections
- Context gathering verzamelt koopredenen / verliesredenen
- Volgende brain-generatie leest al deze updates → output verbetert automatisch

### Laag 2: Hugo's Meta-Feedback verbetert Brain Template (via config review)

```
Hugo reviewt coaching sessies → ziet patroon → chat met AI admin agent
     ↓
AI interpreteert feedback → stelt template-wijziging voor via config review
     ↓
"Brain template moet meer nadruk leggen op bezwaarbehandeling"
"Brain template moet sector-specifieke storytelling voorbeelden genereren"
     ↓
Superadmin valideert → brain template evolueert
```

- Brain template is NIET vast — het is een versioned config in de database
- Hugo's feedback op sessies leidt tot template-verbeteringsvoorstellen
- LangWatch simulaties meten brain-kwaliteit → flaggen regressies
- Superadmin (Stéphane) valideert template-wijzigingen

---

## Caching Strategie

**Opslag:** `user_brain_cache` tabel in Supabase

```sql
CREATE TABLE user_brain_cache (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id),
  brain_document TEXT NOT NULL,
  template_version INT NOT NULL,
  context_hash VARCHAR(64) NOT NULL,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata JSONB  -- model, tokens, timing
);
```

**Context hash:** SHA-256 van:
- User profiel velden
- Sessie count + laatste sessie timestamp
- Laatste memory timestamp
- Laatste analyse timestamp
- Mastery scores (gesorteerd)
- Template version

**Invalidatie:** Brain wordt opnieuw gegenereerd wanneer:
1. Context hash verandert (nieuwe sessie, analyse, memory, profiel update)
2. Template versie verandert (Hugo's meta-feedback gevalideerd)
3. Cache ouder dan 24 uur (TTL)

**In-memory cache:** Server houdt `Map<userId, { brain, hash, ts }>` met 30 min TTL.

**Verwachte regeneraties:** ~5-10 per maand per actieve user (niet bij elke login).

---

## Technische Implementatie

### Nieuwe bestanden

| Bestand | Doel |
|---------|------|
| `server/hugo-engine/v3/preflight.ts` | Brain generatie logica: data assemblage, Sonnet call, caching |
| `server/hugo-engine/v3/brain-template.ts` | Versioned brain template (default + DB overrides) |

### Gewijzigde bestanden

| Bestand | Wijziging |
|---------|-----------|
| `server/hugo-engine/v3/routes.ts` | Nieuw endpoint `POST /api/v3/preflight` + session start gebruikt brain |
| `server/hugo-engine/v3/agent.ts` | `getBrainToolDefinitions()` — fast tools only wanneer brain beschikbaar |
| `server/hugo-engine/v3/system-prompt.ts` | `buildBrainSystemPrompt()` — injecteert brain ipv briefing |
| `server/hugo-engine/v3/system-prompt-voice.ts` | Gebruikt brain ipv briefing (al deels klaar) |
| `server/hugo-engine/v3/voice-routes.ts` | `/signed-url` triggert brain check/generatie |
| `server/hugo-engine/v3/user-briefing.ts` | Uitbreiden met koopredenen/verliesredenen data |
| `src/contexts/UserContext.tsx` | Fire-and-forget preflight call bij login |

### Bestaande functies die hergebruikt worden

| Functie | Bestand | Hergebruik |
|---------|---------|------------|
| `buildUserBriefing()` | `user-briefing.ts` | Basis data voor preflight input |
| `getMemoriesForUser()` | `memory-service.ts` | Alle memories laden (niet semantic search) |
| `getAnthropicClient()` | `anthropic-client.ts` | Claude client voor preflight call |
| `formatBriefingForPrompt()` | `user-briefing.ts` | Basis formatting (uitgebreid voor brain) |
| `createSession()` | `agent.ts` | Session creation met brain parameter |
| Roleplay tools | `tools/roleplay.ts` | Ongewijzigd — state management blijft |
| Methodology tools | `tools/methodology.ts` | Ongewijzigd — houding selectie blijft |

### Database migratie

```sql
-- user_brain_cache tabel
CREATE TABLE user_brain_cache (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id),
  brain_document TEXT NOT NULL,
  template_version INT NOT NULL DEFAULT 1,
  context_hash VARCHAR(64) NOT NULL,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata JSONB
);

-- brain_templates tabel (voor versioned templates)
CREATE TABLE brain_templates (
  id SERIAL PRIMARY KEY,
  version INT NOT NULL UNIQUE,
  template TEXT NOT NULL,
  description TEXT,
  created_by TEXT,  -- 'system' of admin email
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  active BOOLEAN NOT NULL DEFAULT false
);
```

---

## Migratie Pad

V3 is superadmin-only → brain is automatisch alleen voor Stéphane. Geen feature flag nodig.

### Fase 1: Brain Infrastructuur + Tekst-coaching
1. Database migraties (user_brain_cache, brain_templates)
2. `preflight.ts` — brain generatie + caching
3. `brain-template.ts` — default template + DB versioning
4. `POST /api/v3/preflight` endpoint
5. Frontend trigger in UserContext.tsx (fire-and-forget bij login)
6. `system-prompt.ts` gebruikt brain wanneer beschikbaar (fallback naar briefing als niet)
7. `agent.ts` tool set: fast tools + save_insight + script builder wanneer brain beschikbaar
8. Test: coaching kwaliteit, brain inhoud, caching

### Fase 2: Voice integratie
1. `system-prompt-voice.ts` gebruikt brain ipv briefing
2. `voice-routes.ts` laadt brain bij signed-url
3. Voice tool set: alleen fast tools (al geïmplementeerd)
4. Test: latency meting, voice kwaliteit, roleplay met brain

### Fase 3: Zelflerend (na validatie)
1. Admin tools: brain template review + wijzigingsvoorstellen
2. LangWatch brain-kwaliteit metrics
3. Config review flow voor template evolution
4. Automatische brain-template refinement loop

---

## Kosten

| Component | Per keer | Per user/maand | % van €49 abo |
|-----------|----------|----------------|---------------|
| Preflight (Sonnet + thinking) | ~€0.19 | ~€1-2 (5-10x) | 2-4% |
| Runtime per beurt (Sonnet, geen tools) | ~€0.04 | ~€2-4 (50-100 beurten) | 4-8% |
| **Totaal** | | **~€3-6** | **6-12%** |

Vergelijk: huidig systeem met tool calls kost ~€4-8/user/maand. Brain is vergelijkbaar in kosten maar significant sneller en kwalitatief beter.

---

## Verificatie

1. `npm run build` slaagt
2. Preflight endpoint retourneert brain document voor testuser
3. Brain document bevat sector-specifieke data (niet generiek)
4. Voice mode met brain: latency < 2 seconden first-token
5. Roleplay met brain: klant geeft sector-specifieke antwoorden
6. Debrief na roleplay: "je vond X van Y baten" — concreet, niet generiek
7. Cache werkt: tweede login dezelfde dag = instant brain (geen regeneratie)
8. Tekst-coaching met brain: coherente strategie over meerdere beurten
9. LangWatch scenario tests: brain-mode scores >= non-brain scores
