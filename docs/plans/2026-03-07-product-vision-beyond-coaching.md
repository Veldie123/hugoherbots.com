# HugoHerbots.ai — Product Vision: Beyond Coaching

**Datum:** 2026-03-07
**Type:** Strategic brainstorm → design document
**Trigger:** Twee principes uit Boris Power's artikel over Claude Code

## Context

Twee principes uit een artikel over hoe Claude Code gebouwd werd:

1. **"Build for the model six months from now"** — Boris bouwde Claude Code voor een AI-model dat nog niet bestond. Sonnet 3.5 schreef 20% van zijn code. Hij bouwde toch de volledige agent-infra, wettende dat het model zou bijbenen. Toen Opus 4 uitkwam, klikte alles.

2. **"Latent demand is the single best product signal"** — Kijk hoe gebruikers je product misbruiken voor dingen waarvoor het niet ontworpen is. Facebook Marketplace ontstond omdat 40% van groepsposts buy-and-sell waren.

**Vraag:** Voldoet HugoHerbots.ai hieraan?

## Analyse: Waar staat het platform nu?

### Wat er is (sterk fundament)
- V2 production: Multi-engine coaching (OpenAI GPT), roleplay, analyse, video, audio
- V3 experimental: Single Claude agent + 26 tools, extended thinking, memory, EPIC regels
- Content SSOT: 54 technieken, 9 houdingen, Hugo's persona — allemaal in JSON config
- Multimodal: Text chat, ElevenLabs voice (TTS), HeyGen avatar, Deepgram STT
- Dummy UI: "Live Analyse" card in ConversationAnalysis.tsx:614-764 — real-time coaching shell bestaat al

### Wat ontbreekt (drie gaten)
1. **Real-time in-call coaching** — Hugo kan je laten oefenen en achteraf analyseren, maar niet live meefluisteren
2. **Management layer** — Het platform is 100% verkoper-gericht. Geen dashboard voor sales managers/CEO's
3. **Tangible output** — Coaching verbetert vaardigheden, maar levert geen document op dat je kunt gebruiken

## Drie Nieuwe Product-Pijlers

### Pijler 1: Real-time In-Call Coach ("Hugo in je oor")

**Wat:** Hugo luistert mee tijdens echte sales calls en geeft real-time tips.

**Flow:**
```
Verkoper start call (Teams/Zoom/telefoon)
  → Opent "Live Analyse" in Hugo's platform
  → Browser mic vangt audio op (of screen share audio)
  → STT transcribeert real-time (Deepgram)
  → Claude analyseert elke beurt:
      • Detecteert klanthouding (H1-H9)
      • Identificeert gebruikte techniek
      • Vergelijkt met aanbevolen techniek
  → Hugo's tips verschijnen real-time:
      "Verdiep: Stel nu een open vraag (Techniek 2.1.2)"
      "Let op: Dit is uitstel. Gebruik de indien-techniek."
      "Goed bezig: Sterke impactvraag!"
```

**Bestaande bouwblokken:**
- Dummy UI in ConversationAnalysis.tsx (5 tip-types: verdiep, lock, wedervraag, waarschuwing, positief)
- 54 technieken met detectiemarkers in technieken_index.json
- 9 houdingen met semantic markers in klant_houdingen.json
- Deepgram STT (al geïntegreerd in V2)
- V3 tool: evaluate_technique + select_customer_attitude

**Punt 7 alignment:** Over 6 maanden is real-time audio + tool calling standaard. De infra die je nu bouwt wordt exponentieel beter met elk nieuw model. Niemand in B2B sales coaching heeft dit.

**Punt 8 alignment:** Verkopers gaan dit gebruiken voor calls die geen "sales" zijn — klantgesprekken, onderhandelingen, pitches. Dat is latent demand.

### Pijler 2: Management Dashboard ("De sales manager view")

**Wat:** Sales managers en CEO's zien hoe hun team presteert, live en over tijd.

**Wat de manager wil:**

| KPI | Data-bron |
|-----|-----------|
| Team EPIC score (gemiddeld) | Analyse uploads + roleplay scores |
| Score per fase (E/P/I/C apart) | Evaluator scores per techniek |
| Techniek heatmap (sterk/zwak) | Alle sessies aggregeren |
| Individuele voortgang over tijd | Sessie-historie per user |
| Live sessies nu | Real-time coaching activiteit |
| Gebruik statistieken | Sessies/week, tijd besteed, analyses |
| ROI bewijs | Score-delta sinds start coaching |

**Twee ingangen:**
- **Passief:** Manager koopt licenties voor team → ziet dashboard met resultaten
- **Actief:** Manager gaat zelf Hugo's coaching gebruiken → vergelijkt met team

**Business model impact:**
- Verkoper betaalt voor coaching (individueel)
- Manager betaalt voor zichtbaarheid (team overzicht)
- Twee pricing tiers, twee value propositions
- De manager die investeert in het team = recurring revenue + upsell

**Punt 7 alignment:** Het model van morgen kan proactief rapporteren: "Jan's afsluittechnieken zakken. Ik stel voor dat hij deze week focust op proefafsluitingen."

**Punt 8 alignment:** Managers gaan Hugo's team-data gebruiken voor hiring beslissingen ("Welk profiel scoort het best op EPIC?"), coaching toewijzing, en zelfs klant-toewijzing. Niet waarvoor het ontworpen is.

### Pijler 3: Script Builder ("Hugo schrijft je verkoopscript")

**Wat:** Na voldoende coaching genereert Hugo een compleet, gepersonaliseerd verkoopscript per EPIC fase.

**Wanneer beschikbaar:** Hugo AI triggered dit automatisch als:
- ≥5 coaching sessies voltooid
- Context compleet (product, sector, klanttype, DMU)
- ≥3 analyse uploads beschikbaar (echte gesprekken)

**Wat het script bevat:**
```
FASE 1 — OPENING
├─ Gentleman's Agreement (uitgeschreven, gepersonaliseerd)
├─ POP Presentatie (korte intro)
└─ Koopklimaat openers (3 varianten)

FASE 2 — ONTDEKKING (E.P.I.C.)
├─ EXPLORE: 5 open vragen rond klantpijnpunten
├─ PROBE: 3 hypothetische verdiepingsvragen
├─ IMPACT: 3 consequentievragen (€/tijd/risico)
└─ COMMIT: 2 buy-in checks

FASE 3 — AANBEVELING (O.V.B.)
├─ Per pijnpunt: Oplossing → Voordeel → Baat
└─ Verwachtingsmanagement

FASE 4 — AFSLUITING
├─ Proefafsluiting (3 varianten)
├─ Top 5 bezwaren + behandeling (uit echte data)
└─ Sluittechnieken op maat
```

**Reverse engineering logica:**
- Analyseer de laatste 20 gewonnen deals → top 5 koopmotieven → worden IMPACT vragen
- Analyseer verloren deals → top 5 bezwaren → worden bezwaarbehandelingen
- Analyseer succesvolle gesprekken → welke openingsvragen werkten → worden EXPLORE vragen

**Als V3 tool:**
```
Tool: generate_sales_script
Triggers: automatisch als voldoende data, of op verzoek
Input: user_id, focus_phase (optioneel), klant_segment (optioneel)
Output: Gestructureerd script in markdown, per EPIC fase
```

**Iteratief:** Het script verbetert met elke sessie. Nieuwe analyse → script update. Nieuwe roleplay → bezwaarbehandeling verfijnd.

**Punt 7 alignment:** Over 6 maanden genereert Claude niet alleen het script — het past het real-time aan op basis van hoe het gesprek verloopt (combinatie script builder + real-time coach).

**Punt 8 alignment:** Verkopers gaan vragen: "Kan Hugo ook een script maken voor mijn andere productlijn?" "Voor mijn nieuwe markt?" "Voor mijn collega die net begint?" Dat is latent demand → meer licenties.

## De Flywheel: Hoe alles verbindt

```
┌──────────────┐     data      ┌──────────────────┐
│  VERKOPER    │──────────────▶│  MANAGEMENT      │
│              │               │  DASHBOARD       │
│ • Coaching   │               │                  │
│ • Roleplay   │  scores +     │ • Team KPIs      │
│ • Analyse    │  technieken   │ • Heatmaps       │
│ • Script     │               │ • ROI bewijs     │
│ • Real-time  │               │ • Live sessies   │
└──────┬───────┘               └────────┬─────────┘
       │                                │
       │  script als                    │ meer licenties
       │  baseline                      │ = meer data
       ▼                                ▼
┌──────────────┐               ┌──────────────────┐
│ REAL-TIME    │   vergelijkt  │  MEER VERKOPERS  │
│ IN-CALL      │◀──────────────│  IN HET TEAM     │
│ COACH        │   script vs   │                  │
│              │   werkelijk   │  → meer scripts   │
│ Hugo checkt  │               │  → meer data      │
│ live of je   │               │  → betere KPIs    │
│ script volgt │               │  → meer ROI bewijs│
└──────────────┘               └──────────────────┘
```

**De cyclus:**
1. Verkoper coached → genereert data
2. Data voedt script → verkoper heeft tangible output
3. Script wordt baseline voor real-time coach → betere calls
4. Betere calls → betere analyse data → betere KPIs
5. Manager ziet KPIs → koopt meer licenties
6. Meer verkopers → meer data → betere scripts → herhaal

## Implicaties voor de Bestaande Roadmap

| Bestaand (V3 Roadmap) | Nieuw (deze brainstorm) |
|------------------------|-------------------------|
| Fase 1: Streaming + Persistence | Onveranderd — fundament voor alles |
| Fase 2: Adaptive Thinking + Compaction | + Script Builder als tool toevoegen |
| Fase 3: Voice Agent (ElevenLabs) | + Real-time in-call coach (STT → tips) |
| Fase 4: Agent SDK | Onveranderd |
| Fase 5: MCP + Analytics | → Management Dashboard (de "analytics" wordt een volwaardig product) |

Geen roadmap-wijziging nodig. De drie pijlers passen IN de bestaande fasen. Ze maken de fasen alleen waardevoller.

## Verdict: Voldoet het platform aan de twee principes?

### Punt 7: "Build for the model six months from now"
**Score: 7/10 → met deze pijlers: 9/10**

Het fundament (tool-based architectuur, SSOT configs, memory) schaalt automatisch mee met betere modellen. De drie nieuwe pijlers (real-time coach, management, scripts) zijn precies het soort features dat onmogelijk was met GPT-3 maar vanzelfsprekend wordt met het model van september 2026.

### Punt 8: "Latent demand"
**Score: 4/10 → met deze pijlers: 7/10**

Pre-launch, dus echte demand data ontbreekt. Maar de script builder en management layer creëren oppervlak voor latent demand. Hoe meer tangible outputs (scripts, rapporten, KPIs), hoe meer manieren gebruikers het product kunnen "misbruiken" voor onverwachte use cases.

### Key takeaway
> Hugo's 54 technieken + 9 houdingen in structured JSON is de moat. Modellen worden commodity. Die 40 jaar ervaring niet.
