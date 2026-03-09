# Agent First — Langetermijnvisie HugoHerbots.ai

> **Doel:** Dit document beschrijft de strategische visie voor de evolutie van HugoHerbots.ai
> van een feature-platform naar een agent-first platform. Bedoeld als input voor het businessplan.

---

## De Visie in Één Zin

**Eén Hugo. Eén gesprek. Alles op maat.**

Geen aparte video's, geen webinars, geen analyse-uploads, geen losse tools.
Eén intelligente Hugo-agent die naadloos schakelt tussen chat, audio en video
— op basis van wat de verkoper op dat moment nodig heeft.

---

## Van Features naar Agent

### Het Huidige Model (Feature-Platform)

Vandaag biedt HugoHerbots.ai meerdere losse features:

| Feature | Interface | Probleem |
|---------|-----------|----------|
| AI Coaching | Chat venster | Tekst-only, voelt niet als Hugo |
| Rollenspel | Chat venster | Geen visuele klant, beperkte immersie |
| Video Bibliotheek | Video player + lijst | Generiek, niet gepersonaliseerd |
| Gesprekanalyse | Upload + rapport | Los workflow, achteraf |
| Live Coaching | Video call panel | Apart van AI coaching |
| Video-Avatar | Aparte modus | Niet geïntegreerd in coaching flow |
| Script Builder | Tool in chat | Vereist expliciete activatie |

De gebruiker moet zelf kiezen welke feature hij nodig heeft. Dat is het oude SaaS-denken:
*"Hier zijn tools, zoek maar uit wat je nodig hebt."*

### Het Agent-First Model

In het agent-first model bestaat er maar één ingangspunt: **"Talk to Hugo"**.

Hugo — als AI-agent — bepaalt zelf de optimale modaliteit en aanpak:

```
Gebruiker opent "Talk to Hugo"
        │
        ▼
   Hugo begroet je
   (tekst, audio, of video — op basis van voorkeur/context)
        │
        ├── Je hebt een vraag over een techniek?
        │   → Hugo legt uit (audio/video), toont whiteboard, vraagt of je wilt oefenen
        │
        ├── Je wilt oefenen?
        │   → Hugo wordt de klant (video-rollenspel), geeft daarna feedback als coach
        │
        ├── Je hebt net een salesgesprek gehad?
        │   → Hugo vraagt ernaar, analyseert samen met jou, geeft gerichte oefentips
        │
        ├── Je bereidt een pitch voor?
        │   → Hugo bouwt samen een script, laat je oefenen, slaat op voor later
        │
        ├── Je wilt gewoon bijleren?
        │   → Hugo presenteert de volgende techniek in jouw leerpad (video-les)
        │   → Je onderbreekt? Hugo schakelt naar coaching. Klaar? Volgende segment.
        │
        └── Je hebt een opname?
            → Hugo analyseert real-time mee terwijl je het afspeelt
```

**Er zijn geen features meer. Er is alleen Hugo.**

---

## Waarom Agent-First Wint

### 1. Personalisatie vervangt Content

| Oud model | Agent-first |
|-----------|-------------|
| 47 pre-recorded video's die iedereen hetzelfde ziet | Hugo legt techniek X uit **voor jouw sector, jouw product, jouw klanttype** |
| Webinar: 1 uur, generiek, niet interactief | Hugo geeft je een 10-minuten les, je onderbreekt met vragen, hij past aan |
| Analyse-rapport na upload | Hugo bespreekt het gesprek met je, vraagt wat je zelf opviel, coacht gericht |
| Script template invullen | Hugo bouwt het script in dialoog, personaliseert elke zin op jouw situatie |

**Generieke content is waardeloos voor sales coaching.** Een verkoper van renovaties heeft niets aan een voorbeeld over IT-consultancy. Agent-first betekent: elke interactie is 100% op maat.

### 2. Modaliteit als Spectrum

De gebruiker kiest niet meer "chat" of "video" — Hugo escaleert de modaliteit op basis van context:

| Situatie | Modaliteit | Waarom |
|----------|------------|--------|
| Snelle vraag tussendoor | Chat (tekst) | Snel, low-bandwidth, op de trein |
| Techniek leren | Audio of video | Hugo's stem/beeld maakt het persoonlijk |
| Rollenspel oefenen | Video (avatar) | Non-verbale cues, eye contact, realisme |
| Feedback na oefening | Audio + tekst | Samenvatting zichtbaar, Hugo legt uit |
| Script review | Chat + tekst | Tekst editen is visueel beter |

De agent past de modaliteit aan op basis van:
- **Gebruikersvoorkeur** (expliciet gekozen of geleerd over tijd)
- **Context** (mobiel → audio, desktop → video, haast → chat)
- **Type interactie** (coaching → audio, rollenspel → video, analyse → tekst)

### 3. Sessie-Continuïteit

Geen losse "sessies" meer per feature. Eén doorlopend gesprek met Hugo:

- Hugo onthoudt alles (cross-session memory via pgvector)
- Hugo weet waar je vorige keer bent gestopt
- Hugo weet welke technieken je al beheerst (mastery tracking)
- Hugo ziet patronen over sessies heen ("Je hebt al 3x moeite met Commitment — laten we dat vandaag specifiek aanpakken")

**Hugo is niet een tool. Hugo is je persoonlijke sales coach die je kent.**

---

## Impact op Productaanbod

### Wat Verdwijnt

| Feature (oud) | Vervangen door |
|---------------|---------------|
| Video Bibliotheek (47 video's) | Hugo presenteert de relevante les live, gepersonaliseerd voor jouw context |
| Webinars / Live Sessies | Hugo geeft je een privé-les via avatar. Interactief, op jouw tempo |
| Analyse-upload workflow | Hugo vraagt "Hoe ging je gesprek?", analyseert samen met jou |
| Losse Script Builder tool | Hugo bouwt scripts in het natuurlijke gesprek |
| Model selector (V2/V3) | Eén agent, transparant voor de gebruiker |

### Wat Blijft (Versterkt)

| Element | Rol in Agent-First |
|---------|-------------------|
| E.P.I.C. TECHNIQUE SSOT | De kennisbasis van de agent — 47 technieken, 9 houdingen, alles gecodeerd |
| RAG corpus (559 docs) | Hugo's geheugen — grounding voor elke response |
| Mastery tracking | Hugo's kompas — weet wat je al kan en wat je moet leren |
| Cross-session memory | Hugo's relatie met jou — onthoudt context, patronen, doelen |
| Klanthoudingen (H1-H9) | Realisme in rollenspel — deterministische klantpsychologie |

### Wat Nieuw Wordt

| Capability | Beschrijving |
|------------|-------------|
| **Adaptieve modaliteit** | Hugo schakelt tussen chat, audio en video binnen één sessie |
| **Gepersonaliseerde lessen** | Hugo presenteert technieken in jouw taal, met jouw voorbeelden, voor jouw sector |
| **Proactieve coaching** | Hugo initieert: "Je hebt vorige week een pitch, wil je oefenen?" |
| **Meertalige coaching** | Dezelfde Hugo, in het Frans, Duits of Engels — met E.P.I.C. termen in het Nederlands op het whiteboard |
| **Contextbewust rollenspel** | Hugo speelt jouw klant (sector, producttype, bezwaren uit echte data) |

---

## Technische Architectuur: Agent-First

```
┌──────────────────────────────────────────────────────────┐
│                     "Talk to Hugo"                        │
│              (één knop, één ingangspunt)                  │
│                                                          │
│  ┌────────────────────────────────────────────────────┐  │
│  │              Hugo Agent (V3 Claude)                │  │
│  │                                                    │  │
│  │  System Prompt: Hugo's identiteit + filosofie      │  │
│  │  Tools: 47 technieken, RAG, memory, roleplay,     │  │
│  │         script builder, analyse, mastery tracking  │  │
│  │  Context: cross-session memory + user briefing     │  │
│  │                                                    │  │
│  │  Modaliteit-laag:                                  │  │
│  │  ┌──────────┬──────────┬──────────────────────┐   │  │
│  │  │  Tekst   │  Audio   │   Video (Avatar)     │   │  │
│  │  │  (chat)  │  (stem)  │   (Tavus/HeyGen)     │   │  │
│  │  └──────────┴──────────┴──────────────────────┘   │  │
│  │                                                    │  │
│  │  Output routing:                                   │  │
│  │  - Tekst → chat interface                         │  │
│  │  - Audio → ElevenLabs TTS (Hugo's stem)           │  │
│  │  - Video → Avatar platform (Hugo's gezicht+stem)  │  │
│  └────────────────────────────────────────────────────┘  │
│                                                          │
│  ┌────────────────────────────────────────────────────┐  │
│  │              Kennisbasis (SSOT)                     │  │
│  │  47 technieken · 9 houdingen · 559 RAG docs        │  │
│  │  Video transcripts · Mastery data · User memory    │  │
│  └────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────┘
```

**Kern:** De agent is de orchestrator. Geen feature-routing, geen menu's.
Hugo beslist wat er moet gebeuren en in welke vorm.

---

## Internationalisering via Agent-First

Het agent-first model maakt internationalisering fundamenteel anders:

### Oud model: Content vertalen
- 47 video's × 4 talen = 188 video's opnemen of nasynchroniseren
- Webinars vertalen of herhalen in elke taal
- UI vertalen, content beheren per taal
- **Kosten: enorm. Schaalt niet.**

### Agent-first: De agent spreekt jouw taal
- Hugo spreekt Frans, Duits, Engels — dezelfde agent, dezelfde kennis
- E.P.I.C. termen blijven in het Nederlands (SSOT-integriteit)
- Whiteboard toont Nederlandse termen, Hugo legt uit in de doeltaal
- Culturele nuances: Hugo past voorbeelden aan per markt
- **Kosten: marginaal. Eén agent, N talen.**

| Taal | Status | Aanpak |
|------|--------|--------|
| Nederlands | Live | Moedertaal van de methodologie |
| Frans | Eerste doeltaal | Avatar spreekt Frans, E.P.I.C. termen in NL |
| Duits | Gepland | Grote markt, Hugo heeft DACH-ervaring |
| Engels | Gepland | Globale schaling |

---

## Impact op Business Model

### Vereenvoudiging Pricing

Agent-first maakt de pricing logischer:

| Tier | Wat je krijgt | Prijs |
|------|--------------|-------|
| **Pro** | Onbeperkt Hugo (chat + audio). Video-avatar: X min/maand | €98/mo |
| **Founder** | Onbeperkt Hugo (chat + audio + video). Prioriteitsqueue | €498/mo |
| **Inner Circle** | Alles + directe toegang tot de echte Hugo. Proactieve coaching | €2.498/mo |

De waarde is niet meer "toegang tot features" maar **"toegang tot Hugo's aandacht"**.
Hogere tiers = meer avatar-minuten, proactievere coaching, snellere responses.

### Kostenstructuur

| Modaliteit | Kosten per minuut | Marge op Pro (€98/mo) |
|------------|-------------------|----------------------|
| Chat (tekst) | ~€0.02 | 98%+ |
| Audio (TTS + STT) | ~€0.05 | 95%+ |
| Video (avatar) | ~€0.10 (Tavus) | 90%+ |

Avatar-kosten zijn de variabele factor. Met Tavus Phoenix-4 op €0.10/min
kan een Pro-gebruiker 20 uur video-coaching per maand krijgen binnen de marge.

### Churn-Reductie

Agent-first verlaagt churn fundamenteel:
- **Gewoontevorming:** Hugo wordt een dagelijkse gesprekspartner, niet een tool die je af en toe opent
- **Emotionele band:** Video-interactie creëert een relatie die tekst-tools niet bereiken
- **Proactieve waarde:** Hugo stuurt je een bericht als je lang niet geweest bent
- **Onvervangbaar:** Jouw Hugo kent jouw sector, jouw struggles, jouw doelen. Opzeggen = dat kwijtraken

---

## Roadmap naar Agent-First

### Fase A: Foundation (Q1 2026) — DONE

- [x] V3 agentic loop met tool-based architectuur
- [x] Cross-session memory (pgvector)
- [x] Mastery tracking per techniek
- [x] SSOT terminologie enforcement
- [x] Platform-agnostische avatar abstraction (HeyGen + Tavus)
- [x] Script engine voor avatar-presentaties
- [x] Interrupt/resume flow (avatar → coaching → avatar)

### Fase B: Unified Experience (Q2 2026)

- [ ] Voice agent: ElevenLabs Conversational AI met Hugo's stem
- [ ] Modaliteit-switcher: chat ↔ audio ↔ video binnen één sessie
- [ ] "Talk to Hugo" als enige entry point (feature-menu verdwijnt)
- [ ] Gepersonaliseerde techniek-presentaties (sector + product + klanttype)
- [ ] Proactieve coaching triggers (mastery gaps, sessie-frequentie)

### Fase C: Internationaal (Q3 2026)

- [ ] Frans: Hugo's avatar spreekt Frans, E.P.I.C. termen in NL
- [ ] Tavus replica getraind op Hugo-footage
- [ ] Cultureel aangepaste voorbeelden per taalregio
- [ ] Marketing: Franstalige landing page + content engine

### Fase D: Full Autonomy (Q4 2026)

- [ ] Hugo initieert sessies ("Je hebt morgen een pitch — wil je oefenen?")
- [ ] Contextueel rollenspel op basis van CRM-data (HubSpot/Salesforce integratie)
- [ ] Team-coaching: Hugo coacht het hele team, rapporteert aan de manager
- [ ] Analytics: Hugo genereert maandrapportages voor managers, niet als rapport maar als gesprek

---

## De Kern

> **"De beste sales coach ter wereld is niet een app met features.
> Het is iemand die je kent, die weet wat je nodig hebt,
> en die er altijd is wanneer je hem nodig hebt.
> Dat is wat Hugo wordt."**

Agent-first betekent: de technologie verdwijnt.
Er is geen UI om te leren. Er is geen workflow te onthouden.
Er is alleen Hugo. En Hugo kent jou.

Elke interactie is gepersonaliseerd. Elke les is op maat.
Elke oefening is relevant voor jouw volgende gesprek.

Dat is het verschil tussen een SaaS-platform en een AI-coach.

---

*Document: 2026-03-09 · Auteur: Stéphane · Status: Strategische visie*
