# Live Coaching - Implementation Guide (Replit)

Step-by-step guide voor het implementeren van Live Coaching backend in Replit.

---

## 🚀 Quick Start

### 1. Setup Database (PostgreSQL)

```sql
-- Run this in your Replit PostgreSQL console

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create tables
CREATE TABLE live_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title VARCHAR(255) NOT NULL,
  description TEXT,
  scheduled_date TIMESTAMP NOT NULL,
  duration_minutes INTEGER DEFAULT 60,
  topic VARCHAR(255),
  phase_id INTEGER CHECK (phase_id BETWEEN 1 AND 4),
  status VARCHAR(20) DEFAULT 'upcoming' CHECK (status IN ('upcoming', 'live', 'ended')),
  video_url TEXT,
  thumbnail_url TEXT,
  viewer_count INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE live_chat_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID REFERENCES live_sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  message TEXT NOT NULL CHECK (LENGTH(message) <= 500),
  is_host BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE live_polls (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID REFERENCES live_sessions(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE live_poll_options (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  poll_id UUID REFERENCES live_polls(id) ON DELETE CASCADE,
  option_text VARCHAR(255) NOT NULL,
  vote_count INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE live_poll_votes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  poll_id UUID REFERENCES live_polls(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  option_id UUID REFERENCES live_poll_options(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(poll_id, user_id)
);

CREATE TABLE live_session_reminders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID REFERENCES live_sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(session_id, user_id)
);

-- Create indexes for performance
CREATE INDEX idx_live_sessions_status ON live_sessions(status);
CREATE INDEX idx_live_sessions_scheduled ON live_sessions(scheduled_date);
CREATE INDEX idx_chat_messages_session ON live_chat_messages(session_id);
CREATE INDEX idx_chat_messages_created ON live_chat_messages(created_at);
CREATE INDEX idx_poll_votes_poll_user ON live_poll_votes(poll_id, user_id);
CREATE INDEX idx_reminders_user ON live_session_reminders(user_id);

-- Insert sample data
INSERT INTO live_sessions (title, description, scheduled_date, duration_minutes, topic, phase_id, status, thumbnail_url)
VALUES
  ('Live Q&A: Discovery Technieken', 'Leer de E.P.I.C. methode voor ontdekkingsgesprekken', '2025-01-22 14:00:00', 60, 'Fase 2 • Ontdekkingsfase', 2, 'upcoming', 'https://images.unsplash.com/photo-1552664730-d307ca884978?w=800'),
  ('Live Coaching: Closing Mastery', 'Masterclass in afsluittechnieken', '2025-01-29 14:00:00', 60, 'Fase 4 • Afsluittechnieken', 4, 'upcoming', 'https://images.unsplash.com/photo-1531482615713-2afd69097998?w=800'),
  ('Live Coaching: Value Selling', 'Hoe verkoop je waarde in plaats van features', '2025-02-05 14:00:00', 60, 'Fase 3 • Aanbevelingsfase', 3, 'upcoming', 'https://images.unsplash.com/photo-1542744173-8e7e53415bb0?w=800');
```

---

## 📦 Backend Setup (Node.js + Express)

### 2. Install Dependencies

```bash
npm install express pg ws ics dotenv cors helmet express-rate-limit
```

### 3. Project Structure

```
/replit-live-coaching
├── server.js              # Main server file
├── routes/
│   ├── sessions.js        # Session endpoints
│   ├── chat.js            # Chat endpoints
│   ├── polls.js           # Poll endpoints
│   └── calendar.js        # Calendar export
├── websocket/
│   └── handler.js         # WebSocket logic
├── db/
│   └── queries.js         # Database queries
├── middleware/
│   ├── auth.js            # JWT authentication
│   └── ratelimit.js       # Rate limiting
├── utils/
│   └── ics.js             # ICS file generator
└── .env                   # Environment variables
```

---

## 🔧 Environment Variables (.env)

```env
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/hugoherbots

# Server
PORT=3000
NODE_ENV=production

# JWT
JWT_SECRET=your-secret-key-here

# WebSocket
WS_PORT=3001

# CORS
ALLOWED_ORIGINS=https://app.hugoherbots.ai,http://localhost:5173

# Rate Limiting
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=60
CHAT_RATE_LIMIT_MAX=5
```

---

## 🛠️ Core Files

### server.js

```javascript
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const WebSocket = require('ws');
require('dotenv').config();

const sessionsRouter = require('./routes/sessions');
const chatRouter = require('./routes/chat');
const pollsRouter = require('./routes/polls');
const calendarRouter = require('./routes/calendar');
const { handleWebSocket } = require('./websocket/handler');
const { authenticate } = require('./middleware/auth');

const app = express();
const PORT = process.env.PORT || 3000;
const WS_PORT = process.env.WS_PORT || 3001;

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS.split(',')
}));
app.use(express.json());
app.use(authenticate); // JWT auth on all routes

// Routes
app.use('/api/live/sessions', sessionsRouter);
app.use('/api/live/sessions', chatRouter);
app.use('/api/live/polls', pollsRouter);
app.use('/api/live/sessions', calendarRouter);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Start HTTP server
app.listen(PORT, () => {
  console.log(`✅ HTTP server running on port ${PORT}`);
});

// WebSocket server
const wss = new WebSocket.Server({ port: WS_PORT });
handleWebSocket(wss);

console.log(`✅ WebSocket server running on port ${WS_PORT}`);
```

---

### routes/sessions.js

```javascript
const express = require('express');
const router = express.Router();
const { pool } = require('../db/queries');

// GET /api/live/sessions
router.get('/', async (req, res) => {
  try {
    const { status, limit = 10 } = req.query;
    
    let query = 'SELECT * FROM live_sessions';
    const params = [];
    
    if (status) {
      query += ' WHERE status = $1';
      params.push(status);
    }
    
    query += ' ORDER BY scheduled_date ASC LIMIT $' + (params.length + 1);
    params.push(limit);
    
    const result = await pool.query(query, params);
    
    res.json({
      sessions: result.rows.map(row => ({
        id: row.id,
        title: row.title,
        description: row.description,
        scheduledDate: row.scheduled_date,
        duration: row.duration_minutes,
        topic: row.topic,
        phaseId: row.phase_id,
        status: row.status,
        videoUrl: row.video_url,
        thumbnailUrl: row.thumbnail_url,
        viewerCount: row.viewer_count,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      }))
    });
  } catch (error) {
    console.error('Error fetching sessions:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/live/sessions/:sessionId
router.get('/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const userId = req.user.id; // From JWT middleware
    
    // Get session
    const sessionResult = await pool.query(
      'SELECT * FROM live_sessions WHERE id = $1',
      [sessionId]
    );
    
    if (sessionResult.rows.length === 0) {
      return res.status(404).json({ error: 'Session not found' });
    }
    
    const session = sessionResult.rows[0];
    
    // Check if user has reminder
    const reminderResult = await pool.query(
      'SELECT id FROM live_session_reminders WHERE session_id = $1 AND user_id = $2',
      [sessionId, userId]
    );
    
    res.json({
      id: session.id,
      title: session.title,
      description: session.description,
      scheduledDate: session.scheduled_date,
      duration: session.duration_minutes,
      topic: session.topic,
      phaseId: session.phase_id,
      status: session.status,
      videoUrl: session.video_url,
      thumbnailUrl: session.thumbnail_url,
      viewerCount: session.viewer_count,
      hasReminder: reminderResult.rows.length > 0,
      createdAt: session.created_at,
      updatedAt: session.updated_at
    });
  } catch (error) {
    console.error('Error fetching session:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/live/sessions/:sessionId/reminder
router.post('/:sessionId/reminder', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const userId = req.user.id;
    
    // Check if reminder already exists
    const existingReminder = await pool.query(
      'SELECT id FROM live_session_reminders WHERE session_id = $1 AND user_id = $2',
      [sessionId, userId]
    );
    
    if (existingReminder.rows.length > 0) {
      return res.status(409).json({
        error: 'ReminderAlreadyExists',
        message: 'Je hebt al een reminder voor deze sessie'
      });
    }
    
    // Create reminder
    const result = await pool.query(
      'INSERT INTO live_session_reminders (session_id, user_id) VALUES ($1, $2) RETURNING id',
      [sessionId, userId]
    );
    
    res.status(201).json({
      success: true,
      reminderId: result.rows[0].id
    });
  } catch (error) {
    console.error('Error creating reminder:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/live/sessions/:sessionId/reminder
router.delete('/:sessionId/reminder', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const userId = req.user.id;
    
    await pool.query(
      'DELETE FROM live_session_reminders WHERE session_id = $1 AND user_id = $2',
      [sessionId, userId]
    );
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting reminder:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
```

---

### routes/chat.js

```javascript
const express = require('express');
const router = express.Router();
const { pool } = require('../db/queries');
const rateLimit = require('express-rate-limit');

const chatLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 5,
  message: {
    error: 'RateLimitExceeded',
    message: 'Maximum 5 berichten per minuut. Probeer het over 30 seconden opnieuw.'
  }
});

// GET /api/live/sessions/:sessionId/chat
router.get('/:sessionId/chat', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { limit = 50, before } = req.query;
    
    let query = `
      SELECT cm.*, u.name as user_name, u.initials as user_initials
      FROM live_chat_messages cm
      LEFT JOIN users u ON cm.user_id = u.id
      WHERE cm.session_id = $1
    `;
    const params = [sessionId];
    
    if (before) {
      query += ' AND cm.created_at < $2';
      params.push(before);
    }
    
    query += ' ORDER BY cm.created_at DESC LIMIT $' + (params.length + 1);
    params.push(limit);
    
    const result = await pool.query(query, params);
    
    res.json({
      messages: result.rows.map(row => ({
        id: row.id,
        sessionId: row.session_id,
        userId: row.user_id,
        userName: row.user_name,
        userInitials: row.user_initials,
        message: row.message,
        isHost: row.is_host,
        createdAt: row.created_at
      })).reverse(),
      hasMore: result.rows.length === parseInt(limit)
    });
  } catch (error) {
    console.error('Error fetching chat:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/live/sessions/:sessionId/chat
router.post('/:sessionId/chat', chatLimiter, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { message } = req.body;
    const userId = req.user.id;
    
    if (!message || message.trim().length === 0) {
      return res.status(400).json({ error: 'Message is required' });
    }
    
    if (message.length > 500) {
      return res.status(400).json({
        error: 'MessageTooLong',
        message: 'Bericht mag maximaal 500 karakters zijn'
      });
    }
    
    const result = await pool.query(
      `INSERT INTO live_chat_messages (session_id, user_id, message)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [sessionId, userId, message.trim()]
    );
    
    const newMessage = result.rows[0];
    
    // Get user info
    const userResult = await pool.query(
      'SELECT name, initials FROM users WHERE id = $1',
      [userId]
    );
    
    const user = userResult.rows[0];
    
    const response = {
      id: newMessage.id,
      sessionId: newMessage.session_id,
      userId: newMessage.user_id,
      userName: user.name,
      userInitials: user.initials,
      message: newMessage.message,
      isHost: newMessage.is_host,
      createdAt: newMessage.created_at
    };
    
    // Broadcast to WebSocket clients
    // (handled by WebSocket server)
    
    res.status(201).json(response);
  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
```

---

### websocket/handler.js

```javascript
const { pool } = require('../db/queries');

const sessions = new Map(); // sessionId -> Set of WebSocket clients

function handleWebSocket(wss) {
  wss.on('connection', (ws, req) => {
    // Extract sessionId and token from URL
    const url = new URL(req.url, 'ws://localhost');
    const sessionId = url.pathname.split('/').pop();
    const token = url.searchParams.get('token');
    
    // TODO: Verify JWT token
    
    // Add client to session
    if (!sessions.has(sessionId)) {
      sessions.set(sessionId, new Set());
    }
    sessions.get(sessionId).add(ws);
    
    console.log(`Client connected to session ${sessionId}`);
    
    // Send welcome message
    ws.send(JSON.stringify({
      type: 'connected',
      data: { sessionId }
    }));
    
    // Handle incoming messages
    ws.on('message', async (message) => {
      try {
        const data = JSON.parse(message);
        
        if (data.type === 'chat:send') {
          // Broadcast chat message to all clients in session
          broadcast(sessionId, {
            type: 'chat:message',
            data: {
              // ... message data
            }
          });
        }
        
        if (data.type === 'poll:vote') {
          // Update poll vote count
          const { pollId, optionId } = data.data;
          
          // Update database
          await pool.query(
            'UPDATE live_poll_options SET vote_count = vote_count + 1 WHERE id = $1',
            [optionId]
          );
          
          // Broadcast update
          broadcast(sessionId, {
            type: 'poll:update',
            data: {
              pollId,
              optionId,
              // ... updated counts
            }
          });
        }
      } catch (error) {
        console.error('WebSocket message error:', error);
      }
    });
    
    // Handle disconnect
    ws.on('close', () => {
      if (sessions.has(sessionId)) {
        sessions.get(sessionId).delete(ws);
        if (sessions.get(sessionId).size === 0) {
          sessions.delete(sessionId);
        }
      }
      console.log(`Client disconnected from session ${sessionId}`);
    });
  });
}

function broadcast(sessionId, message) {
  if (sessions.has(sessionId)) {
    const clients = sessions.get(sessionId);
    const messageStr = JSON.stringify(message);
    
    clients.forEach(client => {
      if (client.readyState === 1) { // WebSocket.OPEN
        client.send(messageStr);
      }
    });
  }
}

module.exports = { handleWebSocket, broadcast };
```

---

## ✅ Testing Checklist

- [ ] Database setup werkt
- [ ] GET /api/live/sessions returns data
- [ ] POST /reminder creates reminder
- [ ] Chat messages worden opgeslagen
- [ ] WebSocket connects successfully
- [ ] Real-time chat broadcasting werkt
- [ ] Poll votes update live
- [ ] Rate limiting werkt (max 5 chat/min)
- [ ] Calendar .ics download werkt
- [ ] Error handling werkt correct

---

## 🔒 Security

1. **JWT Authentication**: Verify token on all endpoints
2. **Rate Limiting**: Prevent spam (5 msg/min chat)
3. **Input Validation**: Sanitize all user input
4. **SQL Injection**: Use parameterized queries
5. **CORS**: Whitelist allowed origins
6. **Message Length**: Max 500 chars
7. **WebSocket Auth**: Verify token on connect

---

## 📊 Monitoring

Log deze metrics:
- Active WebSocket connections
- Messages per minute
- Database query performance
- Error rates
- Viewer counts per session

---

Veel succes! 🚀
