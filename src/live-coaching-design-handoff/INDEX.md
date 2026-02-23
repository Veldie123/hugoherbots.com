# Live Coaching - Design Handoff Package

**Pure design/frontend package** voor Replit - Alleen UI/UX, geen backend code.

---

## 📦 Wat zit erin?

### 1. **LiveCoaching.tsx** (Main Component)
Complete React component voor de Live Coaching pagina:
- Live video area met Hugo's foto
- Real-time chat panel met tabs (Chat/Polls)
- Poll voting interface
- Upcoming sessions grid (3 kolommen)
- Past sessions grid met recordings
- Alle mock data included

**Gebruik:** Kopieer dit bestand direct naar je Replit project.

---

### 2. **DashboardWidget.tsx** (Dashboard Section)
Widget voor "Opkomende Live Coaching" op Dashboard:
- 3 session cards in responsive grid
- Calendar export functionaliteit (.ics download)
- "Elke woensdag" badge met Radio icon
- Gradient highlight border op eerste sessie
- "Herinner me" buttons

**Gebruik:** Importeer in je Dashboard component.

---

### 3. **design-tokens.css** (CSS Variables)
Alle HH design tokens en custom styles:
- Color palette (ink, primary, muted, success, warn)
- Typography scale (48/32/24/16/14/12px)
- Shadow system (sm/md/lg)
- Spacing system (4/8/16/24px)
- Responsive breakpoints
- Custom animations (pulse, transitions)

**Gebruik:** Importeer in je `globals.css` of main CSS file.

---

### 4. **DESIGN-GUIDE.md** (Complete Guide)
Pixel-perfect design specificatie:
- Component breakdown (structuur + styling)
- Exact measurements (spacing, typography, icons)
- Color usage guide
- Interactive states (hover, active, disabled)
- Responsive behavior
- Reusable patterns
- UX details (auto-scroll, calendar export, etc.)
- Quality checklist

**Gebruik:** Lees dit om exact dezelfde UX/UI te bouwen als in Figma Make.

---

### 5. **README.md** (Feature Overview)
Overzicht van alle features en design principes:
- Feature lijst
- Color palette
- Typography scale
- Component patterns
- Tailwind class reference
- Custom CSS examples

**Gebruik:** Quick reference voor design tokens en patterns.

---

### 6. **INDEX.md** (Dit bestand)
Overzicht van de package.

---

## 🚀 Quick Start

### Voor Replit:

1. **Kopieer component bestanden**
   ```bash
   # Kopieer naar je project
   LiveCoaching.tsx → /components/HH/LiveCoaching.tsx
   DashboardWidget.tsx → /components/HH/DashboardWidget.tsx
   ```

2. **Voeg CSS toe**
   ```css
   /* In je globals.css of main.css */
   @import './design-tokens.css';
   ```

3. **Importeer in je app**
   ```tsx
   // In je router of App.tsx
   import { LiveCoaching } from './components/HH/LiveCoaching';
   
   // In je Dashboard.tsx
   import { DashboardLiveCoachingWidget } from './components/HH/DashboardWidget';
   ```

4. **Check DESIGN-GUIDE.md**
   - Lees voor pixel-perfect implementatie details
   - Gebruik checklist aan het einde

---

## 🎨 Design System Reference

### Colors (Quick)
```css
--hh-ink: #1C2535         /* Main text */
--hh-primary: #6B7A92     /* Accent, CTAs */
--hh-muted: #B1B2B5       /* Secondary text */
--hh-success: #00C389     /* Green */
--hh-warn: #FFB020        /* Yellow */
--destructive: hsl(0,84%,60%)  /* Red - Live badge */
```

### Typography (Quick)
```
H1: 48px/56px (desktop), 32px/40px (mobile)
H2: 32px/40px
H3: 24px/32px
Body: 16px/24px
Small: 14px/20px
Tiny: 12px/16px
```

### Spacing (Quick)
```
gap-2: 8px
gap-3: 12px
gap-4: 16px
gap-6: 24px
p-4: 16px (mobile cards)
p-6: 24px (desktop cards)
```

### Icons (Quick)
```
w-3 h-3: 12px (tiny - badges)
w-4 h-4: 16px (most UI icons)
w-5 h-5: 20px (larger icons)
w-8 h-8: 32px (avatars, icon buttons)
```

---

## 📐 Component Sizes

### Video Container
```css
aspect-ratio: 16/9
background: var(--hh-ink)
```

### Chat Panel
```css
height: 700px (fixed)
grid: lg:grid-cols-[1fr_380px]  /* 380px sidebar */
```

### Session Cards
```css
padding: 16px (mobile), 24px (desktop)
border-radius: 16px
shadow: shadow-hh-sm (default), shadow-hh-md (hover)
```

### Avatar Circles
```css
size: 32px (w-8 h-8)
initials: 12px text
background: hh-primary (host), hh-ui-200 (user)
```

---

## 🎯 Key Features & Patterns

### Live Badge (Pulsing)
```tsx
<Badge className="bg-destructive text-white border-destructive animate-pulse">
  <Radio className="w-4 h-4" />
  LIVE NU
</Badge>
```

### Session Card with Highlight
```tsx
<Card className="p-6 rounded-[16px] shadow-hh-sm hover:shadow-hh-md transition-all relative overflow-hidden">
  {/* Gradient top border voor eerste sessie */}
  <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-hh-primary to-hh-accent" />
  {/* Rest van card content */}
</Card>
```

### Poll Option with Progress Bar
```tsx
<button className="w-full text-left p-3 rounded-lg border border-hh-border hover:border-hh-primary transition-colors relative overflow-hidden">
  <div className="absolute inset-0 bg-hh-primary/5" style={{ width: `${percentage}%` }} />
  <div className="relative flex items-center justify-between">
    <span>{option.text}</span>
    <span className="text-hh-primary">{percentage}%</span>
  </div>
</button>
```

### Calendar Export (.ics)
```tsx
// Complete implementatie in DashboardWidget.tsx
const handleAddToCalendar = (session) => {
  const icsContent = [
    'BEGIN:VCALENDAR',
    // ... full ICS format
  ].join('\n');
  
  const blob = new Blob([icsContent], { type: 'text/calendar' });
  // ... download logic
}
```

---

## 📱 Responsive Grid

### Mobile (< 640px)
```css
.grid                    /* 1 column */
.flex-col                /* Stack vertically */
.p-4                     /* 16px padding */
```

### Tablet (640px - 1023px)
```css
sm:grid-cols-2          /* 2 columns */
sm:flex-row             /* Horizontal layout */
sm:p-6                  /* 24px padding */
```

### Desktop (>= 1024px)
```css
lg:grid-cols-3          /* 3 columns */
lg:grid-cols-[1fr_380px] /* Video + Chat layout */
lg:p-8                  /* 32px padding */
```

---

## ✅ Implementation Checklist

### Must-have:
- [ ] Exact color tokens gebruikt (hh-primary, hh-text, etc.)
- [ ] Correct font sizes (48/32/24/16/14/12px)
- [ ] Spacing exact (gap-2/3/4/6, p-4/p-6)
- [ ] Icon sizes correct (w-3/4/5/8)
- [ ] Border radius 16px voor cards
- [ ] Shadows: shadow-hh-sm default, shadow-hh-md hover
- [ ] Responsive: 1 → 2 → 3 columns

### Nice-to-have:
- [ ] Live badge pulse animation
- [ ] Smooth transitions (200-300ms)
- [ ] Chat auto-scroll bij nieuwe berichten
- [ ] Calendar .ics download werkt
- [ ] Poll percentage calculation
- [ ] Hover states op alle interactive elements
- [ ] Focus states (outline-2 outline-hh-primary)
- [ ] Reduced motion support

---

## 🔧 Troubleshooting

### "Colors niet zichtbaar"
→ Check of `design-tokens.css` correct geïmporteerd is in je main CSS

### "Layout breekt op mobile"
→ Check responsive classes: `sm:` prefix voor tablet, `lg:` voor desktop

### "Icons te groot/klein"
→ Gebruik exact `w-4 h-4` voor UI icons, `w-8 h-8` voor avatars

### "Spacing niet consistent"
→ Gebruik Tailwind gap-X classes (gap-2/3/4/6), niet custom values

### "Shadows te donker"
→ Gebruik `shadow-hh-sm` en `shadow-hh-md`, niet default Tailwind shadows

---

## 📞 Design Questions?

Check deze bestanden in volgorde:

1. **Quick fix?** → README.md (Tailwind class reference)
2. **Component details?** → DESIGN-GUIDE.md (breakdown + measurements)
3. **CSS tokens?** → design-tokens.css (alle variabelen)
4. **Code example?** → LiveCoaching.tsx / DashboardWidget.tsx

---

**Veel succes met bouwen! Deze package bevat alles voor pixel-perfect Live Coaching UI.** 🎨
