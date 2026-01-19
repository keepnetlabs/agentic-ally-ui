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

### Components (14 total)

| Component | Purpose | Size |
|-----------|---------|------|
| ChatCanvas | Multi-format content viewer | 16.8 KB |
| EmailCanvas | HTML email previewer | 3.5 KB |
| HTMLEditorModal | Full-featured HTML editor | 12.8 KB |
| LandingPageCanvas | Phishing landing page simulator | 7.2 KB |
| DashboardNavbar | Top navigation bar | 539 B |
| UserMenu | Profile & theme settings | 4.3 KB |
| ModelSelect | LLM model dropdown | 542 B |
| ModalConfirm | Delete confirmation dialog | 714 B |
| Logo | Company logo | 261 B |
| PreStream | Code syntax highlighting | 978 B |
| PhishingEmailCard | Chat stream card for emails | 1.9 KB |
| TrainingUrlCard | Chat stream card for training URLs | 1.9 KB |
| LandingPageCard | Chat stream card for landing pages | 1.7 KB |
| ReasoningSection | AI chain-of-thought display | 626 B |

All components auto-imported (no manual imports needed).

### Composables (State Management)

**useCanvas()**
- Manages canvas visibility state and active content
- Content type: 'preview', 'email', 'code', 'html', 'url' active content

**useCanvasTriggers()**
- Complex logic to detect patterns in chat stream (e.g. TrainingUrl, PhishingEmail)
- Auto-opens canvas with appropriate content

**useChatClient()**
- Handles SSE connection and message parsing
- Manages stream state (text-delta, reasoning-delta)

**useSecureApi()**
- Wrapper around `$fetch` that automatically adds Auth headers

**useLLM()**
- Manages selected model
- Returns: `{ models, model }`

**useChats()**
- Groups chats by time (Today, Yesterday, Last Week, etc.)
- Returns: `{ groups }`

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

#### Files & Policies (`server/api/files/`, `server/api/policies/`)
```
GET    /api/files              → List company files
POST   /api/files              → Upload PDF policy
DELETE /api/files/[id]         → Delete policy file
GET    /api/policies/[...path] → Get policy text/metadata
```

#### Auth (`server/api/auth/`)
```
POST   /api/auth/token         → Exchange auth code for token
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
4. Frontend parses stream (useChatClient)
   - Updates message content
   - useCanvasTriggers detects patterns
   - Auto-triggers canvas components (EmailCanvas, etc.)
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

policies (Standalone, linked via companyId)
```

### Tables

**users**
- User data storage
- Stores: id, email, name, avatar, username, provider, providerId

**chats**
- One per conversation session
- Stores: id, title, userId, createdAt

**messages**
- One per message (user or assistant)
- Stores: id, chatId, role, content, createdAt

**policies**
- Stores metadata for uploaded policy files
- Stores: id, companyId, name, size, blobUrl, createdAt

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
