# Documentation Index

Welcome to Agentic Ally documentation. Choose a guide based on what you need:

## 🚀 Getting Started

**Start here if you're new to the project:**

- **[SETUP.md](SETUP.md)** - Local development setup
  - Install dependencies
  - Setup database
  - Environment variables
  - Common issues & troubleshooting

## 📚 Understanding the Project

**Learn how the project is structured and works:**

- **[ARCHITECTURE.md](ARCHITECTURE.md)** - System design overview
  - Frontend architecture (Pages, Components, Composables)
  - Backend architecture (API endpoints, Database)
  - Data flow & authentication
  - SSE streaming & Canvas panel
  - Performance & security

- **[API.md](API.md)** - Complete API reference
  - All endpoints with request/response examples
  - Error handling
  - CORS & rate limiting
  - curl examples for testing

## 👨‍💻 Development

**For actively coding on the project:**

- **[DEVELOPMENT.md](DEVELOPMENT.md)** - Coding workflow
  - File naming conventions
  - Code style & patterns
  - Git workflow
  - Common tasks (add endpoint, component, composable)
  - Debugging tips

- **[COMPONENTS.md](COMPONENTS.md)** - Vue components guide
  - Component overview (7 total)
  - Component APIs & usage
  - Best practices
  - Debugging components

## 📋 Quick Reference

### File Structure
```
app/
├── components/          # Vue components (auto-imported)
├── composables/         # State management (auto-imported)
├── pages/              # Routes (auto-routed)
├── layouts/            # Page layouts
└── utils/              # Utility functions

server/
├── api/                # API endpoints
├── routes/             # Special routes
├── database/           # Schema & migrations
└── middleware/         # Server middleware
```

### Technology Stack
| Layer | Tech |
|-------|------|
| Frontend | Vue 3, Nuxt 4, TypeScript |
| Styling | TailwindCSS, Nuxt UI Pro |
| Backend | Nitro, Drizzle ORM |
| Database | Cloudflare D1 (SQLite) |
| Session | nuxt-auth-utils, encrypted cookies |
| Hosting | Cloudflare Pages + Workers |

### Key Concepts

**Components** (7 total)
- ChatCanvas: Multi-format content viewer
- UserMenu: Profile & theme settings
- ModelSelect: AI model dropdown
- DashboardNavbar: Top navigation
- ModalConfirm: Confirmation dialog
- Logo: Company logo
- PreStream: Code syntax highlighting

**Composables** (State Management)
- useCanvas: Canvas visibility & content
- useLLM: Model selection
- useChats: Chat grouping logic
- useHighlighter: Code highlighting

**API Endpoints**
- GET/POST/PUT/DELETE `/api/chats` - Chat management
- POST `/api/chats/[id]` - Stream AI response (SSE)

**Database**
- users: User data storage
- chats: Conversation sessions
- messages: Chat messages (user + assistant)

### Common Commands
```bash
yarn dev              # Start dev server
yarn build            # Build for production
yarn cf:reset         # Reset database
yarn cf:typegen       # Generate database types
yarn deploy           # Deploy to Cloudflare
```

## 🤔 Finding What You Need

### I want to...

**...understand how the app works**
→ Read [ARCHITECTURE.md](ARCHITECTURE.md)

**...set up local development**
→ Read [SETUP.md](SETUP.md)

**...add a new feature**
1. Read [DEVELOPMENT.md](DEVELOPMENT.md) for patterns
2. Add API endpoint: see [API.md](API.md) for reference
3. Add component: see [COMPONENTS.md](COMPONENTS.md)
4. Commit with descriptive message

**...debug an issue**
→ Check [SETUP.md](SETUP.md) (Common Issues) or [DEVELOPMENT.md](DEVELOPMENT.md) (Troubleshooting)

**...understand a component**
→ See [COMPONENTS.md](COMPONENTS.md)

**...call an API**
→ See [API.md](API.md) for examples

**...write database code**
→ See [DEVELOPMENT.md](DEVELOPMENT.md) (Database Schema Changes)

**...deploy changes**
→ Read [SETUP.md](SETUP.md) (Build for Production)

## 📝 Notes

- All documentation is beginner-friendly
- Examples are copy-paste ready
- Troubleshooting sections for common issues
- See also: [claude.md](../claude.md) (for Claude/Cursor IDE)

## ❓ Still Have Questions?

1. Check the relevant documentation section
2. Search in troubleshooting sections
3. Check code comments in source files
4. Consult the `.cursorrules` file for coding standards

## 🔄 Keeping Docs Updated

When making changes:
- Update relevant documentation
- Add new features to this index
- Include examples in code comments
- Update API.md if endpoints change

---

**Last updated**: 2025-10-27

See the main project file: [claude.md](../claude.md)
