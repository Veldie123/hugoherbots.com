# Live Coaching Handoff Package - Index

Complete handoff voor **HugoHerbots.ai Live Coaching** functionaliteit.

---

## 📦 Package Contents

### 1. **README.md**
Volledige feature overview en technische specificatie:
- Feature lijst (Live Streaming, Chat, Polls, Sessions, Calendar)
- Database schema (6 tabellen)
- API endpoints (REST + WebSocket)
- Design tokens en styling
- Component structure
- Analytics events
- Implementation checklist

### 2. **types.ts**
TypeScript type definities voor:
- Data models (LiveSession, ChatMessage, Poll, etc.)
- API request/response types
- WebSocket event types
- Frontend component props
- Utility types

### 3. **mock-data.json**
Complete dataset met:
- 5 upcoming sessions
- 1 live session
- 3 past sessions (recordings)
- 15 chat messages
- 2 active polls met votes
- 3 user reminders
- WebSocket event examples

### 4. **api-examples.md**
Praktische API voorbeelden:
- cURL commands voor alle endpoints
- JavaScript fetch examples
- Request/response bodies
- Error responses
- WebSocket connection setup
- Rate limits en testing scripts

### 5. **IMPLEMENTATION.md**
Step-by-step implementatie guide:
- Database setup SQL script
- Node.js backend structuur
- Environment variables
- Core server files (Express + WebSocket)
- Route implementations
- Security checklist
- Testing checklist

### 6. **INDEX.md** (dit bestand)
Overzicht van alle documenten

---

## 🚀 Quick Start

### Voor Backend Development (Replit):

1. **Start met database**
   ```bash
   # Lees: IMPLEMENTATION.md → Section 1
   # Run SQL script in PostgreSQL
   ```

2. **Setup backend**
   ```bash
   # Lees: IMPLEMENTATION.md → Section 2-3
   npm install express pg ws ics dotenv cors helmet express-rate-limit
   ```

3. **Implementeer routes**
   ```bash
   # Kopieer code van: IMPLEMENTATION.md → Section 4
   # /routes/sessions.js
   # /routes/chat.js
   # /websocket/handler.js
   ```

4. **Test API**
   ```bash
   # Gebruik voorbeelden van: api-examples.md
   curl -X GET "http://localhost:3000/api/live/sessions"
   ```

### Voor Frontend Development:

1. **Check types**
   ```typescript
   // Importeer types van: types.ts
   import type { LiveSession, ChatMessage, Poll } from './types';
   ```

2. **Gebruik mock data**
   ```javascript
   // Laad mock data van: mock-data.json
   const sessions = mockData.sessions.upcoming;
   ```

3. **Implementeer API calls**
   ```javascript
   // Volg voorbeelden van: api-examples.md
   const response = await fetch('/api/live/sessions');
   ```

---

## 🎯 Features Overview

| Feature | Frontend | Backend | Status |
|---------|----------|---------|--------|
| **Live Stream** | ✅ UI ready | ⚠️ Video hosting needed | In Progress |
| **Real-time Chat** | ✅ UI ready | ⚠️ WebSocket needed | In Progress |
| **Live Polls** | ✅ UI ready | ⚠️ Vote tracking needed | In Progress |
| **Upcoming Sessions** | ✅ Complete | ⚠️ API needed | In Progress |
| **Calendar Export** | ✅ .ics download | ⚠️ Server generation (optional) | Complete |
| **Session Reminders** | ✅ UI ready | ⚠️ Email scheduling needed | In Progress |
| **Past Recordings** | ✅ UI ready | ⚠️ Video storage needed | In Progress |

---

## 📚 Document Reading Order

Voor **volledige context**:
1. README.md (30 min) - Complete overview
2. types.ts (10 min) - Data structures
3. IMPLEMENTATION.md (20 min) - Backend setup
4. api-examples.md (15 min) - API reference

Voor **quick implementation**:
1. IMPLEMENTATION.md - Stap-voor-stap guide
2. api-examples.md - Copy-paste voorbeelden
3. mock-data.json - Test data

Voor **frontend integration**:
1. types.ts - TypeScript types
2. api-examples.md - API calls
3. mock-data.json - Sample responses

---

## 🔗 Related Files in Main Project

### Frontend Components
- `/components/HH/LiveCoaching.tsx` - Main live coaching page
- `/components/HH/Dashboard.tsx` - "Opkomende Live Coaching" section
- `/components/HH/AppLayout.tsx` - Navigation wrapper

### Design System
- `/Guidelines.md` - Complete design system & brand guidelines
- `/styles/globals.css` - HH design tokens

### Other Handoff Packages
- `/live-coaching-handoff/` - This package (Live Coaching)
- `/roleplay-training-handoff/` - Role-play training features

---

## 🎨 Design Tokens Reference

### Colors
```css
--hh-primary: #6B7A92;       /* Slate Gray - Primary accent */
--hh-text: #1C2535;          /* Mirage - Main text */
--hh-muted: #B1B2B5;         /* French Gray - Secondary text */
--hh-success: #00C389;       /* Success green */
--hh-warn: #FFB020;          /* Warning yellow */
--destructive: hsl(0 84% 60%); /* Live badge red */
```

### Typography
```css
H1: 48px/56px Bold
H2: 32px/40px Bold
H3: 24px/32px Bold
Body: 16px/24px Light
Small: 14px/20px Light
```

### Spacing
```css
--radius: 16px;              /* Card border radius */
--gap-sm: 4px;
--gap-md: 8px;
--gap-lg: 16px;
--gap-xl: 24px;
```

---

## 💡 Tips

### Database
- Use UUID voor alle IDs (niet integers)
- Zet indexes op foreign keys voor performance
- Use transactions voor vote updates (consistency)
- Schedule reminder emails met cron jobs

### WebSocket
- Heartbeat ping/pong voor connection health
- Reconnect logic in frontend (exponential backoff)
- Broadcast alleen naar clients in specifieke session
- Rate limit WebSocket messages (10/min per user)

### Security
- Verify JWT op alle endpoints
- Sanitize chat messages (XSS prevention)
- Rate limiting op chat (5 msg/min)
- Validate poll votes (één per user per poll)

### Performance
- Cache session data (Redis optioneel)
- Paginate chat messages (50 per load)
- Index database queries
- Compress WebSocket messages (gzip)

---

## 📞 Support & Questions

Bij vragen over:
- **Frontend**: Check `/components/HH/LiveCoaching.tsx`
- **Design**: Check `/Guidelines.md`
- **API**: Check `api-examples.md`
- **Database**: Check `IMPLEMENTATION.md` section 1
- **WebSocket**: Check `IMPLEMENTATION.md` section 4

---

## ✅ Implementation Checklist

### Phase 1: Core Backend
- [ ] PostgreSQL database setup
- [ ] Express server met routes
- [ ] JWT authentication middleware
- [ ] GET /sessions endpoint
- [ ] GET /sessions/:id endpoint
- [ ] Error handling

### Phase 2: Reminders & Calendar
- [ ] POST /reminder endpoint
- [ ] DELETE /reminder endpoint
- [ ] Calendar .ics generation
- [ ] Email reminder scheduling (cron)

### Phase 3: Chat
- [ ] GET /chat endpoint
- [ ] POST /chat endpoint
- [ ] Chat rate limiting (5/min)
- [ ] Message validation (max 500 chars)

### Phase 4: Polls
- [ ] GET /polls endpoint
- [ ] POST /polls/:id/vote endpoint
- [ ] Vote uniqueness constraint
- [ ] Real-time vote count updates

### Phase 5: WebSocket
- [ ] WebSocket server setup
- [ ] Session-based broadcasting
- [ ] Chat message events
- [ ] Poll update events
- [ ] Viewer count tracking
- [ ] Session status events

### Phase 6: Advanced Features
- [ ] Video streaming integration (YouTube/Vimeo)
- [ ] Recording storage & playback
- [ ] Analytics tracking
- [ ] Push notifications (reminder emails)
- [ ] Moderation tools (chat bans, spam filter)

---

**Veel succes met de implementatie!** 🚀

Voor vragen: check de individuele documenten of de main project `/Guidelines.md`.
