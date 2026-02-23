# Live Coaching - Complete Design Guide

**Pixel-perfect UX/UI guide** voor het bouwen van exact dezelfde Live Coaching ervaring in Replit.

---

## 📦 Bestandenoverzicht

1. **LiveCoaching.tsx** - Complete main component
2. **DashboardWidget.tsx** - Widget voor Dashboard page
3. **design-tokens.css** - Alle CSS variabelen en custom classes
4. **DESIGN-GUIDE.md** - Dit bestand

---

## 🎨 Component Breakdown

### 1. Live Video Area

**Structuur:**
```
Card (rounded-[16px], shadow-hh-md)
  └─ Video Container (aspect-ratio 16/9, bg-hh-ink)
      ├─ Background Image (Hugo photo, object-cover, absolute inset-0)
      ├─ Dark Overlay (bg-black/10)
      ├─ Live Badge (top-4 left-4, destructive, pulse animation)
      └─ Viewer Count (top-4 right-4, black/50 blur backdrop)
  └─ Session Info (p-6, border-t)
      ├─ Title (h2)
      ├─ Phase Badge (outline variant)
      ├─ Time Info (Clock icon + text)
      └─ Viewer Count (Users icon + text)
```

**Design Details:**
- **Aspect ratio**: Exact 16:9 voor video
- **Live badge**: Rood (`bg-destructive`), wit tekst, pulse animatie
- **Viewer count**: Semi-transparent zwart (`bg-black/50`) met `backdrop-blur-sm`
- **Icons**: 4x4 size voor kleine icons, 5x5 voor medium
- **Gap between info items**: 3 (12px)

---

### 2. Chat Panel

**Structuur:**
```
Card (h-[700px], flex flex-col)
  └─ Tabs
      ├─ TabsList (bg-hh-ui-50, w-full)
      │   ├─ TabTrigger "Chat" (active: bg-hh-primary + text-white)
      │   └─ TabTrigger "Polls" (active: bg-hh-primary + text-white)
      └─ TabContent
          ├─ ScrollArea (flex-1, p-4)
          │   └─ Messages (space-y-4)
          │       └─ Message Row
          │           ├─ Avatar (w-8 h-8, flex-shrink-0)
          │           │   └─ Initials (12px, bg-hh-primary if host)
          │           └─ Content (flex-1, min-w-0)
          │               ├─ Header (items-baseline, gap-2)
          │               │   ├─ Name (14px, hh-primary if host)
          │               │   ├─ HOST badge (10px, if host)
          │               │   └─ Time (12px, hh-muted)
          │               └─ Message (14px, text-hh-text)
          └─ Input Area (p-4, border-t)
              ├─ Input + Send Button (flex gap-2)
              └─ Helper Text (12px, mt-2, muted)
```

**Design Details:**
- **Chat height**: Fixed `h-[700px]` op desktop
- **Avatar**: 8x8 circle, initials centered, 12px text
- **Host badge**: 10px text, `px-1.5 py-0`, primary/10 background
- **Message spacing**: `space-y-4` tussen berichten
- **Send button**: `size="icon"`, disabled state voor empty input
- **Helper text**: "Wees respectvol — Hugo beantwoordt vragen live"

---

### 3. Poll Panel

**Structuur:**
```
Poll Container (space-y-6)
  ├─ Header (flex items-center gap-2)
  │   ├─ ThumbsUp Icon (w-5 h-5, text-hh-primary)
  │   └─ "Live Poll" Title
  ├─ Question (text-hh-text, mb-4)
  ├─ Options (space-y-2)
  │   └─ Poll Option Button (relative, overflow-hidden)
  │       ├─ Progress Bar BG (absolute inset-0, bg-hh-primary/5, dynamic width)
  │       └─ Content (relative, flex justify-between)
  │           ├─ Option Text
  │           └─ Votes + Percentage
  ├─ Total Votes (12px, text-hh-muted, mt-3)
  └─ Info Card (bg-hh-primary/5, border-hh-primary/20)
```

**Design Details:**
- **Poll button**: Full width, `text-left`, `p-3`, `rounded-lg`
- **Progress bar**: Positioned absolute, `bg-hh-primary/5`, width = percentage
- **Hover state**: `border-hh-primary` on hover
- **Vote count**: 14px muted text links, percentage in primary color rechts
- **Info card**: Rounded-[12px], padding 4, emoji + bold text

---

### 4. Session Cards (Upcoming/Past)

**Structuur:**
```
Grid (sm:grid-cols-2 lg:grid-cols-3, gap-4)
  └─ Card (p-6, rounded-[16px], shadow-hh-sm, hover:shadow-hh-md)
      ├─ Highlight Border (absolute top, h-1, gradient) [alleen eerste sessie]
      ├─ Header (flex justify-between, mb-3)
      │   ├─ Phase Badge (outline, 12px text)
      │   └─ Icon Button (Calendar/Bell, h-8 w-8)
      ├─ Title (h4, 16px/24px, mb-2)
      ├─ Info Rows (space-y-1.5, 14px text, text-hh-muted)
      │   ├─ Date (Calendar icon + text)
      │   └─ Time (Clock emoji + text)
      └─ CTA Button (w-full, mt-4, gap-2)
          ├─ Bell Icon
          └─ "Herinnering instellen" / "Bekijk opname"
```

**Design Details:**
- **Highlight gradient**: `bg-gradient-to-r from-hh-primary to-hh-accent`, 1px height
- **Phase badge**: `variant="outline"`, `text-[12px]`
- **Icon button**: `variant="ghost"`, `size="icon"`, `h-8 w-8`, `-mt-1 -mr-2` voor alignment
- **Info rows**: `flex items-center gap-2`, 14px/20px text
- **CTA button**: `size="sm"`, eerste sessie primary, rest outline
- **Hover**: `transition-shadow` naar `shadow-hh-md`

---

### 5. Dashboard Widget

**Structuur:**
```
Section Container
  ├─ Header (flex justify-between, mb-4)
  │   ├─ Left (flex items-center gap-3)
  │   │   ├─ Title (20px/28px)
  │   │   └─ "Elke woensdag" Badge (destructive/10, Radio icon)
  │   └─ "Bekijk alles" Button (ghost, sm)
  └─ Session Grid (sm:grid-cols-2 lg:grid-cols-3, gap-4)
      └─ [3x Session Cards - zie boven]
```

**Design Details:**
- **Section title**: 20px/28px, text-hh-text
- **"Elke woensdag" badge**: `bg-destructive/10`, `text-destructive`, `border-destructive/20`
- **Radio icon**: `w-3 h-3` (klein)
- **Grid**: 1 column mobile → 2 tablet → 3 desktop
- **Only 3 sessions**: Toon maximaal 3 upcoming sessions

---

## 📏 Exact Measurements

### Spacing
```css
/* Section spacing */
.space-y-6  /* 24px - tussen main sections */
.space-y-8  /* 32px - tussen page sections (lg breakpoint) */

/* Card padding */
.p-4       /* 16px - mobile */
.p-6       /* 24px - desktop cards */

/* Element gaps */
.gap-2     /* 8px - tussen icon + text */
.gap-3     /* 12px - tussen avatar + content */
.gap-4     /* 16px - tussen cards in grid */
.gap-6     /* 24px - tussen video + chat panel */
```

### Typography Sizes
```css
/* Headers */
h1: 48px/56px (lg), 40px/48px (sm), 32px/40px (mobile)
h2: 32px/40px (desktop), 24px/32px (mobile)
h3: 24px/32px (desktop), 20px/28px (mobile)
h4: 18px/26px
Section title: 20px/28px

/* Body text */
body: 16px/24px
paragraph: 16px/24px (desktop), 14px/22px (mobile)

/* UI elements */
Badge text: 12px
Button text: default (inherit from button component)
Chat name: 14px/20px
Chat message: 14px/20px
Chat time: 12px/16px
HOST badge: 10px (tiny!)
Info text: 14px/20px (muted)
Helper text: 12px/16px
```

### Icon Sizes
```css
/* Standard sizes */
.w-3 .h-3   /* 12px - tiny badges (Radio icon in "Elke woensdag") */
.w-4 .h-4   /* 16px - most UI icons (Calendar, Clock, Bell, Send) */
.w-5 .h-5   /* 20px - larger icons (ThumbsUp in poll header) */
.w-8 .h-8   /* 32px - avatar circles, icon buttons */
.w-10 .h-10 /* 40px - feature icon circles (in session description) */
```

### Border Radius
```css
.rounded-[16px]  /* Cards */
.rounded-[12px]  /* Info card in polls */
.rounded-lg      /* Poll option buttons, inputs */
.rounded-full    /* Avatars, icon circles, viewer count badge */
```

### Shadows
```css
.shadow-hh-sm    /* Default card shadow */
.shadow-hh-md    /* Hover card shadow, chat/video cards */
.shadow-hh-lg    /* (not used in Live Coaching) */
```

---

## 🎨 Color Usage Guide

### Primary Text
```css
text-hh-text     /* #1C2535 - Headers, important text, message content */
```

### Secondary Text
```css
text-hh-muted    /* #B1B2B5 - Timestamps, meta info, helper text */
```

### Accent Color (Interactive)
```css
text-hh-primary  /* #6B7A92 - Hugo's name, percentage in polls, links */
bg-hh-primary    /* Background voor buttons, active tab, host avatar */
border-hh-primary /* Hover state op poll options */
```

### Status Colors
```css
/* Live badge */
bg-destructive text-white  /* Rood - Live status */

/* Success states */
bg-hh-success/10 text-hh-success  /* Groen tints */

/* Warning states */
bg-hh-warn/10 text-hh-warn  /* Geel tints */
```

### Backgrounds
```css
bg-hh-white      /* Card backgrounds, page background */
bg-hh-ui-50      /* Tab list background (#F7F7F8) */
bg-hh-ui-100     /* Dark backgrounds (#2B3748) */
bg-hh-ui-200     /* Avatar backgrounds for non-host (#E4E4E4) */
bg-hh-ink        /* Video container background (#1C2535) */
```

### Semi-transparent Overlays
```css
bg-black/10           /* Subtle overlay op video voor badge visibility */
bg-black/50           /* Viewer count badge background */
backdrop-blur-sm      /* Viewer count badge blur effect */
bg-hh-primary/5       /* Poll progress bar background */
bg-hh-primary/10      /* Host badge background, info cards */
```

---

## ⚡ Interactive States

### Hover States
```css
/* Cards */
hover:shadow-hh-md
transition-shadow

/* Buttons */
hover:bg-hh-primary/90  /* Slight darken */
transition-colors

/* Poll options */
hover:border-hh-primary
transition-colors

/* Icon buttons */
hover:bg-hh-ui-50
```

### Active/Selected States
```css
/* Tabs */
data-[state=active]:bg-hh-primary
data-[state=active]:text-white

/* Selected poll option (if voted) */
border-hh-primary
bg-hh-primary/5
```

### Disabled States
```css
/* Send button when input empty */
disabled:opacity-50
disabled:cursor-not-allowed
```

### Animation
```css
/* Live badge pulse */
animate-pulse   /* Built-in Tailwind animation */

/* Smooth transitions */
transition-all duration-200      /* General transitions */
transition-shadow duration-300   /* Shadow hover */
transition-colors duration-150   /* Color changes */
```

---

## 📱 Responsive Behavior

### Breakpoints
```css
/* Mobile */
< 640px    /* Base styles */

/* Tablet (sm:) */
>= 640px   /* sm: prefix */

/* Desktop (lg:) */
>= 1024px  /* lg: prefix */
```

### Layout Changes

**Page Header:**
```css
/* Mobile */
.flex-col          /* Stack vertically */
.items-start       /* Align left */

/* Desktop (sm:) */
sm:flex-row        /* Horizontal */
sm:items-center    /* Align center */
```

**Video + Chat:**
```css
/* Mobile */
.space-y-4         /* Stack vertically with 16px gap */

/* Desktop (lg:) */
lg:grid
lg:grid-cols-[1fr_380px]  /* Video left (flexible), Chat right (380px fixed) */
lg:gap-6                   /* 24px gap tussen panels */
```

**Session Grid:**
```css
/* Mobile */
.grid              /* 1 column */

/* Tablet (sm:) */
sm:grid-cols-2     /* 2 columns */

/* Desktop (lg:) */
lg:grid-cols-3     /* 3 columns */
```

**Card Padding:**
```css
/* Mobile */
.p-4               /* 16px padding */

/* Tablet/Desktop (sm:) */
sm:p-6             /* 24px padding */
```

**Typography:**
```css
/* H1 */
.text-[32px] .leading-[40px]          /* Mobile */
sm:text-[40px] sm:leading-[48px]      /* Tablet */
lg:text-[48px] lg:leading-[56px]      /* Desktop */

/* Body text */
.text-[14px] .leading-[22px]          /* Mobile */
sm:text-[16px] sm:leading-[24px]      /* Tablet/Desktop */
```

---

## 🧩 Reusable Patterns

### Pattern: Info Row (Icon + Text)
```tsx
<div className="flex items-center gap-2 text-hh-muted text-[14px] leading-[20px]">
  <Calendar className="w-4 h-4 flex-shrink-0" />
  <span>Woensdag 22 jan</span>
</div>
```

### Pattern: Section Header
```tsx
<div className="flex items-center justify-between mb-4">
  <h3 className="text-[20px] leading-[28px] text-hh-text">Section Title</h3>
  <Button variant="ghost" size="sm">Bekijk alles</Button>
</div>
```

### Pattern: Icon Circle Background
```tsx
<div className="w-10 h-10 rounded-full bg-hh-primary/10 flex items-center justify-center">
  <TrendingUp className="w-5 h-5 text-hh-primary" />
</div>
```

### Pattern: Status Badge
```tsx
{/* Host badge */}
<Badge className="bg-hh-primary/10 text-hh-primary border-hh-primary/20 text-[10px] px-1.5 py-0">
  HOST
</Badge>

{/* Live badge */}
<Badge className="bg-destructive text-white border-destructive flex items-center gap-2 px-3 py-1.5 animate-pulse">
  <Radio className="w-4 h-4" />
  <span>LIVE NU</span>
</Badge>

{/* Phase badge */}
<Badge variant="outline" className="text-[12px]">
  Fase 2 • Ontdekkingsfase
</Badge>
```

### Pattern: Gradient Highlight Border
```tsx
{/* Eerste sessie krijgt gradient border top */}
<div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-hh-primary to-hh-accent" />
```

---

## 🎯 UX Details

### Chat Auto-scroll
Bij nieuwe berichten moet de ScrollArea automatisch naar beneden scrollen:
```tsx
const messagesEndRef = useRef<HTMLDivElement>(null);

useEffect(() => {
  messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
}, [chatMessages]);
```

### Enter to Send
Input field moet bericht versturen bij Enter (niet Shift+Enter):
```tsx
onKeyDown={(e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    handleSendMessage();
  }
}}
```

### Calendar Export
ICS file download bij klik op Calendar icon:
```tsx
const icsContent = [
  'BEGIN:VCALENDAR',
  'VERSION:2.0',
  'PRODID:-//HugoHerbots.ai//Live Coaching//NL',
  'BEGIN:VEVENT',
  `DTSTART:${start.toISOString().replace(/[-:]/g, '').split('.')[0]}Z`,
  `DTEND:${end.toISOString().replace(/[-:]/g, '').split('.')[0]}Z`,
  `SUMMARY:${title}`,
  `DESCRIPTION:${description}`,
  `LOCATION:${location}`,
  'END:VEVENT',
  'END:VCALENDAR'
].join('\n');

const blob = new Blob([icsContent], { type: 'text/calendar' });
const url = URL.createObjectURL(blob);
const link = document.createElement('a');
link.href = url;
link.download = 'session.ics';
link.click();
URL.revokeObjectURL(url);
```

### Poll Vote Percentage Calculation
```tsx
const percentage = totalVotes 
  ? Math.round((votes / totalVotes) * 100) 
  : 0;
```

### Disabled Send Button
```tsx
<Button 
  onClick={handleSendMessage} 
  disabled={!chatMessage.trim()}
  size="icon"
>
  <Send className="w-4 h-4" />
</Button>
```

---

## ✅ Quality Checklist

- [ ] **Spacing**: Exact 4px/8px/16px/24px gaps zoals gespecificeerd
- [ ] **Typography**: Correcte font sizes (48/32/24/16/14/12px) op alle breakpoints
- [ ] **Colors**: HH tokens gebruikt (`text-hh-text`, `bg-hh-primary`, etc.)
- [ ] **Icons**: Correcte sizes (3/4/5/8/10)
- [ ] **Shadows**: `shadow-hh-sm` default, `shadow-hh-md` op hover
- [ ] **Border radius**: 16px voor cards, 8px voor buttons
- [ ] **Responsive**: Mobile (1 col) → Tablet (2 col) → Desktop (3 col)
- [ ] **Hover states**: Alle interactive elements hebben hover effect
- [ ] **Animations**: Live badge pulse, smooth transitions
- [ ] **Accessibility**: Focus states, proper labels, keyboard navigation
- [ ] **Calendar export**: ICS download werkt correct
- [ ] **Chat**: Auto-scroll, Enter to send, disabled state

---

Veel succes met het bouwen! 🎨
