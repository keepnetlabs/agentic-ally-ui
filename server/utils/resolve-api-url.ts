const DOMAIN_MAP: Record<string, string> = {
  'https://test-ui.devkeepnet.com': 'https://test-api.devkeepnet.com'
}

export const resolveBaseApiUrl = (value: string): string => {
  const trimmed = value.trim().replace(/\/+$/, '')
  return DOMAIN_MAP[trimmed] || trimmed
}
