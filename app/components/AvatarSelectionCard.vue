<script setup lang="ts">
import { computed, ref } from 'vue'

type AvatarItem = {
  avatar_id: string
  avatar_name: string
  gender?: string
  preview_image_url?: string
  preview_video_url?: string
}

const props = defineProps<{
  payload: {
    avatars: AvatarItem[]
    total: number
  }
}>()

const emit = defineEmits<{
  (e: 'select', value: string): void
}>()

const query = ref('')
const isExpanded = ref(true)

const isAutoSelected = computed(() => props.payload.total === 1)

const filteredAvatars = computed(() => {
  const items = props.payload.avatars || []
  const q = query.value.trim().toLowerCase()
  if (!q) return items
  return items.filter((avatar) => avatar.avatar_name?.toLowerCase().includes(q))
})

const submitSelection = (avatar: AvatarItem, index: number) => {
  if (isAutoSelected.value) return
  const fallback = String(index + 1)
  emit('select', avatar.avatar_name?.trim() || fallback)
}

const toggleExpanded = () => {
  isExpanded.value = !isExpanded.value
}
</script>

<template>
  <div class="mb-2 overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 shadow-sm dark:border-gray-700 dark:bg-gray-950">
    <div class="px-3 py-2.5 md:px-5 md:py-4">
      <div class="flex items-center justify-between gap-2">
        <div class="flex items-center gap-2 text-slate-700 dark:text-slate-200">
          <UIcon name="i-lucide-user-round" class="h-4 w-4" />
          <span class="text-sm font-medium">Avatar Selection</span>
        </div>
        <div class="flex items-center gap-1.5">
          <UBadge :color="isAutoSelected ? 'success' : 'warning'" variant="soft" size="xs">
            {{ isAutoSelected ? 'Auto-selected' : `${payload.total} options` }}
          </UBadge>
          <UButton
            color="neutral"
            variant="ghost"
            size="xs"
            :aria-label="isExpanded ? 'Collapse avatar selection' : 'Expand avatar selection'"
            @click="toggleExpanded"
          >
            <UIcon
              name="i-mdi-menu-down"
              class="h-4 w-4 transition-transform duration-200"
              :class="isExpanded ? 'rotate-0' : '-rotate-90'"
            />
          </UButton>
        </div>
      </div>

      <div v-show="isExpanded && payload.total > 12" class="mt-3">
        <UInput v-model="query" icon="i-lucide-search" placeholder="Search avatar by name" size="sm" />
        <p class="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
          Tip: Click a card to send selection.
        </p>
      </div>

      <div v-show="isExpanded" class="mt-2.5 grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-4">
        <component
          v-for="(avatar, index) in filteredAvatars"
          :key="avatar.avatar_id || `${avatar.avatar_name}-${index}`"
          :is="isAutoSelected ? 'div' : 'button'"
          :type="isAutoSelected ? undefined : 'button'"
          class="group overflow-hidden rounded-lg border border-slate-200 bg-white p-1.5 text-left transition hover:border-slate-300 hover:shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-primary dark:border-gray-700 dark:bg-gray-900 dark:hover:border-gray-500"
          :disabled="isAutoSelected ? undefined : false"
          :aria-label="`Select avatar ${avatar.avatar_name || index + 1}`"
          @click="submitSelection(avatar, index)"
        >
          <div class="relative h-20 overflow-hidden rounded-md bg-slate-100 dark:bg-gray-800 md:h-24">
            <img
              v-if="avatar.preview_image_url"
              :src="avatar.preview_image_url"
              :alt="avatar.avatar_name"
              class="h-full w-full object-cover"
              loading="lazy"
            />
            <div v-else class="flex h-full items-center justify-center text-xs text-slate-500 dark:text-slate-300">
              No preview
            </div>
            <video
              v-if="avatar.preview_video_url"
              :src="avatar.preview_video_url"
              class="pointer-events-none absolute inset-0 hidden h-full w-full object-cover group-hover:block"
              muted
              autoplay
              loop
              playsinline
            />
            <UBadge
              v-if="avatar.preview_video_url"
              color="neutral"
              variant="soft"
              size="xs"
              class="absolute left-1.5 top-1.5"
            >
              Preview
            </UBadge>
          </div>

          <div class="mt-1.5 flex items-center justify-between gap-1.5">
            <p class="truncate text-[11px] font-medium text-slate-700 dark:text-slate-100" :title="avatar.avatar_name">
              {{ avatar.avatar_name }}
            </p>
            <UBadge v-if="avatar.gender" color="neutral" variant="soft" size="xs">
              {{ avatar.gender }}
            </UBadge>
          </div>
        </component>
      </div>
    </div>
  </div>
</template>
