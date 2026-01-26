import { ref, nextTick, onMounted, onBeforeUnmount, type Ref } from 'vue'
import { buildTargetGroupTag, buildTargetUserTag, getEmailInitials, getNameInitials } from '../utils/mention-utils'

export type MentionUser = {
  id: string
  name: string
  email: string
  avatar?: string | null
  department?: string | null
}

export type MentionGroup = {
  id: string
  name: string
  memberCount?: number | null
}

export type MentionItem = {
  kind: 'user' | 'group'
  id: string
  name: string
  email?: string
  avatar?: string | null
  department?: string | null
  memberCount?: number | null
}

type UseMentionsOptions = {
  input: Ref<string>
  buildUrl: (path: string) => string
  secureFetch: <T>(url: string, options?: Record<string, unknown>) => Promise<T>
  minMentionLength?: number
  debounceMs?: number
}

export const useMentions = ({
  input,
  buildUrl,
  secureFetch,
  minMentionLength = 3,
  debounceMs = 500
}: UseMentionsOptions) => {
  const cursorIndex = ref(0)
  const mentionQuery = ref('')
  const mentionStartIndex = ref<number | null>(null)
  const mentionOpen = ref(false)
  const mentionResults = ref<MentionItem[]>([])
  const mentionIndex = ref(0)
  const mentionLoading = ref(false)
  const selectedTargetUser = ref<MentionUser | null>(null)
  const selectedTargetGroup = ref<MentionGroup | null>(null)
  const promptRef = ref<unknown>(null)
  const promptContainerRef = ref<HTMLElement | null>(null)
  const mentionListRef = ref<HTMLElement | null>(null)
  let mentionSearchTimeout: ReturnType<typeof setTimeout> | null = null

  const getPromptInput = () => {
    const element = (promptRef.value as { $el?: HTMLElement } | null)?.$el
    if (!element) {
      return null
    }
    return element.querySelector('textarea, input') as HTMLTextAreaElement | HTMLInputElement | null
  }

  const closeMentionMenu = () => {
    if (mentionSearchTimeout) {
      clearTimeout(mentionSearchTimeout)
      mentionSearchTimeout = null
    }
    mentionLoading.value = false
    mentionOpen.value = false
    mentionQuery.value = ''
    mentionResults.value = []
    mentionStartIndex.value = null
    mentionIndex.value = 0
  }

  const scrollActiveMentionIntoView = () => {
    nextTick(() => {
      const container = mentionListRef.value
      if (!container) {
        return
      }
      const active = container.querySelector(`[data-mention-index="${mentionIndex.value}"]`) as HTMLElement | null
      if (!active) {
        return
      }
      active.scrollIntoView({ block: 'nearest' })
    })
  }

  const syncCursorIndex = (event?: Event) => {
    if (event instanceof KeyboardEvent && ['ArrowDown', 'ArrowUp', 'Enter', 'Escape'].includes(event.key)) {
      return
    }
    const target = event?.target as HTMLTextAreaElement | HTMLInputElement | null
    const inputEl = target && 'selectionStart' in target ? target : getPromptInput()
    if (!inputEl || inputEl.selectionStart === null) {
      return
    }
    cursorIndex.value = inputEl.selectionStart
    updateMentionState()
  }

  const queueMentionSearch = (query: string) => {
    if (mentionSearchTimeout) {
      clearTimeout(mentionSearchTimeout)
    }
    if (!query) {
      mentionResults.value = []
      mentionOpen.value = false
      return
    }

    mentionSearchTimeout = setTimeout(async () => {
      try {
        mentionLoading.value = true
        mentionOpen.value = true
        const baseOrigin = process.client ? window.location.origin : 'http://localhost'
        const usersUrl = new URL(buildUrl('/api/users'), baseOrigin)
        usersUrl.searchParams.set('q', query)
        usersUrl.searchParams.set('limit', '8')
        const groupsUrl = new URL(buildUrl('/api/target-groups'), baseOrigin)
        groupsUrl.searchParams.set('q', query)
        groupsUrl.searchParams.set('limit', '8')

        const [usersResult, groupsResult] = await Promise.allSettled([
          secureFetch<MentionUser[]>(usersUrl.toString(), { method: 'GET' }),
          secureFetch<MentionGroup[]>(groupsUrl.toString(), { method: 'GET' })
        ])

        const users = usersResult.status === 'fulfilled' ? usersResult.value : []
        const groups = groupsResult.status === 'fulfilled' ? groupsResult.value : []

        const combined: MentionItem[] = [
          ...users.map((user) => ({
            kind: 'user' as const,
            id: user.id,
            name: user.name,
            email: user.email,
            avatar: user.avatar ?? null,
            department: user.department ?? null
          })),
          ...groups.map((group) => ({
            kind: 'group' as const,
            id: group.id,
            name: group.name,
            memberCount: group.memberCount ?? 0
          }))
        ]

        mentionResults.value = combined
        mentionIndex.value = 0
        mentionOpen.value = true
        scrollActiveMentionIntoView()
      } catch {
        mentionResults.value = []
      } finally {
        mentionLoading.value = false
      }
    }, debounceMs)
  }

  const updateMentionState = () => {
    const currentText = input.value
    const cursor = cursorIndex.value
    const beforeCursor = currentText.slice(0, cursor)
    const match = beforeCursor.match(/(?:^|\s)@([\w.+-]*)$/)
    if (!match) {
      closeMentionMenu()
      return
    }

    const query = match[1] ?? ''
    if (query.length < minMentionLength) {
      closeMentionMenu()
      return
    }
    mentionQuery.value = query
    const atIndex = beforeCursor.lastIndexOf('@')
    mentionStartIndex.value = atIndex >= 0 ? atIndex : cursor - match[0].length
    queueMentionSearch(query)
  }

  const selectMention = (item: MentionItem) => {
    const startIndex = mentionStartIndex.value
    if (startIndex === null) {
      closeMentionMenu()
      return
    }

    const cursor = cursorIndex.value
    const before = input.value.slice(0, startIndex)
    const after = input.value.slice(cursor)
    const insertValue = item.kind === 'group' ? item.name : (item.email ?? item.name)
    const insertText = `@${insertValue} `
    input.value = `${before}${insertText}${after}`
    if (item.kind === 'user') {
      selectedTargetUser.value = {
        id: item.id,
        name: item.name,
        email: item.email ?? '',
        avatar: item.avatar ?? null,
        department: item.department ?? null
      }
    } else {
      selectedTargetGroup.value = {
        id: item.id,
        name: item.name,
        memberCount: item.memberCount ?? 0
      }
    }
    closeMentionMenu()

    nextTick(() => {
      const inputEl = getPromptInput()
      if (!inputEl) {
        return
      }
      const nextCursor = before.length + insertText.length
      inputEl.focus()
      inputEl.setSelectionRange(nextCursor, nextCursor)
      cursorIndex.value = nextCursor
    })
  }

  const handleMentionMouseDown = (item: MentionItem) => {
    selectMention(item)
  }

  const handlePromptKeydown = (event: KeyboardEvent) => {
    if (!mentionOpen.value || mentionResults.value.length === 0) {
      return
    }

    if (event.key === 'Backspace') {
      event.stopPropagation()
      if (mentionSearchTimeout) {
        clearTimeout(mentionSearchTimeout)
        mentionSearchTimeout = null
      }
      mentionLoading.value = false
      closeMentionMenu()
      return
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault()
      event.stopPropagation()
      mentionIndex.value = (mentionIndex.value + 1) % mentionResults.value.length
      scrollActiveMentionIntoView()
      return
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault()
      event.stopPropagation()
      mentionIndex.value = (mentionIndex.value - 1 + mentionResults.value.length) % mentionResults.value.length
      scrollActiveMentionIntoView()
      return
    }

    if (event.key === 'Enter') {
      event.preventDefault()
      event.stopPropagation()
      const selected = mentionResults.value[mentionIndex.value]
      if (selected) {
        selectMention(selected)
      }
      return
    }

    if (event.key === 'Escape') {
      event.stopPropagation()
      closeMentionMenu()
    }
  }

  const applyTargetTags = () => {
    if (selectedTargetUser.value && input.value.includes(selectedTargetUser.value.email)) {
      const tag = buildTargetUserTag(selectedTargetUser.value)
      input.value = `${input.value}\n${tag}\n`
    }
    if (selectedTargetGroup.value && input.value.includes(selectedTargetGroup.value.name)) {
      const tag = buildTargetGroupTag(selectedTargetGroup.value)
      input.value = `${input.value}\n${tag}\n`
    }
  }

  const clearSelectedTargets = () => {
    selectedTargetUser.value = null
    selectedTargetGroup.value = null
  }

  const getMentionInitials = (item: MentionItem) => {
    if (item.kind === 'group') {
      return getNameInitials(item.name)
    }
    return getEmailInitials(item.email ?? '')
  }

  const handleDocumentClick = (event: MouseEvent) => {
    const container = promptContainerRef.value
    if (!container) {
      return
    }
    if (!container.contains(event.target as Node)) {
      closeMentionMenu()
    }
  }

  onMounted(() => {
    document.addEventListener('click', handleDocumentClick)
  })

  onBeforeUnmount(() => {
    if (mentionSearchTimeout) {
      clearTimeout(mentionSearchTimeout)
    }
    document.removeEventListener('click', handleDocumentClick)
  })

  return {
    promptRef,
    promptContainerRef,
    mentionListRef,
    mentionOpen,
    mentionResults,
    mentionIndex,
    mentionLoading,
    syncCursorIndex,
    handlePromptKeydown,
    handleMentionMouseDown,
    applyTargetTags,
    clearSelectedTargets,
    closeMentionMenu,
    getMentionInitials
  }
}
