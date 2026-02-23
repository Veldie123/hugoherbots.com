# Rollenspel Training - Backend Implementatie Briefing

## Executive Summary

De **Rollenspel Training** is de kernfunctionaliteit van HugoHerbots.ai waar B2B salespeople live oefenen met Hugo's AI avatar. Het systeem combineert:

- **HeyGen Streaming API** voor real-time avatar conversaties
- **OpenAI GPT-4** voor conversatie-analyse en feedback
- **Hugo's 4-fasen methodologie** (20 technieken) als structured framework
- **Real-time progress tracking** via WebSockets
- **Firebase/PostgreSQL** voor session persistence

## Business Context

**Probleem:**
Traditionele salestraining kost €2.000 per halve dag en is niet schaalbaar. Hugo Herbots heeft 40 jaar training gegeven aan 20.000+ mensen, maar wil zijn kennis nu democratiseren via AI.

**Oplossing:**
Een AI-avatar coach waar users 24/7 mee kunnen oefenen, met instant feedback volgens Hugo's bewezen methodologie.

**USP:**
- Live conversatie (niet pre-recorded)
- Structured feedback op 20 specifieke technieken
- Progress tracking door 4 fasen
- Fractievolle prijs (€149/mnd vs €2.000 live)

---

## Technical Architecture

### High-Level Flow
```
┌─────────────┐
│   Frontend  │  React + HeyGen iframe
│  (RolePlay) │  WebSocket client
└──────┬──────┘
       │
       ↓ HTTP/WS
┌─────────────┐
│   Backend   │  Node.js / Python
│   Server    │  WebSocket server
└──────┬──────┘
       │
       ├──→ HeyGen API (avatar streaming)
       ├──→ OpenAI API (transcript analysis)
       └──→ Database (session storage)
```

### Component Responsibilities

**Frontend (React):**
- User interface & state management
- HeyGen iframe embedding & controls
- Sales flow sidebar visualization
- Results modal rendering
- WebSocket client voor real-time updates

**Backend API:**
- HeyGen session management (start/stop)
- Transcript logging & storage
- OpenAI analysis orchestration
- Progress calculation & step transitions
- WebSocket event broadcasting

**HeyGen:**
- Avatar video streaming
- Speech-to-text (user audio → text)
- Text-to-speech (AI response → avatar audio)
- Real-time conversation handling

**OpenAI:**
- Transcript analysis
- Technique detection
- Scoring & feedback generation
- Next-step suggestions

**Database:**
- Session persistence
- Transcript storage
- Feedback history
- User progress tracking

---

## Hugo's 4-Fasen Methodologie

Dit is de kern van het systeem. Elke fase heeft specifieke technieken die gebruikers moeten beheersen:

### Fase 1: Openingsfase (4 stappen)
**Doel:** Koopklimaat creëren en vertrouwen opbouwen

| ID   | Techniek                          | Duur  | Verplicht |
|------|-----------------------------------|-------|-----------|
| 1.1  | Koopklimaat creëren               | 2 min | ✓         |
| 1.2  | Gentleman's agreement             | 1 min | ✓         |
| 1.3  | Firmavoorstelling + reference     | 2 min | ✓         |
| 1.4  | Instapvraag                       | 1 min | ✓         |

### Fase 2: Ontdekkingsfase (8 stappen)
**Doel:** Klantbehoeften, wensen en bezwaren in kaart brengen

**Thema's om te bespreken:** Bron, Motivatie, Ervaring, Verwachtingen, Alternatieven, Budget, Timing, Beslissingscriteria

| ID    | Techniek                                     | Duur  |
|-------|----------------------------------------------|-------|
| 2.1.1 | Feitgerichte vragen                          | 3 min |
| 2.1.2 | Meningsgerichte vragen (open vragen)         | 3 min |
| 2.1.3 | Feitgerichte vragen onder alternatieve vorm  | 2 min |
| 2.1.4 | Ter zijde schuiven                           | 2 min |
| 2.1.5 | Pingpong techniek                            | 2 min |
| 2.1.6 | Actief en empathisch luisteren               | 3 min |
| 2.1.7 | LEAD questioning (storytelling)              | 4 min |
| 2.1.8 | Lock questioning                             | 2 min |

### Fase 3: Aanbevelingsfase (5 stappen)
**Doel:** Oplossing koppelen aan klantbehoeften

**Thema's:** USP's

| ID  | Techniek                                         | Duur  |
|-----|--------------------------------------------------|-------|
| 3.1 | Empathie tonen                                   | 2 min |
| 3.2 | Oplossing                                        | 3 min |
| 3.3 | Voordeel                                         | 2 min |
| 3.4 | Baat                                             | 2 min |
| 3.5 | Mening vragen / standpunt onder alternatieve vorm| 2 min |

### Fase 4: Beslissingsfase (6 stappen)
**Doel:** Deal sluiten en bezwaren neutraliseren

**Thema's:** Beslissing

| ID    | Techniek                  | Duur  | Status  |
|-------|---------------------------|-------|---------|
| 4.1   | Proefafsluiting           | 2 min | Locked* |
| 4.2.1 | Klant stelt vragen        | 3 min | Locked  |
| 4.2.2 | Twijfels                  | 3 min | Locked  |
| 4.2.3 | Poging tot uitstel        | 2 min | Locked  |
| 4.2.4 | Bezwaren                  | 4 min | Locked  |
| 4.2.5 | Angst / Bezorgdheden      | 3 min | Locked  |

*Locked = alleen toegankelijk na completion van vorige fasen

---

## API Endpoints Specification

### Session Management

#### POST /api/roleplay/sessions/start
**Request:**
```json
{
  "userId": "uuid",
  "scenarioId": "uuid",
  "startPhaseId": 1,
  "startStepId": "1.1"
}
```

**Response:**
```json
{
  "sessionId": "uuid",
  "heygenSessionId": "heygen-uuid",
  "heygenSdpOffer": "...",
  "currentPhaseId": 1,
  "currentStepId": "1.1",
  "status": "recording"
}
```

**Business Logic:**
1. Create session record in database
2. Initialize HeyGen streaming session
3. Return session ID + HeyGen credentials
4. Set initial phase/step based on user's progress

---

#### POST /api/roleplay/sessions/:sessionId/stop
**Request:**
```json
{
  "sessionId": "uuid"
}
```

**Response:**
```json
{
  "sessionId": "uuid",
  "status": "completed",
  "duration": 734, // seconds
  "stepsCompleted": ["1.1", "1.2", "1.3"],
  "feedbackQueued": true
}
```

**Business Logic:**
1. Stop HeyGen session
2. Mark session as completed
3. Calculate duration
4. Queue OpenAI analysis (async)
5. Return session summary

---

#### GET /api/roleplay/sessions/:sessionId/status
**Response:**
```json
{
  "sessionId": "uuid",
  "status": "recording",
  "currentPhaseId": 2,
  "currentStepId": "2.1.3",
  "duration": 425,
  "transcriptLength": 47
}
```

---

### Transcript Management

#### POST /api/roleplay/sessions/:sessionId/transcript
**Request:**
```json
{
  "speaker": "user", // or "hugo"
  "message": "Hallo, fijn dat we kunnen spreken.",
  "timestamp": "2025-01-15T14:02:30Z"
}
```

**Response:**
```json
{
  "transcriptId": "uuid",
  "sessionId": "uuid",
  "created": true
}
```

**Business Logic:**
- Log alle user + hugo messages
- Timestamp voor latere analyse
- Check voor real-time hints (optioneel)

---

### Analysis & Feedback

#### POST /api/roleplay/sessions/:sessionId/analyze
**Triggered:** Automatisch bij session stop, of manueel

**Internal Process:**
1. Fetch complete transcript from database
2. Send to OpenAI GPT-4 met Hugo's prompt template
3. Parse structured JSON response
4. Calculate overall score + sub-scores
5. Store feedback in database
6. Broadcast completion via WebSocket

**OpenAI Prompt:**
```
Je bent een sales training AI die rollenspel conversaties analyseert volgens Hugo Herbots' 4-fasen methodologie.

CONTEXT:
- Fase: [current phase name]
- Stap: [current step name]
- Doel van deze stap: [step.doel from TECHNIQUE_DETAILS]

CONVERSATIE TRANSCRIPT:
[complete transcript]

ANALYSEER:
1. Welke technieken zijn correct gebruikt? (noem ID's: 1.1, 2.1.3, etc.)
2. Hoe effectief per techniek? (score 0-100)
3. Wat ging goed? (max 2 concrete voorbeelden)
4. Wat kan beter? (max 2 concrete verbeterpunten)
5. Overall sales effectiveness (0-100)

SCORING CRITERIA:
- Luisteren: Actief luisteren, samenvatten, empathie tonen
- Samenvatten: Lock questioning, terugkoppelen klantbehoeften
- Objections: Bezwaren neutraliseren zonder defensief te worden
- Next Step: Duidelijke vervolgstappen afspreken

OUTPUT (strict JSON):
{
  "overallScore": 84,
  "subScores": {
    "luisteren": 92,
    "samenvatten": 78,
    "objections": 85,
    "nextStep": 81
  },
  "techniquesUsed": ["1.1", "1.2", "2.1.1"],
  "techniqueScores": {
    "1.1": 95,
    "1.2": 88,
    "2.1.1": 82
  },
  "highlights": [
    { 
      "type": "good", 
      "text": "Je erkende het bezwaar eerst zonder direct te verdedigen. Dat schept vertrouwen." 
    },
    { 
      "type": "warning", 
      "text": "Je noemde features, niet de waarde voor hen. Focus op hun outcome, niet je product." 
    }
  ],
  "advice": "Oefen nog 2x deze week met budget bezwaren. Focus op waarde, niet features. People buy people — maar ze kopen ook resultaten.",
  "nextStepSuggestion": "2.1.4"
}
```

---

#### GET /api/roleplay/sessions/:sessionId/feedback
**Response:**
```json
{
  "sessionId": "uuid",
  "overallScore": 84,
  "delta": 7, // vs previous session
  "subScores": {
    "luisteren": 92,
    "samenvatten": 78,
    "objections": 85,
    "nextStep": 81
  },
  "highlights": [
    { "type": "good", "text": "..." },
    { "type": "warning", "text": "..." }
  ],
  "advice": "Oefen nog 2x deze week...",
  "techniquesUsed": ["1.1", "1.2", "2.1.1"],
  "sessionDuration": "12:34",
  "completedAt": "2025-01-15T14:15:00Z",
  "comparedToPrevious": {
    "overallScore": { "previous": 77, "current": 84, "delta": 7 },
    "luisteren": { "previous": 85, "current": 92, "delta": 7 }
  }
}
```

---

### Progress Tracking

#### GET /api/roleplay/users/:userId/progress
**Response:**
```json
{
  "userId": "uuid",
  "totalSessions": 23,
  "averageScore": 78,
  "currentPhase": 2,
  "currentStep": "2.1.3",
  "unlockedPhases": [1, 2],
  "stepProgress": {
    "1.1": { "status": "completed", "attempts": 3, "bestScore": 95 },
    "1.2": { "status": "completed", "attempts": 2, "bestScore": 88 },
    "2.1.3": { "status": "current", "attempts": 1, "bestScore": 82 },
    "4.1": { "status": "locked" }
  },
  "lastSessionAt": "2025-01-15T14:15:00Z"
}
```

**Business Logic:**
- Track completion per stap
- Unlock volgende stap/fase wanneer criteria voldaan
- Calculate best score per stap (over alle attempts)

---

## WebSocket Events

### Client → Server

**Join session:**
```javascript
socket.emit('session:join', { sessionId, userId });
```

**Heartbeat (keep-alive):**
```javascript
socket.emit('session:heartbeat', { sessionId });
```

**Manual step completion:**
```javascript
socket.emit('step:complete', { sessionId, stepId });
```

---

### Server → Client

**Step updated:**
```javascript
socket.on('step:updated', (data) => {
  // data = { sessionId, currentStepId, previousStepId, status }
  // Update sidebar highlight
});
```

**Phase completed:**
```javascript
socket.on('phase:completed', (data) => {
  // data = { sessionId, phaseId, nextPhaseId, unlockedSteps }
  // Show confetti animation
  // Update sidebar to show next phase unlocked
});
```

**Feedback ready:**
```javascript
socket.on('feedback:ready', (data) => {
  // data = { sessionId, overallScore }
  // Trigger results modal
});
```

**Real-time hint:**
```javascript
socket.on('hint:show', (data) => {
  // data = { stepId, hintText, type: "tip" | "warning" }
  // Show in Tips Panel tijdens sessie
});
```

---

## HeyGen Integration Details

### Initialization Flow

1. **Backend creates session:**
```javascript
const response = await fetch('https://api.heygen.com/v1/streaming.new', {
  method: 'POST',
  headers: {
    'X-Api-Key': process.env.HEYGEN_API_KEY,
  },
  body: JSON.stringify({
    avatar_id: process.env.HEYGEN_AVATAR_ID, // Hugo's avatar
    quality: 'high',
    voice: {
      voice_id: process.env.HEYGEN_VOICE_ID,
      rate: 1.0, // speaking rate
    },
    knowledge_base_id: process.env.HEYGEN_KB_ID, // Hugo's training data
  })
});

const { session_id, sdp_offer, access_token } = await response.json();
```

2. **Frontend initializes iframe:**
```tsx
const heygenUrl = `https://labs.heygen.com/guest/streaming-embed?
  session_id=${sessionId}
  &access_token=${accessToken}
  &quality=high
  &inIFrame=1`;

<iframe src={heygenUrl} allow="microphone *; camera *; autoplay *" />
```

3. **Listen for HeyGen events:**
```javascript
window.addEventListener('message', (e) => {
  if (e.origin === 'https://labs.heygen.com') {
    if (e.data.type === 'streaming-embed') {
      switch (e.data.action) {
        case 'ready':
          // Avatar loaded, can start conversation
          break;
        case 'message':
          // Hugo spoke, transcript available
          logTranscript('hugo', e.data.text);
          break;
        case 'user_spoke':
          // User spoke, transcript available
          logTranscript('user', e.data.text);
          break;
      }
    }
  }
});
```

### Knowledge Base Setup

Hugo's avatar moet getraind worden op:
- Zijn 4-fasen methodologie
- Typische klant bezwaren
- Sales scenarios (SaaS, Enterprise, etc.)
- Tone of voice: direct, warm, 40 jaar ervaring

**Training Data Format (HeyGen KB):**
```
Q: Hoe ga je om met prijsbezwaren?
A: Goed dat je dat vraagt. Mensen kopen geen prijs, ze kopen waarde. Eerst moet je begrijpen waarom prijs een issue is. Vraag: "Wat is voor jou de belangrijkste factor naast prijs?" Dan kun je de waarde koppelen aan hun prioriteit.

Q: Wanneer moet ik proefafsluiten?
A: Als je lock questioning hebt gedaan en de klant bevestigt dat jouw oplossing past bij hun behoeften. Dan vraag je: "Als we dit kunnen realiseren binnen jullie timeline, zou dat interessant zijn?"
```

---

## Database Schema (Complete)

### roleplay_sessions
```sql
CREATE TABLE roleplay_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  scenario_id UUID REFERENCES scenarios(id),
  
  -- Session state
  status VARCHAR(20) NOT NULL DEFAULT 'idle', 
    -- Values: 'idle', 'recording', 'completed', 'abandoned'
  
  -- Progress tracking
  current_phase_id INT NOT NULL DEFAULT 1,
  current_step_id VARCHAR(10) NOT NULL DEFAULT '1.1',
  
  -- HeyGen integration
  heygen_session_id VARCHAR(255),
  heygen_access_token TEXT,
  
  -- Timing
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  duration_seconds INT,
  
  -- Scores (set after analysis)
  overall_score INT CHECK (overall_score >= 0 AND overall_score <= 100),
  
  -- Metadata
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  INDEX idx_user_sessions (user_id, created_at DESC),
  INDEX idx_status (status),
  INDEX idx_completed (completed_at DESC)
);
```

### roleplay_step_progress
```sql
CREATE TABLE roleplay_step_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES roleplay_sessions(id) ON DELETE CASCADE,
  
  -- Step identification
  step_id VARCHAR(10) NOT NULL, -- '1.1', '2.1.3', etc.
  phase_id INT NOT NULL,
  
  -- Status
  status VARCHAR(20) NOT NULL DEFAULT 'upcoming',
    -- Values: 'completed', 'current', 'upcoming', 'locked'
  
  -- Timing
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  duration_seconds INT,
  
  -- Scoring (set after AI analysis)
  technique_score INT CHECK (technique_score >= 0 AND technique_score <= 100),
  technique_used BOOLEAN DEFAULT FALSE,
  
  -- Feedback
  feedback TEXT,
  
  created_at TIMESTAMP DEFAULT NOW(),
  
  INDEX idx_session_steps (session_id, step_id),
  UNIQUE (session_id, step_id)
);
```

### roleplay_transcripts
```sql
CREATE TABLE roleplay_transcripts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES roleplay_sessions(id) ON DELETE CASCADE,
  
  -- Message details
  speaker VARCHAR(10) NOT NULL, -- 'user' or 'hugo'
  message TEXT NOT NULL,
  
  -- Timing
  timestamp TIMESTAMP NOT NULL DEFAULT NOW(),
  sequence_number INT NOT NULL, -- Order of messages
  
  -- Metadata
  duration_ms INT, -- How long user/hugo spoke
  confidence FLOAT, -- STT confidence (0-1)
  
  created_at TIMESTAMP DEFAULT NOW(),
  
  INDEX idx_session_transcript (session_id, sequence_number),
  INDEX idx_timestamp (timestamp)
);
```

### roleplay_feedback
```sql
CREATE TABLE roleplay_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES roleplay_sessions(id) ON DELETE CASCADE,
  
  -- Overall scores
  overall_score INT NOT NULL CHECK (overall_score >= 0 AND overall_score <= 100),
  
  -- Sub-scores (JSON for flexibility)
  sub_scores JSONB NOT NULL,
    -- Example: { "luisteren": 92, "samenvatten": 78, "objections": 85, "nextStep": 81 }
  
  -- Technique analysis
  techniques_used TEXT[] NOT NULL DEFAULT '{}',
    -- Example: ['1.1', '1.2', '2.1.1']
  
  technique_scores JSONB,
    -- Example: { "1.1": 95, "1.2": 88, "2.1.1": 82 }
  
  -- Feedback content
  highlights JSONB NOT NULL,
    -- Example: [{ "type": "good", "text": "..." }, { "type": "warning", "text": "..." }]
  
  advice TEXT NOT NULL,
  
  -- Next steps suggestion
  next_step_suggestion VARCHAR(10),
  
  -- Comparison to previous
  delta INT, -- Overall score improvement vs previous session
  
  -- AI metadata
  openai_model VARCHAR(50),
  openai_tokens_used INT,
  analysis_duration_ms INT,
  
  created_at TIMESTAMP DEFAULT NOW(),
  
  INDEX idx_session_feedback (session_id),
  UNIQUE (session_id)
);
```

### user_progress
```sql
CREATE TABLE user_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Current position
  current_phase_id INT NOT NULL DEFAULT 1,
  current_step_id VARCHAR(10) NOT NULL DEFAULT '1.1',
  
  -- Unlocked content
  unlocked_phases INT[] NOT NULL DEFAULT '{1}',
  unlocked_steps TEXT[] NOT NULL DEFAULT '{1.1}',
  
  -- Overall stats
  total_sessions INT NOT NULL DEFAULT 0,
  average_score FLOAT,
  best_score INT,
  total_duration_seconds INT NOT NULL DEFAULT 0,
  
  -- Step-level stats (JSON for flexibility)
  step_stats JSONB NOT NULL DEFAULT '{}',
    -- Example: { "1.1": { "attempts": 3, "bestScore": 95, "avgScore": 87 } }
  
  -- Timestamps
  last_session_at TIMESTAMP,
  updated_at TIMESTAMP DEFAULT NOW(),
  
  UNIQUE (user_id),
  INDEX idx_user_progress (user_id)
);
```

---

## Performance Optimization

### Caching Strategy
- **User progress:** Cache in Redis (TTL: 5 min)
- **Technique definitions:** Static, cache indefinitely
- **Session state:** Cache active sessions only

### Database Indexes
- All foreign keys (user_id, session_id)
- Timestamp columns voor time-range queries
- Composite index: (user_id, created_at DESC) voor "recent sessions"

### Async Processing
- **OpenAI analysis:** Queue in background (Celery/Bull)
- **Feedback email:** Delayed job (niet blocking)
- **Transcript storage:** Batch insert elke 10 seconden

---

## Security & Privacy

### Data Retention
- **Transcripts:** 90 dagen, dan archiveren of verwijderen
- **Sessions:** Permanent (alleen metadata)
- **Feedback:** Permanent
- **HeyGen tokens:** 24u expiry, refresh automatisch

### PII Handling
- User messages kunnen sensitive info bevatten
- Encrypt transcripts at rest
- GDPR compliance: right to deletion (cascade delete on user)
- Opt-out: users kunnen transcript storage uitschakelen

### Rate Limiting
- **HeyGen API:** Max 100 sessions/day per user
- **OpenAI API:** Max 50 analyses/hour
- **WebSocket:** Max 1000 events/minute per session

---

## Testing Strategy

### Unit Tests
- OpenAI prompt parsing
- Score calculations
- Step progression logic

### Integration Tests
- HeyGen session lifecycle (start → stop)
- WebSocket event flow
- Database transactions

### E2E Tests
- Complete roleplay session (mock HeyGen)
- Results modal display
- Progress persistence

### Load Testing
- 100 concurrent sessions
- WebSocket scalability
- Database query performance

---

Zie README.md voor setup instructies en component details.
