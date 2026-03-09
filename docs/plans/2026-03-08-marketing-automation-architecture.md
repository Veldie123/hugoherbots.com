# Marketing Automatisering: Revenue-Based Content Engine

**Datum:** 2026-03-08 (v2 — afgestemd op financieel model v3 met prompt caching)
**Type:** Architectuur — marketing automatisering via Cowork + MCP + creator approval
**Aanleiding:** Hoe users vinden en converteren? Automatiseer marketing met x% van inkomsten als budget.
**Gerelateerd:** `docs/plans/2026-03-08-financial-model-hugo.md` (kosten, marges, break-even)

---

## Concept

Elke maand vloeit x% van de inkomsten automatisch terug naar marketing. Cowork genereert content en ad-voorstellen. De creator keurt goed in het admin dashboard. Na goedkeuring wordt gepubliceerd en (optioneel) gepromoot met toegewezen budget.

---

## Flow

```
STRIPE WEBHOOK (maandelijkse inkomsten)
        │
        ▼
┌───────────────────────┐
│  Budget Berekening     │
│  x% van MRR            │
│  bv. 15% van €5.000    │
│  = €750 marketing      │
└───────┬───────────────┘
        │
        ▼
┌───────────────────────┐
│  Cowork genereert      │
│  maandelijks plan:     │
│                        │
│  • 8 LinkedIn posts    │
│  • 2 LinkedIn articles │
│  • 4 tweets            │
│  • 1 video script      │
│  • 2 promoted posts    │
│    (met ad budget)     │
│                        │
│  Grounded in Hugo's    │
│  methodologie via MCP  │
│  tools                 │
└───────┬───────────────┘
        │
        ▼
┌───────────────────────┐
│  MCP → SaaS Platform   │
│  submit_content_plan() │
│                        │
│  Creator ziet in       │
│  admin dashboard:      │
│                        │
│  ┌─────────────────┐  │
│  │ Content Kalender │  │
│  │ Week 1: post, X  │  │
│  │ Week 2: artikel  │  │
│  │ Week 3: video    │  │
│  │ Week 4: post, X  │  │
│  └─────────────────┘  │
│                        │
│  Per item:             │
│  [Preview] [Budget: €X]│
│  [✓ Goedkeuren]        │
│  [✎ Bewerken]          │
│  [✗ Afwijzen]          │
└───────┬───────────────┘
        │
        ▼
┌───────────────────────┐
│  Na goedkeuring:       │
│                        │
│  Organic →             │
│    Publiceer via       │
│    LinkedIn API /      │
│    Buffer / Zapier     │
│                        │
│  Promoted →            │
│    Start LinkedIn ad   │
│    met toegewezen      │
│    budget              │
└───────────────────────┘
```

---

## Budget Allocatie Model

| Revenue band | Marketing % | Maandbudget | Verdeling |
|-------------|-------------|-------------|-----------|
| €0 - €1.000 | 20% | €0 - €200 | 100% organic (geen ads) |
| €1.000 - €5.000 | 15% | €150 - €750 | 70% ads, 30% content tools |
| €5.000 - €10.000 | 12% | €600 - €1.200 | 60% ads, 20% content tools, 20% partnerships |
| €10.000+ | 10% | €1.000+ | 50% ads, 25% retargeting, 25% partnerships |

**Principe:** Hoe hoger de omzet, hoe lager het %, maar hoe hoger het absolute bedrag. Bij €0 omzet investeer je uit eigen zak (bootstrap fase).

---

## Content Types & Ad Budget

| Content Type | Organic/Paid | Typisch ad budget | Verwachte reach |
|-------------|-------------|-------------------|-----------------|
| LinkedIn post | Organic | €0 | 500 - 2K impressies |
| LinkedIn post (promoted) | Paid | €50 - 150 | 5K - 20K impressies |
| LinkedIn article | Organic | €0 | 200 - 1K reads |
| LinkedIn Thought Leader Ad | Paid | €100 - 300 | 10K - 50K impressies |
| Twitter/X post | Organic | €0 | 200 - 1K impressies |
| Twitter/X promoted | Paid | €30 - 100 | 3K - 15K impressies |
| Video (YouTube/LinkedIn) | Organic + Paid | €100 - 500 | 1K - 10K views |

---

## MCP Server Tools

De MCP server is de brug tussen Cowork en het creator platform.

| Tool | Input | Output | Functie |
|------|-------|--------|---------|
| `get_monthly_budget` | `creator_slug` | `{ total, spent, remaining, breakdown }` | Beschikbaar marketing budget ophalen |
| `submit_content_plan` | `creator_slug, items[]` (elk met titel, body, platform, type, budget, scheduled_at) | `{ plan_id, items_count }` | Maandelijks content plan indienen |
| `submit_for_approval` | `creator_slug, title, body, content_type, platform, budget, media_urls` | `{ draft_id, status: "pending" }` | Individueel item ter goedkeuring |
| `get_approval_status` | `draft_id` | `{ status, reviewer_notes, reviewed_at }` | Status van specifiek item |
| `list_pending_content` | `creator_slug, status?` | `ContentDraft[]` | Wat wacht op review? |
| `publish_approved_content` | `draft_id, platform` | `{ published_url }` | Publiceer goedgekeurd item |
| `get_content_performance` | `creator_slug, period?` | `{ items[], totals }` | ROI per gepubliceerd item |
| `adjust_budget_allocation` | `creator_slug, new_allocation` | `{ updated }` | Budget verschuiven naar best-performing types |
| `search_creator_methodology` | `creator_slug, query` | `Technique[]` | Technieken opzoeken voor grounded content |
| `get_creator_persona` | `creator_slug` | `PersonaConfig` | Tone of voice voor content generatie |

---

## Admin Dashboard: Marketing Tab

Nieuw tabblad **"Marketing"** in admin sidebar. Drie sub-views:

### 1. Content Kalender

Maandoverzicht met geplande posts per week.

```
┌─────────────────────────────────────────────────┐
│  Marketing — Maart 2026           Budget: €750  │
│  ├── Besteed: €280   Resterend: €470            │
│─────────────────────────────────────────────────│
│                                                  │
│  WEEK 1 (10-16 mrt)                             │
│  ┌────────────────────────────────────────────┐ │
│  │ 🟢 LinkedIn Post — "5 vragen die..."       │ │
│  │    Organic | Gepland: di 11 mrt 09:00      │ │
│  │    [Bekijken] [Bewerken] [Annuleren]       │ │
│  ├────────────────────────────────────────────┤ │
│  │ 🟡 Tweet — "De meeste verkopers..."        │ │
│  │    Organic | Ter goedkeuring                │ │
│  │    [Goedkeuren] [Bewerken] [Afwijzen]      │ │
│  └────────────────────────────────────────────┘ │
│                                                  │
│  WEEK 2 (17-23 mrt)                             │
│  ┌────────────────────────────────────────────┐ │
│  │ 🟡 LinkedIn Article — "Waarom EPIC..."     │ │
│  │    Organic | Ter goedkeuring                │ │
│  │    [Goedkeuren] [Bewerken] [Afwijzen]      │ │
│  ├────────────────────────────────────────────┤ │
│  │ 🟡 LinkedIn Promoted — "Gratis webinar..." │ │
│  │    Ad budget: €150 | Ter goedkeuring        │ │
│  │    [Goedkeuren] [Budget wijzigen] [Afwijzen]│ │
│  └────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────┘
```

Kleurcodes: 🟢 goedgekeurd/gepubliceerd, 🟡 ter goedkeuring, ⚪ concept, 🔴 afgewezen

### 2. Budget Dashboard

```
┌─────────────────────────────────────────────────┐
│  Budget — Maart 2026                             │
│─────────────────────────────────────────────────│
│                                                  │
│  MRR deze maand:        €5.200                  │
│  Marketing allocation:  15% = €780              │
│                                                  │
│  ┌──────────────────────────────────────┐       │
│  │  Ads         €450 ████████████░░░░░  │       │
│  │  Tools       €180 █████░░░░░░░░░░░░  │       │
│  │  Resterend   €150 ░░░░░░░░░░░░░░░░░  │       │
│  └──────────────────────────────────────┘       │
│                                                  │
│  ROI Metrics:                                    │
│  Cost per click:     €0.85                       │
│  Cost per lead:      €12.40                      │
│  Cost per conversion: €45.00                     │
│  ROAS:               3.2×                        │
└─────────────────────────────────────────────────┘
```

### 3. Performance

```
┌─────────────────────────────────────────────────┐
│  Content Performance — Laatste 30 dagen          │
│─────────────────────────────────────────────────│
│                                                  │
│  Top performers:                                 │
│  1. "5 vragen die..." (LinkedIn)   1.2K clicks  │
│  2. "Waarom verkopers..." (X)      890 clicks   │
│  3. "EPIC methode..." (LinkedIn)   650 clicks   │
│                                                  │
│  Beste topics:                                   │
│  • Bezwaartechnieken → 3× meer engagement        │
│  • EPIC uitleg → 2× meer saves                   │
│  • Rollenspel tips → meeste comments             │
│                                                  │
│  AI-suggestie:                                   │
│  "Posts over bezwaartechnieken presteren 3×       │
│   beter. Volgende maand 40% van content           │
│   hierop richten?" [Ja] [Nee] [Aanpassen]        │
└─────────────────────────────────────────────────┘
```

---

## Automatiseerbare Pipeline

| Stap | Auto? | Implementatie |
|------|-------|---------------|
| Budget berekenen (% van MRR) | ✅ Ja | Stripe webhook → berekening → `content_drafts.monthly_budget` |
| Content plan genereren | ✅ Ja | Cowork + MCP `get_creator_persona` + `search_creator_methodology` |
| Content schrijven | ✅ Ja | Cowork genereert in creator's tone of voice, grounded in methodologie |
| Creator goedkeuring | ❌ Menselijk | Admin dashboard approval UI |
| Publicatie (organic) | ✅ Ja | LinkedIn API / Buffer / Zapier webhook na approval |
| Ad campagne starten | 🟡 Semi | LinkedIn Campaign Manager API (of Zapier) — creator zet budget goed |
| Performance tracking | ✅ Ja | LinkedIn Analytics API → `publish_history` → dashboard |
| Budget re-allocatie | 🟡 Semi | AI-suggestie op basis van performance, creator keurt goed |

---

## Database Tabellen

Twee nieuwe tabellen (aansluiting op bestaand schema):

### `content_drafts`

| Kolom | Type | Beschrijving |
|-------|------|-------------|
| id | UUID PK | |
| creator_id | UUID FK | Welke creator |
| title | TEXT | Titel/hook |
| body | TEXT | Volledige content |
| content_type | TEXT | linkedin_post, twitter_post, linkedin_article, video_script, etc. |
| target_platform | TEXT | linkedin, twitter, youtube |
| media_urls | JSONB | Gekoppelde afbeeldingen/video's |
| hashtags | JSONB | Hashtags |
| scheduled_at | TIMESTAMPTZ | Geplande publicatiedatum |
| ad_budget | NUMERIC | Toegewezen ad budget (€0 = organic) |
| status | TEXT | pending, approved, rejected, published, scheduled |
| reviewer_notes | TEXT | Creator feedback |
| reviewed_at | TIMESTAMPTZ | |
| reviewed_by | UUID FK | |
| source | TEXT | cowork, manual |
| published_at | TIMESTAMPTZ | |
| published_url | TEXT | URL op doelplatform |
| publish_metadata | JSONB | Platform-specifieke data |
| created_at | TIMESTAMPTZ | |

### `marketing_budgets`

| Kolom | Type | Beschrijving |
|-------|------|-------------|
| id | UUID PK | |
| creator_id | UUID FK | |
| month | DATE | Eerste dag van de maand |
| mrr | NUMERIC | Monthly recurring revenue die maand |
| allocation_pct | NUMERIC | Marketing percentage |
| total_budget | NUMERIC | Berekend budget |
| spent_ads | NUMERIC | Besteed aan ads |
| spent_tools | NUMERIC | Besteed aan tools |
| spent_other | NUMERIC | Overig |
| created_at | TIMESTAMPTZ | |

### `publish_history`

| Kolom | Type | Beschrijving |
|-------|------|-------------|
| id | UUID PK | |
| content_draft_id | UUID FK | |
| creator_id | UUID FK | |
| platform | TEXT | |
| published_url | TEXT | |
| impressions | INTEGER | |
| clicks | INTEGER | |
| engagement_rate | NUMERIC | |
| conversions | INTEGER | |
| cost_spent | NUMERIC | Werkelijk besteed ad budget |
| metrics_updated_at | TIMESTAMPTZ | Laatste metrics sync |
| created_at | TIMESTAMPTZ | |

---

## Publishing Adapters

Platform-agnostische architectuur. Start simpel, bouw uit:

| Adapter | Prioriteit | Implementatie | Complexiteit |
|---------|-----------|---------------|-------------|
| **Webhook (Zapier/Make)** | 1 — Eerste | Fire webhook, Zapier handelt publicatie af | Laag |
| **Buffer.com** | 2 | Multi-platform scheduling via Buffer API | Laag-Medium |
| **LinkedIn API** (direct) | 3 | Meer controle, maar OAuth + approval process | Medium-Hoog |
| **Twitter/X API v2** | 4 | Direct posting | Medium |
| **LinkedIn Campaign Manager** | 5 | Ad campagnes starten | Hoog |

**Aanbeveling:** Start met Zapier webhook adapter. Elke goedgekeurde post triggert een Zapier workflow die publiceert naar LinkedIn/X. Geen OAuth complexity, geen API approval nodig.

---

## ROI van Marketing Automatisering

### Scenario: €5.000 MRR, 15% marketing budget = €750/maand

| Kanaal | Budget | Verwachte clicks | Cost/click | Verwachte leads | Cost/lead | Verwachte conversies |
|--------|--------|-----------------|-----------|----------------|----------|---------------------|
| LinkedIn organic (8 posts) | €0 | 400 | €0 | 20 | €0 | 2 |
| LinkedIn promoted (2 posts) | €300 | 2.000 | €0.15 | 100 | €3.00 | 5 |
| LinkedIn Thought Leader Ad (1) | €250 | 3.000 | €0.08 | 80 | €3.13 | 4 |
| Twitter organic (4 posts) | €0 | 200 | €0 | 5 | €0 | 0.5 |
| Content tools (Canva etc.) | €100 | - | - | - | - | - |
| Buffer/scheduling | €50 | - | - | - | - | - |
| **Totaal** | **€700** | **5.600** | **€0.13 avg** | **205** | **€3.41 avg** | **11.5** |

### ROI Berekening (afgestemd op financieel model v3)

**Revenue per nieuwe Pro user:** €98/mo
**Variabele kost per Pro user (medium, met caching):** €30.54/mo
**Netto marge per Pro user:** €65.74/mo (67%)

| Metric | Berekening | Waarde |
|--------|-----------|--------|
| Nieuwe Pro users uit marketing | 11.5 conversies/maand | 11.5 |
| Nieuwe bruto MRR | 11.5 × €98 | **€1.127** |
| Variabele kosten nieuwe users | 11.5 × €30.54 | -€351 |
| Netto bijdrage nieuwe users | 11.5 × €65.74 | **€756** |
| Marketing spend | | -€700 |
| **Netto winst maand 1** | €756 - €700 | **€56** |
| **ROAS maand 1** | €1.127 / €700 | **1.6×** |
| **Cumulative ROAS na 6 maanden** | (11.5 × €65.74 × 6) / €700 | **6.5×** |

*Noot: Cumulative ROAS is lager dan eerder geschat (6.5× vs 9.7×) omdat we nu de variabele kosten per user meenemen. De marketing genereert nog steeds sterk positieve ROI dankzij het recurring revenue model.*

### Break-even marketing spend

Bij welke conversie-ratio betaalt marketing zichzelf terug?

| Metric | Waarde |
|--------|--------|
| Netto marge per Pro user/maand | €65.74 |
| Marketing budget bij €5K MRR (15%) | €750 |
| Users nodig om marketing terug te verdienen in maand 1 | €750 / €65.74 = **11.4 users** |
| Users nodig bij 3 maanden retentie | €750 / (€65.74 × 3) = **3.8 users** |

Met een gemiddelde retentie van 3+ maanden hoeven we maar **4 nieuwe users per maand** te converteren om de marketing terug te verdienen. De rest is winst.

---

## Samenvatting

De marketing engine maakt het platform **self-sustaining**: inkomsten voeden automatisch content → content genereert leads → leads worden users → users genereren meer inkomsten.

**Key numbers (afgestemd op financieel model v3, met prompt caching):**

| Metric | Waarde |
|--------|--------|
| Marketing als % van revenue | 15% (dalend naar 10% bij schaal) |
| Break-even conversies/maand (3mo retentie) | 4 Pro users |
| ROAS maand 1 | 1.6× |
| Cumulative ROAS na 6 maanden | 6.5× |
| Netto marge per geconverteerde Pro user | €65.74/mo |

De creator hoeft alleen:
1. Maandelijks het content plan te reviewen (~15 min)
2. Budget goed te keuren per promoted item
3. Optioneel: content aanpassen voor het gepubliceerd wordt

Alles anders is geautomatiseerd.
