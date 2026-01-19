# Components Guide

## Overview

The project has 7 Vue components in `app/components/`. All are auto-imported - no manual imports needed.

## Components

### ChatCanvas.vue (11.6 KB)

**Purpose**: Multi-format content viewer in the right panel

**Features:**
- Display URLs in iframe with reload/fullscreen controls
- Display email templates with From/To/Subject headers
- Display code with syntax highlighting and copy button
- Display HTML preview
- Loading and error states
- Auto-open on URL detection

**Props:**
None (uses `useCanvas()` composable for state)

**Methods (exposed):**
- `updateContent(content)` - Set canvas content
- `clearContent()` - Clear and reset state

**Content Types:**
```typescript
type: 'preview' | 'email' | 'code' | 'html' | 'markdown' | 'url'
```

**Example Usage:**
```typescript
const { canvasContent } = useCanvas()

// In template:
<ChatCanvas ref="canvasRef" />
```

---

### DashboardNavbar.vue (688 B)

**Purpose**: Top navigation bar wrapper

**Features:**
- Logo and app title
- Canvas visibility toggle
- Dark mode toggle button
- New chat button (mobile)

**Props:**
None

**Usage:**
```vue
<DashboardNavbar />
```

**Styling:**
- Flex layout with items-center
- Gap and padding for spacing
- Dark mode support

---

### UserMenu.vue (4.3 KB)

**Purpose**: User profile dropdown menu

**Features:**
- Display user avatar and name
- Theme color selector (primary & neutral)
- Dark/light mode toggle
- Links to documentation
- Logout button

**Props:**
- `collapsed?: boolean` - Hide text when sidebar collapsed

**Data Returned:**
```typescript
{
  user: {
    name: string
    email: string
    avatar: string
  }
}
```

**Usage:**
```vue
<UserMenu :collapsed="isSidebarCollapsed" />
```

---

### ModelSelect.vue (358 B)

**Purpose**: LLM model selector dropdown

**Features:**
- Model dropdown
- Currently hardcoded: `gpt-oss-120b`
- Can be extended for multiple models

**Props:**
None

**Emits:**
- `select` - Model selected

**Usage:**
```vue
<ModelSelect @select="handleModelChange" />
```

**To Add More Models:**
1. Update `AVAILABLE_MODELS` constant
2. Update API request body
3. Backend validates model exists

---

### ModalConfirm.vue (585 B)

**Purpose**: Confirmation dialog for destructive actions

**Features:**
- Modal overlay
- Title and description
- Confirm/Cancel buttons
- Keyboard shortcuts (Enter to confirm, Esc to cancel)

**Props:**
- `title: string` - Dialog title
- `description: string` - Dialog message
- `confirmText?: string` - Confirm button label (default: "Delete")
- `cancelText?: string` - Cancel button label (default: "Cancel")

**Emits:**
- `confirm` - User clicked confirm
- `cancel` - User clicked cancel

**Usage:**
```vue
<ModalConfirm
  title="Delete chat"
  description="Are you sure? This cannot be undone."
  @confirm="handleDelete"
  @cancel="handleCancel"
/>
```

---

### Logo.vue (158 B)

**Purpose**: Company logo display

**Features:**
- SVG/image logo
- Reusable component
- Responsive sizing

**Props:**
- `src?: string` - Logo URL (default: Keepnet logo)

**Usage:**
```vue
<!-- Default logo -->
<Logo />

<!-- Custom logo -->
<Logo src="https://example.com/logo.png" />
```

---

### PreStream.vue (978 B)

**Purpose**: Streaming syntax highlighter for code blocks

**Features:**
- Code syntax highlighting with Shiki
- Language detection and mapping
- Dark/light theme support
- Caching for performance
- Works with markdown rendering

**Props:**
- `code: string` - Code to highlight
- `language: string` - Programming language
- `class?: string` - Additional CSS classes

**Languages Supported:**
- JavaScript → `js`
- TypeScript → `ts`
- Vue → `vue`
- CSS → `css`
- And all Shiki languages

**Usage:**
In markdown code blocks:
````markdown
```typescript
const hello = "world"
```
````

Automatically uses PreStream for rendering.

---

---

### EmailCanvas.vue (3.5 KB)

**Purpose**: Renders HTML email previews within the chat canvas.

**Features:**
- Displays email headers (From, To, Subject)
- Sanitiszes and renders email body HTML
- Responsive email container

**Props:**
- `content`: Email HTML content object

---

### HTMLEditorModal.vue (12.8 KB)

**Purpose**: A full-featured modal for editing HTML content.

**Features:**
- Code editor with syntax highlighting
- Live preview toggle
- Save and Cancel actions

**Usage:**
Used for refining generated email or landing page templates.

---

### LandingPageCanvas.vue (7.2 KB)

**Purpose**: Renders phishing landing page previews.

**Features:**
- Simulates a browser window
- Renders full-page HTML content
- form interaction simulation

---

### PhishingEmailCard.vue (1.9 KB) & TrainingUrlCard.vue (1.9 KB) & LandingPageCard.vue (1.7 KB)

**Purpose**: Card components displayed in the chat stream to represent generated artifacts.

**Features:**
- Preview thumbnail or icon
- Title and description
- Click to open detailed view in Canvas

---

### ReasoningSection.vue (626 B)

**Purpose**: collapsible section to display the AI's "Chain of Thought" or reasoning steps.

**Features:**
- Expand/Collapse toggle
- Displays raw reasoning text from the LLM
- Automatically shown during streaming if reasoning delta is present

---

### StreamingIndicator.vue (334 B)

**Purpose**: Visual pulse/dot animation to indicate active AI generation.

---

## Component Best Practices

### Creating New Components

1. **Use `<script setup lang="ts">`**
   ```vue
   <script setup lang="ts">
   interface Props {
     title: string
   }

   const props = defineProps<Props>()
   </script>
   ```

2. **Define Props with TypeScript**
   ```typescript
   interface MyProps {
     items: Item[]
     isLoading?: boolean
   }

   const props = withDefaults(defineProps<MyProps>(), {
     isLoading: false
   })
   ```

3. **Use TailwindCSS Only**
   ```vue
   <!-- ✅ Good -->
   <button class="px-4 py-2 bg-blue-500 hover:bg-blue-600 dark:bg-blue-700">

   <!-- ❌ Bad -->
   <button style="padding: 8px 16px; background: blue;">
   ```

4. **Handle Events with `handle` Prefix**
   ```typescript
   const handleClick = () => {
     // Logic here
   }

   const handleInputChange = (e) => {
     // Logic here
   }
   ```

5. **Use Semantic HTML**
   ```vue
   <!-- ✅ Good -->
   <button @click="handleClick">Click me</button>

   <!-- ❌ Bad -->
   <div @click="handleClick">Click me</div>
   ```

### Performance

- Use `computed()` for derived values
- Use `v-if` for large components
- Lazy load heavy components with `<Suspense>`
- Avoid `v-for` loops in templates, use computed instead

### Accessibility

- Always use `aria-label` for icon buttons
- Use semantic HTML tags
- Ensure keyboard navigation works
- Test with screen readers

---

## Composable Integration

Most components use composables for state:

### useCanvas()
```typescript
const { isCanvasVisible, canvasContent, toggleCanvas, updateCanvasContent } = useCanvas()
```

### useLLM()
```typescript
const { model, models } = useLLM()
```

### useChats()
```typescript
const { groups } = useChats(chats)
```

See [ARCHITECTURE.md](ARCHITECTURE.md) for more details.

---

## Common Patterns

### Loading State
```vue
<template>
  <div v-if="isLoading" class="flex items-center justify-center">
    <Spinner />
  </div>
  <div v-else>
    <!-- Content -->
  </div>
</template>
```

### Error Handling
```vue
<template>
  <div v-if="error" class="p-4 bg-red-50 text-red-700 rounded">
    {{ error }}
  </div>
  <div v-else>
    <!-- Content -->
  </div>
</template>
```

### Modal
```vue
<template>
  <Teleport to="body">
    <div v-if="isOpen" class="fixed inset-0 bg-black/50">
      <!-- Modal content -->
    </div>
  </Teleport>
</template>
```

---

## Testing Components

### Manual Testing Checklist
- [ ] Renders without errors
- [ ] Props work correctly
- [ ] Events emit properly
- [ ] Responsive on mobile
- [ ] Dark mode looks good
- [ ] Keyboard navigation works
- [ ] No console errors

### Using DevTools
1. Open browser DevTools
2. Vue DevTools extension (if installed)
3. Inspect component props and state
4. Check event emits

---

## Debugging

### Component Not Rendering
- Check if data is reactive (use `ref()` or `reactive()`)
- Check if `v-if` conditions are correct
- Check for TypeScript errors

### Props Not Updating
- Make sure using reactive assignments
- Check watchers if needed
- Avoid mutating props directly

### Events Not Firing
- Check event name matches emitted event
- Check listener syntax: `@event="handler"`
- Check handler function exists

---

## Resources

- [Vue 3 Components Guide](https://vuejs.org/guide/essentials/component-basics.html)
- [Nuxt Components](https://nuxt.com/docs/guide/concepts/auto-imports#components)
- [TailwindCSS Components](https://tailwindcss.com)
