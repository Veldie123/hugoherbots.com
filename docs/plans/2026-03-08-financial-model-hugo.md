# Financieel Model: HugoHerbots.ai (V3 Architectuur, 1 Creator)

**Datum:** 2026-03-08 (v3 — met prompt caching)
**Type:** Financieel model — kosten, marges, break-even, groeiprojecties
**Architectuur:** V3 (Claude Sonnet 4, prompt caching actief)

---

## Prompt Caching: Status ✅ Geïmplementeerd

Prompt caching is live in `server/hugo-engine/v3/agent.ts`. System prompt en tool definities worden gecached met `cache_control: { type: "ephemeral" }`. Na de eerste API call in een sessie betalen we 90% minder voor deze herhaalde tokens.

**Impact op dit model:** Alle kosten hieronder zijn berekend MET prompt caching als baseline. Sectie 2 toont ook de kosten zonder caching ter referentie.

---

## 1. Vaste Maandelijkse Kosten (ongeacht aantal users)

| Service | Plan/Tier | Maandelijks | Bron |
|---------|-----------|-------------|------|
| **Railway** (hosting) | Pro + usage | €50 | 3 processen (main 5001, video 3001, standalone 3002) |
| **Supabase** (DB + auth) | Pro | €25 | PostgreSQL + session pooler + auth + storage |
| **ElevenLabs** (Hugo voice clone) | Scale | €330 | Custom voice clone, models: flash_v2_5 + multilingual_v2 |
| **Tavus** (streaming avatar) | Growth | €365 | $397/mo, 1250 min incl., Phoenix-4 replica |
| **Mux** (video hosting) | Starter | €20 | Video assets opslag + playback |
| **LiveKit** (voice agent) | Cloud | €10 | Voice agent rooms |
| **Daily.co** (video calls) | Scale | €10 | Live coaching video sessies |
| **Google Cloud Run** (video worker) | Pay-as-you-go | €5 | europe-west1 video processing |
| **Domain + DNS** | - | €2 | hugoherbots.com |
| **GitHub** | Free/Team | €0-4 | Repo + auto-deploy |
| | | | |
| **TOTAAL VAST** | | **€817 - €821** | |

### Zonder voice/avatar (text-only):

| Weggelaten | Besparing |
|------------|-----------|
| ElevenLabs | -€330 |
| Tavus | -€365 |
| LiveKit | -€10 |
| **TOTAAL VAST (text-only)** | **€112 - €116** |

---

## 2. Variabele Kosten per Sessie (V3 Claude, met caching)

### Model: Claude Sonnet 4 (`claude-sonnet-4-20250514`)
- Input: $3 / 1M tokens
- Output: $15 / 1M tokens
- Extended thinking: $15 / 1M tokens (= output rate)
- **Cache write:** 1.25× input prijs (eerste call)
- **Cache read:** 0.10× input prijs (alle volgende calls)

### Per Coaching Sessie (user, 10 turns, MET caching)

| Component | Tokens | Calls | Kost |
|-----------|--------|-------|------|
| **Gecachte input** (system prompt + tools) | | | |
| Cache write (1e call) | 6.700 × 1.25× | 1 | $0.025 |
| Cache reads (24 overige calls) | 6.700 × 0.10× | 24 | $0.048 |
| **Niet-gecachte input** (berichten, tool results) | | | |
| Message history (groeiend) | 8.000 avg | 25 | $0.600 |
| Tool results | 1.500 | 15 | $0.068 |
| **Output** | 920 avg | 25 | $0.345 |
| **Thinking** (5K budget, avg 3.5K used) | 3.500 avg | 25 | $1.313 |
| | | | |
| **TOTAAL MET CACHING** | | | **$2.40 (≈ €2.20)** |
| *ter referentie: zonder caching* | | | *$2.83 (≈ €2.60)* |
| **Besparing door caching** | | | **~15%** |

*Noot: De besparing is ~15% (niet 50%) omdat thinking tokens de dominante kost zijn en die worden niet gecached. De 50% besparing geldt specifiek voor de INPUT token kosten.*

### Per Admin Sessie (3 turns, 31 tools, MET caching)

| Component | Tokens | Calls | Kost |
|-----------|--------|-------|------|
| Cache write (1e call, 31 tools) | 20.100 × 1.25× | 1 | $0.075 |
| Cache reads (9 overige calls) | 20.100 × 0.10× | 9 | $0.054 |
| Niet-gecachte input | 5.000 avg | 10 | $0.150 |
| Output | 1.000 avg | 10 | $0.150 |
| Thinking (10K budget, avg 7K) | 7.000 avg | 10 | $1.050 |
| | | | |
| **TOTAAL MET CACHING** | | | **$1.48 (≈ €1.36)** |
| *ter referentie: zonder caching* | | | *$2.01 (≈ €1.85)* |
| **Besparing door caching** | | | **~26%** |

*Noot: Admin sessies besparen meer omdat 31 tools = ~18.6K gecachte tokens (vs. 5.2K bij coaching).*

### Per Analyse Upload (6 Claude calls, geen thinking, geen caching)

Analyse calls zijn stateless (geen sessie-context) — caching helpt hier niet.

| Call | Input | Output | Kost |
|------|-------|--------|------|
| Turn evaluation | 15K | 4K | $0.105 |
| Signal detection | 12K | 4K | $0.096 |
| Phase coverage | 10K | 3K | $0.075 |
| Missed opportunities | 10K | 2K | $0.060 |
| Report generation | 12K | 3K | $0.081 |
| Debrief + moments | 15K | 3K | $0.090 |
| **Totaal per analyse** | **74K** | **19K** | **$0.51 (≈ €0.47)** |

---

## 3. Variabele Kosten per User per Maand (met caching)

### Gebruikersprofielen

| Profiel | Sessies/maand | Analyses/maand | Voice min | Avatar min |
|---------|--------------|----------------|-----------|------------|
| **Light** | 4 (1/week) | 1 | 10 | 5 |
| **Medium** | 12 (3/week) | 3 | 30 | 15 |
| **Heavy** | 20 (5/week) | 5 | 60 | 30 |

### Kosten per User per Maand (met caching, full features)

| Kostenlijn | Light | Medium | Heavy |
|------------|-------|--------|-------|
| Claude coaching (sessies, cached) | €8.80 | €26.40 | €44.00 |
| Claude analyse | €0.47 | €1.41 | €2.35 |
| Claude compaction (~1 per 4 sessies) | €0.10 | €0.30 | €0.50 |
| ElevenLabs TTS | €0.15 | €0.45 | €0.90 |
| Tavus avatar | €1.45 | €4.35 | €8.70 |
| Daily.co video | €0.12 | €0.36 | €0.60 |
| LiveKit voice | €0.04 | €0.12 | €0.24 |
| | | | |
| **TOTAAL per user/maand** | **€11.13** | **€33.39** | **€57.29** |

### Kosten per User per Maand (met caching, text-only)

| Kostenlijn | Light | Medium | Heavy |
|------------|-------|--------|-------|
| Claude coaching (cached) | €8.80 | €26.40 | €44.00 |
| Claude analyse | €0.47 | €1.41 | €2.35 |
| Compaction | €0.10 | €0.30 | €0.50 |
| | | | |
| **TOTAAL per user/maand** | **€9.37** | **€28.11** | **€46.85** |

---

## 4. Revenue: Pricing Tiers

| Tier | Maandelijks | Jaarlijks (per maand) | Target Audience |
|------|-------------|----------------------|-----------------|
| **Pro** | €98/mo | €49/mo (€588/jaar) | Individuele verkopers |
| **Founder** | €498/mo | €249/mo (€2.988/jaar) | Ambitieuze verkopers, kleine teams |
| **Inner Circle** | €2.498/mo | €1.249/mo (€14.988/jaar) | Exclusief (max 20 members), directe toegang Hugo |

**Stripe kosten:** 1.5% + €0.25 per transactie (EU) of 2.9% + €0.25 (internationaal)

---

## 5. Unit Economics per Tier (met caching)

### Marge per User (medium gebruik, full features)

| | Pro (€98/mo) | Founder (€498/mo) | Inner Circle (€2.498/mo) |
|--|--------------|--------------------|--------------------------|
| Revenue | €98.00 | €498.00 | €2.498.00 |
| Stripe fee | -€1.72 | -€7.72 | -€37.72 |
| AI + infra kosten (medium, cached) | -€33.39 | -€33.39 | -€57.29 (heavy) |
| **Netto per user** | **€62.89** | **€456.89** | **€2.402.99** |
| **Marge** | **64%** | **92%** | **96%** |

### Waarschuwing: Pro Tier + Heavy User

| | Pro (€98/mo), heavy user |
|--|--------------------------|
| Revenue | €98.00 |
| Stripe + AI kosten (cached) | -€59.01 |
| **Netto** | **€38.99** |
| **Marge** | **40%** |

Heavy Pro users hebben lage marge. Mitigatie: usage caps of fair use policy op Pro tier. Video-minuten zijn de belangrijkste variabele kost (Tavus Growth: €0,29/min).

---

## 6. Break-Even Analyse (met caching)

### Full Features (vaste kosten: €821/maand)

| Situatie | Users nodig |
|----------|-------------|
| Break-even (alleen Pro, medium) | **13 Pro users** |
| Break-even (6 Pro + 1 Founder) | **7 users** |

### Text-Only (vaste kosten: €116/maand)

| Situatie | Users nodig |
|----------|-------------|
| Break-even (alleen Pro) | **2 Pro users** |

---

## 7. Groeiprojecties: Weg naar €10k/maand (met caching)

### Realistisch Scenario (conservatief)

| Maand | Pro | Founder | Inner Circle | Revenue | Vaste | Variabel | Marketing (15%) | **Winst** |
|-------|-----|---------|-------------|---------|-------|----------|-----------------|-----------|
| 1 | 3 | 0 | 0 | €294 | €821 | €101 | €44 | **-€672** |
| 3 | 8 | 1 | 0 | €1.282 | €821 | €301 | €192 | **-€32** |
| 6 | 20 | 3 | 1 | €6.952 | €821 | €832 | €835 | **€4.464** |
| 9 | 35 | 5 | 2 | €12.916 | €821 | €1.465 | €1.550 | **€9.080** |
| 12 | 50 | 8 | 3 | €16.388 | €821 | €2.129 | €1.967 | **€11.471** |

### Premium Scenario (weinig users, hoge ARPU)

| Maand | Pro | Founder | Inner Circle | Revenue | Vaste | Variabel | Marketing (15%) | **Winst** |
|-------|-----|---------|-------------|---------|-------|----------|-----------------|-----------|
| 1 | 2 | 1 | 0 | €694 | €821 | €101 | €104 | **-€332** |
| 3 | 5 | 3 | 1 | €5.482 | €821 | €301 | €822 | **€3.538** |
| 6 | 10 | 5 | 2 | €8.466 | €821 | €568 | €1.270 | **€5.807** |
| 9 | 15 | 8 | 3 | €13.948 | €821 | €869 | €2.092 | **€10.166** |
| 12 | 20 | 10 | 4 | €16.932 | €821 | €1.137 | €2.540 | **€12.434** |

**€10k winst rond maand 9-10** (inclusief marketing spend).

---

## 8. Kostenoptimalisatie: Status

| Optimalisatie | Status | Besparing |
|---------------|--------|-----------|
| **Prompt caching** (system prompt + tools) | ✅ Live | ~15% totale sessiekosten, tot 26% admin |
| **Tool subset per context** (10 ipv 31 admin tools) | ⏳ Nog te doen | -40% admin input tokens |
| **Thinking budget verlagen** (admin 10K→4K, coaching 5K→2K) | ⏳ Nog te doen | -50% thinking kosten (= grootste kostenpost) |
| **Compaction threshold verlagen** (80K→40K) | ⏳ Nog te doen | -30% context kosten |
| **Start text-only** | 💡 Keuze | -€490/mo vast |
| **ElevenLabs → Pro** (€99 ipv €330) | 💡 Keuze | -€231/mo vast |

### Volgende optimalisatie: Thinking Budget Verlagen

Thinking tokens zijn nu de **dominante kostenpost** (~55% van sessiekosten). Het budget is 5K (coaching) en 10K (admin), maar het model gebruikt gemiddeld 3.5K/7K. Verlagen naar 2K/4K zou ~30-40% besparen op thinking costs zonder merkbaar kwaliteitsverlies voor standaard coaching interacties.

---

## 9. Kritieke Aannames & Risico's

| Aanname | Risico |
|---------|--------|
| Claude Sonnet 4 pricing $3/$15 per 1M | Prijsverhoging → output capping als mitigatie |
| Prompt caching effectief (90% korting) | Cache misses bij pauzes >5 min → hogere kosten |
| Gemiddeld 10 turns per sessie | Langere sessies → hogere kosten |
| Medium profiel (12 sessies/mo) | Heavy users (20+) → marge daalt naar 40% bij Pro |
| ElevenLabs Scale (€330) volstaat | Character limit bij veel voice users |
| Tavus Growth ($397/1250 min) volstaat | Overage bij >50 concurrent video users |
| Stripe in test mode | Productie onboarding nodig |
| V3 productie-ready | Nu superadmin-only; stabilisatie nodig |
| Marketing 15% van revenue werkt | Pre-launch; geen echte conversie data |

---

## 10. Samenvatting

| Metric | Zonder caching | **Met caching (huidig)** |
|--------|---------------|--------------------------|
| **Vaste kosten (full)** | €821/mo | €821/mo |
| **Kost per coaching sessie** | €2.60 | **€2.20** |
| **Kost per admin sessie** | €1.85 | **€1.36** |
| **Kost per analyse** | €0.47 | €0.47 (geen caching) |
| **Variabel/user/maand (medium, full)** | €38.19 | **€33.39** |
| **Marge Pro user (medium)** | 59% | **64%** |
| **Marge Founder user** | 91% | **92%** |
| **Break-even (full, Pro)** | 14 users | **13 users** |
| **€10k/mo winst (incl. marketing)** | Maand 9-10 | **Maand 9-10** |

**Conclusie:** Met prompt caching zijn de marges verbeterd, maar thinking tokens blijven de dominante kostenpost (~55%). De volgende optimalisatie (thinking budget verlagen) zou de grootste impact hebben. Groeiprojecties zijn nu inclusief 15% marketing spend — realistischer dan het eerdere model zonder marketing kosten.
