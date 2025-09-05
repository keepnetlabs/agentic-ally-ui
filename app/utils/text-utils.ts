// Helper: convert AI SDK UIMessage parts to plain text for UI Components and backend
export function parseAIMessage(message: any): string {
    if (!message) {
        throw new Error('Message is empty')
    }

    if (message.content && message.content.length > 0) {
        return message.content
    }

    if (!Array.isArray(message.parts) || message.parts.length === 0) {
        return ''
    }

    const text = message.parts
        .map((p: any) => (typeof p === 'string' ? p : p?.text ?? ''))
        .join('')

    return text
}

// Helper: extract reasoning/thinking text if present in message parts
export function parseAIReasoning(message: any): string {
    if (!message) {
        return ''
    }

    // Preferred: derive reasoning from parts stream
    if (!Array.isArray(message.parts) || message.parts.length === 0) {
        return ''
    }

    const isReasoningPart = (p: any) => {
        if (!p || typeof p !== 'object') return false
        if (p.type === 'reasoning') return true
        // Provider fallbacks
        if (p.channel === 'reasoning') return true
        if (p.name === 'reasoning') return true
        if (p.key === 'reasoning') return true
        if (p.id === 'reasoning') return true
        if (p?.metadata?.reasoning === true) return true
        return false
    }

    const reasoningText = message.parts
        .filter((p: any) => isReasoningPart(p))
        .map((p: any) => (typeof p === 'string' ? p : p?.text ?? ''))
        .join('')

    return reasoningText
}