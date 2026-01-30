import { ref, nextTick, watch } from 'vue'
import { base64ToUtf8, getAllStreamText, extractTrainingUrlFromMessage, extractLandingPageFromMessage } from '../utils/message-utils'
import { parseAIMessage } from '../utils/text-utils'
import { useStreamEvents, type PhishingEmailPayload, type LandingPagePayload } from './useStreamEvents'

export const useCanvasTriggers = (
    canvasRef: any,
    isCanvasVisible: any,
    toggleCanvas: () => void,
    hideCanvas: () => void,
    messages: any,
    route: any,
    chat: any,
    status: any
) => {
    const hasCanvasOpenedForCurrentMessage = ref(false)
    const hasEmailRenderedForCurrentMessage = ref(false)
    const hasLandingPageRenderedForCurrentMessage = ref(false)

    // =====================================
    // MASTRA V1: Stream Event Handlers
    // =====================================

    // Get current message ID for canvas operations
    const getCurrentMessageId = (): string | undefined => {
        const last = messages.value?.[messages.value.length - 1]
        return last?.id
    }

    // Forward declarations for canvas functions (defined below)
    // Using arrow functions with closures to avoid hoisting issues
    let openCanvasWithUrlFn: (url: string, title?: string) => Promise<void>
    let openCanvasWithEmailFn: (emailData: any, messageId?: string) => Promise<void>
    let openCanvasWithLandingPageFn: (landingPage: any, messageId?: string) => Promise<void>

    // Initialize stream event handlers with lazy binding
    const streamEventHandlers = {
        onPhishingEmail: (payload: PhishingEmailPayload) => {
            if (hasEmailRenderedForCurrentMessage.value) return
            hasEmailRenderedForCurrentMessage.value = true
            openCanvasWithEmailFn(payload, getCurrentMessageId())
        },
        onLandingPage: (payload: LandingPagePayload) => {
            if (hasLandingPageRenderedForCurrentMessage.value) return
            hasLandingPageRenderedForCurrentMessage.value = true
            openCanvasWithLandingPageFn(payload, getCurrentMessageId())
        },
        onCanvasOpen: (url: string) => {
            if (hasCanvasOpenedForCurrentMessage.value) return
            hasCanvasOpenedForCurrentMessage.value = true
            openCanvasWithUrlFn(url)
        }
    }

    const { handleStreamEvent } = useStreamEvents(streamEventHandlers)

    /**
     * Handle incoming stream data events (called from Chat transport)
     * This is the main entry point for MASTRA V1 data-* events
     */
    const handleDataEvent = (event: unknown) => {
        handleStreamEvent(event)
    }

    const openCanvasWithUrl = async (url: string, title?: string) => {
        if (!url) return
        if (!isCanvasVisible.value) {
            toggleCanvas()
            await nextTick()
        }
        // Always update content, even if canvas is already visible
        await nextTick()

        // Force reload by updating content with a timestamp to make it unique
        const urlWithTimestamp = `${url}${url.includes('?') ? '&' : '?'}t=${Date.now()}`

        canvasRef.value?.updateContent({
            type: 'url',
            url: urlWithTimestamp,
            title: title || `Training: ${new URL(url).hostname}`
        })
    }

    const openCanvasWithEmail = async (emailData: { template: string; fromAddress?: string; fromName?: string; subject?: string } | string, messageId?: string) => {
        // Support both old string format and new object format
        const isString = typeof emailData === 'string'
        const template = isString ? emailData : emailData.template
        const fromAddress = isString ? undefined : emailData.fromAddress
        const fromName = isString ? undefined : emailData.fromName
        const subject = isString ? undefined : emailData.subject

        if (!template) return
        if (!isCanvasVisible.value) {
            toggleCanvas()
            await nextTick()
        }
        await nextTick()

        // Build from string: "Name <email>" or just email
        const from = fromName && fromAddress
            ? `${fromName} <${fromAddress}>`
            : fromAddress || 'Phishing Simulation <security@example.com>'

        // Replace {QRCODEURLIMAGE} placeholder with actual image
        const body = template.replace(/{QRCODEURLIMAGE}/g, 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAZAAAAGQCAYAAACAvzbMAAAV0UlEQVR4Ae3dzZHkxLoG4OIG+wELGCwALGCwANiyASwALAAsACwANmyBiHvWgAWABYAFMBb0ra8DnStEZpX0llr1M88TUcHM0C2ppEy9mSkp9dzd3g4AFvqfHQAEBAgAEQECQESAABARIABEBAgAEQECQESAABARIABEBAgAEQECQESAABARIABEBAgAEQECQESAABARIABEBAgAEQECQESAABARIABEBAgAEQECQESAABB5freBRy882nF+T/96ukvc+vFL9wtt6vtl2KJc64EAEBEgAEQECAARAQJARIAAEBEgAEQECAARAQJARIAAEBEgAEQECAARAQJARIAAENlkNt6UWVLbtp7t9FqOQ7pfrmX22K1nU976uKvvbZdcPvVAAIgIEAAiAgSAiAABICJAAIgIEAAiAgSAiAABICJAAIgIEAAiAgSAiAABICJAAIhc9Gy8qVufXfVa3PossFt/v2sp11tT389HDwSAiAABICJAAIgIEAAiAgSAiAABICJAAIgIEAAiAgSAiAABICJAAIgIEAAiAgSAyE3OxstlMOss3DY9EAAiAgSAiAABICJAAIgIEAAiAgSAiAABICJAAIgIEAAiAgSAiAABICJAAIgIEAAiZuPlmZfO/rv1bMNmN+bS6IEAEBEgAEQECAARAQJARIAAEBEgAEQECAARAQJARIAAEBEgAEQECAARAQJARIAAELnJ2XjTWUtZ163PcstlcPzORw8EgIgAASAiQACICBAAIgIEgIgAASAiQACICBAAIgIEgIgAASAiQACICBAAIgIEgMhFz8abzq7Kum59Vl2z+F4G9f366IEAEBEgAEQECAARAQJARIAAEBEgAEQECAARAQJARIAAEBEgAEQECAARAQJARIAAEHnubm8HB2w9S+rWs9ze+veDh6IHAkBEgAAQESAARAQIABEBAkBEgAAQESAARAQIABEBAkBEgAAQESAARAQIABEBAkDk+d0GrmW201vfznR917I/t3br5Sy1dfm8dZe8P/VAAIgIEAAiAgSAiAABICJAAIgIEAAiAgSAiAABICJAAIgIEAAiAgSAiAABICJAAIg8d7e3e2DXMiurWXzXXV/q1rdza9dSXm599ubUJc9SrAcCQESAABARIABEBAgAEQECQESAABARIABEBAgAEQECQESAABARIABEBAgAEQECQOT53QW79Vk9r+X7Xctsw6lbn/331mfVNTt12xbbqQcCQESAABARIABENrkG8p///c9uS9bHEteyP23numzn6TZ5pS0At8cQFgARAQJARIAAEBEgAEQECAARAQJARIAAEBEgAEQECAARAQJARIAAEBEgAEQECAARAQJARIAAENnkhVJz/PXXX7sff/xx98cff9z/+ffff9999tlnuxdeeGEH8Kz68MMPdy+++OL9n1955ZXdq6++unv8+PHuEpz9hVIVFp9++unuq6++uv/z2G+//XYxOwrgHOocWA3rsSdPnuy+/PLLs58fz94DeeONN3a//PLLDoB5arTmtdde2/38889nDZGzBkj1Ok4Nj9qR33///f1/a9hr3Iuprl593n333fvEnuOjjz6avU114Gr5r7/++v1/E7W9X3zxxf3213qn21/reOutt+6/Q6qW+fXXX/93HbWfBjVEWOt577337r/HnMJYy6j9dEwtu5ZXn+p6zz0GZclxaKl1ffzxx//9e2uba/u+/fbbo8uq/ff222//699/+OGHf/z9ocpOa7kffPDBfblYqrWsOvbj8nXo+NY+XXIcjy1vSSu6RiqqDK+1XWNDHfnuu+9Oroe98rLEnONb63n//ff/VQ43dXdG+wNTw2f/+OwP1N3+2sfdfqcc/N398NbdvsD86/d7n/rZ+p1jlixzut371sDdXH/++efdfmxz0fL3gXu31Oeff363P1HOXscnn3xydJl1bNJ9NPc7pMdh+OxPike3ubZnjio3rXWstc3HymZruUlZ6C1reswPHd8qs0vtT4Td5c2pk4M6XmtuV6l6WN9/SR05tu975WXJZ7yOOh77hk53P9Z3OJezBkhaoGrnzj3gxyrL1Kknrjkn4PqOhyrDoc/cilKF6pQwPHQc0gCZu/w1jsM1BUjrpHFsuecKkKp3S05Yx06mcwPkWJmr7Vrqoerh2gEy1jrvHWtsP6Sz3cY7vWBe5txdUN3M6nK3fn+OfWW57wo/lFp+r5tdaviorvuMh5GW2Pco7ruth9S+qXUc2o5DTt3GOcuv8VvXvv6pynV6zLYyDPXMVcOzazi2zuEuzrm2qIcPocrI1PQC+5bOdg2kFQDHbtmtg123tLUMY/n1qT/XyakKVGs9dZKvsee5Y6b1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q/0/XW+VyyWjDVXfWr3/Q/PR1TGoc8FQD6cjIUkdObWXOj4m9Z16Dx3P3Z6H8lylyO6MqlD1LuJWgKw1jFI7elywhmGeS535FKDUObAVIKcOw63h7Lfx1g7Y4hH86nVUkg+3H1ZwXNPDWwCD4RrMOcOjnL0HMhhunaxPvRui/t56ahfgWVJD+jXzbr3RcbhR4FLOixcTIABcl6t5Eh2AyyJAAIgIEAAiAgSAiAABICJAAIgIEAAiAgSAiAABICJAAIgIEAAiAgSAiAABILLJGwm/+eab3ZbeeeedXWLr7bwWW+/PdH3XQn1oU2/XtUU92mQ690cvPNpt6elfT3eJrbfzWmy9P9P1XQv1oU29XdcW9cgQFgARAQJAZJNrIKmthzK2Xt/WQzy6+m3XMtRmKOoy1pe6xXqrBwJARIAAEBEgAEQECAARAQJARIAAEBEgAEQECAARAQJARIAAEBEgAEQECAARAQJA5KJfKHXrs87e+iyiqVufNdhsypdB/TudHggAEQECQESAABARIABEBAgAEQECQESAABARIABEBAgAEQECQESAABARIABEBAgAkU1m4+W6Xcvso1vP+nwtbn2/3Pps32bjBeDmCBAAIgIEgIgAASAiQACICBAAIgIEgIgAASAiQACICBAAIgIEgIgAASAiQACIPL/bwNazV9KWzuq59Wyg1zK7qlmD2279+916fVhCDwSAiAABICJAAIgIEAAiAgSAiAABICJAAIgIEAAiAgSAiAABICJAAIgIEAAiAgSAyCaz8aauZXbOrd367MZm1V13fVtTb58deiAARAQIABEBAkBEgAAQESAARAQIABEBAkBEgAAQESAARAQIABEBAkBEgAAQESAARC56Nt6UWUvXdeuzzppVt+3WZ32+Fpd8ntADASAiQACICBAAIgIEgIgAASAiQACICBAAIgIEgIgAASAiQACICBAAIgIEgIgAASByk7Pxchm2nuU2lW7n1rPVmr35ut1iedEDASAiQACICBAAIgIEgIgAASAiQACICBAAIgIEgIgAASAiQACICBAAIgIEgIgAASBiNl6OSmf13Hr20a1ngbW+ddeX2rqc8f/0QACICBAAIgIEgIgAASAiQACICBAAIgIEgIgAASAiQACICBAAIgIEgIgAASAiQACI3ORsvFvPBnrrrmUW2K35fuvaer/c+vHbgh4IABEBAkBEgAAQESAARAQIABEBAkBEgAAQESAARAQIABEBAkBEgAAQESAARAQIAJGLno3XrJfX7dZnV03XZ5bbdX8vtfVxT13yeVAPBICIAAEgIkAAiAgQACICBICIAAEgIkAAiAgQACICBICIAAEgIkAAiAgQACICBIDIc3d7OwBYSA8EgIgAASAiQACICBAAIgIEgIgAASAiQACICBAAIgIEgIgAASAiQACICBAAIgIEgIgAASAiQACICBAAIgIEgIgAASAiQACICBAAIgIEgIgAASAiQACICBAAIv8H7Y9lJqlPj7MAAAAASUVORK5CYII=')

        canvasRef.value?.updateContent({
            type: 'email',
            body: body,
            from: from,
            to: 'user@company.com',
            subject: subject || 'Security Awareness Training Email',
            messageId: messageId,
            chatId: route.params.id as string,
            emailData: isString ? undefined : emailData
        })
    }

    const openCanvasWithLandingPage = async (landingPage: any, messageId?: string) => {
        if (!landingPage || !landingPage.pages || landingPage.pages.length === 0) return
        if (!isCanvasVisible.value) {
            toggleCanvas()
            await nextTick()
        }
        await nextTick()

        canvasRef.value?.updateContent({
            type: 'landing-page',
            landingPage: landingPage,
            title: landingPage.name || 'Landing Page',
            messageId: messageId,
            chatId: route.params.id as string
        })
    }

    // Bind forward references now that functions are defined
    openCanvasWithUrlFn = openCanvasWithUrl
    openCanvasWithEmailFn = openCanvasWithEmail
    openCanvasWithLandingPageFn = openCanvasWithLandingPage

    const checkAndTriggerCanvas = (message: any) => {
        const content = message.content || parseAIMessage(message)
        if (typeof content === 'string') {
            // Only open canvas if ::ui:canvas_open:: tag is present
            const canvasUrl = extractTrainingUrlFromMessage(message)
            if (canvasUrl) {
                // Extract title if provided
                const titleMatch = content.match(/Title:\s*([^\n]+)/i)
                const title = titleMatch ? titleMatch[1] : `Training: ${new URL(canvasUrl).hostname}`

                canvasRef.value?.updateContent({
                    type: 'url',
                    url: canvasUrl,
                    title: title
                })
            }
        }
    }

    const maybeProcessUiSignals = (message: any) => {
        if (!message) return

        const allText = getAllStreamText(message)

        // Check for canvas URL signal
        if (!hasCanvasOpenedForCurrentMessage.value) {
            const urlMatch = allText.match(/::ui:canvas_open::([^\s\n]+)/)
            if (urlMatch && urlMatch[1]) {
                hasCanvasOpenedForCurrentMessage.value = true
                openCanvasWithUrl(urlMatch[1])
            }
        }

        // Check for phishing email signal
        if (!hasEmailRenderedForCurrentMessage.value) {
            const emailMatch = allText.match(/::ui:phishing_email::([\s\S]+?)::\/ui:phishing_email::/)
            if (emailMatch && emailMatch[1]) {
                try {
                    // Decode base64 to get JSON string with UTF-8 support
                    const decoded = base64ToUtf8(emailMatch[1].trim())
                    // Parse JSON to get PhishingEmail object
                    const emailObj = JSON.parse(decoded)
                    hasEmailRenderedForCurrentMessage.value = true
                    // Pass the entire email object with message ID
                    openCanvasWithEmail(emailObj, message.id)
                } catch (error) {
                    console.error('Failed to decode base64 phishing email in stream:', error)
                }
            }
        }

        // Check for landing page signal
        if (!hasLandingPageRenderedForCurrentMessage.value) {
            const landingPage = extractLandingPageFromMessage(message)
            if (landingPage) {
                hasLandingPageRenderedForCurrentMessage.value = true
                openCanvasWithLandingPage(landingPage, message.id)
            }
        }
    }

    // Helper to reset all canvas flags
    const resetCanvasFlags = () => {
        hasCanvasOpenedForCurrentMessage.value = false
        hasEmailRenderedForCurrentMessage.value = false
        hasLandingPageRenderedForCurrentMessage.value = false
    }

    // UNIFIED WATCH: Reset flags and close canvas on context changes
    watch(
        () => ({
            messageId: messages.value[messages.value.length - 1]?.id,
            routeId: route.params.id,
            chatId: chat.value?.id
        }),
        (current, previous) => {
            // Reset flags when message changes
            if (current.messageId !== previous?.messageId) {
                resetCanvasFlags()
            }

            // Close canvas and reset when chat/route changes
            if (current.routeId !== previous?.routeId || current.chatId !== previous?.chatId) {
                if (isCanvasVisible.value) {
                    hideCanvas()
                }
                resetCanvasFlags()
            }
        }
    )

    // NOTE: Streaming watch removed - now handled in [id].vue unified watcher

    return {
        hasCanvasOpenedForCurrentMessage,
        hasEmailRenderedForCurrentMessage,
        hasLandingPageRenderedForCurrentMessage,
        openCanvasWithUrl,
        openCanvasWithEmail,
        openCanvasWithLandingPage,
        checkAndTriggerCanvas,
        maybeProcessUiSignals,
        // MASTRA V1: New stream event handler
        handleDataEvent
    }
}

