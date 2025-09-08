import { ref, reactive, readonly } from 'vue'

export interface CanvasContent {
  type: 'preview' | 'email' | 'code' | 'html' | 'markdown' | 'url'
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

  // Email preview helper
  const showEmailPreview = (emailData: {
    from?: string
    to?: string
    subject?: string
    body: string
  }) => {
    updateCanvasContent({
      type: 'email',
      ...emailData
    })
  }

  // Code preview helper
  const showCodePreview = (codeData: {
    code: string
    filename?: string
    language?: string
  }) => {
    updateCanvasContent({
      type: 'code',
      ...codeData
    })
  }

  // HTML preview helper
  const showHTMLPreview = (htmlData: {
    html: string
    title?: string
  }) => {
    updateCanvasContent({
      type: 'html',
      ...htmlData
    })
  }

  // Generic preview helper
  const showPreview = (previewData: {
    title?: string
    content?: string
    html?: string
    type?: CanvasContent['type']
  }) => {
    updateCanvasContent({
      type: previewData.type || 'preview',
      title: previewData.title,
      content: previewData.content,
      html: previewData.html
    })
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
    clearCanvasContent,
    
    // Helpers
    showEmailPreview,
    showCodePreview,
    showHTMLPreview,
    showPreview
  }
}

// Global canvas event bus
export const canvasEventBus = {
  showEmail: (emailData: {
    from?: string
    to?: string
    subject?: string
    body: string
  }) => {
    const { showEmailPreview } = useCanvas()
    showEmailPreview(emailData)
  },
  
  showCode: (codeData: {
    code: string
    filename?: string
    language?: string
  }) => {
    const { showCodePreview } = useCanvas()
    showCodePreview(codeData)
  },
  
  showHTML: (htmlData: {
    html: string
    title?: string
  }) => {
    const { showHTMLPreview } = useCanvas()
    showHTMLPreview(htmlData)
  },
  
  showPreview: (previewData: {
    title?: string
    content?: string
    html?: string
    type?: CanvasContent['type']
  }) => {
    const { showPreview } = useCanvas()
    showPreview(previewData)
  }
}

// Make it available globally
if (typeof window !== 'undefined') {
  (window as any).__canvasEventBus = canvasEventBus
}