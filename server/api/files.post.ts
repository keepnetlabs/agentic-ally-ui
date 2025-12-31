import { extractCompanyId } from '../utils/company-id'
import * as tables from '../database/schema'
import { randomUUID } from 'node:crypto'

export default defineEventHandler(async (event) => {
  const companyId = extractCompanyId(event)

  if (!companyId) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Company ID not found in token or header'
    })
  }

  // Read multipart form data
  const formData = await readFormData(event)
  const file = formData.get('file') as File | null

  if (!file) {
    throw createError({
      statusCode: 400,
      statusMessage: 'No file provided'
    })
  }

  // Validate file type - only PDF allowed
  if (file.type !== 'application/pdf') {
    throw createError({
      statusCode: 400,
      statusMessage: 'Only PDF files are allowed'
    })
  }

  // Validate file size - max 50MB
  const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50MB in bytes
  if (file.size > MAX_FILE_SIZE) {
    throw createError({
      statusCode: 400,
      statusMessage: 'File size exceeds 50MB limit'
    })
  }

  // Generate unique path for blob storage
  const fileId = randomUUID()
  const fileExtension = file.name.split('.').pop() || ''
  const blobPath = `policies/${companyId}/${fileId}.${fileExtension}`

  // Upload to R2 storage (using direct R2 binding to avoid hub blob conflict)
  const r2 = event?.context?.cloudflare?.env?.agentic_ally_policies

  console.log('Available bindings:', Object.keys(event?.context?.cloudflare?.env || {}))
  console.log('R2 binding found:', !!r2)

  if (!r2) {
    throw createError({
      statusCode: 500,
      statusMessage: 'R2 bucket binding not found'
    })
  }

  // Upload file to R2
  await r2.put(blobPath, file, {
    httpMetadata: {
      contentType: file.type || 'application/octet-stream'
    }
  })

  // Store pathname for serving
  const blobUrl = blobPath

  // Save metadata to D1
  const db = useDrizzle()
  const policy = await db.insert(tables.policies).values({
    companyId,
    name: file.name,
    size: file.size,
    blobUrl
    // createdAt is auto-set by schema default
  }).returning().get()

  return policy
})

