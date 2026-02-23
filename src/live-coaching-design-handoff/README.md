# Live Coaching - Design Handoff voor Replit

**Puur design/frontend package** - Alle UI components, styling en UX patterns om exact dezelfde Live Coaching experience te bouwen als in Figma Make.

---

## 📦 Package Inhoud

1. **LiveCoaching.tsx** - Complete component code
2. **DashboardWidget.tsx** - "Opkomende Live Coaching" sectie voor Dashboard
3. **design-tokens.css** - Alle HH design tokens (colors, typography, spacing)
4. **component-patterns.md** - Reusable UI patterns
5. **mock-data.ts** - Frontend mock data voor development
6. **styling-guide.md** - Tailwind classes en custom CSS

---

## 🎨 Design Principes

### Brand: HugoHerbots.ai
- **Tone**: Direct, warm, persoonlijk, eerlijk
- **Feel**: Professioneel maar toegankelijk
- **Core**: "People buy people" - focus op menselijke connectie

### Visual Style
- **Clean cards** met 16px border radius
- **Subtle shadows** voor depth (shadow-hh-sm, shadow-hh-md)
- **Accent colors** voor status (live badge rood, success groen)
- **Generous spacing** tussen secties (24px desktop, 16px mobile)
- **Hover states** voor interactieve elementen

---

## 🎯 Features & Components

### 1. Live Session Video Area
- **16:9 aspect ratio** video container
- **Live badge** (top-left) - rood met pulse animation
- **Viewer count** (top-right) - black overlay met blur
- **Background image** van Hugo tijdens sessie
- **Session info below** - topic badge, tijd, deelnemers

### 2. Real-time Chat Panel
- **Tabbed interface** - Chat / Polls tabs
- **ScrollArea** voor messages met auto-scroll naar bottom
- **Avatar circles** met initials (8x8 size)
- **Host badge** voor Hugo's berichten
- **Timestamps** op alle berichten (12px, muted)
- **Message input** met send button
- **Helper text** onder input voor tone setting

### 3. Live Polls
- **Question header** met ThumbsUp icon
- **Option buttons** met:
  - Progress bar background (primary/5 opacity)
  - Vote count rechts
  - Percentage in accent color
- **Total votes** onder opties
- **Info card** over Hugo's gebruik van polls

### 4. Upcoming Sessions Grid
- **3-column grid** (desktop) → 2 (tablet) → 1 (mobile)
- **Session cards** met:
  - Phase badge (outline variant)
  - Calendar icon button (top-right)
  - Titel + datum/tijd info
  - Reminder button (outline variant)
- **Highlight border** (gradient top) op eerstvolgende sessie

### 5. Past Sessions
- **Same grid layout** als upcoming
- **Video icon** op CTA button
- **"Bekijk opname"** label
- **Grijze/muted** styling vs. active sessions

---

## 🎨 Color Palette (HH Design Tokens)

```css
/* Primary Colors */
--hh-ink: #1C2535;              /* Mirage - darkest */
--hh-ui-100: #2B3748;           /* Indian Ink - dark backgrounds */
--hh-primary: #6B7A92;          /* Slate Gray - accent, CTA's */
--hh-muted: #B1B2B5;            /* French Gray - secondary text */
--hh-ui-200: #E4E4E4;           /* Platinum - light gray */
--hh-white: #FFFFFF;            /* Pure white */

/* Status Colors */
--hh-success: #00C389;          /* Groen - positive */
--hh-warn: #FFB020;             /* Geel - attention */
--destructive: hsl(0, 84%, 60%); /* Rood - live badge */

/* Specific UI */
--hh-text: #1C2535;             /* Main text (same as ink) */
--hh-border: #E4E4E4;           /* Borders (same as ui-200) */
--hh-ui-50: #F7F7F8;            /* Lightest background */
--hh-accent: #6B7A92;           /* Same as primary */
```

---

## 📐 Typography Scale

```css
/* Headings */
--h1-size: 48px;
--h1-line: 56px;
--h1-weight: 700;

--h2-size: 32px;
--h2-line: 40px;
--h2-weight: 700;

--h3-size: 24px;
--h3-line: 32px;
--h3-weight: 700;

/* Body Text */
--body-size: 16px;
--body-line: 24px;
--body-weight: 300;

--small-size: 14px;
--small-line: 20px;
--small-weight: 300;

--tiny-size: 12px;
--tiny-line: 16px;
--tiny-weight: 300;
```

---

## 📏 Spacing System

```css
/* Gap Sizes */
--gap-1: 4px;
--gap-2: 8px;
--gap-3: 12px;
--gap-4: 16px;
--gap-6: 24px;
--gap-8: 32px;

/* Padding (Cards) */
--card-padding-sm: 16px;   /* Mobile */
--card-padding-md: 24px;   /* Tablet/Desktop */

/* Border Radius */
--radius-card: 16px;
--radius-button: 8px;
--radius-badge: 6px;
--radius-full: 9999px;
```

---

## 🖼️ Shadows

```css
/* Elevation System */
--shadow-hh-sm: 0 1px 2px 0 rgb(0 0 0 / 0.05);
--shadow-hh-md: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);
--shadow-hh-lg: 0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1);
```

---

## 📱 Responsive Breakpoints

```css
/* Mobile First */
--mobile: 0px;       /* Base styles */
--tablet: 640px;     /* sm: */
--desktop: 1024px;   /* lg: */
--wide: 1280px;      /* xl: */
```

---

## ⚡ Interactive States

### Live Badge
```css
/* Pulsing animation voor "LIVE NU" badge */
.animate-pulse
bg-destructive text-white border-destructive
```

### Hover States
```css
/* Cards */
.hover:shadow-hh-md .transition-shadow

/* Buttons */
.hover:bg-hh-primary/90 .transition-colors

/* Poll Options */
.hover:border-hh-primary .transition-colors
```

### Focus States
```css
/* Form inputs en buttons */
.focus:outline-none .focus:ring-2 .focus:ring-hh-primary .focus:ring-offset-2
```

---

## 🧩 Component Patterns

### Pattern 1: Card Container
```tsx
<Card className="p-6 rounded-[16px] shadow-hh-sm border-hh-border">
  {/* Content */}
</Card>
```

### Pattern 2: Section Header
```tsx
<div className="flex items-center justify-between mb-4">
  <h3 className="text-[20px] leading-[28px] text-hh-text">Section Title</h3>
  <Button variant="ghost" size="sm">Bekijk alles</Button>
</div>
```

### Pattern 3: Info Row (Icon + Text)
```tsx
<div className="flex items-center gap-2 text-hh-muted text-[14px]">
  <Calendar className="w-4 h-4" />
  <span>Woensdag 22 jan</span>
</div>
```

### Pattern 4: Badge Variants
```tsx
{/* Phase badge */}
<Badge variant="outline">Fase 2 • Ontdekkingsfase</Badge>

{/* Status badge */}
<Badge className="bg-hh-primary/10 text-hh-primary border-hh-primary/20">
  HOST
</Badge>

{/* Live badge */}
<Badge className="bg-destructive text-white border-destructive animate-pulse">
  <Radio className="w-4 h-4" />
  LIVE NU
</Badge>
```

### Pattern 5: Avatar Circle
```tsx
<Avatar className="w-8 h-8">
  <AvatarFallback className="bg-hh-primary text-white text-[12px]">
    HH
  </AvatarFallback>
</Avatar>
```

---

## 📋 Layout Grid

### Desktop (lg:)
```tsx
{/* 2-column: Video left, Chat right */}
<div className="grid lg:grid-cols-[1fr_380px] gap-6">
  <div>{/* Video area */}</div>
  <div>{/* Chat/Polls panel */}</div>
</div>

{/* 3-column: Session cards */}
<div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
  {sessions.map(s => <SessionCard {...s} />)}
</div>
```

### Mobile/Tablet
```tsx
{/* Stack vertically */}
<div className="flex flex-col gap-6">
  <div>{/* Video */}</div>
  <div>{/* Chat */}</div>
  <div>{/* Sessions grid */}</div>
</div>
```

---

## 🎭 Animation Patterns

### Pulse (Live Badge)
```tsx
className="animate-pulse"
```

### Smooth Transitions
```tsx
className="transition-all duration-200"
className="transition-shadow duration-300"
className="transition-colors duration-150"
```

### Hover Scale
```tsx
className="hover:scale-105 transition-transform"
```

---

## 📸 Assets

### Hugo Live Photo
```tsx
import hugoLivePhoto from "figma:asset/9f21bc9eaae81b79a083fcd342b14f53acdad581.png";

<img src={hugoLivePhoto} alt="Hugo Herbots Live" className="absolute inset-0 w-full h-full object-cover" />
```

### Icons (Lucide React)
```tsx
import { Radio, Calendar, Clock, Users, Send, ThumbsUp, MessageCircle, Bell, Video, Eye } from "lucide-react";
```

---

## 🎨 Tailwind Class Reference

### Most Used Classes

```css
/* Layout */
.flex .flex-col .items-center .justify-between .gap-4
.grid .grid-cols-3 .gap-6
.p-4 .p-6 .px-3 .py-1.5
.space-y-4 .space-y-6

/* Sizing */
.w-full .w-4 .w-8 .h-4 .h-8
.min-w-0 .flex-1 .flex-shrink-0

/* Borders */
.rounded-[16px] .rounded-lg .rounded-full
.border .border-hh-border .border-t

/* Colors */
.bg-hh-primary .bg-hh-ui-50 .bg-white
.text-hh-text .text-hh-muted .text-hh-primary
.border-hh-border

/* Typography */
.text-[48px] .leading-[56px]
.text-[16px] .leading-[24px]
.text-[14px] .leading-[20px]
.text-[12px] .leading-[16px]

/* Effects */
.shadow-hh-sm .shadow-hh-md
.opacity-50 .backdrop-blur-sm
.overflow-hidden .overflow-auto

/* States */
.hover:shadow-hh-md .hover:border-hh-primary
.transition-all .transition-shadow .transition-colors
.animate-pulse
```

---

## 🔧 Custom CSS (globals.css)

```css
/* HH Custom shadows */
.shadow-hh-sm {
  box-shadow: 0 1px 2px 0 rgb(0 0 0 / 0.05);
}

.shadow-hh-md {
  box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);
}

.shadow-hh-lg {
  box-shadow: 0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1);
}

/* HH Color tokens */
:root {
  --hh-ink: #1C2535;
  --hh-ui-100: #2B3748;
  --hh-primary: #6B7A92;
  --hh-muted: #B1B2B5;
  --hh-ui-200: #E4E4E4;
  --hh-white: #FFFFFF;
  --hh-success: #00C389;
  --hh-warn: #FFB020;
  
  --hh-text: var(--hh-ink);
  --hh-border: var(--hh-ui-200);
  --hh-ui-50: #F7F7F8;
  --hh-accent: var(--hh-primary);
}
```

---

## 📝 Notes

- **Geen backend logic** - Mock data gebruiken voor development
- **Focus op pixel-perfect** - Exact dezelfde spacing en sizing
- **Responsive first** - Mobile → Tablet → Desktop
- **Accessibility** - Proper focus states, labels, ARIA
- **Performance** - Lazy load images, memo components

---

Alle component code zit in de andere bestanden in deze handoff package! 🎨
