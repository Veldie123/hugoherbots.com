# Live Coaching Handoff Package

## 📦 Overzicht

Complete handoff voor **HugoHerbots.ai Live Coaching** feature met wekelijkse livestreams, real-time chat, live polls, session management en calendar export functionaliteit.

---

## 🎯 Features

### 1. Live Streaming
- **Weekly livestreams** elke woensdag 14:00-15:00
- **Live badge** met viewer count tijdens actieve sessie
- **Video embed** met 16:9 aspect ratio
- **Session info**: Datum, tijd, topic, niveau, duur
- **Status indicators**: Live / Upcoming / Ended

### 2. Real-time Chat
- **Live chat** tijdens sessies met Hugo en andere deelnemers
- **Host badge** voor Hugo's berichten
- **Timestamps** op alle berichten
- **Auto-scroll** naar nieuwste berichten
- **Message input** met send button
- **Avatar initials** voor gebruikers

### 3. Live Polls
- **Interactive polls** tijdens sessies
- **Real-time voting** met percentage visualisatie
- **Total vote count** zichtbaar
- **One vote per user** restriction
- **Visual poll results** met progress bars

### 4. Upcoming Sessions
- **Session calendar** met alle aankomende sessies
- **Session cards** met fase badge, datum, tijd, topic
- **Calendar export** (.ics download) voor elke sessie
- **Reminder buttons** om notificaties in te stellen
- **Responsive grid** (1-2-3 kolommen)

### 5. Past Sessions
- **Recording library** van vorige sessies
- **"Bekijk opname" CTA** om recording te bekijken
- **Session metadata** (datum, tijd, topic)

---

## 🗄️ Database Schema

### Table: `live_sessions`
```sql
CREATE TABLE live_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title VARCHAR(255) NOT NULL,
  description TEXT,
  scheduled_date TIMESTAMP NOT NULL,
  duration_minutes INTEGER DEFAULT 60,
  topic VARCHAR(255),
  phase_id INTEGER, -- 1: Voorbereiding, 2: Ontdekking, 3: Aanbeveling, 4: Beslissing
  status VARCHAR(20) DEFAULT 'upcoming', -- 'upcoming', 'live', 'ended'
  video_url TEXT, -- Livestream URL tijdens live, recording URL na afloop
  thumbnail_url TEXT,
  viewer_count INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### Table: `live_chat_messages`
```sql
CREATE TABLE live_chat_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID REFERENCES live_sessions(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  is_host BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### Table: `live_polls`
```sql
CREATE TABLE live_polls (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID REFERENCES live_sessions(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### Table: `live_poll_options`
```sql
CREATE TABLE live_poll_options (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  poll_id UUID REFERENCES live_polls(id) ON DELETE CASCADE,
  option_text VARCHAR(255) NOT NULL,
  vote_count INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### Table: `live_poll_votes`
```sql
CREATE TABLE live_poll_votes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  poll_id UUID REFERENCES live_polls(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  option_id UUID REFERENCES live_poll_options(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(poll_id, user_id) -- One vote per user per poll
);
```

### Table: `live_session_reminders`
```sql
CREATE TABLE live_session_reminders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID REFERENCES live_sessions(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(session_id, user_id)
);
```

---

## 🔌 API Endpoints

### GET `/api/live/sessions`
Haal alle live coaching sessies op (upcoming, live, ended)

**Query Parameters:**
- `status` (optional): Filter op status ('upcoming', 'live', 'ended')
- `limit` (optional): Aantal sessies (default: 10)

**Response:**
```json
{
  "sessions": [
    {
      "id": "session-uuid-1",
      "title": "Live Q&A: Discovery Technieken",
      "description": "Leer de E.P.I.C. methode voor ontdekkingsgesprekken",
      "scheduledDate": "2025-01-22T14:00:00Z",
      "duration": 60,
      "topic": "Fase 2 • Ontdekkingsfase",
      "phaseId": 2,
      "status": "upcoming",
      "videoUrl": null,
      "thumbnailUrl": "https://...",
      "viewerCount": 0
    },
    {
      "id": "session-uuid-2",
      "title": "Live Coaching: Bezwaarhandeling",
      "scheduledDate": "2025-01-15T14:00:00Z",
      "duration": 60,
      "topic": "Fase 4 • Beslissingsfase",
      "phaseId": 4,
      "status": "live",
      "videoUrl": "https://livestream.url",
      "viewerCount": 127
    }
  ]
}
```

---

### GET `/api/live/sessions/:sessionId`
Haal details van een specifieke sessie op

**Response:**
```json
{
  "id": "session-uuid-1",
  "title": "Live Q&A: Discovery Technieken",
  "description": "Leer de E.P.I.C. methode voor ontdekkingsgesprekken",
  "scheduledDate": "2025-01-22T14:00:00Z",
  "duration": 60,
  "topic": "Fase 2 • Ontdekkingsfase",
  "phaseId": 2,
  "status": "upcoming",
  "videoUrl": null,
  "thumbnailUrl": "https://...",
  "viewerCount": 0,
  "hasReminder": false
}
```

---

### POST `/api/live/sessions/:sessionId/reminder`
Zet een reminder voor een sessie

**Request:**
```json
{
  "userId": "user-uuid"
}
```

**Response:**
```json
{
  "success": true,
  "reminderId": "reminder-uuid"
}
```

---

### DELETE `/api/live/sessions/:sessionId/reminder`
Verwijder een reminder

**Response:**
```json
{
  "success": true
}
```

---

### GET `/api/live/sessions/:sessionId/chat`
Haal chat berichten op voor een sessie

**Query Parameters:**
- `limit` (optional): Aantal berichten (default: 50)
- `before` (optional): Timestamp voor pagination

**Response:**
```json
{
  "messages": [
    {
      "id": "msg-uuid-1",
      "sessionId": "session-uuid",
      "userId": "user-uuid",
      "userName": "Hugo Herbots",
      "userInitials": "HH",
      "message": "Welkom allemaal! Vandaag gaan we het hebben over bezwaarhandeling.",
      "isHost": true,
      "createdAt": "2025-01-15T14:02:00Z"
    },
    {
      "id": "msg-uuid-2",
      "sessionId": "session-uuid",
      "userId": "user-uuid-2",
      "userName": "Sarah van Dijk",
      "userInitials": "SV",
      "message": "Dank je Hugo! Ik heb hier echt moeite mee.",
      "isHost": false,
      "createdAt": "2025-01-15T14:03:00Z"
    }
  ],
  "hasMore": false
}
```

---

### POST `/api/live/sessions/:sessionId/chat`
Stuur een chat bericht

**Request:**
```json
{
  "userId": "user-uuid",
  "message": "Geweldige sessie, Hugo!"
}
```

**Response:**
```json
{
  "id": "msg-uuid-3",
  "sessionId": "session-uuid",
  "userId": "user-uuid",
  "userName": "Jan de Vries",
  "userInitials": "JV",
  "message": "Geweldige sessie, Hugo!",
  "isHost": false,
  "createdAt": "2025-01-15T14:15:00Z"
}
```

---

### GET `/api/live/sessions/:sessionId/polls`
Haal actieve polls op voor een sessie

**Response:**
```json
{
  "polls": [
    {
      "id": "poll-uuid-1",
      "sessionId": "session-uuid",
      "question": "Waar loop je het meest tegenaan bij bezwaarhandeling?",
      "isActive": true,
      "options": [
        {
          "id": "option-uuid-1",
          "text": "Prijsbezwaren",
          "voteCount": 12
        },
        {
          "id": "option-uuid-2",
          "text": "Timing bezwaren (uitstel)",
          "voteCount": 8
        },
        {
          "id": "option-uuid-3",
          "text": "Technische bezwaren",
          "voteCount": 5
        },
        {
          "id": "option-uuid-4",
          "text": "Budgetbezwaren",
          "voteCount": 15
        }
      ],
      "totalVotes": 40,
      "userVoted": false,
      "userVoteOptionId": null
    }
  ]
}
```

---

### POST `/api/live/polls/:pollId/vote`
Stem op een poll optie

**Request:**
```json
{
  "userId": "user-uuid",
  "optionId": "option-uuid-1"
}
```

**Response:**
```json
{
  "success": true,
  "poll": {
    "id": "poll-uuid-1",
    "question": "Waar loop je het meest tegenaan bij bezwaarhandeling?",
    "options": [
      {
        "id": "option-uuid-1",
        "text": "Prijsbezwaren",
        "voteCount": 13
      }
    ],
    "totalVotes": 41,
    "userVoted": true,
    "userVoteOptionId": "option-uuid-1"
  }
}
```

---

## 🔄 WebSocket Events (Real-time)

### Connection
```javascript
const ws = new WebSocket('wss://api.hugoherbots.ai/live/:sessionId');

ws.onopen = () => {
  console.log('Connected to live session');
};
```

### Server → Client Events

#### `chat:message`
Nieuw chat bericht ontvangen
```json
{
  "type": "chat:message",
  "data": {
    "id": "msg-uuid",
    "userId": "user-uuid",
    "userName": "Sarah van Dijk",
    "userInitials": "SV",
    "message": "Geweldige tip!",
    "isHost": false,
    "createdAt": "2025-01-15T14:10:00Z"
  }
}
```

#### `poll:update`
Poll vote count update
```json
{
  "type": "poll:update",
  "data": {
    "pollId": "poll-uuid",
    "optionId": "option-uuid-1",
    "voteCount": 14,
    "totalVotes": 42
  }
}
```

#### `session:status`
Sessie status update (bijv. van upcoming → live)
```json
{
  "type": "session:status",
  "data": {
    "sessionId": "session-uuid",
    "status": "live",
    "viewerCount": 127
  }
}
```

#### `viewer:count`
Viewer count update
```json
{
  "type": "viewer:count",
  "data": {
    "sessionId": "session-uuid",
    "viewerCount": 132
  }
}
```

### Client → Server Events

#### Send chat message
```json
{
  "type": "chat:send",
  "data": {
    "message": "Geweldige sessie!"
  }
}
```

#### Vote on poll
```json
{
  "type": "poll:vote",
  "data": {
    "pollId": "poll-uuid",
    "optionId": "option-uuid-1"
  }
}
```

---

## 📅 Calendar Export (.ics)

### Frontend implementatie
```typescript
function downloadCalendarEvent(session: Session) {
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
}

function formatICSDate(date: Date): string {
  return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
}
```

### Backend endpoint (optional)
Als je de .ics server-side wil genereren:

**GET** `/api/live/sessions/:sessionId/calendar`

**Response Headers:**
```
Content-Type: text/calendar
Content-Disposition: attachment; filename="live-coaching-session.ics"
```

**Response Body:**
```
BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//HugoHerbots.ai//Live Coaching//NL
CALSCALE:GREGORIAN
METHOD:PUBLISH
BEGIN:VEVENT
DTSTART:20250122T140000Z
DTEND:20250122T150000Z
SUMMARY:Live Q&A: Discovery Technieken
DESCRIPTION:Live coaching sessie met Hugo Herbots - Fase 2: Ontdekkingsfase
LOCATION:HugoHerbots.ai Live Coaching
UID:session-uuid@hugoherbots.ai
STATUS:CONFIRMED
SEQUENCE:0
END:VEVENT
END:VCALENDAR
```

---

## 🎨 Design Tokens

### Status Colors
```css
/* Live status */
--live-badge-bg: hsl(0, 84%, 60%);        /* Destructive red */
--live-badge-text: hsl(0, 0%, 100%);      /* White */
--live-badge-border: hsl(0, 84%, 60%);

/* Upcoming status */
--upcoming-badge-bg: hsl(217, 33%, 97%);  /* Light gray */
--upcoming-badge-text: hsl(215, 25%, 27%);/* Dark text */
--upcoming-badge-border: hsl(0, 0%, 90%); /* Border */

/* Host badge */
--host-badge-bg: hsl(215, 28%, 40%);      /* Slate gray primary */
--host-badge-text: hsl(0, 0%, 100%);      /* White */
```

### Phase Colors
```css
/* Phase badges */
--phase-1-bg: hsl(215, 33%, 97%);         /* Voorbereiding */
--phase-2-bg: hsl(142, 100%, 38%, 0.1);   /* Ontdekking (success/10) */
--phase-3-bg: hsl(38, 100%, 56%, 0.1);    /* Aanbeveling (warn/10) */
--phase-4-bg: hsl(215, 28%, 40%, 0.1);    /* Beslissing (primary/10) */
```

### Card Styling
```css
--card-radius: 16px;
--card-shadow-sm: 0 1px 2px 0 rgb(0 0 0 / 0.05);
--card-shadow-md: 0 4px 6px -1px rgb(0 0 0 / 0.1);
--card-border: hsl(0, 0%, 90%);
```

---

## 📱 Responsive Breakpoints

```css
/* Mobile first */
--mobile: 0px;           /* 1 column */
--tablet: 640px;         /* sm: 2 columns */
--desktop: 1024px;       /* lg: 3 columns */
```

### Grid Layout
```tsx
// Upcoming sessions grid
<div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
  {sessions.map(session => <SessionCard {...session} />)}
</div>
```

---

## 🧩 Component Structure

### LiveCoaching.tsx (Main page)
- AppLayout wrapper
- Header met "LIVE NU" badge
- Tabs: Live Stream / Chat / Polls
- Upcoming sessions grid
- Past sessions list

### SessionCard.tsx (Reusable component)
```tsx
interface SessionCardProps {
  id: string;
  title: string;
  date: string;
  time: string;
  duration: string;
  topic: string;
  status: 'upcoming' | 'live' | 'ended';
  viewerCount?: number;
  onAddToCalendar: () => void;
  onSetReminder: () => void;
}
```

### ChatPanel.tsx
- ScrollArea met chat berichten
- Message input met send button
- Auto-scroll naar nieuwste bericht
- Host badge voor Hugo's berichten

### PollPanel.tsx
- Poll vraag
- Poll opties met vote counts
- Progress bars voor vote percentages
- Vote button (disabled na stemmen)

---

## 🔒 Permissions & Security

### Chat moderation
- Rate limiting: Max 5 berichten per minuut per user
- Spam filtering: Filter op banned words
- Host privileges: Alleen Hugo kan polls aanmaken
- Message max length: 500 characters

### Poll voting
- One vote per user per poll (database constraint)
- Poll alleen actief tijdens live sessie
- Results altijd zichtbaar (geen verborgen polls)

### Session access
- Live sessies toegankelijk voor alle users met actief abonnement
- Opnames toegankelijk voor Pro & Team tier
- Reminder functie alleen voor ingelogde users

---

## 📊 Analytics Events

Track deze events voor analytics:

```typescript
// Session join
analytics.track('live_session_joined', {
  sessionId: 'session-uuid',
  sessionTitle: 'Live Q&A: Discovery Technieken',
  userTier: 'pro'
});

// Chat message sent
analytics.track('live_chat_sent', {
  sessionId: 'session-uuid',
  messageLength: 45
});

// Poll vote
analytics.track('live_poll_voted', {
  sessionId: 'session-uuid',
  pollId: 'poll-uuid',
  optionId: 'option-uuid'
});

// Calendar export
analytics.track('live_session_calendar_export', {
  sessionId: 'session-uuid',
  sessionDate: '2025-01-22'
});

// Reminder set
analytics.track('live_session_reminder_set', {
  sessionId: 'session-uuid',
  daysUntilSession: 7
});

// Recording watched
analytics.track('live_recording_watched', {
  sessionId: 'session-uuid',
  watchDuration: 1200 // seconds
});
```

---

## 🚀 Implementation Checklist

### Backend
- [ ] Database schema setup (6 tables)
- [ ] REST API endpoints (10 endpoints)
- [ ] WebSocket server voor real-time chat & polls
- [ ] Calendar .ics generation
- [ ] Reminder email scheduling (24h voor sessie)
- [ ] Recording upload & storage (na live sessie)
- [ ] Chat moderation & spam filtering
- [ ] Poll vote validation (one per user)
- [ ] Session status automation (upcoming → live → ended)

### Frontend
- [ ] LiveCoaching page met tabs (Stream / Chat / Polls)
- [ ] Upcoming sessions grid met calendar export
- [ ] Real-time chat met WebSocket
- [ ] Live polls met vote functionality
- [ ] Past sessions met recording playback
- [ ] Reminder button & notification system
- [ ] Responsive design (mobile/tablet/desktop)
- [ ] Loading states & error handling

### Testing
- [ ] WebSocket connection stability
- [ ] Chat message delivery (< 1s latency)
- [ ] Poll vote synchronization
- [ ] Calendar .ics download in verschillende apps
- [ ] Reminder email delivery
- [ ] Recording playback performance
- [ ] Concurrent user testing (100+ viewers)

---

## 📝 Example Data

Zie `mock-data.json` voor volledige example dataset met:
- 5 upcoming sessions
- 3 past sessions
- 20 chat messages
- 2 active polls
- Session metadata

---

## 🎥 Video Streaming

### Recommended approach
Voor livestreaming kun je gebruiken:

1. **YouTube Live** (easiest)
   - Embed YouTube livestream iframe
   - Free, schaalbaar, betrouwbaar
   - Chat functie kan je custom bouwen

2. **Vimeo Live** (professional)
   - Betaalde optie met betere controle
   - Custom player branding
   - Better analytics

3. **Custom WebRTC** (advanced)
   - Volledige controle
   - Requires significant backend infrastructure
   - Tools: Janus, Jitsi, Mediasoup

### Simple YouTube embed
```tsx
<div className="relative w-full" style={{ aspectRatio: "16/9" }}>
  <iframe
    src="https://www.youtube.com/embed/LIVE_VIDEO_ID?autoplay=1"
    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
    allowFullScreen
    className="absolute inset-0 w-full h-full border-0 rounded-lg"
  />
</div>
```

---

## 📞 Support

Voor vragen over deze handoff:
- Zie `/components/HH/LiveCoaching.tsx` voor frontend referentie
- Zie `/components/HH/Dashboard.tsx` voor "Opkomende Live Coaching" sectie
- Check design system in `/Guidelines.md`

**Veel succes met de backend implementatie!** 🚀
