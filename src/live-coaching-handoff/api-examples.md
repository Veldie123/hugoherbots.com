# Live Coaching API - Request/Response Examples

Compleet overzicht van alle API calls met request en response voorbeelden voor implementatie in Replit.

---

## 🔐 Authentication

Alle requests vereisen authenticatie via Bearer token in de Authorization header:

```bash
Authorization: Bearer YOUR_JWT_TOKEN
```

---

## 📋 Sessions API

### 1. GET /api/live/sessions

Haal alle live coaching sessies op

**cURL:**
```bash
curl -X GET "https://api.hugoherbots.ai/api/live/sessions?status=upcoming&limit=10" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json"
```

**JavaScript (fetch):**
```javascript
const response = await fetch('https://api.hugoherbots.ai/api/live/sessions?status=upcoming&limit=10', {
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }
});

const data = await response.json();
```

**Response (200 OK):**
```json
{
  "sessions": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "title": "Live Q&A: Discovery Technieken",
      "description": "Leer de E.P.I.C. methode voor ontdekkingsgesprekken",
      "scheduledDate": "2025-01-22T14:00:00Z",
      "duration": 60,
      "topic": "Fase 2 • Ontdekkingsfase",
      "phaseId": 2,
      "status": "upcoming",
      "videoUrl": null,
      "thumbnailUrl": "https://cdn.hugoherbots.ai/thumbnails/session-1.jpg",
      "viewerCount": 0,
      "createdAt": "2025-01-10T10:00:00Z",
      "updatedAt": "2025-01-10T10:00:00Z"
    }
  ]
}
```

---

### 2. GET /api/live/sessions/:sessionId

Haal details van specifieke sessie

**cURL:**
```bash
curl -X GET "https://api.hugoherbots.ai/api/live/sessions/550e8400-e29b-41d4-a716-446655440000" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json"
```

**JavaScript:**
```javascript
const sessionId = '550e8400-e29b-41d4-a716-446655440000';
const response = await fetch(`https://api.hugoherbots.ai/api/live/sessions/${sessionId}`, {
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }
});

const session = await response.json();
```

**Response (200 OK):**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "title": "Live Q&A: Discovery Technieken",
  "description": "Leer de E.P.I.C. methode voor ontdekkingsgesprekken en hoe je de juiste vragen stelt",
  "scheduledDate": "2025-01-22T14:00:00Z",
  "duration": 60,
  "topic": "Fase 2 • Ontdekkingsfase",
  "phaseId": 2,
  "status": "upcoming",
  "videoUrl": null,
  "thumbnailUrl": "https://cdn.hugoherbots.ai/thumbnails/session-1.jpg",
  "viewerCount": 0,
  "hasReminder": true,
  "createdAt": "2025-01-10T10:00:00Z",
  "updatedAt": "2025-01-10T10:00:00Z"
}
```

---

## 🔔 Reminder API

### 3. POST /api/live/sessions/:sessionId/reminder

Zet een reminder voor sessie

**cURL:**
```bash
curl -X POST "https://api.hugoherbots.ai/api/live/sessions/550e8400-e29b-41d4-a716-446655440000/reminder" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user-uuid-123"
  }'
```

**JavaScript:**
```javascript
const response = await fetch(
  `https://api.hugoherbots.ai/api/live/sessions/${sessionId}/reminder`,
  {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      userId: currentUserId
    })
  }
);

const result = await response.json();
```

**Request Body:**
```json
{
  "userId": "user-uuid-123"
}
```

**Response (201 Created):**
```json
{
  "success": true,
  "reminderId": "reminder-uuid-456"
}
```

**Error Response (409 Conflict - reminder already exists):**
```json
{
  "error": "ReminderAlreadyExists",
  "message": "Je hebt al een reminder voor deze sessie",
  "statusCode": 409
}
```

---

### 4. DELETE /api/live/sessions/:sessionId/reminder

Verwijder reminder

**cURL:**
```bash
curl -X DELETE "https://api.hugoherbots.ai/api/live/sessions/550e8400-e29b-41d4-a716-446655440000/reminder" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**JavaScript:**
```javascript
const response = await fetch(
  `https://api.hugoherbots.ai/api/live/sessions/${sessionId}/reminder`,
  {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${token}`
    }
  }
);

const result = await response.json();
```

**Response (200 OK):**
```json
{
  "success": true
}
```

---

## 💬 Chat API

### 5. GET /api/live/sessions/:sessionId/chat

Haal chat messages op

**cURL:**
```bash
curl -X GET "https://api.hugoherbots.ai/api/live/sessions/550e8400-e29b-41d4-a716-446655440000/chat?limit=50" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json"
```

**JavaScript:**
```javascript
const response = await fetch(
  `https://api.hugoherbots.ai/api/live/sessions/${sessionId}/chat?limit=50`,
  {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  }
);

const data = await response.json();
```

**Response (200 OK):**
```json
{
  "messages": [
    {
      "id": "msg-uuid-1",
      "sessionId": "550e8400-e29b-41d4-a716-446655440000",
      "userId": "hugo-herbots-uuid",
      "userName": "Hugo Herbots",
      "userInitials": "HH",
      "message": "Welkom allemaal! Vandaag gaan we het hebben over bezwaarhandeling.",
      "isHost": true,
      "createdAt": "2025-01-15T14:02:00Z"
    },
    {
      "id": "msg-uuid-2",
      "sessionId": "550e8400-e29b-41d4-a716-446655440000",
      "userId": "user-uuid-1",
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

### 6. POST /api/live/sessions/:sessionId/chat

Stuur chat bericht

**cURL:**
```bash
curl -X POST "https://api.hugoherbots.ai/api/live/sessions/550e8400-e29b-41d4-a716-446655440000/chat" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user-uuid-123",
    "message": "Geweldige sessie, Hugo!"
  }'
```

**JavaScript:**
```javascript
const response = await fetch(
  `https://api.hugoherbots.ai/api/live/sessions/${sessionId}/chat`,
  {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      userId: currentUserId,
      message: chatMessage
    })
  }
);

const newMessage = await response.json();
```

**Request Body:**
```json
{
  "userId": "user-uuid-123",
  "message": "Geweldige sessie, Hugo!"
}
```

**Response (201 Created):**
```json
{
  "id": "msg-uuid-3",
  "sessionId": "550e8400-e29b-41d4-a716-446655440000",
  "userId": "user-uuid-123",
  "userName": "Jan de Vries",
  "userInitials": "JV",
  "message": "Geweldige sessie, Hugo!",
  "isHost": false,
  "createdAt": "2025-01-15T14:15:00Z"
}
```

**Error Response (400 Bad Request - message too long):**
```json
{
  "error": "MessageTooLong",
  "message": "Bericht mag maximaal 500 karakters zijn",
  "statusCode": 400
}
```

**Error Response (429 Too Many Requests - rate limit):**
```json
{
  "error": "RateLimitExceeded",
  "message": "Maximum 5 berichten per minuut. Probeer het over 30 seconden opnieuw.",
  "statusCode": 429,
  "retryAfter": 30
}
```

---

## 📊 Polls API

### 7. GET /api/live/sessions/:sessionId/polls

Haal actieve polls op

**cURL:**
```bash
curl -X GET "https://api.hugoherbots.ai/api/live/sessions/550e8400-e29b-41d4-a716-446655440000/polls" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json"
```

**JavaScript:**
```javascript
const response = await fetch(
  `https://api.hugoherbots.ai/api/live/sessions/${sessionId}/polls`,
  {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  }
);

const data = await response.json();
```

**Response (200 OK):**
```json
{
  "polls": [
    {
      "id": "poll-uuid-1",
      "sessionId": "550e8400-e29b-41d4-a716-446655440000",
      "question": "Waar loop je het meest tegenaan bij bezwaarhandeling?",
      "isActive": true,
      "options": [
        {
          "id": "option-uuid-1",
          "pollId": "poll-uuid-1",
          "text": "Prijsbezwaren",
          "voteCount": 34
        },
        {
          "id": "option-uuid-2",
          "pollId": "poll-uuid-1",
          "text": "Timing bezwaren (uitstel)",
          "voteCount": 28
        },
        {
          "id": "option-uuid-3",
          "pollId": "poll-uuid-1",
          "text": "Technische bezwaren",
          "voteCount": 15
        },
        {
          "id": "option-uuid-4",
          "pollId": "poll-uuid-1",
          "text": "Budgetbezwaren",
          "voteCount": 42
        }
      ],
      "totalVotes": 119,
      "userVoted": false,
      "userVoteOptionId": null,
      "createdAt": "2025-01-15T14:16:00Z"
    }
  ]
}
```

---

### 8. POST /api/live/polls/:pollId/vote

Stem op poll optie

**cURL:**
```bash
curl -X POST "https://api.hugoherbots.ai/api/live/polls/poll-uuid-1/vote" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user-uuid-123",
    "optionId": "option-uuid-1"
  }'
```

**JavaScript:**
```javascript
const response = await fetch(
  `https://api.hugoherbots.ai/api/live/polls/${pollId}/vote`,
  {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      userId: currentUserId,
      optionId: selectedOptionId
    })
  }
);

const result = await response.json();
```

**Request Body:**
```json
{
  "userId": "user-uuid-123",
  "optionId": "option-uuid-1"
}
```

**Response (200 OK):**
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
        "voteCount": 35
      },
      {
        "id": "option-uuid-2",
        "text": "Timing bezwaren (uitstel)",
        "voteCount": 28
      },
      {
        "id": "option-uuid-3",
        "text": "Technische bezwaren",
        "voteCount": 15
      },
      {
        "id": "option-uuid-4",
        "text": "Budgetbezwaren",
        "voteCount": 42
      }
    ],
    "totalVotes": 120,
    "userVoted": true,
    "userVoteOptionId": "option-uuid-1"
  }
}
```

**Error Response (409 Conflict - already voted):**
```json
{
  "error": "AlreadyVoted",
  "message": "Je hebt al gestemd op deze poll",
  "statusCode": 409
}
```

---

## 📅 Calendar Export API

### 9. GET /api/live/sessions/:sessionId/calendar

Download .ics calendar file (optioneel - kan ook client-side)

**cURL:**
```bash
curl -X GET "https://api.hugoherbots.ai/api/live/sessions/550e8400-e29b-41d4-a716-446655440000/calendar" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  --output session.ics
```

**JavaScript (trigger download):**
```javascript
const response = await fetch(
  `https://api.hugoherbots.ai/api/live/sessions/${sessionId}/calendar`,
  {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`
    }
  }
);

const blob = await response.blob();
const url = URL.createObjectURL(blob);
const link = document.createElement('a');
link.href = url;
link.download = `live-coaching-${sessionId}.ics`;
link.click();
URL.revokeObjectURL(url);
```

**Response Headers:**
```
Content-Type: text/calendar; charset=utf-8
Content-Disposition: attachment; filename="live-coaching-session.ics"
```

**Response Body (.ics format):**
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
DESCRIPTION:Live coaching sessie met Hugo Herbots - Fase 2: Ontdekkingsfase. Leer de E.P.I.C. methode voor ontdekkingsgesprekken.
LOCATION:HugoHerbots.ai Live Coaching
UID:550e8400-e29b-41d4-a716-446655440000@hugoherbots.ai
URL:https://app.hugoherbots.ai/live/550e8400-e29b-41d4-a716-446655440000
STATUS:CONFIRMED
SEQUENCE:0
BEGIN:VALARM
TRIGGER:-PT24H
ACTION:DISPLAY
DESCRIPTION:Live Coaching sessie begint over 24 uur
END:VALARM
BEGIN:VALARM
TRIGGER:-PT1H
ACTION:DISPLAY
DESCRIPTION:Live Coaching sessie begint over 1 uur
END:VALARM
END:VEVENT
END:VCALENDAR
```

---

## 🔌 WebSocket Connection

### Connect to WebSocket

**JavaScript:**
```javascript
const sessionId = '550e8400-e29b-41d4-a716-446655440000';
const token = 'YOUR_JWT_TOKEN';

const ws = new WebSocket(`wss://api.hugoherbots.ai/live/${sessionId}?token=${token}`);

ws.onopen = () => {
  console.log('Connected to live session');
};

ws.onmessage = (event) => {
  const message = JSON.parse(event.data);
  handleWebSocketMessage(message);
};

ws.onerror = (error) => {
  console.error('WebSocket error:', error);
};

ws.onclose = () => {
  console.log('Disconnected from live session');
};
```

### Server → Client Events

**Event: chat:message**
```json
{
  "type": "chat:message",
  "data": {
    "id": "msg-uuid-new",
    "sessionId": "550e8400-e29b-41d4-a716-446655440000",
    "userId": "user-uuid-9",
    "userName": "Anne Smit",
    "userInitials": "AS",
    "message": "Geweldige tips, Hugo!",
    "isHost": false,
    "createdAt": "2025-01-15T14:20:00Z"
  }
}
```

**Event: poll:update**
```json
{
  "type": "poll:update",
  "data": {
    "pollId": "poll-uuid-1",
    "optionId": "option-uuid-4",
    "voteCount": 43,
    "totalVotes": 120
  }
}
```

**Event: session:status**
```json
{
  "type": "session:status",
  "data": {
    "sessionId": "550e8400-e29b-41d4-a716-446655440000",
    "status": "live",
    "viewerCount": 85
  }
}
```

**Event: viewer:count**
```json
{
  "type": "viewer:count",
  "data": {
    "sessionId": "550e8400-e29b-41d4-a716-446655440000",
    "viewerCount": 132
  }
}
```

### Client → Server Events

**Send chat message:**
```javascript
ws.send(JSON.stringify({
  type: "chat:send",
  data: {
    message: "Geweldige sessie!"
  }
}));
```

**Vote on poll:**
```javascript
ws.send(JSON.stringify({
  type: "poll:vote",
  data: {
    pollId: "poll-uuid-1",
    optionId: "option-uuid-1"
  }
}));
```

---

## 🚨 Error Codes

| Status Code | Error | Beschrijving |
|-------------|-------|--------------|
| 400 | BadRequest | Invalid request data |
| 401 | Unauthorized | Missing or invalid authentication token |
| 403 | Forbidden | Access denied (bijv. tier restriction) |
| 404 | NotFound | Resource not found |
| 409 | Conflict | Duplicate resource (bijv. reminder already exists) |
| 429 | TooManyRequests | Rate limit exceeded |
| 500 | InternalServerError | Server error |
| 503 | ServiceUnavailable | Service temporarily unavailable |

---

## 📝 Rate Limits

| Endpoint | Limit | Window |
|----------|-------|--------|
| POST /chat | 5 requests | 1 minute |
| POST /polls/:pollId/vote | 1 request | Per poll |
| GET /sessions | 60 requests | 1 minute |
| POST /reminder | 10 requests | 1 minute |
| WebSocket messages | 10 messages | 1 minute |

---

## 🔍 Testing

### Postman Collection

Importeer deze URL in Postman:
```
https://api.hugoherbots.ai/docs/postman-collection.json
```

### cURL test script

```bash
#!/bin/bash
TOKEN="your-jwt-token-here"
BASE_URL="https://api.hugoherbots.ai"

# Test 1: Get upcoming sessions
echo "📋 Testing GET /api/live/sessions..."
curl -X GET "$BASE_URL/api/live/sessions?status=upcoming" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json"

# Test 2: Get session details
echo "\n\n📄 Testing GET /api/live/sessions/:sessionId..."
SESSION_ID="550e8400-e29b-41d4-a716-446655440000"
curl -X GET "$BASE_URL/api/live/sessions/$SESSION_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json"

# Test 3: Set reminder
echo "\n\n🔔 Testing POST /api/live/sessions/:sessionId/reminder..."
curl -X POST "$BASE_URL/api/live/sessions/$SESSION_ID/reminder" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"userId": "user-123"}'

# Test 4: Get chat messages
echo "\n\n💬 Testing GET /api/live/sessions/:sessionId/chat..."
curl -X GET "$BASE_URL/api/live/sessions/$SESSION_ID/chat?limit=10" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json"

echo "\n\n✅ Tests completed!"
```

---

Veel succes met de implementatie! 🚀
