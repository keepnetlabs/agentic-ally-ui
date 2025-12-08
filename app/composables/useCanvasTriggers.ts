import { ref, nextTick, watch } from 'vue'
import { base64ToUtf8, getAllStreamText, extractTrainingUrlFromMessage, extractLandingPageFromMessage } from '../utils/message-utils'
import { parseAIMessage } from '../utils/text-utils'

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

    const openCanvasWithEmail = async (emailData: { template: string; fromAddress?: string; fromName?: string; subject?: string } | string) => {
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

        canvasRef.value?.updateContent({
            type: 'email',
            body: template,
            from: from,
            to: 'user@company.com',
            subject: subject || 'Security Awareness Training Email'
        })
    }

    const openCanvasWithLandingPage = async (landingPage: any) => {
        if (!landingPage || !landingPage.pages || landingPage.pages.length === 0) return
        if (!isCanvasVisible.value) {
            toggleCanvas()
            await nextTick()
        }
        await nextTick()

        canvasRef.value?.updateContent({
            type: 'landing-page',
            landingPage: landingPage,
            title: landingPage.name || 'Landing Page'
        })
    }

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
                    // Pass the entire email object
                    openCanvasWithEmail(emailObj)
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
                openCanvasWithLandingPage(landingPage)
            }
        }
    }

    // Reset the processed flags whenever the last message changes
    watch(() => messages.value[messages.value.length - 1]?.id, () => {
        hasCanvasOpenedForCurrentMessage.value = false
        hasEmailRenderedForCurrentMessage.value = false
        hasLandingPageRenderedForCurrentMessage.value = false
    })

    // Close canvas when switching to different chat
    watch(() => route.params.id, () => {
        if (isCanvasVisible.value) {
            hideCanvas()
        }
        hasCanvasOpenedForCurrentMessage.value = false
        hasEmailRenderedForCurrentMessage.value = false
        hasLandingPageRenderedForCurrentMessage.value = false
    })

    // Close canvas when chat data changes (new chat created)
    watch(() => chat.value?.id, () => {
        if (isCanvasVisible.value) {
            hideCanvas()
        }
        hasCanvasOpenedForCurrentMessage.value = false
        hasEmailRenderedForCurrentMessage.value = false
        hasLandingPageRenderedForCurrentMessage.value = false
    })

    // Watch streaming progress and last message parts to detect the UI signal in near real-time
    watch(
        () => ({
            s: status.value,
            lastId: messages.value[messages.value.length - 1]?.id,
            lastRole: messages.value[messages.value.length - 1]?.role,
            lastParts: messages.value[messages.value.length - 1]?.parts?.length
        }),
        () => {
            const last = messages.value[messages.value.length - 1]
            if (!last || last.role !== 'assistant') return
            if (status.value === 'streaming') {
                maybeProcessUiSignals(last)
            }
        },
        { deep: true }
    )

    return {
        hasCanvasOpenedForCurrentMessage,
        hasEmailRenderedForCurrentMessage,
        hasLandingPageRenderedForCurrentMessage,
        openCanvasWithUrl,
        openCanvasWithEmail,
        openCanvasWithLandingPage,
        checkAndTriggerCanvas,
        maybeProcessUiSignals
    }
}

