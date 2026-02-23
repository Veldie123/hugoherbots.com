# 🎯 Rollenspel Training — Design Handoff Package

**HugoHerbots.ai Platform**  
**Component**: Role-play Chat/Audio/Video Training Interface  
**Voor**: Replit Frontend Implementation  
**Focus**: 100% UX/UI Design & Look-and-Feel

---

## 📦 Package Overzicht

Deze design handoff package bevat **alle frontend componenten en design assets** voor de Rollenspel Training feature — de kern van HugoHerbots.ai waar gebruikers sales gesprekken oefenen met Hugo via chat, audio of video.

### ✅ Wat zit erin
- ✅ **Complete TSX componenten** (RolePlayChat, EPICSalesFlow, AppLayout)
- ✅ **Design System tokens** (HH kleuren, typography, spacing)
- ✅ **UI primitives** (Shadcn components)
- ✅ **Styling guidelines** (Tailwind v4, responsive breakpoints)
- ✅ **Interaction patterns** (animations, hover states, transitions)
- ✅ **Accessibility specs** (ARIA labels, keyboard nav, focus states)

### ❌ Wat zit er NIET in
- ❌ Backend code
- ❌ API endpoints
- ❌ Database schemas
- ❌ HeyGen SDK integratie code
- ❌ OpenAI prompt templates
- ❌ WebSocket implementatie

**Dit package is 100% frontend-focused voor perfecte look & feel in Replit.**

---

## 🎨 Visual Design System

### Color Palette (HH Tokens)
```css
--hh-ink: #1C2535           /* Primary dark, headers */
--hh-ui-700: #2B3748        /* Secondary dark, UI elements */
--hh-slate-gray: #6B7A92    /* Accent, CTA's, active states */
--hh-primary: #6B7A92       /* Brand primary */
--hh-muted: #6B7A92         /* Secondary text */
--hh-border: #E4E4E4        /* Dividers, borders */
--hh-ui-50: #F9FAFB         /* Light background */
--hh-bg: #FFFFFF            /* Pure white backgrounds */
--hh-success: #00C389       /* Positive feedback */
--hh-warn: #FFB020          /* Warnings, tips */
```

### Typography Scale
```
48px/56px  — Page titles (H1)
24px/32px  — Section headers (H2)
18px/24px  — Card titles (H3)
16px/24px  — Body text
14px/20px  — Small text
12px/16px  — Micro text (labels, timestamps)
```

### Spacing System (4px base)
```
px-4 (16px)  — Mobile padding
px-6 (24px)  — Tablet padding
px-8 (32px)  — Desktop padding
gap-3 (12px) — Default component spacing
gap-4 (16px) — Card spacing
```

### Shadows (HH)
```css
.shadow-hh-sm   /* Subtle: Cards, bubbles */
.shadow-hh-md   /* Standard: Elevated cards */
.shadow-hh-lg   /* Strong: Modals, orbs */
```

---

## 📁 Bestandsstructuur

```
/roleplay-training-handoff/
├── INDEX.md                    ← Package overzicht & navigatie
├── README.md                   ← Deze file: Design brief
├── BRIEFING.md                 ← Gedetailleerde UX/UI specs
├── COMPONENT-NOTE.md           ← Technische component notes
├── Guidelines.md               ← HH Design System tokens
│
├── RolePlayChat.tsx            ← Main component (Chat/Audio/Video)
├── EPICSalesFlow.tsx           ← Sidebar (Scenario flow tracker)
├── AppLayout.tsx               ← Wrapper (Sidebar + Topbar)
│
├── ui/                         ← Shadcn UI primitives
│   ├── button.tsx
│   ├── card.tsx
│   ├── dialog.tsx
│   ├── sheet.tsx
│   ├── badge.tsx
│   ├── input.tsx
│   ├── avatar.tsx
│   └── ...
│
└── styles/
    └── globals.css             ← HH Design tokens CSS
```

---

## 🏗️ Component Architectuur

### Layout Breakdown

```
┌────────────────────────────────────────────────────────────┐
│ AppLayout (Sidebar + Topbar)                               │
├────────────────────────────────────────────────────────────┤
│ Page Header                                                │
│ ├─ Title: "Role-play Chat" (48px/56px)                    │
│ ├─ Subtitle: "Train in je eigen tempo..."                 │
│ └─ Mode Buttons: [Chat] [Audio] [Video]                   │
├────────────────────────────────────────────────────────────┤
│ Main Content Area (flex, overflow-hidden)                 │
│ ┌──────────────────────────┬─────────────────────────┐    │
│ │ Left: Chat/Audio/Video   │ Right: Scenario Flow    │    │
│ │ Interface (flex-1)       │ Tracker (w-80, desktop) │    │
│ │                          │ (Sheet overlay mobile)  │    │
│ │ [Mode-specific content]  │ [EPICSalesFlow]        │    │
│ └──────────────────────────┴─────────────────────────┘    │
└────────────────────────────────────────────────────────────┘
```

### State Flow

```
IDLE 
  ├─ [Click Chat]  → ACTIVE (Chat Mode)
  ├─ [Click Audio] → ACTIVE (Audio Mode)
  └─ [Click Video] → ACTIVE (Video Mode)

ACTIVE 
  └─ [Stop] → COMPLETED

COMPLETED 
  ├─ [Opnieuw]    → IDLE
  └─ [Resultaten] → Results Modal (overlay)
```

---

## 🎭 Mode-Specific Interfaces

### 1. Chat Mode (Text-based conversation)

**Visual Design**:
- **Message Bubbles**: Left (Hugo) / Right (User) alignment
- **Colors**: Hugo = `bg-white shadow-hh-sm`, User = `bg-hh-primary text-white`
- **Avatar Circles**: HH (Hugo) vs User initials
- **Typing Indicator**: 3 bouncing dots, staggered animation
- **Input Area**: Bottom fixed, `border-t`, `bg-white`, `p-4`
- **Tips Panel**: Collapsible card below input, `bg-hh-ui-50`

**Layout**:
```
┌─────────────────────────────────┐
│ Messages (overflow-y-auto)       │
│ ├─ Hugo bubble (left)           │
│ ├─ User bubble (right)          │
│ └─ Typing indicator             │
├─────────────────────────────────┤
│ Input Area (fixed bottom)       │
│ ├─ Text input (flex-1)          │
│ ├─ Send button (icon)           │
│ └─ Stop button (outline)        │
├─────────────────────────────────┤
│ Tips Panel (collapsible)        │
│ └─ Card: Lightbulb + tip text   │
└─────────────────────────────────┘
```

**Message Bubble Details**:
- Max width: `70%`
- Border radius: `16px`
- Padding: `p-4`
- Timestamp: `12px`, muted color, bottom-right

**Typing Indicator Animation**:
```tsx
<div className="flex gap-1">
  <div className="w-2 h-2 bg-hh-muted rounded-full animate-bounce" 
       style={{ animationDelay: "0ms" }} />
  <div className="w-2 h-2 bg-hh-muted rounded-full animate-bounce" 
       style={{ animationDelay: "150ms" }} />
  <div className="w-2 h-2 bg-hh-muted rounded-full animate-bounce" 
       style={{ animationDelay: "300ms" }} />
</div>
```

---

### 2. Audio Mode (Voice call with animated orb)

**Visual Design**:
- **Centered Layout**: Full screen, gradient background `from-hh-ui-50 to-hh-primary/5`
- **Animated Orb**: 3-layer design (outer ping rings + gradient core + icon/waveform)
- **Status Text**: Large (24px) + subtitle (16px muted)
- **Controls**: Bottom centered, gap-3
- **Tip Card**: Bottom card with technique info

**Orb Design**:
```
┌──────────────────────────┐
│ Outer ping ring (2s)     │  ← bg-hh-primary/10, animate-ping
│  ┌────────────────────┐  │
│  │ Middle ring (2.5s) │  │  ← bg-hh-primary/20, animate-ping
│  │  ┌──────────────┐  │  │
│  │  │ Core gradient│  │  │  ← from-hh-primary to-hh-slate-gray
│  │  │ ┌──────────┐ │  │  │
│  │  │ │ Mic icon │ │  │  │  ← Idle: Static mic
│  │  │ │ OR       │ │  │  │  ← Recording: 4 waveform bars
│  │  │ │ Waveform │ │  │  │
│  │  │ └──────────┘ │  │  │
│  │  └──────────────┘  │  │
│  └────────────────────┘  │
└──────────────────────────┘
```

**Waveform Bars (Recording State)**:
```tsx
<div className="flex gap-1">
  <div className="w-2 h-8 bg-white rounded-full animate-pulse" 
       style={{ animationDuration: "0.6s" }} />
  <div className="w-2 h-12 bg-white rounded-full animate-pulse" 
       style={{ animationDuration: "0.7s", animationDelay: "0.1s" }} />
  <div className="w-2 h-10 bg-white rounded-full animate-pulse" 
       style={{ animationDuration: "0.8s", animationDelay: "0.2s" }} />
  <div className="w-2 h-6 bg-white rounded-full animate-pulse" 
       style={{ animationDuration: "0.6s", animationDelay: "0.3s" }} />
</div>
```

**Controls**:
- Primary button: "Start gesprek" (default) / "Stop gesprek" (destructive when recording)
- Outline button: "Beëindig sessie"

---

### 3. Video Mode (HeyGen avatar video call)

**Visual Design**:
- **Video Container**: `max-w-5xl`, `aspect-ratio: 16/9`, `rounded-[16px]`, `shadow-hh-md`
- **Background**: `bg-hh-ink` (voor letterbox bars)
- **Border**: `border-hh-ink/20`
- **Bottom Overlay**: Gradient `from-hh-ink/90 to-transparent`, pointer-events-none
- **Placeholder State**: Centered message voor backend integration

**Layout**:
```
┌───────────────────────────────────────┐
│ Video Card (max-w-5xl, aspect 16:9)  │
│ ┌───────────────────────────────────┐ │
│ │ [HeyGen Video Embed Area]         │ │
│ │                                   │ │
│ │ ┌───────────────────────────────┐ │ │
│ │ │ Bottom Gradient Overlay       │ │ │
│ │ │ ├─ Title (white, 16px)        │ │ │
│ │ │ └─ Subtitle (white/70, 14px)  │ │ │
│ │ └───────────────────────────────┘ │ │
│ └───────────────────────────────────┘ │
└───────────────────────────────────────┘

Controls: [Beëindig sessie] (centered, mt-6)

┌───────────────────────────────────────┐
│ Tip Card: Real-time feedback          │
│ ├─ Lightbulb icon                     │
│ └─ Bullet points (14px, muted)        │
└───────────────────────────────────────┘
```

**Placeholder State** (Backend integration pending):
```tsx
<div className="absolute inset-0 flex items-center justify-center 
                bg-gradient-to-br from-hh-ink to-hh-ui-700 text-white">
  <div className="text-center space-y-4 p-8">
    <div className="w-20 h-20 rounded-full bg-hh-primary/20 
                    flex items-center justify-center mx-auto mb-4">
      <Video className="w-10 h-10 text-hh-primary" />
    </div>
    <h3 className="text-[24px] leading-[32px]">
      HeyGen LiveAvatar integratie vereist
    </h3>
    <p className="text-[16px] leading-[24px] text-white/70 max-w-md">
      Deze functie vereist backend setup met HeyGen Interactive Avatar SDK.
    </p>
  </div>
</div>
```

---

## 🎯 Scenario Flow Tracker (Sidebar)

### Visual Design (EPICSalesFlow Component)

**Desktop**: Permanent sidebar, `w-80`, `border-l border-hh-border`  
**Mobile**: Sheet overlay (right side), triggered by Menu button

### Structure
```
┌──────────────────────────────────┐
│ Header                           │
│ ├─ "Scenario Flow" (18px)       │
│ └─ Progress: "12% voltooid"     │
├──────────────────────────────────┤
│ Phase 1: Openingsfase (collapsed)│
│ └─ ✓✓✓✓ (4 completed)           │
├──────────────────────────────────┤
│ Phase 2: Ontdekkingsfase (open) │
│ ├─ ✓ Step 2.1.1 (completed)     │
│ ├─ ✓ Step 2.1.2 (completed)     │
│ ├─ ● Step 2.1.3 (CURRENT) ⟵    │
│ ├─ ○ Step 2.1.4 (upcoming)      │
│ └─ ... (meer stappen)            │
├──────────────────────────────────┤
│ Phase 3: Aanbevelingsfase        │
│ └─ Collapsed...                  │
├──────────────────────────────────┤
│ Phase 4: Beslissingsfase         │
│ └─ 🔒 Locked                    │
└──────────────────────────────────┘

Progress Bar: ████░░░░░░ 12%
```

### Phase Header
- Background: `bg-hh-primary/10`
- Hover: `bg-hh-primary/20`
- Padding: `p-3`
- Border radius: `rounded-lg`
- Icon: ChevronDown (expanded) / ChevronRight (collapsed)
- Badge: "ACTIEF" voor current phase (`bg-hh-primary text-white`)

### Step States

**Completed (✓)**:
- Icon: `<Check className="w-4 h-4 text-hh-success" />`
- Text: Normal opacity, `text-hh-text`
- Background: Transparent
- Hover: `bg-hh-ui-50`

**Current (●)**:
- Icon: `<Circle className="w-4 h-4 text-hh-primary fill-current" />`
- Background: `bg-hh-primary/10`
- Border-left: `border-l-2 border-hh-primary`
- Text: `font-medium`, `text-hh-text`
- Animation: Subtle pulse on border

**Upcoming (○)**:
- Icon: `<Circle className="w-4 h-4 text-hh-border" />` (hollow)
- Text: `text-hh-muted`
- Hover: `bg-hh-ui-50`

**Locked (🔒)**:
- Icon: `<Lock className="w-4 h-4 text-hh-muted/50" />`
- Background: `bg-hh-ui-50`
- Text: `text-hh-muted/50 italic`
- Opacity: `opacity-60`
- Cursor: `cursor-not-allowed`

### Progress Bar (Bottom)
```tsx
<div className="w-full h-2 bg-hh-ui-200 rounded-full overflow-hidden">
  <div
    className="h-full bg-hh-primary rounded-full transition-all duration-500"
    style={{ width: `${progress}%` }}
  />
</div>
```

---

## 🎬 Results Modal (Completed State)

### Visual Design (Dialog Component)

**Dimensions**: `max-w-2xl`  
**Spacing**: `space-y-6` between sections

### Layout Structure
```
┌─────────────────────────────────────┐
│ Header: "Sessie resultaten"         │
├─────────────────────────────────────┤
│ Overall Score Card                  │
│ ├─ "Totaalscore" (16px, muted)     │
│ ├─ "84%" (48px/56px, large)        │
│ └─ Badge: "+7% vs vorige" (success)│
├─────────────────────────────────────┤
│ Sub-scores Grid (2x2)               │
│ ┌───────────┬───────────┐          │
│ │ Vraag: 88%│ Empath:82%│          │
│ ├───────────┼───────────┤          │
│ │ Struct:85%│ Next: 79% │          │
│ └───────────┴───────────┘          │
├─────────────────────────────────────┤
│ Highlights                          │
│ ├─ ✓ Goed: "Je stelde..." (green)  │
│ └─ ⚠ Let op: "Je zou..." (amber)   │
├─────────────────────────────────────┤
│ Hugo's Advies                       │
│ └─ Quote block (16px, muted)       │
└─────────────────────────────────────┘

Footer: [Deel met manager] [Opnieuw oefenen]
```

### Overall Score Card
```tsx
<div className="text-center p-6 bg-hh-ui-50 rounded-[16px]">
  <p className="text-[16px] leading-[24px] text-hh-muted mb-2">
    Totaalscore
  </p>
  <p className="text-[48px] leading-[56px] text-hh-text">
    84<span className="text-[24px] leading-[32px]">%</span>
  </p>
  <Badge className="mt-2 bg-hh-success/10 text-hh-success border-hh-success/20">
    +7% vs vorige sessie
  </Badge>
</div>
```

### Sub-score Card (Grid Item)
```tsx
<Card className="p-4 rounded-[12px] shadow-hh-sm border-hh-border">
  <p className="text-[14px] leading-[20px] text-hh-muted mb-1">
    Vraagstelling
  </p>
  <p className="text-[28px] leading-[36px] text-hh-text">
    88<span className="text-[16px] leading-[24px]">%</span>
  </p>
</Card>
```

### Highlight Cards

**Success (Green)**:
```tsx
<div className="flex items-start gap-2 p-3 bg-hh-success/10 rounded-lg">
  <TrendingUp className="w-4 h-4 text-hh-success flex-shrink-0 mt-1" />
  <p className="text-[14px] leading-[20px] text-hh-text">
    <strong>Goed:</strong> Je stelde de juiste open vragen...
  </p>
</div>
```

**Warning (Amber)**:
```tsx
<div className="flex items-start gap-2 p-3 bg-hh-warn/10 rounded-lg">
  <Lightbulb className="w-4 h-4 text-hh-warn flex-shrink-0 mt-1" />
  <p className="text-[14px] leading-[20px] text-hh-text">
    <strong>Let op:</strong> Je zou meer kunnen doorvragen...
  </p>
</div>
```

---

## ⚡ Interactions & Animations

### Button Hover States
```tsx
// Primary button
className="hover:shadow-md transition-all"

// Outline button
className="hover:border-hh-primary hover:text-hh-primary transition-all"

// Icon in button (with arrow)
<ArrowRight className="w-4 h-4 ml-auto group-hover:translate-x-1 transition-transform" />
```

### Message Bubble Entrance (Chat Mode)
```css
@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

animation: slideUp 300ms ease-out;
```

### Orb Ping Animation (Audio Mode)
```css
@keyframes ping {
  75%, 100% {
    transform: scale(1.5);
    opacity: 0;
  }
}

animation: ping 2s cubic-bezier(0, 0, 0.2, 1) infinite;
```

### Current Step Pulse (Flow Tracker)
```css
@keyframes pulse-border {
  0%, 100% {
    border-color: rgba(107, 122, 146, 0.5);
  }
  50% {
    border-color: rgba(107, 122, 146, 1);
  }
}

animation: pulse-border 2s ease-in-out infinite;
```

### Phase Collapse/Expand
```tsx
// Icon rotation
<ChevronDown className={`transition-transform ${
  isExpanded ? '' : 'rotate-180'
}`} />

// Content reveal
className="transition-all duration-300 ease-in-out"
```

---

## 📱 Responsive Breakpoints

### Mobile (`< 768px`)
```tsx
// Padding
className="px-4 py-4"

// Button labels hide
<span className="hidden sm:inline">Chat</span>

// Flow tracker in Sheet
<Sheet open={sidebarOpen}>
  <SheetContent side="right" className="w-80">
    <EPICSalesFlow />
  </SheetContent>
</Sheet>

// Message bubbles wider
className="max-w-[85%]"
```

### Tablet (`768px - 1024px`)
```tsx
// Medium padding
className="px-6 py-5"

// Flow tracker still in Sheet
// (same as mobile)
```

### Desktop (`> 1024px`)
```tsx
// Large padding
className="px-8 py-6"

// Flow tracker permanent sidebar
<div className="hidden lg:block w-80 flex-shrink-0">
  <EPICSalesFlow />
</div>

// Full button labels
<span>Chat</span> // Always visible
```

---

## ♿ Accessibility Features

### Keyboard Navigation
```tsx
// Tab order
tabIndex={0} // Logical order: Buttons → Input → Send

// Enter to send
onKeyPress={(e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    handleSendMessage();
  }
}}

// Esc to close
onKeyDown={(e) => {
  if (e.key === "Escape") {
    setShowModal(false);
  }
}}
```

### ARIA Labels
```tsx
// Icon-only buttons
<Button aria-label="Send message">
  <Send className="w-4 h-4" />
  <span className="sr-only">Verstuur</span>
</Button>

// Dialog
<Dialog 
  role="dialog"
  aria-labelledby="results-title"
  aria-describedby="results-description"
>
```

### Focus States
```tsx
// All interactive elements
className="focus:ring-2 focus:ring-hh-primary focus:ring-offset-2 
           focus:outline-none"

// Visible focus indicator
className="focus-visible:ring-2 focus-visible:ring-hh-primary"
```

### Screen Reader Text
```tsx
// Hidden but accessible
<span className="sr-only">Bezig met laden...</span>

// Live regions
<div aria-live="polite" aria-atomic="true">
  {isTyping && "Hugo is aan het typen..."}
</div>
```

---

## 🔧 Props & Interfaces

### RolePlayChat
```tsx
interface RolePlayChatProps {
  navigate?: (page: string) => void;
}

// Usage
<RolePlayChat navigate={(page) => router.push(`/${page}`)} />
```

### EPICSalesFlow
```tsx
interface EPICSalesFlowProps {
  phases?: Phase[];
  currentPhaseId?: number;
  currentStepId?: string;
}

interface Phase {
  id: number;
  name: string;
  color: string;
  themas: string[];
  uitleg: string;
  steps: Step[];
}

interface Step {
  id: string;
  name: string;
  status: "completed" | "current" | "upcoming" | "locked";
  duration: string;
  nummer: string;
  isVerplicht?: boolean;
}

// Usage
<EPICSalesFlow 
  phases={scenarioFlowData}
  currentPhaseId={2}
  currentStepId="2.1.3"
/>
```

---

## 🚀 Installatie & Setup (Replit)

### 1. Copy Package
```bash
# In je Replit project root:
cp -r /roleplay-training-handoff /jouw-project/components/
```

### 2. Install Dependencies
```bash
npm install lucide-react
# Shadcn UI components zijn al included in /ui folder
```

### 3. Import Component
```tsx
// In je App.tsx of routing file:
import { RolePlayChat } from './components/roleplay-training-handoff/RolePlayChat';

// In je routes:
<Route path="/roleplay" element={<RolePlayChat navigate={navigate} />} />
```

### 4. Import Styles
```tsx
// In je main CSS file (App.css / globals.css):
@import './components/roleplay-training-handoff/styles/globals.css';
```

### 5. Verify Responsive Layout
- **Desktop** (> 1024px): Check sidebar is visible
- **Mobile** (< 768px): Check Sheet overlay works
- **Tablet** (768-1024px): Check compact layout

---

## 📋 Design Checklist

Voordat je live gaat, verifieer:

### Visual Design
- [ ] HH color tokens gebruikt (geen hardcoded hex)
- [ ] Typography scale correct (48/24/18/16/14/12)
- [ ] Spacing consistent (4px base system)
- [ ] Shadows toegepast (hh-sm/md/lg)
- [ ] Border radius correct (16px/12px/full)
- [ ] Icons van Lucide React, consistent sizing

### States & Interactions
- [ ] Idle state: 3 CTA buttons werkend
- [ ] Chat mode: Bubbles, typing indicator, input
- [ ] Audio mode: Orb animations, waveform
- [ ] Video mode: Placeholder, aspect ratio 16:9
- [ ] Results modal: Scores, highlights, advies
- [ ] Flow tracker: Phases collapsible, steps highlighted

### Responsive
- [ ] Mobile: Sheet overlay voor flow tracker
- [ ] Tablet: Compact padding, button labels
- [ ] Desktop: Sidebar permanent, full labels
- [ ] Breakpoints: 768px, 1024px

### Accessibility
- [ ] Focus states op alle buttons/inputs
- [ ] ARIA labels op icon-only buttons
- [ ] Keyboard nav: Tab, Enter, Esc
- [ ] Screen reader text (sr-only)
- [ ] Color contrast AA compliant

### Component Reuse
- [ ] Shadcn Button component gebruikt
- [ ] Card voor containers
- [ ] Dialog voor results modal
- [ ] Sheet voor mobile overlays
- [ ] Badge voor status indicators
- [ ] Avatar voor user/coach images

---

## 📞 Support & Next Steps

### Voor Design Specs
- **INDEX.md** — Package navigatie & overzicht
- **BRIEFING.md** — Gedetailleerde UX/UI specificaties
- **Guidelines.md** — HH Design System tokens

### Voor Component Details
- **COMPONENT-NOTE.md** — Technische implementatie notes
- **RolePlayChat.tsx** — Main component source code
- **EPICSalesFlow.tsx** — Sidebar component source code

### Backend Integration (Later)
- HeyGen LiveAvatar SDK (video mode)
- OpenAI Chat API (chat mode responses)
- Speech-to-text / Text-to-speech (audio mode)
- Firebase sessie tracking

---

**Design Handoff Status**: ✅ Ready for Replit Implementation  
**Focus**: 100% Frontend UX/UI Look & Feel  
**Last Updated**: December 2024

Succes met de implementatie! 🚀
