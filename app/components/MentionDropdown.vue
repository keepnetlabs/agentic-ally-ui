<template>
  <div
    v-if="open"
    class="absolute left-0 right-0 bottom-full mb-2 z-30 pointer-events-none"
  >
    <div ref="listRef" class="max-h-44 overflow-auto rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-lg">
      <div v-if="loading" class="flex items-center gap-2 px-3 py-2 text-xs text-gray-500 dark:text-gray-400">
        <UIcon name="i-lucide-loader-2" class="h-3.5 w-3.5 animate-spin" />
        Loading results...
      </div>
      <div
        v-else-if="results.length === 0"
        class="flex items-center gap-2 px-3 py-2 text-xs text-gray-500 dark:text-gray-400"
      >
        <UIcon name="i-lucide-search-x" class="h-3.5 w-3.5" />
        No results...
      </div>
      <button
        v-for="(item, index) in results"
        :key="`${item.kind}-${item.id}`"
        type="button"
        :data-mention-index="index"
        class="flex w-full items-center gap-3 px-3 py-2 text-left text-sm hover:bg-gray-50 dark:hover:bg-gray-800 pointer-events-auto"
        :class="index === activeIndex ? 'bg-gray-50 dark:bg-gray-800' : ''"
        @mousedown.prevent="$emit('select', item)"
      >
        <div
          v-if="!item.avatar"
          class="flex h-6 w-6 items-center justify-center rounded-full bg-gray-200 text-[10px] font-semibold text-gray-700 dark:bg-gray-700 dark:text-gray-100"
        >
          {{ getInitials(item) }}
        </div>
        <img
          v-else
          :src="item.avatar"
          :alt="item.name"
          class="h-6 w-6 rounded-full"
        />
        <div class="flex flex-col">
          <span class="flex items-center gap-2 font-medium text-gray-900 dark:text-gray-100">
            {{ item.name }}
            <span
              class="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold"
              :class="item.kind === 'group'
                ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-200'
                : 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-200'"
            >
              <UIcon :name="item.kind === 'group' ? 'i-lucide-users' : 'i-lucide-user'" class="h-3 w-3" />
              {{ item.kind === 'group' ? 'Target Group' : 'Target User' }}
            </span>
          </span>
          <span class="text-xs text-gray-500 dark:text-gray-400">
            {{ item.kind === 'group'
              ? `${item.memberCount ?? 0} ${((item.memberCount ?? 0) === 1 || (item.memberCount ?? 0) === 0) ? 'member' : 'members'}`
              : item.email }}
          </span>
        </div>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { MentionItem } from '../composables/useMentions'

defineProps<{
  open: boolean
  loading: boolean
  results: MentionItem[]
  activeIndex: number
  getInitials: (item: MentionItem) => string
}>()

defineEmits<{
  select: [item: MentionItem]
}>()

const listRef = ref<HTMLElement | null>(null)

defineExpose({
  listRef
})
</script>
