<script setup lang="ts">
/**
 * ToolCallCard - Displays a tool call with collapsible details
 *
 * Bordered card with left accent. Expandable to show arguments and result.
 * Follows the ChatGPT/Cursor collapsible disclosure pattern.
 */

const props = defineProps<{
  toolName: string
  status: 'pending' | 'running' | 'completed' | 'error'
  args?: Record<string, unknown>
  result?: unknown
}>()

/** Human-readable tool name mapping */
const TOOL_LABELS: Record<string, string> = {
  'show_reasoning': 'Reasoning',
  'get-user-info': 'Looking up user info',
  'get-target-group-info': 'Looking up group info',
  'workflow-executor': 'Running training workflow',
  'phishing-workflow-executor': 'Generating phishing simulation',
  'smishing-workflow-executor': 'Generating smishing simulation',
  'upload-training': 'Uploading training',
  'assign-training': 'Assigning training',
  'upload-phishing': 'Uploading phishing',
  'assign-phishing': 'Assigning phishing',
  'upload-smishing': 'Uploading smishing',
  'assign-smishing': 'Assigning smishing',
  'summarize-policy': 'Searching policies',
  'phishing-editor': 'Editing phishing template',
  'smishing-editor': 'Editing smishing template',
  'list-phone-numbers': 'Listing phone numbers',
  'initiate-vishing-call': 'Initiating vishing call',
  'list-heygen-avatars': 'Loading avatars',
  'list-heygen-voices': 'Loading voices',
  'generate-deepfake-video': 'Generating deepfake video',
  'generate-report-outline': 'Creating report outline',
  'expand-report-sections': 'Expanding report sections',
  'validate-and-store-report': 'Saving report',
  'fetch-branding': 'Loading branding',
  'edit-report-section': 'Editing report section',
  'search-companies': 'Searching companies',
  'get-company-detail': 'Getting company details',
  'search-trainings': 'Searching trainings',
}

const label = computed(() => TOOL_LABELS[props.toolName] || props.toolName)

const statusIcon = computed(() => {
  switch (props.status) {
    case 'pending': return 'i-lucide-circle-dashed'
    case 'running': return 'i-lucide-loader-2'
    case 'completed': return 'i-lucide-check-circle-2'
    case 'error': return 'i-lucide-x-circle'
  }
})

const statusColor = computed(() => {
  switch (props.status) {
    case 'pending': return 'text-muted-foreground/60'
    case 'running': return 'text-primary'
    case 'completed': return 'text-green-500 dark:text-green-400'
    case 'error': return 'text-red-500 dark:text-red-400'
  }
})

/** Left border accent color based on status */
const borderColor = computed(() => {
  switch (props.status) {
    case 'pending': return 'border-l-muted-foreground/20'
    case 'running': return 'border-l-primary'
    case 'completed': return 'border-l-green-500 dark:border-l-green-400'
    case 'error': return 'border-l-red-500 dark:border-l-red-400'
  }
})

const isSpinning = computed(() => props.status === 'running')

/** Summarize tool args for collapsed view */
const argsSummary = computed(() => {
  if (!props.args) return ''
  const keys = Object.keys(props.args)
  if (keys.length === 0) return ''
  for (const key of ['prompt', 'topic', 'fullName', 'email', 'workflowType', 'targetLanguage']) {
    if (props.args[key]) return String(props.args[key]).slice(0, 60)
  }
  return ''
})

/** Truncate large JSON for display */
const truncatedResult = computed(() => {
  if (!props.result) return ''
  const str = typeof props.result === 'string' ? props.result : JSON.stringify(props.result, null, 2)
  return str.length > 3000 ? str.slice(0, 3000) + '\n... (truncated)' : str
})
</script>

<template>
  <div
    :class="[
      'my-1.5 border-l-2 rounded-r-md transition-all duration-300',
      borderColor,
      status === 'running'
        ? 'bg-primary/5 dark:bg-primary/10'
        : status === 'error'
          ? 'bg-red-500/5 dark:bg-red-500/10'
          : 'bg-muted/30 dark:bg-muted/20'
    ]"
  >
    <UCollapsible class="text-xs">
      <template #default>
        <button class="flex items-center gap-2 w-full px-3 py-1.5 text-left hover:bg-muted/40 dark:hover:bg-muted/30 rounded-r-md transition-colors">
          <UIcon
            :name="statusIcon"
            :class="[
              'w-3.5 h-3.5 shrink-0 transition-colors duration-300',
              statusColor,
              isSpinning ? 'animate-spin' : ''
            ]"
          />
          <span
            :class="[
              'text-xs transition-colors duration-300',
              status === 'running' ? 'text-foreground font-medium' : 'text-muted-foreground'
            ]"
          >
            {{ label }}
          </span>
          <span v-if="argsSummary && status !== 'completed'" class="text-muted-foreground/50 truncate max-w-[200px] text-[11px]">
            {{ argsSummary }}
          </span>
          <UIcon
            v-if="status === 'completed' || status === 'error'"
            name="i-lucide-chevron-down"
            class="w-3 h-3 ml-auto text-muted-foreground/40 shrink-0"
          />
        </button>
      </template>
      <template #content>
        <div class="px-3 pb-2 pt-0.5 space-y-1.5 border-t border-muted/40 dark:border-muted/20 ml-[22px]">
          <div v-if="args && Object.keys(args).length > 0">
            <span class="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/50">Input</span>
            <pre class="whitespace-pre-wrap break-words text-[10px] text-muted-foreground/70 mt-0.5 max-h-28 overflow-auto leading-relaxed">{{ JSON.stringify(args, null, 2) }}</pre>
          </div>
          <div v-if="result && status === 'completed'">
            <span class="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/50">Output</span>
            <pre class="whitespace-pre-wrap break-words text-[10px] text-muted-foreground/70 mt-0.5 max-h-28 overflow-auto leading-relaxed">{{ truncatedResult }}</pre>
          </div>
        </div>
      </template>
    </UCollapsible>
  </div>
</template>
