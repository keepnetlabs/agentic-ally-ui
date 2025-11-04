<script setup lang="ts">
const { model, models } = useLLM()
</script>

<template>
  <USelectMenu
    v-model="model"
    :items="models"
    option-attribute="value"
    searchable
    variant="ghost"
    class="hover:bg-default focus:bg-default data-[state=open]:bg-default"
    :ui="{
      trailingIcon: 'group-data-[state=open]:rotate-180 transition-transform duration-200',
      content: 'min-w-[148px]'
    }"
  />
</template>

<style scoped>
:deep([role="listbox"]) {
  min-width: 148px !important;
}
</style>
