# V3 Admin Fix Plan — Fase 0: V3 Admin Bruikbaar Maken

## Status: GOEDGEKEURD — klaar voor implementatie

## Context

V3 admin werkt technisch (sessies starten, tools worden aangeroepen) maar de output is **onbruikbaar**:

1. **Briefing fabriceert data** — "0 webinars", "geen vastgelopen gebruikers", "14 gebruikers allemaal actief" — alles verzonnen
2. **Geen onboarding** — Hugo moet door config files (technieken, houdingen, slides, etc.) voor review, maar V3 weet niet dat dit bestaat
3. **"Ik heb even te veel opgezocht"** — als Hugo vraagt om technieken te reviewen, hit de agent `MAX_TOOL_ROUNDS=5` en geeft fallback
4. **Video tool toont MVI-codes** ipv commerciële titels
5. **Sessies verdwijnen bij navigatie** — in-memory opslag
6. **V2 admin fallback** toont user-view tekst van maand geleden

### Hugo's wens
- Onboarding flow: technieken + houdingen één voor één doorlopen
- Agent mag aandringen op onboarding, maar Hugo beslist finaal wat hij doet
- Als onboarding klaar is: keuzemenu, geen automatische briefing die hallucineert

---

## Fix 1: System Prompt — Anti-hallucinatie + Onboarding bewust

**File:** `server/hugo-engine/v3/system-prompt-admin.ts`

Toevoegen aan system prompt:

```
KRITIEKE REGELS:
1. Verzin NOOIT data. Als een tool geen resultaten teruggeeft of een error geeft, zeg eerlijk "Ik kon die data niet ophalen." Geef NOOIT nepgetallen.
2. Het platform is NIEUW — er zijn nog weinig gebruikers. Doe niet alsof het vol zit.
3. Gebruik tools alleen als Hugo erom vraagt of als je specifieke data nodig hebt. Roep niet proactief 5 tools tegelijk aan.

ONBOARDING:
- Hugo moet zijn EPIC-technieken en klanthoudingen reviewen voordat het platform klaar is.
- Check de onboarding-status met get_onboarding_status bij elke sessie.
- Als onboarding NIET compleet is: meld dit en stel voor om verder te gaan met de review. Maar Hugo beslist — als hij iets anders wil doen, help hem daarmee.
- Presenteer items één voor één met get_next_review_item. Wacht op zijn oordeel via submit_review.
```

---

## Fix 2: Opening Prompt — Onboarding check ipv dagelijkse briefing

**File:** `server/hugo-engine/v3/routes.ts` (regels 79-91)

Huidig:
```typescript
openingPrompt = `Geef me een dagelijkse briefing. Check: hoeveel webinars er gepland staan...`;
```

**Nieuw:**
```typescript
// Pre-fetch onboarding status
const onboardingStatus = await getOnboardingStatus();

if (!onboardingStatus.isComplete) {
  openingPrompt = `De onboarding is nog niet compleet: ${onboardingStatus.approved} van ${onboardingStatus.total} items goedgekeurd.
  Begroet Hugo warm. Meld de onboarding-status en stel voor om verder te gaan met de review.
  Maar geef ook aan dat hij vrij is om iets anders te doen — schets kort alle mogelijkheden.
  Als Hugo akkoord gaat met reviewen, gebruik get_next_review_item om het eerste item te tonen.`;
} else {
  openingPrompt = `Begroet Hugo kort als zijn platformassistent. Geef hem een overzicht van wat je kunt doen:
  - Platform analytics bekijken
  - Webinars beheren
  - Video-bibliotheek organiseren
  - Coachingsessies en analyses bekijken
  - Content aanpassen (technieken, houdingen, slides)
  - Rapport genereren
  Vraag wat hij wil doen. Gebruik GEEN tools tenzij hij erom vraagt.`;
}
```

### Helper: `getOnboardingStatus()`
```typescript
async function getOnboardingStatus(): Promise<{ total: number; approved: number; isComplete: boolean }> {
  const { data } = await supabase
    .from('admin_onboarding_progress')
    .select('status');
  const total = data?.length || 0;
  const approved = data?.filter(d => d.status === 'approved').length || 0;
  return { total, approved, isComplete: total > 0 && approved === total };
}
```

---

## Fix 3: Onboarding Tools toevoegen (3 nieuwe tools)

**File:** `server/hugo-engine/v3/tools/admin.ts`

### Tool 1: `get_onboarding_status`
```typescript
// Returns: { total, approved, skipped, feedback_given, pending, isComplete, modules: { technieken: {...}, houdingen: {...} } }
// Query: admin_onboarding_progress grouped by module
```

### Tool 2: `get_next_review_item`
```typescript
// Input: { module?: "technieken" | "houdingen" }
// Returns: { type, key, itemNumber, totalInModule, data: { naam, doel, hoe, stappenplan, voorbeeld, tags } }
// Logic:
//   1. Query admin_onboarding_progress WHERE status = 'pending' ORDER BY item_key LIMIT 1
//   2. Load item data from technieken_index.json of klant_houdingen.json
//   3. Return volledige item data voor presentatie
```

### Tool 3: `submit_review`
```typescript
// Input: { item_key: string, action: "approve" | "feedback" | "skip", feedback_text?: string }
// Logic:
//   1. UPDATE admin_onboarding_progress SET status = action, reviewed_at = now()
//   2. Als feedback: sla feedback op als admin_correction
//   3. Return: { success, remaining, nextItem (auto-fetch next) }
```

---

## Fix 4: Video Tool — Commerciële titels

**File:** `server/video-processor.js` (regel ~2318)

SELECT query uitbreiden met `ai_attractive_title`:
```javascript
// Oud:
select('id,video_title,drive_file_name,techniek_id,playback_order,mux_playback_id,duration_seconds,mux_asset_id')
// Nieuw:
select('id,video_title,drive_file_name,techniek_id,playback_order,mux_playback_id,duration_seconds,mux_asset_id,ai_attractive_title')
```

Response mapping:
```javascript
title: job.ai_attractive_title || job.video_title || job.drive_file_name,
```

---

## Fix 5: V2 Admin Fallback Tekst

**File:** `src/components/HH/AdminChatExpertMode.tsx` (regel ~448)

```typescript
engineModel === "v3"
  ? "V3 sessie kon niet gestart worden. Controleer de server logs of schakel terug naar HugoGPT v1.0."
  : "Dag Hugo! Er ging iets mis bij het laden. Herlaad de pagina of probeer het opnieuw."
```

---

## Fix 6: Sessie Persistentie (localStorage + resume)

### Frontend: `AdminChatExpertMode.tsx`
```typescript
// Na sessie creatie:
localStorage.setItem('v3_admin_sessionId', sessionId);
localStorage.setItem('v3_admin_messages', JSON.stringify(messages));

// Bij component mount:
const savedId = localStorage.getItem('v3_admin_sessionId');
if (savedId) {
  // Check of sessie nog leeft via GET /api/v3/session/:id
  // Zo ja: herstel messages, gebruik bestaande sessie
  // Zo nee: maak nieuwe sessie
}
```

---

## Kritieke Bestanden

| Bestand | Wijziging |
|---------|-----------|
| `server/hugo-engine/v3/system-prompt-admin.ts` | Fix 1: Anti-hallucinatie + onboarding regels |
| `server/hugo-engine/v3/routes.ts` | Fix 2: Opening prompt + getOnboardingStatus() |
| `server/hugo-engine/v3/tools/admin.ts` | Fix 3: 3 onboarding tools |
| `server/video-processor.js` | Fix 4: ai_attractive_title in query |
| `src/components/HH/AdminChatExpertMode.tsx` | Fix 5+6: Fallback + sessie persistentie |

## Implementatievolgorde

1. **Fix 1** (system prompt) — snelste impact
2. **Fix 3** (onboarding tools) — nodig voor Fix 2
3. **Fix 2** (opening prompt) — core onboarding flow
4. **Fix 4** (video titels) — data kwaliteit
5. **Fix 5** (V2 fallback) — quick fix
6. **Fix 6** (sessie persistentie) — UX

## Verificatie

1. `npm run build` slaagt
2. Herstart server
3. Admin V3 → toont onboarding voorstel + keuzevrijheid
4. Hugo vraagt om technieken te reviewen → eerste techniek met details
5. Hugo approves/skips → volgende techniek
6. Hugo zegt "ik wil webinars bekijken" → agent helpt (geen dwang)
7. Video tool → commerciële titels
8. Navigeer weg en terug → sessie hervat
9. V2 admin fallback → geen "selecteer een techniek" tekst
10. Commit + push
