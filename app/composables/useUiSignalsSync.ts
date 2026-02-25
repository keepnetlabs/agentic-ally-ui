const UI_SIGNAL_TYPES = [
  'phishing_email',
  'landing_page',
  'smishing_sms',
  'smishing_landing_page'
] as const

type UiSignal = { signal: string; message: string }

const normalizeSignals = (signals: UiSignal[]) =>
  signals
    .map((s) => ({
      signal: (s?.signal || '').trim(),
      message: (s?.message || '').trim()
    }))
    .sort((a, b) => (a.signal + a.message).localeCompare(b.signal + b.message))

const areSignalsEqual = (a: UiSignal[], b: UiSignal[]) => {
  if (a.length !== b.length) return false
  const aa = normalizeSignals(a)
  const bb = normalizeSignals(b)
  return aa.every((s, i) => s.signal === bb[i]?.signal && s.message === bb[i]?.message)
}

const extractWrappedSignals = (content: string): UiSignal[] => {
  const nextSignals: UiSignal[] = []

  const phishingMatches = [...content.matchAll(/::ui:phishing_email::([\s\S]+?)::\/ui:phishing_email::/g)]
  for (const match of phishingMatches) {
    if (match?.[1]) {
      nextSignals.push({
        signal: 'phishing_email',
        message: `::ui:phishing_email::${match[1].trim()}::/ui:phishing_email::`
      })
    }
  }

  const landingMatch = content.match(/::ui:landing_page::([\s\S]+?)::\/ui:landing_page::/)
  if (landingMatch?.[1]) {
    nextSignals.push({
      signal: 'landing_page',
      message: `::ui:landing_page::${landingMatch[1].trim()}::/ui:landing_page::`
    })
  }

  const smishingMatches = [...content.matchAll(/::ui:smishing_sms::([\s\S]+?)::\/ui:smishing_sms::/g)]
  for (const match of smishingMatches) {
    if (match?.[1]) {
      nextSignals.push({
        signal: 'smishing_sms',
        message: `::ui:smishing_sms::${match[1].trim()}::/ui:smishing_sms::`
      })
    }
  }

  const smishingLandingMatch = content.match(/::ui:smishing_landing_page::([\s\S]+?)::\/ui:smishing_landing_page::/)
  if (smishingLandingMatch?.[1]) {
    nextSignals.push({
      signal: 'smishing_landing_page',
      message: `::ui:smishing_landing_page::${smishingLandingMatch[1].trim()}::/ui:smishing_landing_page::`
    })
  }

  return nextSignals
}

export const useUiSignalsSync = (
  uiSignalsMap: Map<string, any[]>,
  messagesVersion: { value: number }
) => {
  const updateUiSignalsFromContent = (messageId: string, content: string) => {
    const existing = uiSignalsMap.get(messageId) || []
    const preserved = existing.filter((s: any) => !UI_SIGNAL_TYPES.includes(s.signal))
    const nextSignals = extractWrappedSignals(content)
    const merged = preserved.concat(nextSignals)
    const current = uiSignalsMap.get(messageId) || []

    if (areSignalsEqual(current as UiSignal[], merged as UiSignal[])) return

    if (merged.length > 0) {
      uiSignalsMap.set(messageId, merged)
    } else {
      uiSignalsMap.delete(messageId)
    }
    messagesVersion.value += 1
  }

  return { updateUiSignalsFromContent }
}
