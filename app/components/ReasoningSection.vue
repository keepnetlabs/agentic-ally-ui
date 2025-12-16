<script setup lang="ts">
const props = defineProps<{
  reasoning?: string
}>()
</script>

<template>
  <div v-if="reasoning" class="mb-2">
    <UCollapsible class="text-xs">
      <template #default>
        <UButton variant="ghost" size="xs" class="text-muted-foreground ml-0 pl-0">
          <UIcon name="i-lucide-brain" class="w-3.5 h-3.5 mr-2" />
          Reasoning
        </UButton>
      </template>
      <template #content>
        <pre class="whitespace-pre-wrap break-words text-xs text-muted-foreground pt-2">{{ reasoning }}</pre>
      </template>
    </UCollapsible>
  </div>
</template>

