# Live Coaching - Frontend Component Reference

Complete referentie voor frontend componenten en integratie met backend.

---

## 📁 Component Locations

| Component | Path | Beschrijving |
|-----------|------|--------------|
| LiveCoaching | `/components/HH/LiveCoaching.tsx` | Main live coaching page |
| Dashboard Section | `/components/HH/Dashboard.tsx` | Upcoming sessions widget |
| AppLayout | `/components/HH/AppLayout.tsx` | Navigation wrapper |

---

## 🎨 LiveCoaching.tsx Component Structure

### Props Interface
```typescript
interface LiveCoachingProps {
  navigate?: (page: string) => void;
  isPreview?: boolean;
}
```

### State Management
```typescript
const [chatMessage, setChatMessage] = useState("");
const [activeTab, setActiveTab] = useState<"chat" | "polls">("chat");
```

### Key Sections

#### 1. Header with Live Badge
```tsx
<div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
  <div>
    <h1>Live Coaching</h1>
    <p className="text-hh-muted">
      Elke week live met Hugo — stel vragen, oefen samen en leer van andere verkopers.
    </p>
  </div>
  {liveSession && (
    <Badge className="bg-destructive text-white border-destructive flex items-center gap-2 px-3 py-1.5 animate-pulse">
      <Radio className="w-4 h-4" />
      <span>LIVE NU</span>
    </Badge>
  )}
</div>
```

#### 2. Video Stream Area
```tsx
<div className="w-full bg-hh-ink flex items-center justify-center relative overflow-hidden"
     style={{ aspectRatio: "16/9" }}>
  {/* Hugo Live Photo */}
  <img src={hugoLivePhoto} alt="Hugo Herbots Live" className="absolute inset-0 w-full h-full object-cover" />
  
  {/* Live Badge */}
  <div className="absolute top-4 left-4 z-20">
    <Badge className="bg-destructive text-white">
      <Radio className="w-4 h-4 animate-pulse" />
      <span>LIVE</span>
    </Badge>
  </div>
  
  {/* Viewer Count */}
  <div className="absolute top-4 right-4 z-20">
    <div className="bg-black/50 backdrop-blur-sm rounded-full px-3 py-1.5 flex items-center gap-2">
      <Eye className="w-4 h-4 text-white" />
      <span className="text-white">{liveSession.viewers} kijkers</span>
    </div>
  </div>
</div>
```

#### 3. Chat Panel
```tsx
<ScrollArea className="flex-1 p-4">
  <div className="space-y-4">
    {chatMessages.map((msg) => (
      <div key={msg.id} className="flex gap-3">
        <Avatar className="flex-shrink-0 w-8 h-8">
          <AvatarFallback className={msg.isHost ? "bg-hh-primary text-white" : "bg-hh-ui-200 text-hh-text"}>
            {msg.initials}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2 mb-1">
            <span className={msg.isHost ? "text-hh-primary" : "text-hh-text"}>
              {msg.user}
            </span>
            {msg.isHost && <Badge className="bg-hh-primary/10 text-hh-primary">HOST</Badge>}
            <span className="text-hh-muted text-[12px]">{msg.time}</span>
          </div>
          <p className="text-hh-text">{msg.message}</p>
        </div>
      </div>
    ))}
  </div>
</ScrollArea>

{/* Chat Input */}
<div className="p-4 border-t border-hh-border">
  <div className="flex gap-2">
    <Input
      value={chatMessage}
      onChange={(e) => setChatMessage(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          handleSendMessage();
        }
      }}
      placeholder="Stel een vraag..."
      className="flex-1"
    />
    <Button onClick={handleSendMessage} disabled={!chatMessage.trim()} size="icon">
      <Send className="w-4 h-4" />
    </Button>
  </div>
  <p className="text-[12px] text-hh-muted mt-2">
    Wees respectvol — Hugo beantwoordt vragen live
  </p>
</div>
```

#### 4. Poll Panel
```tsx
<div className="space-y-6">
  <div>
    <div className="flex items-center gap-2 mb-3">
      <ThumbsUp className="w-5 h-5 text-hh-primary" />
      <h3>Live Poll</h3>
    </div>
    <p className="text-hh-text mb-4">{currentPoll.question}</p>
    
    <div className="space-y-2">
      {currentPoll.options.map((option, idx) => {
        const percentage = currentPoll.totalVotes
          ? Math.round((option.votes / currentPoll.totalVotes) * 100)
          : 0;
        return (
          <button
            key={idx}
            className="w-full text-left p-3 rounded-lg border border-hh-border hover:border-hh-primary transition-colors relative overflow-hidden"
          >
            <div className="absolute inset-0 bg-hh-primary/5" style={{ width: `${percentage}%` }} />
            <div className="relative flex items-center justify-between">
              <span className="text-hh-text">{option.text}</span>
              <div className="flex items-center gap-2">
                <span className="text-hh-muted">{option.votes}</span>
                <span className="text-hh-primary">{percentage}%</span>
              </div>
            </div>
          </button>
        );
      })}
    </div>
    
    <p className="text-[12px] text-hh-muted mt-3">{currentPoll.totalVotes} stemmen</p>
  </div>
</div>
```

#### 5. Upcoming Sessions Grid
```tsx
<div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
  {upcomingSessions
    .filter((s) => s.status === "upcoming")
    .map((session) => (
      <Card key={session.id} className="p-6 rounded-[16px] shadow-hh-sm border-hh-border hover:shadow-hh-md transition-shadow">
        <div className="flex items-start justify-between mb-3">
          <Badge variant="outline">{session.topic}</Badge>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <Bell className="w-4 h-4" />
          </Button>
        </div>
        <h3 className="text-hh-text mb-3">{session.title}</h3>
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-hh-muted">
            <Calendar className="w-4 h-4" />
            {session.date}
          </div>
          <div className="flex items-center gap-2 text-hh-muted">
            <Clock className="w-4 h-4" />
            {session.time}
          </div>
        </div>
        <Button variant="outline" className="w-full mt-4">
          Herinnering instellen
        </Button>
      </Card>
    ))}
</div>
```

---

## 🔌 Backend Integration Points

### 1. Fetch Sessions on Page Load
```typescript
useEffect(() => {
  async function fetchSessions() {
    try {
      const response = await fetch('/api/live/sessions?status=upcoming&limit=10', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) throw new Error('Failed to fetch sessions');
      
      const data = await response.json();
      setSessions(data.sessions);
    } catch (error) {
      console.error('Error fetching sessions:', error);
      // Show error toast
    }
  }
  
  fetchSessions();
}, []);
```

### 2. WebSocket Connection for Live Session
```typescript
useEffect(() => {
  if (!liveSession) return;
  
  const ws = new WebSocket(`wss://api.hugoherbots.ai/live/${liveSession.id}?token=${token}`);
  
  ws.onopen = () => {
    console.log('Connected to live session');
  };
  
  ws.onmessage = (event) => {
    const message = JSON.parse(event.data);
    
    switch (message.type) {
      case 'chat:message':
        // Add new message to chat
        setChatMessages(prev => [...prev, message.data]);
        break;
        
      case 'poll:update':
        // Update poll vote counts
        updatePollVotes(message.data);
        break;
        
      case 'viewer:count':
        // Update viewer count
        setViewerCount(message.data.viewerCount);
        break;
    }
  };
  
  ws.onerror = (error) => {
    console.error('WebSocket error:', error);
  };
  
  ws.onclose = () => {
    console.log('Disconnected from live session');
    // Attempt reconnect after 3 seconds
    setTimeout(() => {
      // Reconnect logic
    }, 3000);
  };
  
  return () => {
    ws.close();
  };
}, [liveSession]);
```

### 3. Send Chat Message
```typescript
const handleSendMessage = async () => {
  if (!chatMessage.trim()) return;
  
  try {
    const response = await fetch(`/api/live/sessions/${sessionId}/chat`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        userId: currentUserId,
        message: chatMessage.trim()
      })
    });
    
    if (!response.ok) {
      const error = await response.json();
      if (response.status === 429) {
        // Rate limit exceeded
        toast.error(error.message);
        return;
      }
      throw new Error('Failed to send message');
    }
    
    const newMessage = await response.json();
    
    // Message will also come via WebSocket, but we can add it optimistically
    setChatMessages(prev => [...prev, newMessage]);
    setChatMessage('');
    
    // Auto-scroll to bottom
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  } catch (error) {
    console.error('Error sending message:', error);
    toast.error('Kon bericht niet versturen. Probeer opnieuw.');
  }
};
```

### 4. Vote on Poll
```typescript
const handleVote = async (pollId: string, optionId: string) => {
  try {
    const response = await fetch(`/api/live/polls/${pollId}/vote`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        userId: currentUserId,
        optionId
      })
    });
    
    if (!response.ok) {
      const error = await response.json();
      if (response.status === 409) {
        // Already voted
        toast.info('Je hebt al gestemd op deze poll');
        return;
      }
      throw new Error('Failed to vote');
    }
    
    const result = await response.json();
    
    // Update local poll state
    setPoll(result.poll);
    
    toast.success('Stem geregistreerd!');
  } catch (error) {
    console.error('Error voting:', error);
    toast.error('Kon niet stemmen. Probeer opnieuw.');
  }
};
```

### 5. Set Session Reminder
```typescript
const handleSetReminder = async (sessionId: string) => {
  try {
    const response = await fetch(`/api/live/sessions/${sessionId}/reminder`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        userId: currentUserId
      })
    });
    
    if (!response.ok) {
      const error = await response.json();
      if (response.status === 409) {
        toast.info('Je hebt al een reminder voor deze sessie');
        return;
      }
      throw new Error('Failed to set reminder');
    }
    
    const result = await response.json();
    
    // Update local state
    setHasReminder(sessionId, true);
    
    toast.success('Reminder ingesteld! Je krijgt 24 uur van tevoren een email.');
  } catch (error) {
    console.error('Error setting reminder:', error);
    toast.error('Kon reminder niet instellen. Probeer opnieuw.');
  }
};
```

### 6. Download Calendar (.ics)
```typescript
const handleAddToCalendar = (session: LiveSession) => {
  const event = {
    title: session.title,
    start: new Date(session.scheduledDate),
    end: new Date(new Date(session.scheduledDate).getTime() + session.duration * 60000),
    description: `Live coaching sessie met Hugo Herbots - ${session.topic}`,
    location: "HugoHerbots.ai Live Coaching"
  };
  
  // Create ICS file content
  const icsContent = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//HugoHerbots.ai//Live Coaching//NL',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `DTSTART:${formatICSDate(event.start)}`,
    `DTEND:${formatICSDate(event.end)}`,
    `SUMMARY:${event.title}`,
    `DESCRIPTION:${event.description}`,
    `LOCATION:${event.location}`,
    `UID:${session.id}@hugoherbots.ai`,
    'STATUS:CONFIRMED',
    'SEQUENCE:0',
    'END:VEVENT',
    'END:VCALENDAR'
  ].join('\r\n');
  
  // Download ICS file
  const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `live-coaching-${session.id}.ics`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  
  toast.success('Sessie toegevoegd aan kalender!');
};

function formatICSDate(date: Date): string {
  return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
}
```

---

## 🎯 Dashboard Widget Integration

### Location: `/components/HH/Dashboard.tsx`

```tsx
{/* Upcoming Live Coaching Sessions */}
<div>
  <div className="flex items-center justify-between mb-4">
    <div className="flex items-center gap-3">
      <h3 className="text-[20px] leading-[28px] text-hh-text">
        Opkomende Live Coaching
      </h3>
      <Badge className="bg-destructive/10 text-destructive border-destructive/20 flex items-center gap-1.5 px-2 py-0.5">
        <Radio className="w-3 h-3" />
        <span>Elke woensdag</span>
      </Badge>
    </div>
    <Button variant="ghost" size="sm" onClick={() => navigate?.("live")}>
      Bekijk alles
    </Button>
  </div>
  
  <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
    {upcomingSessions.slice(0, 3).map((session) => (
      <Card key={session.id} className="p-4 sm:p-6 rounded-[16px] shadow-hh-sm border-hh-border hover:shadow-hh-md transition-all relative overflow-hidden">
        {/* Next session highlight */}
        {session === upcomingSessions[0] && (
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-hh-primary to-hh-accent" />
        )}
        
        <div className="flex items-start justify-between mb-3">
          <Badge variant="outline">{session.topic}</Badge>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleAddToCalendar(session)}>
            <Calendar className="w-4 h-4" />
          </Button>
        </div>
        
        <h4 className="text-[16px] leading-[24px] text-hh-text mb-2">{session.title}</h4>
        
        <div className="space-y-1.5 text-[14px] leading-[20px] text-hh-muted mb-4">
          <p className="flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            {formatDate(session.scheduledDate)}
          </p>
          <p className="flex items-center gap-2">
            <Clock className="w-4 h-4" />
            {formatTime(session.scheduledDate)} ({session.duration} min)
          </p>
        </div>
        
        <Button size="sm" className="w-full gap-2" onClick={() => handleSetReminder(session.id)}>
          <Bell className="w-4 h-4" />
          Herinner me
        </Button>
      </Card>
    ))}
  </div>
</div>
```

---

## 🎨 Styling Reference

### Component Classes (Tailwind)

```css
/* Card */
.rounded-[16px]              /* Border radius */
.shadow-hh-sm                /* Small shadow */
.shadow-hh-md                /* Medium shadow */
.border-hh-border            /* Border color */

/* Text */
.text-hh-text                /* Primary text color */
.text-hh-muted               /* Secondary text color */
.text-hh-primary             /* Accent color */

/* Backgrounds */
.bg-hh-ui-50                 /* Light background */
.bg-hh-ui-200                /* Muted background */
.bg-hh-primary/10            /* Primary with 10% opacity */

/* Typography */
.text-[48px] .leading-[56px] /* H1 */
.text-[32px] .leading-[40px] /* H2 */
.text-[16px] .leading-[24px] /* Body */
.text-[14px] .leading-[20px] /* Small */
```

### Custom Animations

```css
/* Live badge pulse */
.animate-pulse

/* Hover shadow transition */
.hover:shadow-hh-md .transition-shadow

/* Border hover */
.hover:border-hh-primary .transition-colors
```

---

## 📱 Responsive Breakpoints

```typescript
// Mobile: < 640px (1 column)
// Tablet: 640px-1024px (2 columns)
// Desktop: > 1024px (3 columns)

<div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
  {/* Session cards */}
</div>
```

---

## 🔔 Toast Notifications

```typescript
import { toast } from "sonner@2.0.3";

// Success
toast.success('Reminder ingesteld!');

// Error
toast.error('Kon bericht niet versturen. Probeer opnieuw.');

// Info
toast.info('Je hebt al gestemd op deze poll');

// Loading
const toastId = toast.loading('Bericht versturen...');
// Later:
toast.success('Bericht verstuurd!', { id: toastId });
```

---

## 🚀 Performance Tips

1. **Memo expensive components**
   ```tsx
   const ChatMessage = React.memo(({ message }) => { /* ... */ });
   ```

2. **Virtualize long chat lists**
   ```tsx
   // Use react-window for 100+ messages
   import { FixedSizeList } from 'react-window';
   ```

3. **Debounce WebSocket messages**
   ```tsx
   const debouncedSend = useMemo(
     () => debounce((msg) => ws.send(msg), 100),
     [ws]
   );
   ```

4. **Lazy load past sessions**
   ```tsx
   const PastSessions = lazy(() => import('./PastSessions'));
   ```

---

Veel succes met de implementatie! 🎯
