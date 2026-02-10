// Extract text parts from message for template rendering
export function extractTextPartsForTemplate(msg: any) {
    const provided = msg?.textParts
    if (Array.isArray(provided)) return provided
    const parts = msg?.parts || []
    return parts.filter((p: any) => p?.type === 'text-delta' || p?.type === 'text')
}

// Helper function to decode base64 with UTF-8 support
export function base64ToUtf8(base64: string): string {
    try {
        // Decode base64 to binary string
        const binary = atob(base64)
        // Convert binary string to Uint8Array
        const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0))
        // Decode UTF-8 bytes to string
        return new TextDecoder('utf-8').decode(bytes)
    } catch (error) {
        console.error('Failed to decode base64 to UTF-8:', error)
        throw error
    }
}

// Extract training URL from message
// Supports both MASTRA V1 (uiSignals) and legacy (::ui:canvas_open::) formats
export function extractTrainingUrlFromMessage(msg: any): string | null {
    // 1️⃣ MASTRA V1: Check uiSignals first
    if (msg?.uiSignals && Array.isArray(msg.uiSignals)) {
        const canvasSignal = msg.uiSignals.find((s: any) => s.signal === 'canvas_open')
        if (canvasSignal?.message) {
            const match = canvasSignal.message.match(/::ui:canvas_open::([^\s\n]+)/)
            if (match?.[1]) return match[1].trim()
        }
    }

    // 2️⃣ Legacy: Check parts first (streaming)
    // Format: ::ui:canvas_open::${trainingUrl}\n
    const parts = extractTextPartsForTemplate(msg)
    for (const p of parts) {
        const text = p?.delta || p?.text || ''
        // Match ::ui:canvas_open:: followed by URL (until newline, space, or end of string)
        const m = text.match(/::ui:canvas_open::([^\s\n]+)/)
        if (m && m[1]) {
            // Trim any trailing whitespace/newline that might have been captured
            return m[1].trim()
        }
    }
    // Fallback: check final content
    const content = (msg?.content || '') + ''
    const mc = content.match(/::ui:canvas_open::([^\s\n]+)/)
    return mc && mc[1] ? mc[1].trim() : null
}

// Extract landing page from message
// Supports both MASTRA V1 (uiSignals) and legacy (::ui:landing_page::) formats
export function extractLandingPageFromMessage(msg: any): any | null {
    // 1️⃣ MASTRA V1: Check uiSignals first
    if (msg?.uiSignals && Array.isArray(msg.uiSignals)) {
        const landingSignal = msg.uiSignals.find((s: any) => s.signal === 'landing_page')
        if (landingSignal?.message) {
            try {
                const match = landingSignal.message.match(/::ui:landing_page::([^:]+)::/)
                if (match?.[1]) {
                    return JSON.parse(base64ToUtf8(match[1].trim()))
                }
            } catch (error) {
                console.error('Failed to parse landing_page from uiSignals:', error)
            }
        }
    }

    // 2️⃣ Legacy: Helper function to decode base64 and extract landing page
    const extractAndDecode = (text: string): any | null => {
        // Match: ::ui:landing_page::<base64>::/ui:landing_page::
        const match = text.match(/::ui:landing_page::([\s\S]+?)::\/ui:landing_page::/)
        if (!match || !match[1]) return null

        try {
            // Decode base64 to get JSON string with UTF-8 support
            const decoded = base64ToUtf8(match[1].trim())
            // Parse JSON to get LandingPage object
            return JSON.parse(decoded)
        } catch (error) {
            console.error('Failed to decode base64 landing page:', error)
            return null
        }
    }

    // Check parts first (streaming)
    const parts = extractTextPartsForTemplate(msg)
    for (const p of parts) {
        const text = p?.delta || p?.text || ''
        const landingPage = extractAndDecode(text)
        if (landingPage) return landingPage
    }

    // Fallback: check final content
    const content = (msg?.content || '') + ''
    return extractAndDecode(content)
}

// Extract all phishing emails from message
// Supports both MASTRA V1 (uiSignals) and legacy (::ui:phishing_email::) formats
export function extractAllPhishingEmailsFromMessage(msg: any): any[] {
    // 1️⃣ MASTRA V1: Check uiSignals first
    if (msg?.uiSignals && Array.isArray(msg.uiSignals)) {
        const emailSignals = msg.uiSignals.filter((s: any) => s.signal === 'phishing_email')
        if (emailSignals.length > 0) {
            const emails: any[] = []
            for (const signal of emailSignals) {
                if (signal?.message) {
                    try {
                        const match = signal.message.match(/::ui:phishing_email::([^:]+)::/)
                        if (match?.[1]) {
                            emails.push(JSON.parse(base64ToUtf8(match[1].trim())))
                        }
                    } catch (error) {
                        console.error('Failed to parse phishing_email from uiSignals:', error)
                    }
                }
            }
            if (emails.length > 0) return emails
        }
    }

    // 2️⃣ Legacy: Helper function to decode base64 and extract all email contents
    const extractAndDecodeAll = (text: string): any[] => {
        // Match all occurrences: ::ui:phishing_email::<base64>::/ui:phishing_email::
        const matches = [...text.matchAll(/::ui:phishing_email::([\s\S]+?)::\/ui:phishing_email::/g)]
        const decodedEmails: any[] = []

        for (const match of matches) {
            if (!match || !match[1]) continue

            try {
                // Decode base64 to get JSON string with UTF-8 support
                const decoded = base64ToUtf8(match[1].trim())
                // Parse JSON to get PhishingEmail object
                const emailObj = JSON.parse(decoded)
                decodedEmails.push(emailObj)
            } catch (error) {
                console.error('Failed to decode base64 phishing email:', error)
            }
        }

        return decodedEmails
    }

    // Check parts first (streaming)
    const parts = extractTextPartsForTemplate(msg)
    const allEmails: any[] = []

    for (const p of parts) {
        const text = p?.delta || p?.text || ''
        const decoded = extractAndDecodeAll(text)
        allEmails.push(...decoded)
    }

    // Fallback: check final content
    if (allEmails.length === 0) {
        const content = (msg?.content || '') + ''
        return extractAndDecodeAll(content)
    }

    // Remove duplicates based on subject (keep order)
    const seen = new Set<string>()
    return allEmails.filter((email) => {
        if (seen.has(email.subject)) return false
        seen.add(email.subject)
        return true
    })
}

export interface VishingCallStartedPayload {
    conversationId: string
    callSid: string
    status: string
}

export interface VishingTranscriptEntry {
    role: 'agent' | 'user'
    message: string
    timestamp: number
}

export interface VishingCallTranscriptPayload {
    conversationId: string
    status: string
    callDurationSecs: number
    transcript: VishingTranscriptEntry[]
}

// Extract vishing call started signal from message
// Supports both MASTRA V1 (uiSignals) and legacy (::ui:vishing_call_started::) formats
export function extractVishingCallStartedFromMessage(msg: any): VishingCallStartedPayload | null {
    // 1) MASTRA V1: Check uiSignals first
    if (msg?.uiSignals && Array.isArray(msg.uiSignals)) {
        const startedSignal = msg.uiSignals.find((s: any) => s.signal === 'vishing_call_started')
        if (startedSignal?.message) {
            try {
                const match = startedSignal.message.match(/::ui:vishing_call_started::([^:]+)::/)
                if (match?.[1]) {
                    return JSON.parse(base64ToUtf8(match[1].trim()))
                }
            } catch (error) {
                console.error('Failed to parse vishing_call_started from uiSignals:', error)
            }
        }
    }

    // 2) Legacy: Check stream parts and fallback content
    const extractAndDecode = (text: string): VishingCallStartedPayload | null => {
        const match = text.match(/::ui:vishing_call_started::([\s\S]+?)::\/ui:vishing_call_started::/)
        if (!match || !match[1]) return null

        try {
            return JSON.parse(base64ToUtf8(match[1].trim()))
        } catch (error) {
            console.error('Failed to decode base64 vishing_call_started:', error)
            return null
        }
    }

    const parts = extractTextPartsForTemplate(msg)
    for (const p of parts) {
        const text = p?.delta || p?.text || ''
        const started = extractAndDecode(text)
        if (started) return started
    }

    const content = (msg?.content || '') + ''
    return extractAndDecode(content)
}

// Extract vishing transcript signal from message
// Supports both MASTRA V1 (uiSignals) and legacy (::ui:vishing_call_transcript::) formats
export function extractVishingCallTranscriptFromMessage(msg: any): VishingCallTranscriptPayload | null {
    // 1) MASTRA V1: Check uiSignals first
    if (msg?.uiSignals && Array.isArray(msg.uiSignals)) {
        const transcriptSignal = msg.uiSignals.find((s: any) => s.signal === 'vishing_call_transcript')
        if (transcriptSignal?.message) {
            try {
                const match = transcriptSignal.message.match(/::ui:vishing_call_transcript::([^:]+)::/)
                if (match?.[1]) {
                    return JSON.parse(base64ToUtf8(match[1].trim()))
                }
            } catch (error) {
                console.error('Failed to parse vishing_call_transcript from uiSignals:', error)
            }
        }
    }

    // 2) Legacy: Check stream parts and fallback content
    const extractAndDecode = (text: string): VishingCallTranscriptPayload | null => {
        const match = text.match(/::ui:vishing_call_transcript::([\s\S]+?)::\/ui:vishing_call_transcript::/)
        if (!match || !match[1]) return null

        try {
            return JSON.parse(base64ToUtf8(match[1].trim()))
        } catch (error) {
            console.error('Failed to decode base64 vishing_call_transcript:', error)
            return null
        }
    }

    const parts = extractTextPartsForTemplate(msg)
    for (const p of parts) {
        const text = p?.delta || p?.text || ''
        const transcript = extractAndDecode(text)
        if (transcript) return transcript
    }

    const content = (msg?.content || '') + ''
    return extractAndDecode(content)
}

// Get sanitized content for template (remove UI signals)
export function getSanitizedContentForTemplate(msg: any): string {
    const content = (msg?.content || '') + ''
    return content
        .replace(/::ui:canvas_open::([^\s\n]+)\s*/g, '')
        .replace(/::ui:training_meta::([\s\S]+?)::\/ui:training_meta::/g, '')
        .replace(/::ui:phishing_email::([\s\S]+?)::\/ui:phishing_email::/g, '')
        .replace(/::ui:landing_page::([\s\S]+?)::\/ui:landing_page::/g, '')
        .replace(/::ui:smishing_sms::([\s\S]+?)::\/ui:smishing_sms::/g, '')
        .replace(/::ui:smishing_landing_page::([\s\S]+?)::\/ui:smishing_landing_page::/g, '')
        .replace(/::ui:vishing_call_started::([\s\S]+?)::\/ui:vishing_call_started::/g, '')
        .replace(/::ui:vishing_call_transcript::([\s\S]+?)::\/ui:vishing_call_transcript::/g, '')
        .replace(/::ui:(training_uploaded|phishing_uploaded|smishing_uploaded|training_assigned|phishing_assigned|smishing_assigned|target_user|target_group)::([\s\S]*?::\/ui:\1::)?(\n|\s)*/g, '')
}

// Extract smishing landing page from message
// Supports both MASTRA V1 (uiSignals) and legacy (::ui:smishing_landing_page::) formats
export function extractSmishingLandingPageFromMessage(msg: any): any | null {
    // 1️⃣ MASTRA V1: Check uiSignals first
    if (msg?.uiSignals && Array.isArray(msg.uiSignals)) {
        const landingSignal = msg.uiSignals.find((s: any) => s.signal === 'smishing_landing_page')
        if (landingSignal?.message) {
            try {
                const match = landingSignal.message.match(/::ui:smishing_landing_page::([^:]+)::/)
                if (match?.[1]) {
                    return JSON.parse(base64ToUtf8(match[1].trim()))
                }
            } catch (error) {
                console.error('Failed to parse smishing_landing_page from uiSignals:', error)
            }
        }
    }

    // 2️⃣ Legacy: Helper function to decode base64 and extract landing page
    const extractAndDecode = (text: string): any | null => {
        // Match: ::ui:smishing_landing_page::<base64>::/ui:smishing_landing_page::
        const match = text.match(/::ui:smishing_landing_page::([\s\S]+?)::\/ui:smishing_landing_page::/)
        if (!match || !match[1]) return null

        try {
            // Decode base64 to get JSON string with UTF-8 support
            const decoded = base64ToUtf8(match[1].trim())
            // Parse JSON to get LandingPage object
            return JSON.parse(decoded)
        } catch (error) {
            console.error('Failed to decode base64 smishing landing page:', error)
            return null
        }
    }

    // Check parts first (streaming)
    const parts = extractTextPartsForTemplate(msg)
    for (const p of parts) {
        const text = p?.delta || p?.text || ''
        const landingPage = extractAndDecode(text)
        if (landingPage) return landingPage
    }

    // Fallback: check final content
    const content = (msg?.content || '') + ''
    return extractAndDecode(content)
}

export function getSanitizedTitle(rawTitle: string): string {
    const content = (rawTitle || '') + ''
    return content
        .replace(/::ui:canvas_open::([^\s\n]+)\s*/g, '')
        .replace(/::ui:training_meta::([\s\S]+?)::\/ui:training_meta::/g, '')
        .replace(/::ui:phishing_email::([\s\S]+?)::\/ui:phishing_email::/g, '')
        .replace(/::ui:landing_page::([\s\S]+?)::\/ui:landing_page::/g, '')
        .replace(/::ui:smishing_sms::([\s\S]+?)::\/ui:smishing_sms::/g, '')
        .replace(/::ui:smishing_landing_page::([\s\S]+?)::\/ui:smishing_landing_page::/g, '')
        .replace(/::ui:vishing_call_started::([\s\S]+?)::\/ui:vishing_call_started::/g, '')
        .replace(/::ui:vishing_call_transcript::([\s\S]+?)::\/ui:vishing_call_transcript::/g, '')
        .replace(/::ui:(training_uploaded|phishing_uploaded|smishing_uploaded|training_assigned|phishing_assigned|smishing_assigned|target_user|target_group)::([\s\S]*?::\/ui:\1::)?(\n|\s)*/g, '')
        .replace(/::ui:target_user::[^\n]*/g, '')
        .replace(/::\/ui:target_user::/g, '')
        .replace(/^[A-Za-z0-9+/]{20,}={0,2}$/gm, '')
        .replace(/\n{2,}/g, '\n')
}

// Get all stream text from message parts
export function getAllStreamText(message: any): string {
    const parts = extractTextPartsForTemplate(message) || []
    return parts.map((p: any) => p?.delta || p?.text || '').join('')
}

// Show message content in canvas (URL, email, code, or preview)
export function showInCanvas(canvasRef: any, content: string) {
    // URL detection - check if content contains a URL
    const urlRegex = /(https?:\/\/[^\s]+)/gi
    const urls = content.match(urlRegex)

    if (urls && urls.length > 0) {
        // URL content - show in iframe
        const url = urls[0] // Use the first URL found
        canvasRef.value?.updateContent({
            type: 'url',
            url: url,
            title: `Website: ${new URL(url).hostname}`
        })
    } else if (content.includes('@') && (content.includes('Subject:') || content.includes('From:') || content.includes('To:'))) {
        // Email content
        const emailMatch = content.match(/From:\s*([^\n]+)\nTo:\s*([^\n]+)\nSubject:\s*([^\n]+)\n\n([\s\S]+)/i)
        if (emailMatch) {
            canvasRef.value?.updateContent({
                type: 'email',
                from: emailMatch[1],
                to: emailMatch[2],
                subject: emailMatch[3],
                body: emailMatch[4]
            })
        } else {
            // Simple email format
            canvasRef.value?.updateContent({
                type: 'email',
                body: content
            })
        }
    } else if (content.includes('```') || content.includes('function') || content.includes('const ') || content.includes('class ')) {
        // Code content
        const codeMatch = content.match(/```(\w+)?\n([\s\S]+?)\n```/g)
        if (codeMatch) {
            const firstMatch = codeMatch[0].match(/```(\w+)?\n([\s\S]+?)\n```/)
            if (firstMatch) {
                canvasRef.value?.updateContent({
                    type: 'code',
                    code: firstMatch[2],
                    filename: firstMatch[1] ? `code.${firstMatch[1]}` : 'code.txt'
                })
            } else {
                canvasRef.value?.updateContent({
                    type: 'code',
                    code: content
                })
            }
        } else {
            canvasRef.value?.updateContent({
                type: 'code',
                code: content
            })
        }
    } else {
        // HTML or general preview
        canvasRef.value?.updateContent({
            type: 'preview',
            title: 'AI Response',
            html: content
        })
    }
}

