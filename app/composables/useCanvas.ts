import { ref, readonly } from 'vue'
import type { LandingPage } from '../types/chat'

export interface CanvasContent {
  type: 'preview' | 'email' | 'code' | 'html' | 'markdown' | 'url' | 'landing-page'
  title?: string
  content?: string
  html?: string
  body?: string
  code?: string
  filename?: string
  from?: string
  to?: string
  subject?: string
  url?: string
  landingPage?: LandingPage
}

const isCanvasVisible = ref(false)
const canvasContent = ref<CanvasContent | null>(null)

export const useCanvas = () => {
  const showCanvas = () => {
    isCanvasVisible.value = true
  }

  const hideCanvas = () => {
    isCanvasVisible.value = false
  }

  const toggleCanvas = () => {
    isCanvasVisible.value = !isCanvasVisible.value
  }

  const updateCanvasContent = (content: CanvasContent) => {
    canvasContent.value = content
    showCanvas()
  }

  const clearCanvasContent = () => {
    canvasContent.value = null
  }

  return {
    // State
    isCanvasVisible: readonly(isCanvasVisible),
    canvasContent: readonly(canvasContent),

    // Actions
    showCanvas,
    hideCanvas,
    toggleCanvas,
    updateCanvasContent,
    clearCanvasContent
  }
}