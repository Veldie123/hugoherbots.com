# Rollenspel Training - Component Notes

## Component Hierarchy

```
RolePlay.tsx (Main container)
├── AppLayout (Wrapper met sidebar/topbar)
├── HeyGenEmbedded (Avatar iframe)
├── EPICSalesFlow (Sales flow sidebar - Desktop)
├── Sheet → EPICSalesFlow (Sales flow - Mobile drawer)
├── Dialog (Results modal)
└── Card (Tips panel tijdens sessie)
```

## File Dependencies

### Hoofdcomponent
- **`/components/HH/RolePlay.tsx`** - Main roleplay container
  - Props: `navigate?: (page: string) => void`
  - State management: idle/recording/completed
  - HeyGen integration orchestration
  - Results modal handling

### Sub-components
- **`/components/HH/HeyGenEmbedded.tsx`** - HeyGen iframe wrapper
  - Props: `isActive: boolean`
  - Handles iframe lifecycle
  - Listens for HeyGen postMessage events
  - Cross-origin communication

- **`/components/HH/EPICSalesFlow.tsx`** - Sales flow tracker sidebar
  - Props: `phases`, `currentPhaseId`, `currentStepId`, `compact?`
  - Collapsible phase sections
  - Expandable technique details
  - Progress visualization
  - Thema's per fase

- **`/components/HH/AppLayout.tsx`** - App wrapper
  - Sidebar navigation
  - Topbar with user menu
  - Page container

- **`/components/HH/Logo.tsx`** - HH logo component

### UI Primitives (shadcn/ui)
- `/components/ui/card.tsx`
- `/components/ui/badge.tsx`
- `/components/ui/button.tsx`
- `/components/ui/dialog.tsx`
- `/components/ui/sheet.tsx`
- `/components/ui/progress.tsx`
- `/components/ui/utils.ts` (cn helper)

### Library Utilities
- `/lib/utils.ts` - Shared utility functions

---

## HeyGen Integration Points

### 1. Iframe Embedding (HeyGenEmbedded.tsx)

**Current Implementation:**
```tsx
// Line 15-16 in HeyGenEmbedded.tsx
const liveAvatarUrl = "https://embed.liveavatar.com/v1/fa6ef0c3-d6a6-11f0-a99e-066a7fa2e369";
```

**✅ LiveAvatar Embed:**
Dit is de correcte LiveAvatar embed URL voor Hugo's interactive avatar. De iframe is geoptimaliseerd voor:
- 16:9 aspect ratio
- Microphone access (`allow="microphone"`)
- Seamless integratie in de roleplay card

**Implementation Details:**
```tsx
<iframe
  src="https://embed.liveavatar.com/v1/fa6ef0c3-d6a6-11f0-a99e-066a7fa2e369"
  allow="microphone"
  title="LiveAvatar Interactive Hugo"
  className="absolute inset-0 w-full h-full border-0"
  style={{ aspectRatio: "16/9" }}
/>
```

### 2. LiveAvatar Event Handling

**🔴 ACTION REQUIRED:**
LiveAvatar gebruikt mogelijk een andere event API dan HeyGen. Check de LiveAvatar documentatie voor:
- `ready` event (wanneer avatar geladen is)
- `user_spoke` event (user transcript)
- `assistant_spoke` event (Hugo's response)
- `error` event (connection issues)

**Voorbeeld implementation:**
```tsx
useEffect(() => {
  const handleMessage = (e: MessageEvent) => {
    if (e.origin !== "https://embed.liveavatar.com") return;
    
    switch (e.data?.type) {
      case "ready":
        onAvatarReady?.();
        break;
      case "transcript":
        if (e.data.speaker === "user") {
          onUserSpoke?.(e.data.text);
        } else {
          onHugoSpoke?.(e.data.text);
        }
        break;
      case "error":
        console.error("LiveAvatar error:", e.data.message);
        break;
    }
  };

  window.addEventListener("message", handleMessage);
  return () => window.removeEventListener("message", handleMessage);
}, []);
```

---

## Sales Flow Data Structure

### Phase & Step Schema

**Defined in RolePlay.tsx (Line 54-114):**
```tsx
interface Step {
  id: string;          // "1.1", "2.1.3", etc.
  name: string;        // "Koopklimaat creëren"
  status: "completed" | "current" | "upcoming" | "locked";
  duration: string;    // "2 min"
  nummer: string;      // "1.1" (used for technique details lookup)
  isVerplicht?: boolean; // Required step?
}

interface Phase {
  id: number;          // 1, 2, 3, 4
  name: string;        // "Openingsfase"
  color: string;       // "#6B7A92" (HH primary)
  themas: string[];    // ["Bron", "Motivatie", ...]
  uitleg: string;      // Phase explanation
  steps: Step[];       // Array of techniques
}
```

### Technique Details Lookup

**Defined in EPICSalesFlow.tsx (Line 33-119):**
```tsx
const TECHNIQUE_DETAILS: Record<string, {
  wat: string;      // What is this technique?
  wanneer?: string; // When to use it?
  doel?: string;    // Goal of this technique?
}> = {
  "1.1": {
    wat: "Gedrag/onderwerp afstemmen op klant om vertrouwen te winnen (gunfactor).",
    wanneer: "start gesprek"
  },
  "2.1.3": {
    wat: "Kiesvraag om standpunt te forceren.",
    doel: "twijfel scherpstellen"
  },
  // ... etc
};
```

**🔴 ACTION REQUIRED:**
Move this naar database of backend config file zodat je het kan updaten zonder code changes.

---

## State Management Flow

### Current State (RolePlay.tsx)

```tsx
const [state, setState] = useState<"idle" | "recording" | "completed">("idle");
const [showResults, setShowResults] = useState(false);
const [micActive, setMicActive] = useState(false);
const [sidebarOpen, setSidebarOpen] = useState(false);

const currentPhaseId = 2;          // 🔴 Hardcoded - moet dynamisch
const currentStepId = "2.1.3";     // 🔴 Hardcoded - moet dynamisch
```

**🔴 ACTION REQUIRED:**
Maak state dynamisch gebaseerd op backend data:

```tsx
// ✅ Correct: fetch user progress from backend
const [sessionId, setSessionId] = useState<string | null>(null);
const [state, setState] = useState<SessionState>("idle");
const [currentPhaseId, setCurrentPhaseId] = useState(1);
const [currentStepId, setCurrentStepId] = useState("1.1");
const [phases, setPhases] = useState<Phase[]>([]);

useEffect(() => {
  // Load user's current progress
  fetchUserProgress();
}, []);

const fetchUserProgress = async () => {
  const response = await fetch(`/api/roleplay/users/${userId}/progress`);
  const data = await response.json();
  setCurrentPhaseId(data.currentPhase);
  setCurrentStepId(data.currentStep);
  setPhases(data.scenarioFlow); // Backend determines which steps are unlocked
};
```

### Session Lifecycle

```tsx
const startSession = async () => {
  // 1. Request session van backend
  const response = await fetch("/api/roleplay/sessions/start", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      userId,
      scenarioId: "default-sales-scenario",
      startPhaseId: currentPhaseId,
      startStepId: currentStepId,
    }),
  });

  const data = await response.json();
  setSessionId(data.sessionId);

  // 2. Initialize HeyGen met session credentials
  // (HeyGenEmbedded component will use sessionId + accessToken props)

  // 3. Update UI state
  setState("recording");
  setMicActive(true);

  // 4. Connect to WebSocket voor real-time updates
  connectWebSocket(data.sessionId);
};

const stopSession = async () => {
  if (!sessionId) return;

  // 1. Stop HeyGen session
  await fetch(`/api/roleplay/sessions/${sessionId}/stop`, {
    method: "POST",
  });

  // 2. Update UI state
  setState("completed");
  setMicActive(false);

  // 3. Wait for feedback (async process)
  // Results modal will show when feedback is ready (via WebSocket)
  pollForFeedback();
};

const pollForFeedback = async () => {
  // Poll elke 2 seconden tot feedback ready is
  const interval = setInterval(async () => {
    const response = await fetch(`/api/roleplay/sessions/${sessionId}/feedback`);
    if (response.ok) {
      const feedback = await response.json();
      setShowResults(true);
      setFeedbackData(feedback);
      clearInterval(interval);
    }
  }, 2000);

  // Timeout na 30 seconden
  setTimeout(() => {
    clearInterval(interval);
    // Show error: "Feedback verwerking duurt langer dan verwacht..."
  }, 30000);
};
```

### WebSocket Integration

```tsx
const connectWebSocket = (sessionId: string) => {
  const socket = io(WEBSOCKET_URL);

  socket.emit("session:join", { sessionId, userId });

  // Listen for step updates
  socket.on("step:updated", (data) => {
    setCurrentStepId(data.currentStepId);
    // Update sidebar highlighting
  });

  // Listen for phase completion
  socket.on("phase:completed", (data) => {
    setCurrentPhaseId(data.nextPhaseId);
    // Show confetti animation
    // Update phases to unlock next phase steps
  });

  // Listen for feedback ready
  socket.on("feedback:ready", (data) => {
    setShowResults(true);
    fetchFeedback(sessionId);
  });

  // Cleanup on unmount
  return () => socket.disconnect();
};
```

---

## Results Modal Data Binding

**Current implementation (Line 317-417) is static mock data.**

**🔴 ACTION REQUIRED:**
Bind to backend feedback data:

```tsx
const [feedbackData, setFeedbackData] = useState<FeedbackData | null>(null);

// In Results Modal:
{feedbackData && (
  <DialogContent>
    {/* Overall score */}
    <div className="text-center p-6 bg-hh-ui-50 rounded-[16px]">
      <p className="text-[48px] leading-[56px] text-hh-text">
        {feedbackData.overallScore}
        <span className="text-[24px] leading-[32px]">%</span>
      </p>
      {feedbackData.delta && (
        <Badge className="mt-2 bg-hh-success/10 text-hh-success">
          +{feedbackData.delta}% vs vorige sessie
        </Badge>
      )}
    </div>

    {/* Sub-scores */}
    <div className="grid grid-cols-2 gap-4">
      {Object.entries(feedbackData.subScores).map(([key, score]) => (
        <Card key={key} className="p-4">
          <p className="text-hh-muted capitalize">{key}</p>
          <p className="text-[28px] leading-[36px]">{score}%</p>
        </Card>
      ))}
    </div>

    {/* Highlights */}
    {feedbackData.highlights.map((highlight, idx) => (
      <div key={idx} className={`flex items-start gap-2 p-3 rounded-lg ${
        highlight.type === "good" ? "bg-hh-success/10" : "bg-hh-warn/10"
      }`}>
        <TrendingUp className={`w-4 h-4 ${
          highlight.type === "good" ? "text-hh-success" : "text-hh-warn"
        }`} />
        <p>{highlight.text}</p>
      </div>
    ))}

    {/* Hugo's advice */}
    <p className="text-hh-muted">{feedbackData.advice}</p>
  </DialogContent>
)}
```

---

## Responsive Behavior

### Desktop (>= 1024px)
- **Sidebar:** Permanent, 320px breed, rechts van video
- **Video:** Flex-1, max-width 6xl
- **Flow toggle button:** Hidden

### Mobile/Tablet (< 1024px)
- **Sidebar:** Hidden, vervangen door Sheet (drawer)
- **Video:** Full width
- **Flow toggle button:** Visible tijdens recording state
- **Sheet:** Swipe van rechts naar links om te openen

**Implementation (RolePlay.tsx Line 170-178):**
```tsx
<Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
  <SheetContent side="right" className="p-0 w-80">
    <EPICSalesFlow phases={phases} ... />
  </SheetContent>
</Sheet>

{/* Desktop sidebar - Line 306-312 */}
<div className="hidden lg:block w-80">
  <EPICSalesFlow phases={phases} ... />
</div>
```

---

## Styling Guidelines

### Video/Avatar Card States

**Idle (Line 186-200):**
- Gradient background: `from-hh-ui-500 to-hh-ink`
- Cursor pointer + hover shadow
- Centered Play icon (64px)
- Text: "Klik hier om te beginnen"

**Recording (Line 202-222):**
- HeyGen iframe: absolute inset-0
- Overlay gradient: `from-hh-ink/90 to-transparent` (bottom)
- Pulse indicator: green dot + "Sessie actief" text
- Instructions text: "Klik op de avatar om het gesprek te starten"

**Completed (Line 223-232):**
- Success icon: rounded-full bg-hh-success
- Text: "Sessie voltooid!"

### Sidebar (EPICSalesFlow)

**Header (Line 155-174):**
- White background
- Progress circle icon
- Completion counter: "X / Y voltooid"
- Progress bar met percentage

**Phase sections (Line 186-239):**
- Collapsible met ChevronDown/Right
- Phase icon: CheckCircle (completed), numbered badge (current/upcoming)
- Mini progress bar onder naam
- Completion fraction: "X/Y"

**Step items (Line 306-375):**
- Status icons: CheckCircle2 (completed), filled Circle (current), outline Circle (upcoming), Lock (locked)
- Current step: `bg-hh-primary/5 border-l-2 border-hh-primary`
- Expandable technique details: click to show wat/wanneer/doel

---

## Critical Integration Checklist

- [ ] **HeyGen URL:** Dynamisch van backend (niet hardcoded)
- [ ] **Session management:** Start/stop API calls implemented
- [ ] **PostMessage events:** All HeyGen events handled (ready, user_spoke, message, error)
- [ ] **Transcript logging:** Real-time logging naar backend
- [ ] **State management:** currentPhaseId + currentStepId dynamisch van backend
- [ ] **WebSocket:** Real-time updates voor step/phase transitions
- [ ] **Results modal:** Data binding naar backend feedback API
- [ ] **Progress persistence:** User progress opslaan in database
- [ ] **Error handling:** HeyGen failures, API failures, network issues
- [ ] **Loading states:** Skeleton/spinner tijdens HeyGen init
- [ ] **Microphone permissions:** Clear instructions + fallback
- [ ] **Responsive:** Sidebar (desktop) vs Sheet (mobile) werkt correct

---

## Test Scenario

1. User clicks "Start sessie" → Loading state → HeyGen iframe laadt
2. Microphone permission prompt → User geeft toegang
3. HeyGen avatar appears → "ready" event → UI toont instructies
4. User praat → "user_spoke" event → Transcript logged
5. Hugo reageert → "message" event → Transcript logged
6. Backend analyseert → WebSocket "step:updated" → Sidebar highlight verschuift
7. User voltooit fase → WebSocket "phase:completed" → Confetti + unlock next phase
8. User clicks "Stop sessie" → Backend analyseert met OpenAI (async)
9. Feedback ready → WebSocket "feedback:ready" → Results modal toont scores
10. User clicks "Herhaal met focus" → Modal sluit, state → idle, ready voor nieuwe sessie

---

Zie README.md voor volledige backend requirements en API specs.
Zie BRIEFING.md voor business logic en Hugo's methodologie details.