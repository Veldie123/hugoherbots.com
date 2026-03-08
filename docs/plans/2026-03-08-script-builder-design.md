# Script Builder — Design Document

## Context

Hugo's V3 agent kan coachen, rollenspelen, en analyseren — maar kan nog geen **gepersonaliseerde verkoopscripts** genereren. Sellers willen een concreet script dat ze kunnen oefenen, gebaseerd op hun volledige profiel. Hugo wil scripts reviewen via de bestaande admin flow.

Alle bouwstenen bestaan al: 47 EPIC technieken, 9 klanthoudingen, persona templates, episodisch geheugen, RAG corpus, en context gathering. Wat ontbreekt is de **orchestratie** en een **compleet seller context model**.

## Aanpak: Phase-by-Phase Stateful Tools (roleplay patroon)

4 tools, volgt het bewezen `start_roleplay` → `process_roleplay_turn` → `end_roleplay` patroon.

| Tool | Doel |
|------|------|
| `start_script_builder` | Start sessie. Haalt seller context op, checkt completeness, genereert Opening. |
| `build_script_phase` | Volgende EPIC fase. Input: fase + seller feedback. |
| `finalize_script` | Opslaan + notificatie naar Hugo. |
| `load_script` | Laden voor iteratie of review. |

### Scope

- **V3 tool alleen** — alles in de chat, geen aparte UI
- **Iteratief** — agent bouwt fase per fase, seller geeft feedback
- **Gradueel** — seller kan het vragen, agent stelt het ook proactief voor
- **Document upload** — bestaande paperclip in chat, agent verwerkt brochures/materiaal
- **Approval** — bestaande admin flow via `admin_corrections` + notificaties

## Volledige Seller Context ("Röntgenfoto")

De V2 had 10 slots. Voor een script is veel meer nodig. Het context model wordt opgebouwd per categorie — de agent verzamelt dit **gradueel** over meerdere sessies, niet in één gesprek.

### A. IDENTITEIT (wie is de seller)

| Slot | Wat | Voorbeeld |
|------|-----|-----------|
| `sector` | Branche/industrie | Farma, vastgoed, IT, financiële diensten |
| `product` | Wat verkopen ze | Medische apparatuur, commercieel vastgoed |
| `bedrijfsnaam` | Naam + website | "MedTech Solutions" |
| `verkoopkanaal` | Hoe verkopen ze | Face-to-face, telefoon, hybrid |
| `klant_type` | Doelgroep + beslissers | B2B, C-level, KMO's, ziekenhuizen |
| `ervaring` | Jaren + achtergrond | 5 jaar, van marketing naar sales |
| `dealgrootte` | Gemiddelde orderwaarde | €5K-€50K per deal |
| `salescycle` | Typische doorlooptijd | 3-6 maanden, meerdere contactmomenten |

### B. MARKT & CONCURRENTIE

| Slot | Wat | Script-impact |
|------|-----|---------------|
| `concurrenten` | Wie, sterktes, zwaktes, prijzen | Fase 2 Alternatieven-vragen, Fase 3 differentiatie |
| `eigen_usps` | Onderscheidende kenmerken | Fase 3 O.V.B. zinnen |
| `eigen_sterktes` | Waar ze goed in zijn | Fase 1 POP, Fase 3 oplossingen |
| `eigen_zwaktes` | Kwetsbaarheden | Fase 4 bezwaarbehandeling (anticiperen) |
| `marktpositie` | Marktleider/challenger/niche | Toon en positionering in script |

### C. FASE 2 — De 8 ontdekkingsthema's (E.P.I.C.)

| Thema | Wat de agent moet weten | Wordt in script |
|-------|------------------------|-----------------|
| `bron` | Hoe komen klanten bij hen | EXPLORE instapvragen |
| `motivatie` | Waarom zoeken klanten | EXPLORE doorvragen |
| `klant_ervaring` | Eerdere ervaringen met het probleem | EXPLORE context |
| `verwachtingen` | Wat hopen klanten | EXPLORE + PROBE scenario's |
| `alternatieven` | Wat doen klanten nu / concurrenten | EXPLORE + differentiatie |
| `budget` | Range, beslissingsruimte | EXPLORE + Fase 3 prijspositionering |
| `timing` | Urgentie, deadlines, buying clock | EXPLORE + Fase 4 uitstelbehandeling |
| `beslissingscriteria` | DMU, wie beslist, aankoopproces | EXPLORE + Fase 4 DMU strategie |

### D. REVERSE ENGINEERING (kern van het script)

#### Koopredenen → worden IMPACT vragen + BATEN

| Slot | Wat | Wordt in script |
|------|-----|-----------------|
| `koopredenen_baten` | Concrete baten (€, tijd, risico) | Fase 2.3 IMPACT vragen + Fase 3.4 baten |
| `koopredenen_emotioneel` | Emotionele drijfveren | Fase 2.2 PROBE scenario's |
| `koopredenen_pijnpunten` | Pijnpunten die klanten wilden vermijden | Fase 2.3 IMPACT + Fase 3 "te vermijden" |

#### Verliesredenen → worden ALLE afritten (niet alleen bezwaren!)

| Slot | Klant houding | SSOT techniek | Wordt in script |
|------|--------------|---------------|-----------------|
| `verlies_bezwaren` | H7 Bezwaar | 4.2.4 | "Te duur" → afweegtechniek |
| `verlies_twijfels` | H6 Twijfel | 4.2.2 | "Ik weet niet..." → oprechte vs verdoken |
| `verlies_uitstel` | H8 Uitstel | 4.2.3 | "Ik moet nadenken" → voorwaarde vs voorwendsel |
| `verlies_angst` | H9 Angst | 4.2.5 | "Wat als..." → referentieverhaal |
| `verlies_risico` | H9 variant | 4.2.6 | "Risico te groot" → reverse thinking |
| `verlies_dmu` | DMU blokkade | — | "Ik moet overleggen" → DMU strategie |

### E. FASE 3 — O.V.B. per klantbehoefte

Per geïdentificeerde klantbehoefte/pijnpunt:

| Slot | Wat | Script sectie |
|------|-----|---------------|
| `oplossing` | Welk product/dienst/feature lost dit op | 3.2 Oplossing presenteren |
| `voordeel` | Wat is het verschil met huidige situatie | 3.3 Voordeel benoemen |
| `baat` | Concrete impact (€, tijd, stress, risico) | 3.4 Baat vertalen |
| `te_vermijden` | Wat als ze NIET kopen (pijnpunt) | 3.4 + 2.3 IMPACT |
| `referenties` | Succesverhalen, social proof | 3.5 + 4.2.5 angstbehandeling |

### F. GEÜPLOAD MATERIAAL

| Type | Hoe verwerkt | Script-impact |
|------|-------------|---------------|
| Brochures/productinfo | Agent extraheert features + voordelen | Fase 3 O.V.B. zinnen |
| Prijslijsten | Agent begrijpt prijsstructuur | Fase 3.6 technisch voorrekenen |
| Concurrentieanalyses | Agent begrijpt differentiatie | Fase 2 Alternatieven + Fase 4 bezwaren |
| Presentaties | Agent hergebruikt seller's eigen taal | Heel het script |

## Completeness Score

De agent berekent een **context completeness %** en genereert alleen een script voor fasen waar genoeg data is:

| Niveau | Wat bekend | Wat mogelijk |
|--------|------------|-------------|
| **Basis** (30%) | Sector, product, klanttype | Fase 1 Opening (generiek) |
| **Goed** (50%) | + koopredenen, concurrenten, USPs | + Fase 2 EXPLORE vragen |
| **Sterk** (70%) | + verliesredenen (per type), O.V.B. data | + Fase 2 PROBE/IMPACT + Fase 3 |
| **Compleet** (90%+) | + alle afritten, DMU, referenties | Volledig script incl. Fase 4 |

Agent meldt altijd: "Je script is nu op **70%** — als je me meer vertelt over typische bezwaren, kan ik fase 4 toevoegen."

## Script Output per Fase

### Fase 1 — Opening
- **Koopklimaat** — 2-3 openers aangepast aan kanaal + sector
- **Gentleman's Agreement** — gepersonaliseerd op product + proces
- **POP** — Persoon/Organisatie/Proces met seller's eigen bedrijfsinfo
- **Instapvraag** — 2 varianten naar fase 2

### Fase 2 — E.P.I.C. Ontdekking
- **EXPLORE** — 5-8 vragen over de 8 thema's, gepersonaliseerd op sector
- **PROBE** — 2-3 hypothetische scenario's gebaseerd op koopredenen
- **IMPACT** — 3-4 consequentievragen gebaseerd op baten + pijnpunten
- **COMMIT** — 2 bevestigingsvragen

### Fase 3 — O.V.B. Aanbeveling
- Per klantbehoefte: **Oplossing → Voordeel → Baat** triplet
- **Te vermijden pijnpunten** als extra impact
- **Technisch voorrekenen** (3.6) als prijs/ROI data beschikbaar
- **Batensamenvatting** (3.7)

### Fase 4 — Beslissing
- **Proefafsluiting** (4.1) — 2-3 varianten
- Per verliesreden de juiste afrit-techniek:
  - Bezwaren → 4.2.4 (afweegtechniek, pencil selling)
  - Twijfels → 4.2.2 (oprecht vs verdoken)
  - Uitstel → 4.2.3 (voorwaarde vs voorwendsel)
  - Angst → 4.2.5 (referentieverhaal)
  - Risico → 4.2.6 (reverse thinking)
- **INDIEN-techniek** — 2 varianten
- **Finale closing** (4.3) — samenvatten → koppelen → CVP → alternatieve keuze → order

## Approval Flow (bestaand)

1. `finalize_script` → INSERT in `admin_corrections` (type: `script_review`)
2. → INSERT in `admin_notifications` ("Nieuw script voor [seller]")
3. Hugo ziet notificatie → opent admin chat → HugoClaw toont script
4. Hugo geeft feedback → agent interpreteert → config/RAG wijzigingen
5. Stéphane keurt finaal goed

**CRITICAL FIX nodig:** `config_proposals` tabel is orphaned — V3 `propose_*` tools schrijven ernaar maar er zijn geen API endpoints en geen frontend. Fix: ofwel laten schrijven naar `admin_corrections` (quick), ofwel API + frontend bouwen (proper).

## Bestanden

| Bestand | Wijziging |
|---------|-----------|
| `server/hugo-engine/v3/tools/script-builder.ts` | **NIEUW** — 4 tools + executie |
| `server/hugo-engine/v3/agent.ts` | ScriptBuilderState in V3SessionState, tools registreren |
| `server/hugo-engine/v3/system-prompt.ts` | Script builder instructies (regel 59 al placeholder) |
| `src/supabase/migrations/004_sales_scripts.sql` | **NIEUW** — sales_scripts tabel |

### Intern hergebruik (geen nieuwe code)
- `searchMethodology()` uit `knowledge.ts` → SSOT technieken ophalen
- `searchTrainingMaterials()` uit `knowledge.ts` → RAG voorbeelden
- `recallMemories()` uit `memory-service.ts` → seller context uit geheugen
- `getUserProfile()` uit `knowledge.ts` → profiel + mastery scores
- Roleplay tool structuur uit `roleplay.ts` → patroon voor stateful tools

## Verificatie

1. V3 chat → seller vraagt script → agent checkt completeness → genereert beschikbare fasen
2. Agent meldt ontbrekende context → seller vult aan → script groeit
3. Seller feedback per fase → agent past aan
4. `finalize_script` → check `sales_scripts` + `admin_notifications`
5. Admin chat → Hugo reviewt → feedback → config proposal
6. `npm run build` slaagt
