# Setup Guide

## Prerequisites

- Node.js 18+
- Yarn 1.22+

## Local Development

### 1. Install Dependencies
```bash
yarn install
```

### 2. Setup Database

Reset the local D1 database:
```bash
yarn cf:reset
```

This command:
- Removes local wrangler state
- Applies all migrations
- Creates tables (users, chats, messages)

### 3. Generate Database Types
```bash
yarn cf:typegen
```

Creates TypeScript types from Drizzle schema for type safety.

### 4. Environment Variables

Create `.env` file in project root:
```env
NUXT_SESSION_PASSWORD=your-32-character-password-here
FLEET_AGENT_URL=http://localhost:4111/chat
NUXT_UI_PRO_LICENSE=your-license-key
VITE_DEFAULT_TOKEN=your_jwt_token_here
```

**Note:**
- `NUXT_SESSION_PASSWORD`: Used for encrypting session cookies (min 32 chars)
- `FLEET_AGENT_URL`: Local Fleet Agent Worker endpoint
- `NUXT_UI_PRO_LICENSE`: Required for Nuxt UI Pro components
- `VITE_DEFAULT_TOKEN`: Default access token for local development (fallback)

### 5. Start Development Server

```bash
yarn dev
```

Server runs on `http://localhost:3001`

### 6. Verify Setup

1. Open browser: `http://localhost:3001`
2. Click "New chat" button
3. Enter a prompt: "Create Phishing Awareness"
4. Verify message appears and AI responds

## Common Issues

### Chat returns "404 Not Found"

**Cause**: Session cookie not being set (localhost HTTP issue)

**Solution**:
- Clear browser cookies for localhost
- Hard refresh (Ctrl+Shift+R)
- Check browser DevTools → Application → Cookies

**Technical**:
- Dev uses `sameSite: 'lax'` + `secure: false` to allow HTTP
- If still failing, restart dev server

### Database Error: "no such table: chats"

**Cause**: Migrations didn't run

**Solution**:
```bash
yarn cf:reset
```

### TypeScript Errors

**Cause**: Database types not generated

**Solution**:
```bash
yarn cf:typegen
```

### Port 3001 Already in Use

**Solution**:
```bash
yarn dev --port 3002
```

Or kill the process using port 3001.

## Database Management

### Reset Everything
```bash
yarn cf:reset
```

### View Database Locally
D1 database stored at: `.wrangler/state/d1/`

To inspect:
```bash
# List databases
npx wrangler d1 list --local

# Execute query
npx wrangler d1 execute agentic-ally-db --local --command "SELECT * FROM chats"
```

### View Migrations
```
server/database/migrations/
```

## Build for Production

```bash
yarn build
```

Creates optimized build in `dist/` folder.

## Deploy to Cloudflare

```bash
yarn deploy
```

Deploys to Cloudflare Pages. Requires:
- Cloudflare account
- Pages project configured
- Environment variables set in Cloudflare dashboard

## Troubleshooting

**Issue**: Dev server won't start
- Clear `.nuxt` folder: `rm -rf .nuxt`
- Reinstall: `yarn install`
- Start again: `yarn dev`

**Issue**: Database locked
- Kill dev server
- Remove `.wrangler/state/d1/` folder
- Run `yarn cf:reset`
- Restart dev server

**Issue**: TypeScript errors in IDE
- Run: `yarn cf:typegen`
- Restart IDE/Cursor
- Clear TypeScript cache if needed

## Next Steps

See [DEVELOPMENT.md](DEVELOPMENT.md) for development workflow.
