import { base64ToUtf8 } from '../utils/message-utils'

// =====================================
// MASTRA V1 Stream Event Types
// =====================================

export type UISignalType =
  | 'phishing_assigned'
  | 'training_assigned'
  | 'training_uploaded'
  | 'phishing_uploaded'
  | 'smishing_assigned'
  | 'smishing_uploaded'
  | 'smishing_sms'
  | 'phishing_email'
  | 'landing_page'
  | 'smishing_landing_page'
  | 'vishing_call_started'
  | 'vishing_call_transcript'
  | 'target_user'
  | 'target_group'
  | 'canvas_open'

export interface UISignalEvent {
  type: 'data-ui-signal'
  data: {
    signal: UISignalType
    message: string // ::ui:{signal}::{base64_payload}::/ui:{signal}::
  }
}

export interface ReasoningEvent {
  type: 'data-reasoning'
  data: {
    event: 'start' | 'delta' | 'end'
    id: string
    text?: string
  }
}

export interface ToolProgressEvent {
  type: 'data-tool-progress'
  data: Record<string, unknown>
}

export interface WorkflowStepEvent {
  type: 'data-workflow-step'
  data: Record<string, unknown>
}

export type StreamEvent =
  | UISignalEvent
  | ReasoningEvent
  | ToolProgressEvent
  | WorkflowStepEvent

// =====================================
// Payload Types
// =====================================

export interface PhishingEmailPayload {
  phishingId: string
  emailKey: string
  language: string
  subject: string
  template: string
  fromAddress?: string
  fromName?: string
  method?: 'Click-Only' | 'Data-Submission'
  isQuishing: boolean
}

export interface LandingPagePayload {
  phishingId: string
  landingKey: string
  language: string
  name?: string
  description?: string
  method?: string
  difficulty?: string
  pages: Array<{ html: string; step: number }>
  isQuishing: boolean
}

export interface SmishingSmsPayload {
  smishingId: string
  smsKey: string
  language: string
  template: string
  fromNumber?: string
  fromName?: string
  method?: 'Click-Only' | 'Data-Submission'
  isQuishing: boolean
}

export interface SmishingLandingPagePayload {
  smishingId: string
  landingKey: string
  language: string
  name?: string
  description?: string
  method?: string
  difficulty?: string
  pages: Array<{ html: string; step: number }>
  isQuishing: boolean
}

export interface TargetUserPayload {
  targetUserResourceId: string
  fullName: string
  email?: string
  department?: string
}

export interface TargetGroupPayload {
  targetGroupResourceId: string
  groupName: string
  memberCount: number
}

export interface StreamVishingCallStartedPayload {
  conversationId: string
  callSid: string
  status: string
}

export interface StreamVishingCallTranscriptPayload {
  conversationId: string
  status: string
  callDurationSecs: number
  transcript: Array<{
    role: 'agent' | 'user'
    message: string
    timestamp: number
  }>
}

// =====================================
// Stream Event Handlers
// =====================================

export interface StreamEventHandlers {
  onUISignal?: (signal: UISignalType, payload: unknown) => void
  onPhishingEmail?: (payload: PhishingEmailPayload) => void
  onLandingPage?: (payload: LandingPagePayload) => void
  onSmishingSms?: (payload: SmishingSmsPayload) => void
  onSmishingLandingPage?: (payload: SmishingLandingPagePayload) => void
  onTargetUser?: (payload: TargetUserPayload) => void
  onTargetGroup?: (payload: TargetGroupPayload) => void
  onVishingCallStarted?: (payload: StreamVishingCallStartedPayload) => void
  onVishingCallTranscript?: (payload: StreamVishingCallTranscriptPayload) => void
  onCanvasOpen?: (url: string) => void
  onReasoningStart?: (id: string) => void
  onReasoningDelta?: (id: string, text: string) => void
  onReasoningEnd?: (id: string) => void
  onToolProgress?: (data: Record<string, unknown>) => void
  onWorkflowStep?: (data: Record<string, unknown>) => void
}

/**
 * Parse UI signal payload from base64 encoded message
 */
export function parseUISignalPayload(message: string): unknown | null {
  // Match: ::ui:{signal}::{base64}::/ui:{signal}::
  const regex = /::ui:\w+::([^:]+)::/
  const match = message.match(regex)

  if (!match || !match[1]) {
    return null
  }

  try {
    return JSON.parse(base64ToUtf8(match[1].trim()))
  } catch (e) {
    console.error('Failed to parse UI signal payload:', e)
    return null
  }
}

// Debug mode - set to true to log all stream events
const DEBUG_STREAM_EVENTS = false

/**
 * Composable for handling Mastra v1 stream events
 */
export const useStreamEvents = (handlers: StreamEventHandlers = {}) => {

  /**
   * Handle a stream event from the backend
   */
  const handleStreamEvent = (event: unknown) => {
    if (typeof event !== 'object' || !event) return

    const e = event as Record<string, unknown>
    const eventType = e.type as string | undefined

    if (!eventType) return

    // Debug logging
    if (DEBUG_STREAM_EVENTS) {
      console.log('[StreamEvent]', eventType, e.data)
    }

    // =====================================
    // UI Signal Events (data-ui-signal)
    // =====================================
    if (eventType === 'data-ui-signal') {
      const data = e.data as { signal: UISignalType; message: string } | undefined
      if (!data) return

      const { signal, message } = data
      const payload = parseUISignalPayload(message)

      // Generic handler
      handlers.onUISignal?.(signal, payload)

      // Signal-specific handlers
      switch (signal) {
        case 'phishing_email':
          if (payload) handlers.onPhishingEmail?.(payload as PhishingEmailPayload)
          break

        case 'landing_page':
          if (payload) handlers.onLandingPage?.(payload as LandingPagePayload)
          break

        case 'smishing_sms':
          if (payload) handlers.onSmishingSms?.(payload as SmishingSmsPayload)
          break

        case 'smishing_landing_page':
          if (payload) handlers.onSmishingLandingPage?.(payload as SmishingLandingPagePayload)
          break

        case 'target_user':
          if (payload) handlers.onTargetUser?.(payload as TargetUserPayload)
          break

        case 'target_group':
          if (payload) handlers.onTargetGroup?.(payload as TargetGroupPayload)
          break

        case 'vishing_call_started':
          if (payload) handlers.onVishingCallStarted?.(payload as StreamVishingCallStartedPayload)
          break

        case 'vishing_call_transcript':
          if (payload) handlers.onVishingCallTranscript?.(payload as StreamVishingCallTranscriptPayload)
          break

        case 'canvas_open':
          // For canvas_open, the URL is in the message directly
          const urlMatch = message.match(/::ui:canvas_open::([^\s\n]+)/)
          if (urlMatch?.[1]) handlers.onCanvasOpen?.(urlMatch[1])
          break
      }

      return
    }

    // =====================================
    // Reasoning Events (data-reasoning)
    // =====================================
    if (eventType === 'data-reasoning') {
      const data = e.data as { event: 'start' | 'delta' | 'end'; id: string; text?: string } | undefined
      if (!data) return

      const { event: phase, id, text } = data

      switch (phase) {
        case 'start':
          handlers.onReasoningStart?.(id)
          break
        case 'delta':
          handlers.onReasoningDelta?.(id, text || '')
          break
        case 'end':
          handlers.onReasoningEnd?.(id)
          break
      }

      return
    }

    // =====================================
    // Tool Progress Events (data-tool-progress)
    // =====================================
    if (eventType === 'data-tool-progress') {
      const data = e.data as Record<string, unknown> | undefined
      if (data) handlers.onToolProgress?.(data)
      return
    }

    // =====================================
    // Workflow Step Events (data-workflow-step)
    // =====================================
    if (eventType === 'data-workflow-step') {
      const data = e.data as Record<string, unknown> | undefined
      if (data) handlers.onWorkflowStep?.(data)
      return
    }
  }

  return {
    handleStreamEvent
  }
}
