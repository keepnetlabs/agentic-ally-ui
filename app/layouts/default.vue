<script setup lang="ts">
// @ts-nocheck
import { LazyModalConfirm } from '#components'
import { useCanvas } from '../composables/useCanvas'
import { useChatNavigation } from '../composables/useChatNavigation'
import { useRouteParams } from '../composables/useRouteParams'
const { isCanvasVisible, hideCanvas } = useCanvas()

const route = useRoute()
const router = useRouter()
const toast = useToast()
const overlay = useOverlay()

// Get streaming state
const { isStreaming, stopStreaming, streamingChatId } = useChatNavigation()

// Get route params helper
const { buildUrl } = useRouteParams()

const open = ref(false)

// Build URLs with query params
const homeUrl = computed(() => buildUrl('/'))
const filesUrl = computed(() => buildUrl('/files'))

const deleteModal = overlay.create(LazyModalConfirm, {
  props: {
    title: 'Delete chat',
    description: 'Are you sure you want to delete this chat? This cannot be undone.',
    confirmLabel: 'Delete',
    cancelLabel: 'Cancel'
  }
})

const sessionId = route.query.sessionId as string
const chatsUrl = buildUrl('/api/chats')

const { data: chats, refresh: refreshChats } = await useFetch(chatsUrl, {
  key: 'chats',
  transform: data => data.map(chat => ({
    id: chat.id,
    label: chat.title || 'Untitled',
    to: buildUrl(`/chat/${chat.id}`),
    icon: 'i-lucide-message-circle',
    createdAt: chat.createdAt
  }))
})

onNuxtReady(async () => {
  const first10 = (chats.value || []).slice(0, 10)
  for (const chat of first10) {
    // prefetch the chat and let the browser cache it
    const prefetchUrl = buildUrl(`/api/chats/${chat.id}`)
    await $fetch(prefetchUrl)
  }
})

watch(isCanvasVisible, (newValue) => {
  if (newValue) {
    window.parent.postMessage({
      type: 'CANVAS_CLICK'
    }, '*')
  }
})

onMounted(() => {
  window.addEventListener('message', (event) => {
    if (event.data.type === 'FULLWIDTH_TOGGLE') {
      const { data } = event
      if (!data.isFullWidth) {
        hideCanvas()
      }
    }
  })
})

const { groups } = useChats(chats)

const items = computed(() => groups.value?.flatMap((group) => {
  return [{
    label: group.label,
    type: 'label' as const
  }, ...group.items.map((item: any) => ({
    label: item.label,
    to: item.to,  // Navigation URL from useFetch transform
    slot: 'chat' as const,
    id: item.id,
    class: item.label === 'Untitled' ? 'text-muted' : ''
  }))]
}))

// Search items with homeUrl for "New chat"
const searchItems = computed(() => [{
  id: 'links',
  items: [{
    label: 'New chat',
    to: homeUrl.value,
    icon: 'i-lucide-square-pen'
  }]
}, ...groups.value?.map((group) => ({
  id: group.label.toLowerCase(),
  items: group.items
})) || []])

async function deleteChat(id: string) {
  const instance = deleteModal.open()
  const result = await instance.result
  if (!result) {
    return
  }

  const deleteUrl = buildUrl(`/api/chats/${id}`)
  await $fetch(deleteUrl, { method: 'DELETE' })

  toast.add({
    title: 'Chat deleted',
    description: 'Your chat has been deleted',
    icon: 'i-lucide-trash'
  })

  refreshChats()

  if (route.params.id === id) {
    navigateTo(homeUrl.value)
  }
}

defineShortcuts({
  c: () => {
    navigateTo(homeUrl.value)
  }
})
</script>

<template>
  <UDashboardGroup unit="rem">
    <UDashboardSidebar
      id="default"
      v-model:open="open"
      v-model:collapsed="isCanvasVisible"
      :min-size="12"
      collapsible
      resizable
      class="bg-elevated/50"
    >
      <template #header="{ collapsed }">
        <span v-if="!collapsed" class="text-[15px] font-bold text-highlighted">Your chats</span>

        <div v-if="!collapsed" class="flex items-center gap-1.5 ms-auto">
          <UDashboardSearchButton collapsed class="pl-0 hover:bg-transparent" />
          <UDashboardSidebarCollapse />
        </div>
        
        <div v-if="collapsed" class="flex items-center justify-center w-full">
          <UTooltip text="Expand sidebar">
            <UDashboardSidebarCollapse />
          </UTooltip>
        </div>
      </template>

      <template #default="{ collapsed }">
        <div class="flex flex-col gap-1.5">
          <UTooltip text="New chat" :disabled="!collapsed">
            <UButton
              block
              :to="homeUrl"
              variant="outline"
              :icon="collapsed ? 'i-lucide-plus' : undefined"
              :label="collapsed ? undefined : 'New chat'"
              :aria-label="collapsed ? 'New chat' : undefined"
              :ui="{
                base: [
                  'rounded border border-[#B3D4FC] bg-[#F1F8FE] text-[#2196F3] hover:bg-[#E3F0FD] dark:border-white dark:bg-black dark:text-white dark:hover:bg-gray-900 font-semibold text-sm leading-5',
                  collapsed ? 'justify-center px-0' : ''
                ].join(' '),
                font: 'font-sans'
              }"
              @click="open = false"
            />
          </UTooltip>

          <UTooltip text="Files" :disabled="!collapsed">
            <UButton
              block
              :to="filesUrl"
              variant="ghost"
              color="neutral"
              icon="i-lucide-folder"
              :label="collapsed ? undefined : 'Files'"
              :aria-label="collapsed ? 'Files' : undefined"
              @click="open = false"
            />
          </UTooltip>

          <template v-if="collapsed">
            <UTooltip text="Search">
              <UDashboardSearchButton collapsed />
            </UTooltip>
          </template>
        </div>

        <UNavigationMenu
          v-if="!collapsed"
          :items="items"
          :collapsed="collapsed"
          orientation="vertical"
          :ui="{
            link: 'overflow-hidden',
            linkActive: 'dark:!text-white'
          }"
        >
          <template #chat-trailing="{ item }">
            <div class="flex -mr-1.25 translate-x-full group-hover:translate-x-0 transition-transform">
              <UButton
                icon="i-lucide-x"
                color="neutral"
                variant="ghost"
                size="xs"
                class="text-muted hover:text-primary hover:bg-accented/50 focus-visible:bg-accented/50 p-0.5"
                tabindex="-1"
                @click.stop.prevent="deleteChat(item.id)"
              />
            </div>
          </template>
        </UNavigationMenu>
      </template>
    </UDashboardSidebar>

    <UDashboardSearch
      placeholder="Search chats..."
      :groups="searchItems"
    />

    <slot />
  </UDashboardGroup>
</template>

