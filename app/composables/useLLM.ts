export function useLLM() {
  const models = [
    'gpt-5-nano'
  ]
  const model = useCookie<string>('llm-model', { default: () => 'gpt-5-nano' })

  return {
    models,
    model
  }
}
