# API Documentation

## Base URL

**Development**: `http://localhost:3001/api`
**Production**: `https://agentic-ally.pages.dev/api`

## Authentication

All endpoints (except `/ping`) require a valid session cookie.

Session is set automatically by creating a chat (uses session ID as fallback).

## Chat Endpoints

### List Chats

**GET** `/chats`

Returns all chats for the authenticated user, sorted by creation date (newest first).

**Response:**
```json
[
  {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "title": "Create Phishing Awareness",
    "userId": "user123",
    "createdAt": 1698765432
  }
]
```

**Status Codes:**
- 200: Success
- 401: Unauthorized (no session)

---

### Create Chat

**POST** `/chats`

Creates a new chat with an initial user message.

**Request Body:**
```json
{
  "prompt": "Create Phishing Awareness Training"
}
```

**Response:**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "title": "Create Phishing Awareness Training",
  "userId": "user123",
  "createdAt": 1698765432,
  "messages": [
    {
      "id": "msg-1",
      "chatId": "550e8400...",
      "role": "user",
      "content": "Create Phishing Awareness Training",
      "createdAt": 1698765432
    }
  ]
}
```

**Status Codes:**
- 201: Chat created
- 400: Missing or invalid prompt
- 401: Unauthorized

---

### Get Chat

**GET** `/chats/[id]`

Retrieves a chat and all its messages.

**URL Parameters:**
- `id`: Chat ID (UUID)

**Response:**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "title": "Create Phishing Awareness",
  "userId": "user123",
  "createdAt": 1698765432,
  "messages": [
    {
      "id": "msg-1",
      "chatId": "550e8400...",
      "role": "user",
      "content": "Create Phishing Awareness",
      "createdAt": 1698765432
    },
    {
      "id": "msg-2",
      "chatId": "550e8400...",
      "role": "assistant",
      "content": "# Phishing Awareness Training\n\nPhishing is...",
      "createdAt": 1698765442
    }
  ]
}
```

**Status Codes:**
- 200: Success
- 404: Chat not found
- 401: Unauthorized (doesn't own chat)

---

### Stream AI Response

**POST** `/chats/[id]`

Streams AI response as Server-Sent Events (SSE).

**Request Body:**
```json
{
  "model": "gpt-oss-120b",
  "messages": [
    {
      "role": "user",
      "content": "Create Phishing Awareness"
    }
  ],
  "conversationId": "550e8400-e29b-41d4-a716-446655440000"
}
```

**Response (SSE Stream):**
```
event: text-start
data: {"id": "event-1"}

event: text-delta
data: {"id": "event-1", "delta": "Phishing is a"}

event: text-delta
data: {"id": "event-1", "delta": " type of cyber"}

event: text-end
data: {"id": "event-1"}
```

**Event Types:**
- `text-start`: Message started
- `text-delta`: Text chunk (stream in real-time)
- `text-end`: Text complete
- `reasoning-start`: Thinking started
- `reasoning-delta`: Thinking chunk
- `reasoning-end`: Thinking complete

**Status Codes:**
- 200: Stream started
- 404: Chat not found
- 401: Unauthorized

---

### Update Chat

**PUT** `/chats/[id]`

Updates chat metadata (currently title).

**Request Body:**
```json
{
  "content": "New Chat Title",
  "role": "assistant"
}
```

**Response:**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "title": "New Chat Title",
  "userId": "user123",
  "createdAt": 1698765432
}
```

**Status Codes:**
- 200: Updated
- 404: Chat not found
- 401: Unauthorized

---

### Delete Chat

**DELETE** `/chats/[id]`

Deletes a chat and all its messages (cascade).

**URL Parameters:**
- `id`: Chat ID (UUID)

**Response:**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "title": "Create Phishing Awareness",
  "userId": "user123",
  "createdAt": 1698765432
}
```

**Status Codes:**
- 200: Deleted
- 404: Chat not found
- 401: Unauthorized

---

## Message Endpoints

### Save Message

**POST** `/chats/[id]/messages`

Saves a message to the chat (used after AI response completes).

**Request Body:**
```json
{
  "id": "msg-2",
  "role": "assistant",
  "content": "# Phishing Awareness\n\nPhishing is..."
}
```

**Response:**
```json
{
  "id": "msg-2",
  "chatId": "550e8400-e29b-41d4-a716-446655440000",
  "role": "assistant",
  "content": "# Phishing Awareness\n\nPhishing is...",
  "createdAt": 1698765442
}
```

**Status Codes:**
- 200: Saved
- 400: Invalid message data
- 404: Chat not found
- 401: Unauthorized

---

## Utility Endpoints

### Ping (Cookie Init)

**GET** `/ping`

Sets the `app-init` cookie (Safari ITP workaround).

**Response:**
```json
"ok"
```

**Status Codes:**
- 200: Cookie set

---

### Health Check

**GET** `/health`

Simple health check endpoint.

**Response:**
```json
"running"
```

**Status Codes:**
- 200: Healthy

---

## Error Responses

### 400 Bad Request
```json
{
  "statusCode": 400,
  "statusMessage": "Missing prompt"
}
```

### 401 Unauthorized
```json
{
  "statusCode": 401,
  "statusMessage": "Unauthorized"
}
```

### 403 Forbidden
```json
{
  "statusCode": 403,
  "statusMessage": "Forbidden"
}
```

### 404 Not Found
```json
{
  "statusCode": 404,
  "statusMessage": "Chat not found"
}
```

### 500 Server Error
```json
{
  "statusCode": 500,
  "statusMessage": "Internal Server Error"
}
```

---

## Rate Limiting

Currently no rate limiting. To be implemented based on requirements.

## CORS

All endpoints accept requests from any origin (configured for iframe embedding).

**Headers:**
```
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET, POST, PUT, DELETE
Access-Control-Allow-Headers: Content-Type, Authorization
Access-Control-Allow-Credentials: true
```

## Examples

### Create a Chat
```bash
curl -X POST http://localhost:3001/api/chats \
  -H "Content-Type: application/json" \
  -d '{"prompt": "Create Phishing Awareness"}' \
  --cookie "nuxt-session=..."
```

### Get Chat Messages
```bash
curl http://localhost:3001/api/chats/550e8400-e29b-41d4-a716-446655440000 \
  --cookie "nuxt-session=..."
```

### Stream AI Response
```bash
curl -X POST http://localhost:3001/api/chats/550e8400-e29b-41d4-a716-446655440000 \
  -H "Content-Type: application/json" \
  -d '{"model":"gpt-oss-120b","messages":[{"role":"user","content":"Hello"}]}' \
  --cookie "nuxt-session=..."
```

Output:
```
event: text-start
data: {"id":"..."}

event: text-delta
data: {"id":"...","delta":"Hello"}

event: text-end
data: {"id":"..."}
```
