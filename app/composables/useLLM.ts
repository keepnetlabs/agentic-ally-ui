export function useLLM() {
  const models = [
    'gpt-oss-120b'
  ]
  const model = useCookie<string>('llm-model', { default: () => 'gpt-oss-120b' })

  return {
    models,
    model
  }
}
