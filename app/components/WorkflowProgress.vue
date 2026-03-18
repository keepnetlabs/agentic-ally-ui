<script setup lang="ts">
/**
 * WorkflowProgress - Step-by-step workflow progress with vertical timeline
 *
 * Shows a vertical timeline with connected dots for each step.
 * Steps transition: pending → running (spinner) → completed (check) / error (x)
 * Timeline line colors: completed = primary, running = primary, pending = muted
 */
import { computed } from 'vue'
import type { WorkflowStepData } from '../composables/useStreamEvents'

const props = defineProps<{
  steps: Map<string, WorkflowStepData>
}>()

/** Human-readable workflow name mapping */
const WORKFLOW_LABELS: Record<string, string> = {
  'create-microlearning': 'Creating Training Module',
  'add-language': 'Adding Language',
  'add-multiple-languages': 'Adding Languages',
  'update-microlearning': 'Updating Training',
  'create-phishing': 'Creating Phishing Simulation',
  'create-smishing': 'Creating Smishing Simulation'
}

/** Group steps by workflowRunId for multi-workflow support */
const workflows = computed(() => {
  const grouped = new Map<string, {
    name: string
    label: string
    steps: WorkflowStepData[]
    isComplete: boolean
    completedCount: number
    totalSteps: number
  }>()

  for (const step of props.steps.values()) {
    if (!grouped.has(step.workflowRunId)) {
      grouped.set(step.workflowRunId, {
        name: step.workflowName,
        label: WORKFLOW_LABELS[step.workflowName] || step.workflowName,
        steps: [],
        isComplete: false,
        completedCount: 0,
        totalSteps: step.totalSteps
      })
    }
    const workflow = grouped.get(step.workflowRunId)!
    const existing = workflow.steps.findIndex(s => s.stepIndex === step.stepIndex)
    if (existing >= 0) {
      workflow.steps[existing] = step
    } else {
      workflow.steps.push(step)
    }
    workflow.steps.sort((a, b) => a.stepIndex - b.stepIndex)
    workflow.totalSteps = step.totalSteps
    workflow.completedCount = workflow.steps.filter(s => s.status === 'completed').length
    workflow.isComplete = workflow.steps.length === step.totalSteps
      && workflow.steps.every(s => s.status === 'completed' || s.status === 'error')
  }

  return grouped
})

function stepIcon(status: string) {
  switch (status) {
    case 'running': return 'i-lucide-loader-2'
    case 'completed': return 'i-lucide-check'
    case 'error': return 'i-lucide-x'
    default: return ''
  }
}

function dotColor(status: string) {
  switch (status) {
    case 'running': return 'bg-primary border-primary/30'
    case 'completed': return 'bg-primary border-primary/30'
    case 'error': return 'bg-red-500 dark:bg-red-400 border-red-500/30 dark:border-red-400/30'
    default: return 'bg-muted-foreground/20 border-muted-foreground/10'
  }
}

function lineColor(status: string) {
  switch (status) {
    case 'completed': return 'bg-primary/40'
    case 'error': return 'bg-red-500/40 dark:bg-red-400/40'
    default: return 'bg-muted-foreground/10'
  }
}

/** Check if a step is part of a parallel group (adjacent step also running at same time) */
function isParallelStep(steps: WorkflowStepData[], index: number): boolean {
  const step = steps[index]
  if (!step || step.status !== 'running') return false
  // Check if previous or next step is also running
  const prev = index > 0 ? steps[index - 1] : null
  const next = index < steps.length - 1 ? steps[index + 1] : null
  return (prev?.status === 'running') || (next?.status === 'running')
}

/** Progress percentage for the header bar */
function progressPct(workflow: { completedCount: number, totalSteps: number }) {
  if (workflow.totalSteps === 0) return 0
  return Math.round((workflow.completedCount / workflow.totalSteps) * 100)
}
</script>

<template>
  <div
    v-for="[runId, workflow] of workflows"
    :key="runId"
    class="my-2 w-full"
  >
    <!-- Workflow container with subtle background -->
    <div class="w-full rounded-lg border border-muted/60 dark:border-muted/30 bg-muted/20 dark:bg-muted/10 overflow-hidden transition-all duration-300">
      <!-- Header with progress bar -->
      <div class="px-3 py-2 flex items-center gap-2">
        <UIcon
          name="i-lucide-workflow"
          class="w-4 h-4 shrink-0 text-primary transition-colors duration-300"
        />
        <span
          class="text-xs font-medium"
          :class="workflow.isComplete ? 'text-muted-foreground' : 'text-foreground'"
        >
          {{ workflow.label }}
        </span>
        <!-- Progress counter -->
        <span class="text-[10px] text-muted-foreground/60 ml-auto tabular-nums">
          {{ workflow.completedCount }}/{{ workflow.totalSteps }}
        </span>
      </div>

      <!-- Mini progress bar -->
      <div class="h-0.5 bg-muted/40 dark:bg-muted/20">
        <div
          class="h-full bg-primary transition-all duration-500 ease-out"
          :style="{ width: `${progressPct(workflow)}%` }"
        />
      </div>

      <!-- Timeline steps -->
      <div class="px-3 py-2">
        <div
          v-for="(step, i) in workflow.steps"
          :key="step.stepIndex"
          class="relative flex items-start gap-2.5"
          :class="i < workflow.steps.length - 1 ? 'pb-4' : ''"
        >
          <!-- Connector line (absolute, runs from dot center to next dot center) -->
          <!-- Dashed line between parallel steps, solid otherwise -->
          <div
            v-if="i < workflow.steps.length - 1"
            :class="[
              'absolute left-[9px] top-[14px] w-0.5 bottom-0 transition-colors duration-300',
              lineColor(step.status),
              isParallelStep(workflow.steps, i) ? 'border-l border-dashed border-primary/40 bg-transparent !w-0' : ''
            ]"
          />

          <!-- Dot (sits on top of the line) -->
          <div
            :class="[
              'relative z-10 w-[18px] h-[18px] rounded-full flex items-center justify-center border-2 shrink-0 transition-all duration-300',
              dotColor(step.status)
            ]"
          >
            <UIcon
              v-if="stepIcon(step.status)"
              :name="stepIcon(step.status)"
              :class="[
                'w-2.5 h-2.5 text-white',
                step.status === 'running' ? 'animate-spin' : ''
              ]"
            />
          </div>

          <!-- Step content -->
          <div class="-mt-px">
            <span
              :class="[
                'text-[11px] leading-tight transition-colors duration-300 flex items-center gap-1.5',
                step.status === 'running' ? 'text-foreground font-medium' : 'text-muted-foreground'
              ]"
            >
              {{ step.stepName || `Step ${step.stepIndex + 1}` }}
              <span
                v-if="isParallelStep(workflow.steps, i)"
                class="text-[8px] px-1 py-px rounded-sm bg-primary/10 dark:bg-primary/20 text-primary font-semibold uppercase tracking-wider shrink-0"
              >
                parallel
              </span>
            </span>
            <span
              v-if="step.message && (step.status === 'running' || step.status === 'completed')"
              :class="[
                'text-[10px] leading-tight block mt-0.5 transition-colors duration-300',
                step.status === 'running' ? 'text-muted-foreground/70' : 'text-muted-foreground/50'
              ]"
            >
              {{ step.message }}
            </span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
