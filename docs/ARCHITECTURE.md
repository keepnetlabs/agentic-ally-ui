# Architecture Overview

## High-Level Flow

```
User Browser
    ↓
Nuxt Frontend (Vue 3)
    ├─→ API Routes (Nitro)
    │   ├─→ Database (Drizzle + D1)
    │   └─→ Fleet Agent (LLM, SSE)
    └─→ Components & Pages
```

## Frontend Architecture

### Pages

**Index Page** (`app/pages/index.vue`)
- Home page for creating new chats
- User enters prompt
- Selects AI model
- Creates new chat session

**Chat Page** (`app/pages/chat/[id].vue`)
- Main chat interface
- Displays message history
- Real-time streaming support
- Canvas panel for content display
- ~600 lines of complex logic

### Components (7 total)

| Component | Purpose | Size |
|-----------|---------|------|
| ChatCanvas | Multi-format content viewer | 11.6 KB |
| DashboardNavbar | Top navigation bar | 688 B |
| UserMenu | Profile & theme settings | 4.3 KB |
| ModelSelect | LLM model dropdown | 358 B |
| ModalConfirm | Delete confirmation dialog | 585 B |
| Logo | Company logo | 158 B |
| PreStream | Code syntax highlighting | 978 B |

All components auto-imported (no manual imports needed).

### Composables (State Management)

**useCanvas()**
- Manages canvas visibility state
- Content type: 'preview', 'email', 'code', 'html', 'url'
- Methods: `showCanvas()`, `hideCanvas()`, `updateCanvasContent()`

**useLLM()**
- Manages selected model (currently hardcoded)
- Returns: `{ models, model }`

**useChats()**
- Groups chats by time (Today, Yesterday, Last Week, etc.)
- Returns: `{ groups }`

**useHighlighter()**
- Code syntax highlighting via Shiki

### Layout

**default.vue** (Dashboard)
- Sidebar with chat history
- Collapsible/resizable
- User menu in header
- New chat button
- Search functionality

## Backend Architecture

### API Endpoints

#### Chat Management (`server/api/chats/`)
```
GET    /api/chats              → List user's chats
POST   /api/chats              → Create new chat
GET    /api/chats/[id]         → Get chat + messages
POST   /api/chats/[id]         → Stream AI response (SSE)
PUT    /api/chats/[id]         → Update chat title
DELETE /api/chats/[id]         → Delete chat
POST   /api/chats/[id]/messages → Save message
```

#### Utilities
```
GET    /api/ping               → Set init cookie (Safari ITP fix)
GET    /api/health             → Health check
```

### Request/Response Pattern

**Typical Flow:**
```
1. User sends message
   ↓
2. POST /api/chats/[id]
   - Validates user owns chat
   - Saves user message to DB
   - Proxies to Fleet Agent (SSE)
   ↓
3. Server-Sent Events Stream
   - text-delta (streaming text)
   - reasoning-delta (thinking tokens)
   - text-end (message complete)
   ↓
4. Frontend parses stream
   - Updates message content
   - Extracts training URLs
   - Auto-triggers canvas
   ↓
5. POST /api/chats/[id]/messages
   - Saves complete assistant message to DB
```

## Database Architecture

### Schema

```
users ─────┐
           ├─→ chats ─────┐
           │              ├─→ messages
           │              │
           └──────────────┘
```

### Tables

**users**
- User data storage
- Stores: id, email, name, avatar, username, provider, providerId

**chats**
- One per conversation session
- Stores: id, title, userId, createdAt
- UserId can fallback to 'guest-session' for anonymous users

**messages**
- One per message (user or assistant)
- Stores: id, chatId, role, content, createdAt
- Cascade delete with chat

### Relationships

- User → Chats: 1-to-many
- Chat → Messages: 1-to-many
- On chat delete: all messages deleted (cascade)

## Message Streaming (SSE)

### Events Handled

```
text-start          → Message started
text-delta          → Chunk of text (stream in real-time)
text-end            → Text complete
reasoning-start     → Thinking started
reasoning-delta     → Thinking chunk
reasoning-end       → Thinking complete
```

### Canvas Auto-trigger

Detects patterns like:
```
TrainingUrl: https://example.com/training
```

Automatically opens canvas with URL.

## Session & Cookies

### Development

- **Cookie Name**: `nuxt-session`
- **SameSite**: `'lax'` (allows cross-site)
- **Secure**: `false` (works on HTTP)
- **HttpOnly**: `true` (JS can't access)
- **Password**: 32+ character encryption key

### Production

- **SameSite**: `'none'` (required for cross-site)
- **Secure**: `true` (HTTPS only)
- Other settings same

### Guest Mode

- No login required to use chat
- Uses session ID as fallback user ID
- Chats migrate to user account on login
- Chats lost if session expires (no guest persistence)

## Data Flow Example: Creating a Chat

```
1. User types prompt on index page
2. Clicks "Create Chat"
   ↓
3. Frontend: POST /api/chats
   - Body: { prompt: "Create Phishing Awareness" }
   ↓
4. Backend:
   - Validate user session
   - Generate UUID for chat
   - Insert chat: { id, title, userId, createdAt }
   - Insert message: { id, chatId, role: 'user', content, createdAt }
   - Return chat object
   ↓
5. Frontend:
   - Navigate to /chat/[id]
   ↓
6. Chat page loads:
   - GET /api/chats/[id]
   - Returns chat + all messages
   - Displays message history
```

## Error Handling

### Frontend
- Catch API errors in components
- Show toast notifications
- Redirect on 404/401

### Backend
- All errors throw `createError()`
- Proper status codes (400, 401, 403, 404, 500)
- No internal details in messages
- Always verify user owns resource

## Performance Considerations

- **Prefetching**: Chat page prefetches first 10 chats on mount
- **Caching**: Fetch requests use `key` to deduplicate
- **Streaming**: SSE for real-time message delivery
- **Lazy Loading**: Components loaded on demand

## Security

- **Authorization**: Check `chat.userId === session.user?.id`
- **CORS**: Configured to allow iframe embedding
- **Session**: Encrypted cookies with strong password
- **Input**: Validated on backend before DB operations
- **XSS**: Using Vue templates (auto-escaped), v-html only for trusted content

## External Services

- **Fleet Agent Worker**: LLM API endpoint (SSE)
- **Cloudflare**: Hosting + D1 database

See [API.md](API.md) for endpoint documentation.
