# 🔧 Fixes Applied - 19 januari 2025

## ✅ **COMPLETED:**

### 1. Settings - Subnavigatie & Modals
- ✅ Left sidebar met subnavigation (Profile, Notifications, Training, Subscription, Team, Danger)
- ✅ Auto-scroll naar juiste sectie bij "Plans & Pricing" / "Manage Workspace" clicks
- ✅ "Wijzig plan" modal - 3 plans (Starter €49, Pro €149, Team €499)
- ✅ "Betalingsmethode" modal - Credit card form
- ✅ UserMenu navigeert met query params: `settings?section=subscription`

---

## 🚧 **IN PROGRESS:**

### 2. Help Center & Resources Pages
- ⏳ Nieuwe pagina `/components/HH/HelpCenter.tsx`
- ⏳ Nieuwe pagina `/components/HH/Resources.tsx`
- ⏳ UserMenu links connected

### 3. Preview Mode Fixes
- ⏳ Logout werkt niet in preview
- ⏳ "Digital Coaching" niet klikbaar in preview
- ⏳ "Gesprek Analyse" niet klikbaar in preview

### 4. Admin Bol Visibility
- ⏳ Verberg admin bol op Signup page
- ⏳ Verberg admin bol op Login page

### 5. SPIN → EPIC Vervangingen
- ⏳ VideoLibrary - Video modal teksten
- ⏳ DigitalCoaching - Avatar placeholder tips
- ⏳ DigitalCoaching - Chat tekst verwijderen (audio only)
- ⏳ ConversationAnalysis - SPIN references

### 6. Live Coaching - Bekijk Opname
- ⏳ Modal/page voor recording playback

### 7. Team - Nodig Teamlid Uit
- ⏳ Invite modal UI

### 8. Team - Hugo's Tip
- ⏳ Generieke stimulerende tip (niet Tom-specifiek)

### 9. Analytics - Bekijk Alle Technieken
- ⏳ Navigate naar technique library/detail page

---

## 📝 **NOTES:**

- Query params voor settings werken als: `settings?section=subscription`
- In App.tsx moet de routing logic de `?section=` param doorgeven aan Settings component
- Preview mode moet aparte state hebben voor logout/navigation

