# 📦 Roleplay Training Design Handoff — INDEX

**HugoHerbots.ai Platform**  
**Component**: Rollenspel Training (Chat/Audio/Video)  
**Laatste update**: December 2024

---

## 📁 Package Structuur

```
/roleplay-training-handoff/
├── INDEX.md                    ← Je bent hier
├── README.md                   ← Start hier: Complete design brief
├── BRIEFING.md                 ← UX/UI design specificaties
├── COMPONENT-NOTE.md           ← Technische implementatie notities
├── Guidelines.md               ← HH Design System tokens & guidelines
│
├── RolePlayChat.tsx            ← Main component: Chat/Audio/Video interface
├── EPICSalesFlow.tsx           ← Sidebar component: Scenario flow tracker
├── AppLayout.tsx               ← Wrapper component: Sidebar + Topbar
│
├── ui/                         ← Shadcn UI components (button, card, dialog, etc.)
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
    └── globals.css             ← HH Design System CSS tokens
```

---

## 🚀 Quickstart

### 1. Lees de README
Start met **README.md** voor het complete overzicht van de design handoff.

### 2. Importeer de Componenten
```tsx
// In je Replit project:
import { RolePlayChat } from './roleplay-training-handoff/RolePlayChat';
import { EPICSalesFlow } from './roleplay-training-handoff/EPICSalesFlow';
```

### 3. Gebruik de Component
```tsx
// In je App.tsx routing:
<Route path="/roleplay" element={<RolePlayChat navigate={navigate} />} />
```

### 4. Installeer Dependencies
```bash
npm install lucide-react
# Shadcn UI components zijn al included
```

---

## 📄 Bestand Beschrijvingen

### Design Documentatie

**README.md**
- Complete design brief
- Component overview
- UX flow beschrijving
- Visual design system
- Responsive behavior
- Accessibility requirements

**BRIEFING.md**
- Uitgebreide UX/UI specificaties
- Layout anatomy
- State diagrams
- Interaction patterns
- Animation guidelines
- Grid & spacing details

**COMPONENT-NOTE.md**
- Technische implementatie details
- Props & interfaces
- State management
- Event handlers
- Backend integration notes

**Guidelines.md**
- HH Design System tokens
- Color palette (HH/ prefixes)
- Typography scale
- Spacing system
- Shadow definitions
- Component usage guidelines

---

### React Componenten

**RolePlayChat.tsx** (Main Component)
- **3 Modi**: Chat, Audio, Video
- **5 States**: Idle, Active (per mode), Completed
- **Features**:
  - Message bubbles (chat mode)
  - Animated orb (audio mode)
  - Video embed placeholder (video mode)
  - Results modal with scores
  - Tips panel
  - Responsive layout

**EPICSalesFlow.tsx** (Sidebar Component)
- **Scenario flow tracker**
- **4 Fases**: Opening, Ontdekking, Aanbeveling, Beslissing
- **Step states**: Completed, Current, Upcoming, Locked
- **Features**:
  - Collapsible phases
  - Progress bar
  - Current step highlighting
  - Status indicators
  - Desktop sidebar / Mobile sheet

**AppLayout.tsx** (Wrapper Component)
- **Layout**: Sidebar + Topbar + Main content
- **Features**:
  - Collapsible sidebar
  - Responsive navigation
  - User menu
  - Page routing
  - Consistent header/footer

---

### UI Components (Shadcn)

Alle standaard Shadcn UI components zijn included in de `/ui` folder:

- **button.tsx** — Buttons (default, outline, destructive variants)
- **card.tsx** — Container cards
- **dialog.tsx** — Modals (results modal)
- **sheet.tsx** — Mobile overlays (flow tracker)
- **badge.tsx** — Status badges
- **input.tsx** — Text inputs
- **avatar.tsx** — User/coach avatars
- **... en meer** — Volledige Shadcn library

---

### Styling

**styles/globals.css**
- HH Design System CSS tokens
- Color variables (`--hh-ink`, `--hh-primary`, etc.)
- Shadow utilities (`.shadow-hh-sm`, `.shadow-hh-md`, `.shadow-hh-lg`)
- Typography defaults
- Tailwind v4 configuration

---

## 🎨 Design System Tokens (Quick Reference)

### Colors
```css
--hh-ink: #1C2535           /* Primary dark */
--hh-primary: #6B7A92       /* Accent/CTA */
--hh-success: #00C389       /* Positive */
--hh-warn: #FFB020          /* Warnings */
--hh-border: #E4E4E4        /* Borders */
--hh-ui-50: #F9FAFB         /* Light BG */
--hh-bg: #FFFFFF            /* Pure white */
--hh-muted: #6B7A92         /* Secondary text */
```

### Typography Scale
```
48px/56px  — Page titles
24px/32px  — Section headers
18px/24px  — Card titles
16px/24px  — Body text
14px/20px  — Small text
12px/16px  — Micro text
```

### Spacing
```
4px base system
→ 8px, 12px, 16px, 24px, 32px, 48px
```

### Border Radius
```
16px — Cards, containers
12px — Inner elements
full — Circles, pills
```

---

## 🔄 Component States & Flow

### State Diagram
```
IDLE 
  ├─ [Click Chat]  → ACTIVE (Chat)
  ├─ [Click Audio] → ACTIVE (Audio)
  └─ [Click Video] → ACTIVE (Video)

ACTIVE 
  └─ [Stop] → COMPLETED

COMPLETED 
  ├─ [Opnieuw]  → IDLE
  └─ [Resultaten] → Results Modal
```

### Chat Mode States
1. **Idle**: Empty state met 3 CTA buttons
2. **Active**: Message bubbles + typing indicator + input field
3. **Completed**: Results modal met scores

### Audio Mode States
1. **Idle**: Empty state met 3 CTA buttons
2. **Active**: Animated orb + mic controls
3. **Completed**: Results modal

### Video Mode States
1. **Idle**: Empty state met 3 CTA buttons
2. **Active**: Video embed (placeholder) + controls
3. **Completed**: Results modal

---

## 📱 Responsive Breakpoints

### Mobile (`< 768px`)
- Vertical stack layout
- Flow tracker in Sheet overlay
- Button labels hide (icons only)
- Compact padding (`px-4`)

### Tablet (`768px - 1024px`)
- Similar to mobile
- Medium padding (`px-6`)
- Flow tracker still in Sheet

### Desktop (`> 1024px`)
- Side-by-side layout
- Flow tracker permanent sidebar (`w-80`)
- Full button labels visible
- Large padding (`px-8`)

---

## ♿ Accessibility Features

✅ **Keyboard Navigation**
- Tab order: Logical flow
- Enter to send message
- Esc to close modals/sheets

✅ **Screen Readers**
- ARIA labels on icon-only buttons
- `sr-only` text alternatives
- Dialog roles & descriptions

✅ **Focus States**
- Visible focus rings (2px slate gray)
- `:focus-visible` on all interactive elements

✅ **Color Contrast**
- AA compliant contrast ratios
- Text readability on all backgrounds

---

## 🎯 Key Features

### Chat Mode
- ✅ Message bubbles (left/right aligned)
- ✅ Typing indicator (3 bouncing dots)
- ✅ Auto-scroll to latest message
- ✅ Enter to send
- ✅ Tips panel (collapsible)

### Audio Mode
- ✅ Animated orb (ping rings + waveform)
- ✅ Mic on/off states
- ✅ Recording indicator
- ✅ Technique tips card

### Video Mode
- ✅ 16:9 aspect ratio container
- ✅ HeyGen placeholder (backend required)
- ✅ Bottom gradient overlay
- ✅ Session info display

### Flow Tracker (All Modes)
- ✅ 4 phases (collapsible)
- ✅ Step status indicators
- ✅ Progress bar
- ✅ Current step highlighting
- ✅ Desktop sidebar / Mobile sheet

### Results Modal
- ✅ Overall score (large display)
- ✅ Sub-scores (2x2 grid)
- ✅ Highlights (success/warning)
- ✅ Hugo's advice (quote block)
- ✅ Share & retry actions

---

## 🔧 Props & Interfaces

### RolePlayChat
```tsx
interface RolePlayChatProps {
  navigate?: (page: string) => void;
}
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
```

---

## 🎬 Next Steps (Replit Implementation)

### Frontend (Immediate)
1. ✅ Copy `/roleplay-training-handoff/` naar je Replit project
2. ✅ Importeer `RolePlayChat` in je routing
3. ✅ Test alle 3 modi (chat, audio, video)
4. ✅ Verifieer responsive behavior
5. ✅ Test flow tracker (desktop + mobile)

### Backend (Later)
1. ⏳ HeyGen Interactive Avatar SDK integratie (video mode)
2. ⏳ OpenAI Chat API (chat mode responses)
3. ⏳ Speech-to-text / Text-to-speech (audio mode)
4. ⏳ Firebase sessie tracking & scoring
5. ⏳ Real-time tips engine

### Design Refinement
1. 🎨 Custom animations (message entrance, orb pulse)
2. 🎨 Transition effects (mode switching)
3. 🎨 Loading states (API calls)
4. 🎨 Error states (mic permission, video load)

---

## 📞 Support & Questions

**Design System Reference**: `/Guidelines.md`  
**Component Details**: `/COMPONENT-NOTE.md`  
**UX Specifications**: `/BRIEFING.md`  
**Complete Brief**: `/README.md`

---

**Package Status**: ✅ Ready for Replit Implementation  
**Last Updated**: December 2024  
**Designer**: HugoHerbots.ai Design Team
