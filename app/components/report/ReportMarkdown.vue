<script setup lang="ts">
import { computed } from 'vue'
import { marked } from 'marked'

const props = defineProps<{ content: string }>()

const html = computed(() => {
  // Strip leading heading if it duplicates the section title (AI often repeats it)
  let content = props.content
  const firstLine = content.split('\n')[0]
  if (firstLine.match(/^#{1,3}\s/)) {
    content = content.substring(firstLine.length).trimStart()
  }
  return marked.parse(content, { breaks: true }) as string
})
</script>

<template>
  <div class="report-md" v-html="html" />
</template>

<style>
/* NOT scoped — v-html content doesn't get scoped attributes */
.report-md {
  font-family: 'Inter', var(--font-sans, ui-sans-serif, system-ui, sans-serif) !important;
  font-size: 0.8rem !important;
  line-height: 1.55;
  color: #41526B;
}
.report-md * {
  font-family: inherit !important;
}
.report-md h1 { font-size: 0.95rem !important; font-weight: 700; margin: 0.8rem 0 0.3rem; }
.report-md h2 { font-size: 0.88rem !important; font-weight: 600; margin: 0.7rem 0 0.25rem; }
.report-md h3 { font-size: 0.83rem !important; font-weight: 600; margin: 0.5rem 0 0.2rem; }
.report-md h4 { font-size: 0.8rem !important; font-weight: 600; margin: 0.4rem 0 0.15rem; }
.report-md p { margin: 0.25rem 0; font-size: 0.8rem; }
.report-md ul, .report-md ol { padding-left: 1.2rem; margin: 0.25rem 0; font-size: 0.8rem; }
.report-md li { margin: 0.15rem 0; }
.report-md li::marker { color: #9ca3af; }
.report-md strong { font-weight: 600; }
.report-md blockquote {
  border-left: 3px solid #E94F2E;
  padding: 0.4rem 0.75rem;
  margin: 0.5rem 0;
  color: #6b7280;
  background: #f9fafb;
  border-radius: 0 6px 6px 0;
  font-style: normal;
}
.report-md code {
  font-family: inherit !important;
  font-size: inherit !important;
  background: #f3f4f6;
  padding: 0.1rem 0.3rem;
  border-radius: 3px;
}
.report-md table { width: 100%; border-collapse: collapse; margin: 0.5rem 0; font-size: 0.8rem; }
.report-md th { text-align: left; font-weight: 600; padding: 0.35rem 0.5rem; border-bottom: 2px solid #e5e7eb; }
.report-md td { padding: 0.3rem 0.5rem; border-bottom: 1px solid #f3f4f6; }
</style>
