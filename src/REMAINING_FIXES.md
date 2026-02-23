# 🔧 Remaining Fixes - HugoHerbots.ai

**Datum:** 19 januari 2025  
**Status:** 4/16 compleet

---

## ✅ **COMPLEET (4/16):**

1. ✅ **Settings - Subnavigatie** - Left sidebar + auto-scroll
2. ✅ **Settings - Modals** - "Wijzig plan" + "Betalingsmethode"
3. ✅ **Help Center page** - `/components/HH/HelpCenter.tsx`
4. ✅ **Resources page** - `/components/HH/Resources.tsx`

---

## 🚧 **NOG TE DOEN (12/16):**

### **Preview Mode Fixes:**
5. ❌ **Logout in preview** - Werkt niet, gebruiker blijft in preview
6. ❌ **Digital Coaching in preview** - Niet klikbaar
7. ❌ **Gesprek Analyse in preview** - Niet klikbaar

**Oplossing:** AppPreview component moet aparte state management hebben

---

### **Admin Bol Visibility:**
8. ❌ **Verberg admin bol op Signup** - Paarse admin bol moet weg
9. ❌ **Verberg admin bol op Login** - Paarse admin button moet weg

**Oplossing:** Conditional rendering in de relevante pages

---

### **SPIN → EPIC Vervangingen:**
10. ❌ **VideoLibrary - Video modal** - "SPIN-vragen Masterclass" → Echte EPIC techniek naam
11. ❌ **DigitalCoaching - Avatar tips** - "Tip: Stel een SPIN vraag..." → EPIC techniek tip
12. ❌ **DigitalCoaching - Chat tekst** - Verwijder "Hugo: Hey! Klaar om..." bij audio mode
13. ❌ **ConversationAnalysis - SPIN references** - Alle SPIN → EPIC

**Oplossing:** Search & replace + dynamic techniek data uit `/data/epicTechniques.ts`

---

### **Live Coaching:**
14. ❌ **Bekijk opname** - Modal/page voor recording playback

**Oplossing:** 
```tsx
<Dialog> met video player + transcript + key takeaways
```

---

### **Team Functionaliteit:**
15. ❌ **Nodig teamlid uit** - UI/UX voor invite flow

**Oplossing:**
```tsx
<Dialog> met email input + role selector + invite button
```

16. ❌ **Hugo's team tip** - "Bekijk Tom's vooruitgang" → Generieke tip

**Oplossing:**
```tsx
"Je team laat geweldige vooruitgang zien. Blijf samen oefenen!"
```

---

### **Analytics:**
17. ❌ **Bekijk alle technieken** - Navigate naar technique detail page

**Oplossing:**
```tsx
onClick={() => navigate("techniques")} // Nieuwe page of modal
```

---

## 📋 **Specifieke Code Locaties:**

### Preview Mode
- **File:** `/components/HH/AppPreview.tsx`
- **Lines:** Logout button, navigation handlers

### Admin Bol
- **Files:** `/components/HH/Signup.tsx`, `/components/HH/Login.tsx`
- **Search for:** Admin avatar/button components

### SPIN References
- **Files:** 
  - `/components/HH/VideoLibrary.tsx` (line ~300-350)
  - `/components/HH/DigitalCoaching.tsx` (line ~200-250)
  - `/components/HH/ConversationAnalysis.tsx` (search "SPIN")

### Live Coaching
- **File:** `/components/HH/LiveCoaching.tsx`
- **Line:** "Bekijk opname" button (~line 250)

### Team
- **File:** `/components/HH/TeamSessions.tsx`
- **Lines:** "Nodig teamlid uit" button + Hugo's tip at bottom

### Analytics
- **File:** `/components/HH/Analytics.tsx`
- **Line:** "Bekijk alle technieken" button (~line 180)

---

## 🎯 **Prioriteit:**

**HIGH (moet voor testing):**
1. Preview mode fixes (5-7)
2. Admin bol hiding (8-9)
3. SPIN → EPIC (10-13)

**MEDIUM (nice to have):**
4. Live Coaching opname (14)
5. Team invite (15)
6. Team tip (16)
7. Analytics link (17)

---

## 💡 **Test Scenario's:**

### Test 1: Settings Navigation
1. Klik "Plans & Pricing" in user menu
2. Verwacht: Auto-scroll naar Abonnement sectie
3. Klik "Wijzig plan" → Modal opent met 3 plans
4. Klik "Betalingsmethode" → Modal opent met credit card form

### Test 2: Help & Resources
1. Klik "Help Center" in user menu
2. Verwacht: Help Center page met categories + popular articles
3. Klik "Resources" in user menu
4. Verwacht: Resources page met downloadable guides + webinars

### Test 3: Preview Mode (NEEDS FIX)
1. Ga naar AppPreview
2. Klik "Digital Coaching" → Moet werken
3. Klik "Logout" → Moet terugkeren naar landing

### Test 4: Admin Bol (NEEDS FIX)
1. Ga naar Signup page
2. Verwacht: Geen paarse admin bol zichtbaar
3. Ga naar Login page
4. Verwacht: Geen paarse admin button zichtbaar

---

## 📝 **Notes voor Developer:**

- UserMenu navigation werkt met query params: `settings?section=subscription`
- Help Center + Resources pages zijn klaar en functioneel
- EPIC technieken data beschikbaar in `/data/epicTechniques.ts`
- Alle modals moeten Dialog component van shadcn/ui gebruiken

---

**Next Steps:**
1. Test Settings + Help + Resources
2. Fix preview mode navigation
3. Hide admin UI on marketing pages
4. Replace all SPIN references with EPIC
5. Build remaining modals/pages

