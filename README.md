# Agentic Ally Platform

**Agentic Ally** is an AI-powered platform for creating security awareness training materials. Users interact with an AI chat interface to generate training content on topics like phishing awareness, secure remote work, MFA, and strong passwords.

## Documentation

Comprehensive documentation is available in the `docs/` directory:

- **[SETUP.md](docs/SETUP.md)**: Local development setup guide.
- **[ARCHITECTURE.md](docs/ARCHITECTURE.md)**: System design and architecture overview.
- **[API.md](docs/API.md)**: Complete API reference.
- **[DEVELOPMENT.md](docs/DEVELOPMENT.md)**: Coding workflow and standards.
- **[COMPONENTS.md](docs/COMPONENTS.md)**: Vue components guide.

## Quick Setup

### Prerequisites

- Node.js 18+
- Yarn 1.22+

### Installation

1. Install dependencies:
   ```bash
   yarn install
   ```

2. Setup database:
   ```bash
   yarn cf:reset
   yarn cf:typegen
   ```

3. Create `.env` file (see `.env.example`):
   ```env
   NUXT_SESSION_PASSWORD=...
   FLEET_AGENT_URL=...
   NUXT_UI_PRO_LICENSE=...
   VITE_DEFAULT_TOKEN=...
   ```

### Development Server

Start the development server on `http://localhost:3001`:

```bash
yarn dev
```

### Production Build

Build the application for production (Cloudflare Pages):

```bash
yarn build
```

Preview locally:

```bash
yarn preview
```

## Tech Stack

- **Frontend**: Vue 3, Nuxt 4, TypeScript, TailwindCSS, Nuxt UI Pro
- **Backend**: Nitro, Drizzle ORM, Cloudflare D1 (SQLite)
- **Infrastructure**: Cloudflare Pages + Workers
- **Authentication**: Session-based with `nuxt-auth-utils`

## Key Features

- **Real-time AI Chat**: Streaming responses using Server-Sent Events (SSE).
- **Dynamic Content**: Renders URLs, emails, code blocks, and HTML previews directly in the chat canvas.
- **Secure**: Encrypted sessions and environment-aware configuration.
- **Responsive**: Modern UI with dark mode support.
