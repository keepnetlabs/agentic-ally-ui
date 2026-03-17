<script setup lang="ts">
import { computed } from 'vue'
import type { TableSection } from '../../types/report'

const props = defineProps<{ section: TableSection }>()

// Auto-shrink font when too many columns
const tableClass = computed(() => {
  const cols = props.section.columns.length
  if (cols >= 7) return 'text-[9px]'
  if (cols >= 5) return 'text-[10px]'
  return 'text-xs'
})

const cellPadding = computed(() => {
  const cols = props.section.columns.length
  if (cols >= 7) return 'px-1.5 py-1'
  if (cols >= 5) return 'px-2 py-1.5'
  return 'px-3 py-2'
})
</script>

<template>
  <div>
    <h2 class="text-base font-bold text-[#0B326F] mb-4">{{ section.title }}</h2>
    <div class="overflow-x-auto">
      <table class="w-full" :class="tableClass">
        <thead>
          <tr class="border-b-2 border-[#ECEFF3]">
            <th
              v-for="(col, ci) in section.columns"
              :key="ci"
              class="text-left font-semibold text-[#0B326F]"
              :class="[cellPadding, { 'bg-[#EEF2F8]': ci === section.highlightColumn }]"
            >
              {{ col }}
            </th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="(row, ri) in section.rows"
            :key="ri"
            :class="[
              'border-b border-[#ECEFF3] transition-colors',
              ri % 2 === 1 ? 'bg-[#FAFBFC]' : '',
            ]"
          >
            <td
              v-for="(cell, ci) in row"
              :key="ci"
              class="text-[#41526B]"
              :class="[cellPadding, { 'bg-[#EEF2F8]/50 font-medium': ci === section.highlightColumn }]"
            >
              {{ cell }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
