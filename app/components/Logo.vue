<template>
  <img :src="src" class="h-8 w-auto shrink-0">
</template>

<script setup lang="ts">
withDefaults(defineProps<{
  src?: string
}>(), {
  src: 'https://imagedelivery.net/KxWh-mxPGDbsqJB3c5_fmA/ed60ad9d-9ad1-48a7-177a-bac702cdce00/public'
})
</script>
