/**
 * Exponential backoff with jitter
 * Industry standard used by Netflix, AWS, Google, Stripe
 *
 * Prevents "thundering herd" - multiple clients retrying simultaneously
 * causing server overload. Jitter spreads out retry attempts.
 */
export const exponentialBackoffWithJitter = (attempt: number): number => {
  const baseDelay = 1000 // 1 second
  const maxDelay = 32000 // 32 seconds cap

  // Exponential: 1s, 2s, 4s, 8s, 16s, 32s
  const exponential = baseDelay * Math.pow(2, attempt)

  // Cap at maxDelay
  const capped = Math.min(exponential, maxDelay)

  // Jitter: random 0-50% of delay to spread out retries
  const jitter = Math.random() * capped * 0.5

  return capped + jitter
}

export interface RetryConfig {
  maxRetries?: number
  deadline?: number // overall timeout in ms
}

export interface RetryContext {
  attempt: number
  delay: number
  totalElapsed: number
}

export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 5,
  deadline: 30000 // 30 seconds total
}
