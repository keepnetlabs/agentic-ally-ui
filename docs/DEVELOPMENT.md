# Development Workflow

## File Naming Conventions

### Frontend
- **Components**: PascalCase (e.g., `ChatCanvas.vue`, `UserMenu.vue`)
- **Composables**: `use[Name]` (e.g., `useCanvas.ts`)
- **Utils**: camelCase (e.g., `parseAIMessage.ts`)
- **Constants**: UPPER_SNAKE_CASE (e.g., `MAX_MESSAGE_LENGTH`)

### Backend
- **Endpoints**: `resource.[method].ts` (e.g., `chats.post.ts`, `chats/[id].get.ts`)
- **Routes**: `path/to/route.ts`
- **Middleware**: descriptive name (e.g., `cors.ts`)
- **Utilities**: camelCase (e.g., `drizzle.ts`)

## Code Style

### Vue Components

```vue
<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'

// Types
interface Item {
  id: string
  name: string
}

// Props
const props = defineProps<{
  items: Item[]
  title: string
}>()

// Emits
const emit = defineEmits<{
  select: [item: Item]
}>()

// State
const isLoading = ref(false)
const selected = ref<Item | null>(null)

// Computed
const filteredItems = computed(() => {
  return props.items.filter(item => item.name.includes(props.title))
})

// Methods (with handle prefix for events)
const handleSelect = (item: Item) => {
  selected.value = item
  emit('select', item)
}

// Lifecycle
onMounted(() => {
  // Setup code
})
</script>

<template>
  <div class="space-y-4">
    <!-- Use TailwindCSS classes only -->
    <button @click="handleSelect" class="px-4 py-2 bg-blue-500 hover:bg-blue-600">
      Select
    </button>
  </div>
</template>
```

### TypeScript/API Endpoints

```typescript
export default defineEventHandler(async (event) => {
  // 1. Authenticate
  const session = await getUserSession(event)
  if (!session?.user?.id) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  // 2. Validate
  const { id } = getRouterParams(event)
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Missing id' })
  }

  // 3. Query
  const item = await useDrizzle().query.items.findFirst({
    where: (item, { eq }) => eq(item.id, id)
  })

  if (!item) {
    throw createError({ statusCode: 404, statusMessage: 'Not found' })
  }

  // 4. Return
  return item
})
```

## Git Workflow

### Commit Messages
- Be descriptive: `Add canvas auto-trigger for training URLs`
- Not: `update` or `fix bug`
- Reference issues: `Fix chat loading (#123)`

### Before Pushing
```bash
# Check for issues
yarn typecheck

# No console.log() left
# No @ts-ignore comments
# No dead code
# All tests pass (if applicable)
```

## Common Development Tasks

### Adding a New API Endpoint

1. Create file: `server/api/resource.[method].ts`
2. Implement logic with proper validation
3. Add error handling
4. Test with curl or API client

Example:
```typescript
// server/api/items.post.ts
export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  if (!session?.user?.id) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  const body = await readBody(event)
  if (!body.name) {
    throw createError({ statusCode: 400, statusMessage: 'Missing name' })
  }

  const item = await useDrizzle().insert(items).values({
    id: randomUUID(),
    userId: session.user.id,
    name: body.name,
    createdAt: Date.now()
  }).returning()

  return item[0]
})
```

### Adding a New Component

1. Create file: `app/components/MyComponent.vue`
2. Use TypeScript with `<script setup lang="ts">`
3. Define props and emits with types
4. Use TailwindCSS for styling
5. Auto-imported (no import needed)

### Adding a New Composable

1. Create file: `app/composables/useMyComposable.ts`
2. Define private state and public API
3. Use `readonly()` for exposed state
4. Export main function

Example:
```typescript
export const useMyComposable = () => {
  // Private
  const _cache = ref(new Map())

  // Public
  const data = ref<MyType | null>(null)
  const isLoading = ref(false)

  const fetch = async () => {
    isLoading.value = true
    try {
      data.value = await $fetch('/api/data')
    } finally {
      isLoading.value = false
    }
  }

  return {
    data: readonly(data),
    isLoading: readonly(isLoading),
    fetch
  }
}
```

### Database Schema Changes

1. Modify `server/database/schema.ts`
2. Create migration: `server/database/migrations/[number]_description.sql`
3. Test locally: `yarn cf:reset`
4. Generate types: `yarn cf:typegen`

### Debugging

**Frontend:**
- Open DevTools (F12)
- Check Network tab for API calls
- Check Console for errors
- Use browser DevTools → Application → Cookies

**Backend:**
- Check terminal logs
- Add temporary console.log (remove before commit)
- Use Cloudflare dashboard for production logs

**Database:**
```bash
# Query local database
npx wrangler d1 execute agentic-ally-db --local --command "SELECT * FROM chats"
```

## Testing Checklist

Before committing:
- [ ] No TypeScript errors
- [ ] Code follows conventions
- [ ] No console.log() left
- [ ] No dead code
- [ ] Components render correctly
- [ ] API endpoints respond correctly
- [ ] Dark mode looks good
- [ ] Responsive on mobile
- [ ] No accessibility violations
- [ ] Git diff is clean (no accidental changes)

## Performance Tips

- Use `computed()` for derived values
- Use `readonly()` for immutable state
- Lazy load heavy components
- Prefetch critical data
- Use proper database indexes
- Cache frequently accessed data

## Troubleshooting

### TypeScript Errors After Schema Change
```bash
yarn cf:typegen
```

### Component not updating
- Check if using `ref()` or `reactive()` correctly
- Check watchers are set up
- Avoid mutating objects directly

### API errors in production
- Check environment variables in Cloudflare
- Check database migrations applied
- Check logs in Cloudflare dashboard

### Database migration failed
```bash
# Reset and try again
yarn cf:reset
```

## Useful Commands

```bash
yarn dev              # Start dev server
yarn build            # Build for production
yarn typecheck        # Check TypeScript
yarn cf:reset         # Reset database
yarn cf:typegen       # Generate database types
yarn deploy           # Deploy to Cloudflare
yarn clean            # Clean build artifacts
```

## Resources

- [Nuxt Docs](https://nuxt.com)
- [Vue 3 Docs](https://vuejs.org)
- [TailwindCSS Docs](https://tailwindcss.com)
- [Drizzle Docs](https://orm.drizzle.team)
- [Nitro Docs](https://nitro.unjs.io)

See [ARCHITECTURE.md](ARCHITECTURE.md) for system design.
See [API.md](API.md) for endpoint documentation.
