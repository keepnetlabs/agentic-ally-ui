export interface ErrorDisplay {
  title: string
  message: string
  icon: string
  canRetry: boolean
}

type ErrorType =
  | 'network'
  | 'timeout'
  | 'abort'
  | 'unauthorized'
  | 'forbidden'
  | 'not_found'
  | 'client_error'
  | 'rate_limit'
  | 'server'
  | 'unknown'

interface ErrorContext {
  type: ErrorType
  status?: number
  originalMessage?: string
}

interface ErrorObject {
  message?: string
  status?: number
  statusCode?: number
  code?: string
  name?: string
}

const getErrorObject = (error: unknown): ErrorObject => {
  if (error instanceof Error) {
    return {
      message: error.message,
      code: (error as any).code,
      name: error.name
    }
  }
  return (error as ErrorObject) || {}
}

// Type guards
const isNetworkError = (error: unknown): boolean => {
  const { message } = getErrorObject(error)
  if (!message) return false

  const lowerMsg = message.toLowerCase()
  return (
    lowerMsg.includes('failed to fetch') ||
    lowerMsg.includes('fetch') ||
    lowerMsg.includes('err_internet_disconnected') ||
    lowerMsg.includes('network')
  )
}

const isTimeoutError = (error: unknown): boolean => {
  const { message, code } = getErrorObject(error)
  if (!message && !code) return false

  return (
    message?.toLowerCase().includes('timeout') ||
    code === 'ETIMEDOUT'
  )
}

const isAbortError = (error: unknown): boolean => {
  if (typeof DOMException === 'undefined') return false
  return error instanceof DOMException && error.name === 'AbortError'
}

const getErrorContext = (error: unknown): ErrorContext => {
  const errorObj = getErrorObject(error)
  const status = errorObj.status || errorObj.statusCode

  if (isAbortError(error)) {
    return { type: 'abort', originalMessage: 'User cancelled request' }
  }

  if (isNetworkError(error)) {
    return { type: 'network', originalMessage: errorObj.message }
  }

  if (isTimeoutError(error)) {
    return { type: 'timeout', originalMessage: errorObj.message }
  }

  if (status === 401) {
    return { type: 'unauthorized', status }
  }

  if (status === 403) {
    return { type: 'forbidden', status }
  }

  if (status === 404) {
    return { type: 'not_found', status }
  }

  if (status === 429) {
    return { type: 'rate_limit', status }
  }

  if (status && status >= 500) {
    return { type: 'server', status, originalMessage: errorObj.message }
  }

  if (status && status >= 400 && status < 500) {
    return { type: 'client_error', status, originalMessage: errorObj.message }
  }

  return {
    type: 'unknown',
    originalMessage: errorObj.message || String(error)
  }
}

/**
 * Error messages mapped to error types
 *
 * NOTE: canRetry flag indicates if the operation is theoretically retryable.
 * However, for SSE streams that fail mid-stream (network, timeout during response),
 * the stream is already closed by the time the error fires. Automatic retry is not
 * possible - user must explicitly click "Reload" to regenerate the message.
 *
 * canRetry: true  → persistent toast (no auto-dismiss) to encourage manual retry
 * canRetry: false → auto-dismiss toast (5s) for non-retryable errors
 */
const errorMessages: Record<ErrorType, Omit<ErrorDisplay, 'canRetry'> & { canRetry: boolean }> = {
  network: {
    title: 'Unable to connect',
    message: 'Cannot reach the server. Check your internet connection and try again.',
    icon: 'i-lucide-network-off',
    canRetry: true  // Might recover if user reconnects
  },
  timeout: {
    title: 'Request timed out',
    message: 'The server is not responding. Try again in a moment.',
    icon: 'i-lucide-clock-alert',
    canRetry: true  // Might succeed on retry if server recovers
  },
  abort: {
    title: 'Request cancelled',
    message: 'The request was cancelled.',
    icon: 'i-lucide-square',
    canRetry: false  // User explicitly cancelled, no retry prompt
  },
  unauthorized: {
    title: 'Authentication required',
    message: 'Please sign in to continue.',
    icon: 'i-lucide-lock',
    canRetry: false  // User must auth first, retrying won't help
  },
  forbidden: {
    title: 'Access denied',
    message: 'You do not have permission to perform this action.',
    icon: 'i-lucide-shield-alert',
    canRetry: false  // Permission issue, retry won't help
  },
  not_found: {
    title: 'Not found',
    message: 'The requested resource could not be found.',
    icon: 'i-lucide-search',
    canRetry: false  // Resource doesn't exist, retry won't help
  },
  client_error: {
    title: 'Request error',
    message: 'The request was invalid. Please check your input and try again.',
    icon: 'i-lucide-alert-triangle',
    canRetry: false  // User input error, needs user correction first
  },
  rate_limit: {
    title: 'Too many requests',
    message: 'You\'re sending requests too quickly. Wait a few seconds and try again.',
    icon: 'i-lucide-zap-off',
    canRetry: true  // Will succeed after rate limit resets
  },
  server: {
    title: 'Server error',
    message: 'The server is having issues. Try again in a few moments.',
    icon: 'i-lucide-server-crash',
    canRetry: true  // Server might recover
  },
  unknown: {
    title: 'Something went wrong',
    message: 'An unexpected error occurred. Try again.',
    icon: 'i-lucide-alert-circle',
    canRetry: true  // Unclear, so allow retry
  }
}

export const parseError = (error: unknown): ErrorDisplay => {
  const context = getErrorContext(error)
  const display = errorMessages[context.type]

  // Log for debugging
  if (process.env.NODE_ENV === 'development') {
    console.error('[Error Context]', context)
  }

  return {
    ...display,
    canRetry: display.canRetry
  }
}
