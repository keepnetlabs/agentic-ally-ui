<script setup lang="ts">
defineProps<{
  title: string
  description: string
  confirmLabel?: string
  cancelLabel?: string
}>()

const emit = defineEmits<{ close: [boolean] }>()

</script>

<template>
  <UModal
    :title="title"
    :description="description"
    :ui="{
      footer: 'flex-row-reverse justify-start'
    }"
    :close="false"
    :dismissible="false"
  >
    <template #footer>
      <UButton
        :label="confirmLabel || 'Delete'"
        color="error"
        @click="emit('close', true)"
      />
      <UButton
        color="neutral"
        variant="ghost"
        :label="cancelLabel || 'Cancel'"
        @click="emit('close', false)"
      />
    </template>
  </UModal>
</template>
