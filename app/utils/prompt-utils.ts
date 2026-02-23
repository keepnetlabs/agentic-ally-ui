/**
 * Get the focusable input (textarea or input) from a prompt component ref.
 * UChatPrompt and similar components render a wrapper; the actual input is inside.
 */
export function getPromptInputElement(
  promptRef: { value: unknown } | null
): HTMLTextAreaElement | HTMLInputElement | null {
  const component = promptRef?.value as { $el?: HTMLElement } | null | undefined
  const el = component?.$el
  if (!el) return null
  return el.querySelector('textarea, input') as HTMLTextAreaElement | HTMLInputElement | null
}
