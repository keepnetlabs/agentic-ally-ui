<script setup lang="ts">
import { ref } from 'vue'
import { useRoute } from 'vue-router'
import { useFetch } from 'nuxt/app'
// @ts-ignore - Nuxt auto-imports
import { useToast } from '#imports'
// @ts-ignore - Nuxt auto-imports
import { LazyModalConfirm } from '#components'

const route = useRoute()
const toast = useToast()
// @ts-ignore - Nuxt auto-imports useOverlay
const overlay = useOverlay()

// Get query params for headers
const accessToken = route.query.accessToken as string || 'eyJhbGciOiJSUzI1NiIsImtpZCI6IkMwMjRCMzYyRUY5QzgzNzQxNjYzMzJGMDE1MjMzQUNDIiwidHlwIjoiYXQrand0In0.eyJuYmYiOjE3NjY2MDQ4ODMsImV4cCI6MTc2NjY5MTI4MywiaXNzIjoiaHR0cDovL3Rlc3QtYXBpLmRldmtlZXBuZXQuY29tIiwiY2xpZW50X2lkIjoidWlfY2xpZW50Iiwic3ViIjoicHRhQ2RSS2paRTJhIiwiYXV0aF90aW1lIjoxNzY2NjA0ODgzLCJpZHAiOiJodHRwczovL3Rlc3QtYXBpLmRldmtlZXBuZXQuY29tIiwiZW1haWwiOiJndXJrYW4udWd1cmx1QGtlZXBuZXRsYWJzLmNvbSIsImZhbWlseV9uYW1lIjoiVWd1cmx1IiwiZ2l2ZW5fbmFtZSI6Ikd1cmthbiIsIm5hbWUiOiJHdXJrYW4gVWd1cmx1IiwicGhvbmVfbnVtYmVyIjoiIiwicGhvbmVfbnVtYmVyX3ZlcmlmaWVkIjoiZmFsc2UiLCJ1c2VyX2lkIjoiMzIiLCJ1c2VyX2NvbXBhbnlfaWQiOiIxIiwidXNlcl9jb21wYW55X3Jlc291cmNlaWQiOiJ1QjRqY0Z6OXgxTXkiLCJ1c2VyX2NvbXBhbnlfbmFtZSI6IlN5c3RlbSIsInVzZXJfY29tcGFueV9sb2dvcGF0aCI6Imh0dHBzOi8vdGVzdC1hcGkuZGV2a2VlcG5ldC5jb20vY29tcGFueWxvZ28vZmI5Y2RmODAtYmExZi00MWI4LTkxYzktYjE1YmU4YjBmMDEwLnBuZyIsInVzZXJfY29tcGFueV9pbmR1c3RyeV9yZXNvdXJjZWlkIjoiWlpZR2VOVkI2MHlNIiwidXNlcl9jb21wYW55X2luZHVzdHJ5X25hbWUiOiJUZWNobm9sb2d5IiwidXNlcl9jb21wYW55X3BhcmVudGNvbXBhbnlfcmVzb3VyY2VpZCI6IiIsInVzZXJfY29tcGFueV9wYXJlbnRjb21wYW55X25hbWUiOiIiLCJ1c2VyX2NvbXBhbnlfcGFyZW50Y29tcGFueV9pZCI6IjAiLCJzdGF0dXMiOiIxIiwicm9sZSI6IlJvb3QiLCJyb290X2FjY2VzcyI6IlRydWUiLCJyZXNlbGxlcl9hY2Nlc3MiOiJUcnVlIiwiY29tcGFueV9hZG1pbl9hY2Nlc3MiOiJUcnVlIiwianRpIjoiQzUxNjlBRjlDRDMzODMwQjE5QUMyQTI1NjdCMEMwQzQiLCJpYXQiOjE3NjY2MDQ4ODMsInNjb3BlIjpbImFwaTEiXSwiYW1yIjpbInBhc3N3b3JkIl19.xpXrfHQ9MOcv_h5MV8KjYY0-QdRvXwQ_wwz9fSXL4BOr2HGq9rw1H_Zr46kQctFmbYgF3MQfDO7lf34paMSEdiX4sbke12UhYx86QjOC8SAOK6WawBRvDz8_JW1a1xqqiig0hBa5TIF2Lz7zKf_F9Cr5ubTFuLlUrRPd-Iu5xwCFydjQ379_g8SPmG7KXO6DiYjZCrhwzfLpRD0Uz72SOXmPFShH7FK6jjxihouUNlp-mkzE8ulD4MuiMeyxzNNkMZfckk4w9DLLeiotoBFujjGtpV8hQOoR2lHR-I_8PbV1MydFYfjsO4Mb5fbT8qMyNRmbIwGaf1o33CLcIBkAmA'
const companyId = route.query.companyId as string

// Build headers for requests
const buildHeaders = () => {
  const headers: Record<string, string> = {}
  if (accessToken) {
    headers['X-AGENTIC-ALLY-TOKEN'] = accessToken
  }
  if (companyId) {
    headers['X-COMPANY-ID'] = companyId
  }
  return headers
}

// Fetch policies
// @ts-ignore - Nuxt allows top-level await in script setup
const { data: policies, refresh: refreshPolicies } = await useFetch('/api/files', {
  key: 'policies',
  credentials: 'include',
  headers: buildHeaders()
})

const selectedFile = ref<File | null>(null)
const uploading = ref(false)
const isDragging = ref(false)

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i]
}

const formatDate = (timestamp: Date | number | string): string => {
  let date: Date
  if (typeof timestamp === 'number') {
    // Unix timestamp in seconds
    date = new Date(timestamp * 1000)
  } else if (typeof timestamp === 'string') {
    date = new Date(timestamp)
  } else {
    date = timestamp
  }
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

const handleFileSelect = (event: Event) => {
  const target = event.target as HTMLInputElement
  if (target.files && target.files.length > 0) {
    const file = target.files[0]

    // Check if file is PDF
    if (file && file.type !== 'application/pdf') {
      toast.add({
        title: 'Invalid file type',
        description: 'Only PDF files are allowed',
        color: 'error'
      })
      selectedFile.value = null
      target.value = ''
      return
    }

    selectedFile.value = file || null
  } else {
    selectedFile.value = null
  }
}

const handleUpload = async () => {
  if (!selectedFile.value) {
    toast.add({
      title: 'No file selected',
      description: 'Please select a file to upload',
      color: 'error'
    })
    return
  }

  // Double-check file type
  if (selectedFile.value.type !== 'application/pdf') {
    toast.add({
      title: 'Invalid file type',
      description: 'Only PDF files are allowed',
      color: 'error'
    })
    return
  }

  uploading.value = true
  try {
    const formData = new FormData()
    formData.append('file', selectedFile.value)

    await $fetch('/api/files', {
      method: 'POST',
      body: formData,
      credentials: 'include',
      headers: buildHeaders()
    })

    toast.add({
      title: 'File uploaded',
      description: `${selectedFile.value.name} has been uploaded successfully`,
      color: 'success'
    })

    selectedFile.value = null
    // Reset file input
    const fileInput = document.getElementById('file-input') as HTMLInputElement
    if (fileInput) {
      fileInput.value = ''
    }

    await refreshPolicies()
  } catch (error: any) {
    toast.add({
      title: 'Upload failed',
      description: error.data?.statusMessage || error.message || 'Failed to upload file',
      color: 'error'
    })
  } finally {
    uploading.value = false
  }
}

const handleDragOver = (event: DragEvent) => {
  event.preventDefault()
  isDragging.value = true
}

const handleDragLeave = (event: DragEvent) => {
  event.preventDefault()
  isDragging.value = false
}

const handleDrop = (event: DragEvent) => {
  event.preventDefault()
  isDragging.value = false

  const files = event.dataTransfer?.files
  if (files && files.length > 0) {
    const file = files[0]

    // Ensure file exists
    if (!file) {
      return
    }

    // Check if file is PDF
    if (file.type !== 'application/pdf') {
      toast.add({
        title: 'Invalid file type',
        description: 'Only PDF files are allowed',
        color: 'error'
      })
      return
    }

    selectedFile.value = file
  }
}

const triggerFileInput = () => {
  const fileInput = document.getElementById('file-input') as HTMLInputElement
  if (fileInput) {
    fileInput.click()
  }
}

const handleDelete = async (policyId: string, policyName: string) => {
  const instance = overlay.create(LazyModalConfirm, {
    props: {
      title: 'Delete File',
      description: `Are you sure you want to delete "${policyName}"? This action cannot be undone.`,
      confirmLabel: 'Delete',
      cancelLabel: 'Cancel'
    }
  }).open()

  const confirmed = await instance.result

  if (!confirmed) {
    return
  }

  try {
    await $fetch(`/api/files/${policyId}`, {
      method: 'DELETE',
      credentials: 'include',
      headers: buildHeaders()
    })

    toast.add({
      title: 'File deleted',
      description: `${policyName} has been deleted`,
      color: 'success'
    })

    await refreshPolicies()
  } catch (error: any) {
    toast.add({
      title: 'Delete failed',
      description: error.data?.statusMessage || error.message || 'Failed to delete file',
      color: 'error'
    })
  }
}
</script>

<template>
  <UDashboardPanel id="files">
    <template #header>
      <DashboardNavbar />
    </template>

    <template #body>
      <UContainer class="lg:py-8 py-0 px-2 lg:px-4">
        <div class="space-y-6">
          <div>
            <h1 class="text-2xl font-bold text-highlighted">Files</h1>
            <p class="text-gray-500 dark:text-gray-400 mt-1">
              Manage your company documents
            </p>
          </div>

          <!-- Files Table - Desktop -->
          <div class="hidden lg:block border border-gray-200 dark:border-gray-800 rounded-lg overflow-hidden">
            <table class="w-full">
              <thead class="bg-gray-50 dark:bg-gray-900">
                <tr>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    File Name
                  </th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Size
                  </th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Uploaded
                  </th>
                  <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody class="bg-white dark:bg-gray-950 divide-y divide-gray-200 dark:divide-gray-800">
                <tr v-if="!policies || policies.length === 0">
                  <td colspan="4" class="px-6 py-12 text-center">
                    <div class="flex flex-col items-center justify-center space-y-2">
                      <UIcon name="i-lucide-folder-open" class="w-12 h-12 text-gray-300 dark:text-gray-600" />
                      <p class="text-gray-500 dark:text-gray-400 font-medium">No files uploaded yet</p>
                      <p class="text-sm text-gray-400 dark:text-gray-500">Upload your first PDF to get started</p>
                    </div>
                  </td>
                </tr>
                <tr
                  v-for="policy in policies"
                  :key="policy.id"
                  class="hover:bg-gray-50 dark:hover:bg-gray-900"
                >
                  <td class="px-6 py-4 text-sm font-medium text-gray-900 dark:text-gray-100">
                    <div class="flex items-center space-x-2">
                      <UIcon name="i-lucide-file-text" class="w-5 h-5 text-red-500 flex-shrink-0" />
                      <span class="truncate">{{ policy.name }}</span>
                    </div>
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                    {{ formatFileSize(policy.size) }}
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                    {{ formatDate(policy.createdAt) }}
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-right text-sm">
                    <UButton
                      color="error"
                      variant="ghost"
                      size="xs"
                      icon="i-lucide-trash-2"
                      @click="handleDelete(policy.id, policy.name)"
                    >
                      Delete
                    </UButton>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- Files Cards - Mobile -->
          <div class="lg:hidden space-y-3">
            <!-- Empty State -->
            <div
              v-if="!policies || policies.length === 0"
              class="border border-gray-200 dark:border-gray-800 rounded-lg p-8"
            >
              <div class="flex flex-col items-center justify-center space-y-2">
                <UIcon name="i-lucide-folder-open" class="w-12 h-12 text-gray-300 dark:text-gray-600" />
                <p class="text-gray-500 dark:text-gray-400 font-medium">No files uploaded yet</p>
                <p class="text-sm text-gray-400 dark:text-gray-500">Upload your first PDF to get started</p>
              </div>
            </div>

            <!-- File Cards -->
            <div
              v-for="policy in policies"
              :key="policy.id"
              class="border border-gray-200 dark:border-gray-800 rounded-lg p-4 bg-white dark:bg-gray-950"
            >
              <div class="flex items-start justify-between mb-3">
                <div class="flex items-center space-x-2 flex-1 min-w-0">
                  <UIcon name="i-lucide-file-text" class="w-5 h-5 text-red-500 flex-shrink-0" />
                  <span class="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                    {{ policy.name }}
                  </span>
                </div>
              </div>
              <div class="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                <div class="space-y-1">
                  <div>{{ formatFileSize(policy.size) }}</div>
                  <div>{{ formatDate(policy.createdAt) }}</div>
                </div>
                <UButton
                  color="error"
                  variant="ghost"
                  size="xs"
                  icon="i-lucide-trash-2"
                  @click="handleDelete(policy.id, policy.name)"
                >
                  Delete
                </UButton>
              </div>
            </div>
          </div>

          <!-- File Upload Section -->
          <div class="border border-gray-200 dark:border-gray-800 rounded-lg p-6">
            <h2 class="text-lg font-semibold text-highlighted mb-4">Upload File</h2>
            <div class="space-y-4">
              <!-- Drag & Drop Zone -->
              <div
                @dragover="handleDragOver"
                @dragleave="handleDragLeave"
                @drop="handleDrop"
                @click="triggerFileInput"
                :class="[
                  'border-2 border-dashed rounded-lg p-8 text-center transition-all cursor-pointer',
                  isDragging
                    ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                    : 'border-gray-300 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-600'
                ]"
              >
                <div class="flex flex-col items-center justify-center space-y-3">
                  <UIcon
                    name="i-lucide-upload-cloud"
                    class="w-12 h-12 text-gray-400 dark:text-gray-500"
                  />
                  <div>
                    <span class="text-primary-600 dark:text-primary-400 font-medium">
                      Click to upload
                    </span>
                    <span class="text-gray-500 dark:text-gray-400"> or drag and drop</span>
                  </div>
                  <p class="text-xs text-gray-500 dark:text-gray-400">
                    PDF files only (Max 50MB)
                  </p>
                  <input
                    id="file-input"
                    type="file"
                    accept=".pdf,application/pdf"
                    class="hidden"
                    @change="handleFileSelect"
                  />
                </div>
              </div>

              <!-- Selected File Info -->
              <div
                v-if="selectedFile"
                class="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900 rounded-lg"
              >
                <div class="flex items-center space-x-3">
                  <UIcon name="i-lucide-file-text" class="w-8 h-8 text-red-500" />
                  <div>
                    <p class="text-sm font-medium text-gray-900 dark:text-gray-100">
                      {{ selectedFile.name }}
                    </p>
                    <p class="text-xs text-gray-500 dark:text-gray-400">
                      {{ formatFileSize(selectedFile.size) }}
                    </p>
                  </div>
                </div>
                <UButton
                  variant="ghost"
                  size="xs"
                  icon="i-lucide-x"
                  @click="selectedFile = null"
                />
              </div>

              <UButton
                :disabled="!selectedFile || uploading"
                :loading="uploading"
                color="primary"
                size="lg"
                block
                @click="handleUpload"
              >
                <template v-if="uploading">
                  Uploading...
                </template>
                <template v-else-if="!selectedFile">
                  Select a file first
                </template>
                <template v-else>
                  Upload File
                </template>
              </UButton>
            </div>
          </div>
        </div>
      </UContainer>
    </template>
  </UDashboardPanel>
</template>

