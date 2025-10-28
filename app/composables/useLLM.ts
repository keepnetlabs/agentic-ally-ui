interface Model {
  label: string
  value: string
}

export function useLLM() {
  const models: Model[] = [
    {
      label: 'GPT-OSS',
      value: "WORKERS_AI_GPT_OSS_120B"
    },
    {
      label: 'GPT-5 Nano',
      value: "OPENAI_GPT_5_NANO"
    },
    {
      label: 'GPT-4.1',
      value: "OPENAI_GPT_4_1"
    },
    {
      label: 'GPT-4.1 mini',
      value: "OPENAI_GPT_4_1_MINI"
    },
    {
      label: 'GPT-4o',
      value: "OPENAI_GPT_4O"
    },
    {
      label: 'GPT-4o mini',
      value: "OPENAI_GPT_4O_MINI"
    }
  ]

  const model = useCookie<string>('llm-model', { default: () => "WORKERS_AI_GPT_OSS_120B" })

  return {
    models,
    model
  }
}
