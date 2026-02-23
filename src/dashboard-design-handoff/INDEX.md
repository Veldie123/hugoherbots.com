# 📦 Dashboard Design Handoff Package

**HugoHerbots.ai - Home Tab (Dashboard)**  
**Versie**: 1.0  
**Status**: Production Ready  
**Datum**: December 2024

---

## 📋 Package Contents

### ✅ Core Design Files
- `Dashboard.tsx` - Hoofd dashboard component (2x2 grid layout)
- `AppLayout.tsx` - Sidebar + Topbar wrapper met navigatie
- `EmptyState.tsx` - Empty state component voor nieuwe gebruikers
- `Logo.tsx` - HH brand logo (horizontal/vertical/icon variants)

### 📚 Documentation
- `README.md` - Complete design specs, layout structuur, en design principes
- `QUICKSTART.md` - Stap-voor-stap installatie instructies
- `DEPENDENCIES.md` - Lijst van NPM packages en missing components
- `INDEX.md` - Dit bestand (package overzicht)

### 🎨 Styling
- `dashboard-styles.css` - CSS snippets voor HH color tokens, shadows, utilities

---

## 🎯 Design Highlights

### Layout Structuur
```
┌─────────────────────────────────────────┐
│  Header: Welkom terug + Streak Card     │
├─────────────────┬───────────────────────┤
│ Rollenspel      │ Video Cursus          │
│ Training        │                       │
├─────────────────┼───────────────────────┤
│ Live Coaching   │ Jouw Vooruitgang      │
│                 │                       │
├─────────────────┴───────────────────────┤
│  Hugo's Tip van de dag                  │
└─────────────────────────────────────────┘
```

### Key Features
- ✅ **2x2 Grid** met 4 hoofdblokken (Rollenspel, Video, Live, Progress)
- ✅ **Streak Indicator** rechts uitgelijnd (desktop), onder header (mobile)
- ✅ **Hover Effects** op cards (shadow groeit, arrow schuift)
- ✅ **Progress Bars** met percentage tracking
- ✅ **Hugo's Tip** card onderaan met coach badge
- ✅ **Empty State** voor nieuwe gebruikers zonder data
- ✅ **Fully Responsive** (desktop 2 cols, mobile 1 col)

### Color System (HH Brand)
- **Primary**: `#6B7A92` (SLATE GRAY) - Accent kleur
- **Success**: `#00C389` - Groene badges/progress
- **Warn**: `#FFB020` - Oranje badges/warnings
- **Text**: `#1C2535` (MIRAGE) - Hoofdtekst
- **Muted**: `#B1B2B5` (FRENCH GRAY) - Secondary tekst

---

## 🚀 Quick Start (3 minuten)

```bash
# 1. Installeer dependencies
npm install lucide-react clsx tailwind-merge
npx shadcn-ui@latest add card button badge input avatar sheet

# 2. Kopieer design files
cp dashboard-design-handoff/*.tsx components/HH/

# 3. Add CSS
cat dashboard-design-handoff/dashboard-styles.css >> styles/globals.css

# 4. Gebruik in App
import { Dashboard } from './components/HH/Dashboard';

<Dashboard hasData={true} navigate={(page) => console.log(page)} />
```

**Klaar!** 🎉

Voor gedetailleerde instructies → zie `QUICKSTART.md`

---

## 📁 File Map

| File | Locatie in project | Beschrijving |
|------|-------------------|--------------|
| `Dashboard.tsx` | `/components/HH/Dashboard.tsx` | Main dashboard component |
| `AppLayout.tsx` | `/components/HH/AppLayout.tsx` | Sidebar + topbar layout |
| `EmptyState.tsx` | `/components/HH/EmptyState.tsx` | Empty state UI |
| `Logo.tsx` | `/components/HH/Logo.tsx` | HH brand logo |
| `dashboard-styles.css` | Append to `/styles/globals.css` | CSS tokens & utilities |

---

## ⚠️ Dependencies Needed

### NPM Packages
- `lucide-react` - Icons (Play, Video, Radio, etc.)
- `clsx` + `tailwind-merge` - Utility function (cn)

### shadcn/ui Components
- Card, Button, Badge, Input, Avatar, Sheet

### Missing Components (Not included)
- `UserMenu.tsx` - User avatar menu (minimal version in DEPENDENCIES.md)
- `AppFooter.tsx` - Not used, can ignore

**Full dependency list** → zie `DEPENDENCIES.md`

---

## 🎨 Design System Reference

### Typography
- **H1**: 48px/56px (desktop), 32px/40px (mobile) - Light weight
- **H3**: 20px/28px - Card titles
- **Body**: 16px/24px - Regular text
- **Small**: 14px/20px - Meta info
- **Tiny**: 12px/16px - Labels

### Spacing
- **Desktop**: p-8 (32px padding)
- **Tablet**: p-6 (24px padding)
- **Mobile**: p-4 (16px padding)
- **Grid gap**: 24px (desktop), 16px (mobile)

### Shadows
- `shadow-hh-sm` - Subtiele shadow (Hugo's tip)
- `shadow-hh-md` - Medium shadow (cards default)
- `shadow-hh-lg` - Grote shadow (cards on hover)

### Border Radius
- Cards: `rounded-[16px]`
- Inner elements: `rounded-[12px]`
- Circles: `rounded-full`

---

## 🔧 Customization

### Props Interface

```tsx
interface DashboardProps {
  hasData?: boolean;      // true = show data, false = empty state
  navigate?: (page: string) => void;  // Navigation handler
}
```

### Navigation Targets

When user clicks nav items, `navigate()` receives:
- `"dashboard"` - Home tab
- `"roleplaychat"` - Rollenspel Training
- `"videos"` - Video Cursus
- `"live"` - Live Coaching
- `"overviewprogress"` - Overzicht & Voortgang
- `"team"` - Team
- `"analytics"` - Analytics
- `"settings"` - Settings

### Mock Data Locations

Want to change sample data?

- **User name**: Line ~55 (`"Welkom terug, Jan"`)
- **Streak count**: Line ~71 (`7 dagen`)
- **Progress %**: Lines ~147, 218 (style width)
- **Stats**: Lines ~325-380 (score, sessies, etc.)
- **Hugo's tip**: Lines ~412-418

---

## 📱 Responsive Breakpoints

- **Mobile**: < 640px (1 kolom, stack)
- **Tablet**: 640px - 1023px (2 kolommen indien ruimte)
- **Desktop**: ≥ 1024px (2x2 grid, sidebar expanded)

### Mobile Behavior
- Sidebar collapses to icon-only (left edge)
- Streak card moves under header
- 2x2 grid becomes 1 column stack
- Hamburger menu voor full nav

---

## ✅ Pre-flight Checklist

Before copying to Replit:

- [ ] Read `QUICKSTART.md` voor installatie stappen
- [ ] Check `DEPENDENCIES.md` voor missing components
- [ ] Read `README.md` voor design specs
- [ ] Verify Tailwind is geïnstalleerd in je project
- [ ] Ensure React + TypeScript setup
- [ ] Check if shadcn/ui is initialized

---

## 📊 Design Specs Summary

| Aspect | Value |
|--------|-------|
| Layout | 2x2 grid (desktop), 1 col (mobile) |
| Max width | Full width with padding |
| Color scheme | HH brand tokens (SLATE GRAY primary) |
| Typography | Hypatia Sans (fallback: system fonts) |
| Icons | lucide-react |
| Responsive | Mobile-first, breakpoints at 640px, 1024px |
| State management | Local props (hasData, navigate) |
| Animations | Hover shadows, arrow translations, pulse |

---

## 🎯 Next Steps After Install

1. **Backend Integration** - Replace mock data met API calls
2. **Routing** - Connect navigate() to React Router
3. **State Management** - Add Redux/Context voor user data
4. **Real-time Updates** - WebSocket voor live data
5. **Analytics** - Track user interactions
6. **A/B Testing** - Test verschillende layouts

---

## 📞 Support & Resources

- **Design Specs**: `README.md`
- **Installation**: `QUICKSTART.md`
- **Dependencies**: `DEPENDENCIES.md`
- **CSS Reference**: `dashboard-styles.css`

---

## 🏆 Production Ready

This package is **production-ready** and includes:
- ✅ Responsive design (mobile → desktop)
- ✅ Accessibility considerations (hover states, focus)
- ✅ Performance optimized (no unnecessary re-renders)
- ✅ Clean code structure (TypeScript interfaces)
- ✅ HH brand consistency (colors, typography, spacing)

---

**Ready to deploy! 🚀**

**Package Version**: 1.0  
**Last Updated**: December 2024  
**License**: Proprietary (HugoHerbots.ai)
