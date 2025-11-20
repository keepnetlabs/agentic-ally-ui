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

    const isReasoningPart = (p: any) => {
        if (!p || typeof p !== 'object') return false
        if (p.type === 'reasoning') return true
        if (p.type === 'reasoning-start' || p.type === 'reasoning-delta' || p.type === 'reasoning-end') return true
        // Provider fallbacks
        if (p.channel === 'reasoning') return true
        if (p.name === 'reasoning') return true
        if (p.key === 'reasoning') return true
        if (p.id === 'reasoning') return true
        if (p?.metadata?.reasoning === true) return true
        return false
    }

    const text = message.parts
        .filter((p: any) => !isReasoningPart(p))
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
        if (p.type === 'reasoning-start' || p.type === 'reasoning-delta' || p.type === 'reasoning-end') return true
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
        .map((p: any) => (typeof p === 'string' ? p : p?.delta ?? p?.text ?? ''))
        .join('')

    return reasoningText
}

// Helper: extract canvas data from message parts (SDK standard)
export function parseCanvasData(message: any): any {
    if (!message) {
        return null
    }

    // Check for canvas parts in message.parts
    if (Array.isArray(message.parts) && message.parts.length > 0) {
        const canvasPart = message.parts.find((p: any) => {
            if (!p || typeof p !== 'object') return false
            // Standard canvas keys
            if (p.type === 'canvas') return true
            if (p.type === 'canvas-url') return true
            if (p.channel === 'canvas') return true
            if (p.name === 'canvas') return true
            if (p.key === 'canvas') return true
            if (p?.metadata?.canvas === true) return true
            // URL specific
            if (p['canvas-url']) return true
            return false
        })

        if (canvasPart) {
            // Extract canvas data
            return {
                type: canvasPart?.type || 'canvas',
                url: canvasPart?.['canvas-url'] || canvasPart?.url || canvasPart?.text,
                title: canvasPart?.title || canvasPart?.name,
                data: canvasPart?.data || canvasPart
            }
        }
    }

    // Fallback: check message level canvas fields
    if (message['canvas-url']) {
        return {
            type: 'url',
            url: message['canvas-url'],
            title: message['canvas-title'] || `Website: ${new URL(message['canvas-url']).hostname}`
        }
    }

    return null
}