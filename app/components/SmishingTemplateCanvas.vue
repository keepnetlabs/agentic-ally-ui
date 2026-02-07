<script setup lang="ts">
import { ref, watch, computed } from 'vue'

interface Props {
  template: string
  messageId?: string
  chatId?: string
}

const props = defineProps<Props>()

const emit = defineEmits<{
  close: []
  save: [template: string]
}>()

const localTemplate = ref(props.template || '')

watch(
  () => props.template,
  (value) => {
    localTemplate.value = value || ''
  }
)

const gsm7Basic =
  '@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞ\u001BÆæßÉ !\"#¤%&\'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ`¿abcdefghijklmnopqrstuvwxyzäöñüà'
const gsm7Extended = '^{}\\[~]|€'
const gsm7Set = new Set([...gsm7Basic, ...gsm7Extended])

const stripMergeTags = (value: string) => value.replace(/\{[A-Z0-9_]+\}/g, '')

const isGsm7 = (value: string) => {
  for (const ch of value) {
    if (!gsm7Set.has(ch)) return false
  }
  return true
}

const gsm7Length = (value: string) => {
  let count = 0
  for (const ch of value) {
    if (gsm7Extended.includes(ch)) {
      count += 2
    } else {
      count += 1
    }
  }
  return count
}

const smsStats = computed(() => {
  const raw = stripMergeTags(localTemplate.value || '')
  const gsm7 = isGsm7(raw)
  const length = gsm7 ? gsm7Length(raw) : raw.length
  const maxLength = gsm7 ? 160 : 70
  return { length, maxLength, gsm7 }
})

const hasPhishingUrlTag = computed(() => {
  return (localTemplate.value || '').includes('{PHISHINGURL}')
})

const isOverLimit = computed(() => smsStats.value.length > smsStats.value.maxLength)

const mergeTags = [
  { label: 'Phishing URL', tag: '{PHISHINGURL}' },
  { label: 'Full Name', tag: '{FULLNAME}' },
  { label: 'First Name', tag: '{FIRSTNAME}' },
  { label: 'Last Name', tag: '{LASTNAME}' },
  { label: 'Company Name', tag: '{COMPANYNAME}' }
]

const insertTag = (tag: string) => {
  if (!tag) return
  const spacer = localTemplate.value && !localTemplate.value.endsWith(' ') ? ' ' : ''
  localTemplate.value = `${localTemplate.value || ''}${spacer}${tag}`
}

const onSave = () => {
  if (isOverLimit.value || !hasPhishingUrlTag.value) return
  emit('save', localTemplate.value)
}
</script>

<template>
  <div class="h-full flex flex-col">
    <div class="px-4 pt-4">
      <div class="text-lg font-semibold text-foreground">Text Message</div>
      <div class="text-sm text-muted-foreground mt-1">
        Text message to be sent to target users. Use the mandatory merge tag {PHISHINGURL} for the link to be added to the text message.
      </div>
    </div>

    <div class="px-4 mt-3">
      <div class="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 overflow-hidden">
        <div class="flex flex-wrap items-center gap-2 px-3 py-2 bg-gray-50 dark:bg-gray-950 border-b border-gray-200 dark:border-gray-700">
          <UButton
            v-for="item in mergeTags"
            :key="item.tag"
            size="sm"
            color="primary"
            variant="solid"
            class="rounded-lg font-semibold"
            @click="insertTag(item.tag)"
          >
            {{ item.label }}
          </UButton>

          <div class="ms-auto flex items-center gap-2">
            <div class="text-xs text-muted-foreground">
              <span :class="isOverLimit ? 'text-red-500' : ''">
                {{ smsStats.length }}/{{ smsStats.maxLength }}
              </span>
            </div>
            <UTooltip v-if="isOverLimit || !hasPhishingUrlTag" :text="!hasPhishingUrlTag ? 'Add {PHISHINGURL}' : 'Over 160 chars'">
              <span>
                <UButton
                  size="sm"
                  color="primary"
                  class="rounded-full shadow-sm"
                  :disabled="true"
                >
                  Save
                </UButton>
              </span>
            </UTooltip>
            <UButton
              v-else
              size="sm"
              color="primary"
              class="rounded-full shadow-sm"
              @click="onSave"
            >
              Save
            </UButton>
            <UButton
              size="sm"
              variant="ghost"
              icon="i-lucide-x"
              @click="$emit('close')"
            />
          </div>
        </div>

        <div class="p-3 bg-white dark:bg-gray-900">
          <textarea
            v-model="localTemplate"
            class="w-full h-[240px] rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 p-3 text-sm leading-5 resize-none focus:outline-none focus:ring-2 focus:ring-primary-500"
            placeholder="Write smishing SMS template..."
          />
        </div>
      </div>

      <div class="text-xs mt-2">
        <div class="text-muted-foreground">
          SMS supports the GSM-7 character set (160) or Unicode (70).
        </div>
        <div v-if="!hasPhishingUrlTag" class="text-amber-600">
          {PHISHINGURL} is required.
        </div>
        <div v-else-if="isOverLimit" class="text-red-500">
          Message exceeds {{ smsStats.maxLength }} characters.
        </div>
      </div>
    </div>
  </div>
</template>
