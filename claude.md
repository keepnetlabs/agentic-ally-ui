# Agentic Ally Platform

## Project Overview

**Agentic Ally** is an AI-powered platform for creating security awareness training materials. Users interact with an AI chat interface to generate training content on topics like phishing awareness, secure remote work, MFA, and strong passwords.

**Key Features:**
- Real-time AI chat with SSE streaming
- Multi-format content display (URLs, emails, code, HTML)
- Chat history management
- Session-based authentication
- Dark mode support

## Technology Stack

### Frontend
- **Framework**: Vue 3 + Nuxt 4
- **Styling**: TailwindCSS + Nuxt UI Pro
- **State**: Vue 3 Composition API + composables
- **Language**: TypeScript (strict)
- **Build**: Vite (via Nuxt)

### Backend
- **Server**: Nitro (serverless)
- **Database**: Cloudflare D1 (SQLite)
- **ORM**: Drizzle ORM
- **Session**: nuxt-auth-utils with encrypted cookies
- **Streaming**: Server-Sent Events (SSE)

### Infrastructure
- **Host**: Cloudflare Pages + Workers
- **Package Manager**: Yarn
- **Config**: wrangler.jsonc

## Project Structure

```
app/
├── components/          # Vue components (auto-imported)
│   ├── ChatCanvas.vue   # Multi-format content viewer
│   ├── DashboardNavbar.vue
│   ├── UserMenu.vue     # Theme & profile settings
│   ├── ModelSelect.vue
│   ├── ModalConfirm.vue
│   ├── Logo.vue
│   └── prose/PreStream.vue # Syntax highlighting
├── composables/         # State management
│   ├── useCanvas.ts     # Canvas visibility & content
│   ├── useLLM.ts        # Model selection
│   ├── useChats.ts      # Chat grouping logic
│   └── useHighlighter.ts
├── pages/
│   ├── index.vue        # Home (create new chat)
│   └── chat/[id].vue    # Chat interface
├── layouts/default.vue  # Dashboard layout with sidebar
└── utils/text-utils.ts  # Message parsing

server/
├── api/
│   ├── chats.get.ts              # List user's chats
│   ├── chats.post.ts             # Create chat
│   ├── chats/[id].get.ts         # Get chat with messages
│   ├── chats/[id].post.ts        # Stream AI response (SSE proxy)
│   ├── chats/[id].put.ts         # Update chat
│   ├── chats/[id].delete.ts      # Delete chat
│   ├── chats/[id]/messages.post.ts # Save message
│   ├── health.get.ts
│   └── ping.get.ts               # Cookie initialization
├── middleware/cors.ts            # CORS configuration
├── plugins/ensure-process.ts
├── utils/
│   ├── drizzle.ts               # Database client
│   └── text-utils.ts            # Message utilities
└── database/
    ├── schema.ts                # Drizzle schema (users, chats, messages)
    └── migrations/              # D1 migrations
```

## Key Components

### ChatCanvas.vue (11.6 KB)
Displays content in various formats:
- **URL**: Embedded iframe with reload/fullscreen controls
- **Email**: HTML email template viewer
- **Code**: Syntax-highlighted code with copy button
- **HTML/Preview**: Raw HTML rendering
- Auto-triggers on URL pattern detection from chat

### Chat Page ([id].vue)
- Real-time message streaming with SSE
- Message parsing (text + reasoning parts)
- Canvas auto-trigger on specific patterns
- Chat history with formatted messages
- Regenerate/stop message controls

## Core API Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/chats` | List user's chats |
| POST | `/api/chats` | Create new chat |
| GET | `/api/chats/[id]` | Get chat with messages |
| POST | `/api/chats/[id]` | Stream AI response (SSE) |
| PUT | `/api/chats/[id]` | Update chat |
| DELETE | `/api/chats/[id]` | Delete chat |
| POST | `/api/chats/[id]/messages` | Save message |
| GET | `/api/ping` | Set init cookie |

## Database Schema

```typescript
users {
  id: TEXT (UUID)
  email: TEXT
  name: TEXT
  avatar: TEXT (URL)
  username: TEXT (GitHub login)
  provider: TEXT ('github')
  providerId: INTEGER
  createdAt: INTEGER (unixepoch)
}

chats {
  id: TEXT (UUID)
  title: TEXT (first 100 chars of prompt)
  userId: TEXT (FK → users.id, falls back to 'guest-session')
  createdAt: INTEGER (unixepoch)
}

messages {
  id: TEXT (UUID)
  chatId: TEXT (FK → chats.id, CASCADE DELETE)
  role: TEXT ('user' | 'assistant')
  content: TEXT (full message)
  createdAt: INTEGER (unixepoch)
}
```

## Session Management

- **Session**: nuxt-auth-utils encrypted cookie (`nuxt-session`)
- **Guest Mode**: Uses session ID as fallback userId

**Cookie Settings:**
- Dev: `sameSite: 'lax'`, `secure: false`
- Prod: `sameSite: 'none'`, `secure: true`

## Development

### Setup
```bash
yarn install
yarn cf:reset          # Reset local D1 database
yarn cf:typegen        # Generate database types
```

### Run
```bash
yarn dev               # Start Nuxt on :3001
```

### Build & Deploy
```bash
yarn build            # Build for production
yarn deploy           # Deploy to Cloudflare Pages
```

## Important Files

- **`.cursorrules`** - Development guidelines for Cursor IDE
- **`nuxt.config.ts`** - Nuxt & session configuration
- **`wrangler.jsonc`** - Cloudflare Pages & D1 config
- **`server/database/schema.ts`** - Drizzle ORM schema
- **`server/api/chats/[id].post.ts`** - Complex SSE streaming logic

## Key Patterns

### Message Streaming
- Fleet Agent Worker sends SSE events
- Filter `workflow-*` events (unsupported)
- Generate IDs if missing from upstream
- Handle `text-delta`, `text-start`, `text-end`, `reasoning-*`

### Canvas Auto-trigger
- Detects pattern: `TrainingUrl: https://...`
- Automatically opens canvas panel
- Updates content via `useCanvas()` composable

### Authorization
- Always check `chat.userId === session.user?.id`
- Return generic 404 for unauthorized/not found
- No internal details in error messages

## Notes

- **Safari ITP Workaround**: `app.vue` handles cookie/storage access
- **CORS**: Permissive (any origin) - enable iframe embedding
- **Unused Code Removed**: `useCanvas` helpers & `ChatCanvas` dead functions cleaned up
- **Components**: All 7 components are actively used (Logo refactored to accept src prop)

## External Services

- **LLM**: Fleet Agent Worker (SSE endpoint)
- **Hosting**: Cloudflare (Pages + Workers + D1)
