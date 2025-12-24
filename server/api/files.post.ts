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

  // Generate unique path for blob storage
  const fileId = randomUUID()
  const fileExtension = file.name.split('.').pop() || ''
  const blobPath = `policies/${companyId}/${fileId}.${fileExtension}`

  // Upload to Blob storage
  const blob = hubBlob()
  const blobObject = await blob.put(blobPath, file, {
    contentType: file.type || 'application/octet-stream',
    addRandomSuffix: false
  })

  // Get the blob URL - use pathname for serving via /api/_hub/blob endpoint
  // The URL will be accessible at: /api/_hub/blob/{pathname}
  const blobUrl = blobObject.pathname || blobPath

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

