import { computed, type Ref } from 'vue'

export const useChatClient = () => {
    // Parse model value into provider and model
    const getModelConfig = (model: any) => {
        // Handle both string and object values
        const value = typeof model === 'string' ? model : model?.value || ''

        if (value.startsWith('WORKERS_AI_')) {
            return {
                modelProvider: 'WORKERS_AI',
                model: value
            }
        } else if (value.startsWith('OPENAI_')) {
            return {
                modelProvider: 'OPENAI',
                model: value
            }
        } else if (value.startsWith('GOOGLE_GEMINI_')) {
            return {
                modelProvider: 'GOOGLE',
                model: value
            }
        }

        return {
            modelProvider: 'WORKERS_AI',
            model: 'WORKERS_AI_GPT_OSS_120B'
        }
    }

    const createHandleSubmit = (chatClient: any, input: any, messages: any, status: any, lastFinishedMessageId: any) => {
        return () => {
            if (!input.value) return

            // Check if streaming is actually finished (text-end received) even if status hasn't updated yet
            const lastMessage = messages.value[messages.value.length - 1]
            const isActuallyStreaming = status.value === 'streaming' &&
                lastMessage?.role === 'assistant' &&
                lastMessage?.id &&
                lastFinishedMessageId.value !== lastMessage?.id

            if (isActuallyStreaming) return

            chatClient.sendMessage({ text: input.value })
            input.value = ''
        }
    }

    const createStop = () => {
        return () => {
            // Chat class doesn't have stop method, need to use AbortController
        }
    }

    const createReload = (chatClient: any) => {
        return () => {
            chatClient.regenerate()
        }
    }

    const createMessages = (chatClient: any, parseAIReasoning: any, parseAIMessage: any, versionRef?: Ref<number>) => {
        return computed<any[]>(() =>
            chatClient.messages.map((m: any) => {
                if (versionRef) {
                    versionRef.value
                }
                const reasoning = parseAIReasoning(m)
                if (reasoning && m.role === 'assistant') {
                    console.log('Message with reasoning:', {
                        id: m.id,
                        partsCount: m.parts?.length,
                        reasoningLength: reasoning.length,
                        parts: m.parts
                    })
                }

                // Filter text parts (both legacy and new formats)
                const textParts = (m.parts ?? []).filter((p: any) => {
                    if (!p) return false
                    // Legacy text formats
                    if (p.type === 'text-delta' || p.type === 'text') return true
                    // Exclude data-* events from text parts (they're handled separately)
                    return false
                })

                // Extract data-* events for separate handling
                const dataEvents = (m.parts ?? []).filter((p: any) => {
                    if (!p || typeof p.type !== 'string') return false
                    return p.type.startsWith('data-')
                })

                return {
                    id: m.id,
                    role: m.role,
                    content: m.content || parseAIMessage(m),
                    parts: m.parts ?? [],
                    textParts,
                    dataEvents, // MASTRA V1: Expose data-* events
                    uiSignals: m.uiSignals ?? [], // MASTRA V1: UI signals for cards
                    reasoning
                }
            })
        )
    }

    const createStatus = (chatClient: any) => {
        return computed(() => chatClient.status)
    }

    const createErrorComputed = (chatClient: any) => {
        return computed(() => chatClient.error)
    }

    return {
        getModelConfig,
        createHandleSubmit,
        createStop,
        createReload,
        createMessages,
        createStatus,
        createErrorComputed
    }
}

