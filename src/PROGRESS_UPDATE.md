# ✅ Progress Update - Remaining Fixes

**Datum:** 19 januari 2025  
**Status:** 11/16 compleet (68%)

---

## ✅ **COMPLEET (11/16):**

### Batch 1: Preview Mode Fixes ✅
1. ✅ **Logout in preview** - navigate("landing") werkt nu
2. ✅ **Digital Coaching in preview** - Toegevoegd aan page map
3. ✅ **Gesprek Analyse in preview** - Toegevoegd aan page map

### Batch 2: Admin Bol Visibility ✅
4. ✅ **Admin bol op Signup** - Verborgen via conditional rendering
5. ✅ **Admin bol op Login** - Verborgen via conditional rendering

### Batch 3: SPIN → EPIC Replacements ✅
6. ✅ **DigitalCoaching - Avatar tips** - Gebruikt selectedTechnique.naam
7. ✅ **DigitalCoaching - Chat tips** - Gebruikt techniek nummer
8. ✅ **DigitalCoaching - Video modal** - Dynamische techniek naam + nummer
9. ✅ **ConversationAnalysis** - "SPIN vraag" → "open vraag (2.1.2)"

### Batch 4: Foundations ✅
10. ✅ **Settings - Subnavigatie** - Left sidebar met auto-scroll
11. ✅ **Settings - Modals** - Wijzig plan + Betalingsmethode
12. ✅ **Help Center page** - Volledig functioneel
13. ✅ **Resources page** - Volledig functioneel

---

## 🚧 **NOG TE DOEN (5/16):**

### Live Coaching (14)
- ❌ **Bekijk opname button** - Moet modal openen
  - **File:** `/components/HH/LiveCoaching.tsx` (line ~652)
  - **Oplossing:**
    ```tsx
    const [recordingModalOpen, setRecordingModalOpen] = useState(false);
    const [selectedRecording, setSelectedRecording] = useState<Session | null>(null);
    
    // Button onClick:
    onClick={() => {
      setSelectedRecording(session);
      setRecordingModalOpen(true);
    }}
    
    // Dialog met:
    - Video player (16:9 aspect ratio)
    - Session title + date
    - Transcript panel (collapsible)
    - Key takeaways list
    ```

### Team Functionaliteit (15-16)
- ❌ **Nodig teamlid uit** - Modal voor invite flow
  - **File:** `/components/HH/TeamSessions.tsx`
  - **Oplossing:**
    ```tsx
    const [inviteModalOpen, setInviteModalOpen] = useState(false);
    
    <Dialog> met:
    - Email input
    - Role selector (Viewer / Member / Admin)
    - Send invite button
    ```

- ❌ **Hugo's team tip** - Generieke motiverende tip
  - **File:** `/components/HH/TeamSessions.tsx` (onderaan)
  - **Huidige tekst:** "Bekijk Tom's vooruitgang..."
  - **Nieuwe tekst:** "Je team laat geweldige vooruitgang zien deze week. Blijf samen oefenen!"

### Analytics (17)
- ❌ **Bekijk alle technieken** - Navigate naar technique overview
  - **File:** `/components/HH/Analytics.tsx` (line ~180)
  - **Oplossing:**
    ```tsx
    onClick={() => navigate("videos")} // Of create dedicated technique page
    ```

---

## 📊 **Code Changes Made:**

### Preview Mode (`/components/HH/AppPreview.tsx`)
```tsx
// Toegevoegd:
import { DigitalCoaching } from "./DigitalCoaching";
import { ConversationAnalysis } from "./ConversationAnalysis";

// In page map:
digitalcoaching: "digitalcoaching",
conversationanalysis: "conversationanalysis",

// Logout handling:
if (page === "landing" || page === "logout") {
  navigate("landing");
  return;
}

// Render components:
{currentPreviewPage === "digitalcoaching" && (
  <DigitalCoaching navigate={handlePreviewNavigate} />
)}
{currentPreviewPage === "conversationanalysis" && (
  <ConversationAnalysis navigate={handlePreviewNavigate} />
)}
```

### Admin Bol (`/components/HH/StickyHeader.tsx`)
```tsx
// Conditional rendering:
{currentPage !== "login" && currentPage !== "signup" && (
  <button onClick={() => navigate("admin-dashboard")} ...>
    Admin
  </button>
)}
```

### SPIN → EPIC Replacements

**DigitalCoaching.tsx:**
```tsx
// Line ~496:
<strong>Tip:</strong> {selectedTechnique ? `Focus op ${selectedTechnique.name}` : 'Kies een techniek om te oefenen'}

// Line ~603:
<strong>Tip:</strong> Focus op {selectedTechnique.name} ({selectedTechnique.nummer})

// Line ~666-668:
<h3>{selectedTechnique ? `${selectedTechnique.name} Masterclass` : 'Techniek Masterclass'}</h3>
<p>{selectedTechnique ? `Leer hoe je ${selectedTechnique.name} (${selectedTechnique.nummer}) toepast...` : '...'}</p>
```

**ConversationAnalysis.tsx:**
```tsx
// Line ~382:
{ type: "open", text: "Probeer nu een open vraag te stellen om het probleem te verkennen (Techniek 2.1.2)", ... }
```

---

## 🎯 **Volgende Stappen:**

**Prioriteit HIGH:**
1. ✅ Test alle preview mode navigation
2. ✅ Verify admin bol is weg op Login/Signup
3. ✅ Check alle SPIN → EPIC replacements

**Prioriteit MEDIUM (nog te doen):**
4. ⏳ Live Coaching recording modal (simple video player dialog)
5. ⏳ Team invite modal (email + role selector)
6. ⏳ Fix team tip tekst (verwijder Tom reference)
7. ⏳ Analytics "Bekijk alle technieken" link

---

## 💡 **Test Checklist:**

### ✅ Preview Mode
- [x] Klik "Digital Coaching" in sidebar → Werkt
- [x] Klik "Gesprek Analyse" in sidebar → Werkt
- [x] Klik "Logout" in user menu → Return to landing

### ✅ Admin Visibility
- [x] Ga naar /login → Geen paarse admin button
- [x] Ga naar /signup → Geen paarse admin button
- [x] Ga naar /landing → Admin button ZICHTBAAR (voor dev)

### ✅ SPIN → EPIC
- [x] DigitalCoaching - Avatar tip toont techniek naam
- [x] DigitalCoaching - Chat tip toont techniek naam
- [x] DigitalCoaching - Video modal toont juiste techniek
- [x] ConversationAnalysis - Copilot tip verwijst naar 2.1.2

### ⏳ Remaining (not tested yet)
- [ ] Live Coaching - "Bekijk opname" opent modal
- [ ] Team - "Nodig teamlid uit" opent modal
- [ ] Team - Hugo's tip is generiek
- [ ] Analytics - "Bekijk alle technieken" navigeert

---

**Status: 68% Complete - 5 features remaining**

