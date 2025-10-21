// Helper: convert AI SDK UIMessage parts to plain text for UI Components and backend
export function parseAIMessage(message: any): string {
    if (!message) {
        throw new Error('Message is empty')
    }

    if (message.content && message.content.length > 0) {
        return message.content
    }

    if (!Array.isArray(message.parts) || message.parts.length === 0) {
        throw new Error('Message parts are empty: ' + JSON.stringify(message))
    }

    const text = message.parts
        .filter((p: any) => p !== undefined && p !== null)
        .map((p: any) => (typeof p === 'string' ? p : p?.text ?? ''))
        .join('')

    if (text.length === 0) {
        throw new Error('Message parts are empty: ' + JSON.stringify(message))
    }

    return text
}