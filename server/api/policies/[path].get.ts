import { extractCompanyId } from '../../utils/company-id'
import * as tables from '../../database/schema'
import { eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const { path } = getRouterParams(event)
  
  // Extract company ID for ownership verification
  const companyId = extractCompanyId(event)

  if (!companyId) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Company ID not found in token or header'
    })
  }

  // Decode path if needed
  const decodedPath = decodeURIComponent(path)

  // Verify ownership: path must start with policies/{companyId}/
  const expectedPrefix = `policies/${companyId}/`
  if (!decodedPath.startsWith(expectedPrefix)) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Access denied'
    })
  }

  // Additional verification: check if policy exists in DB with this companyId
  const db = useDrizzle()
  const policy = await db.query.policies.findFirst({
    where: (policy, { eq, and }) => and(
      eq(policy.blobUrl, decodedPath),
      eq(policy.companyId, companyId)
    )
  })

  if (!policy) {
    throw createError({
      statusCode: 404,
      statusMessage: 'File not found or access denied'
    })
  }

  const r2 = event?.context?.cloudflare?.env?.POLICIES_BUCKET

  if (!r2) {
    throw createError({
      statusCode: 500,
      statusMessage: 'R2 bucket binding not found'
    })
  }

  // Get object from R2
  const object = await r2.get(decodedPath)

  if (!object) {
    throw createError({
      statusCode: 404,
      statusMessage: 'File not found'
    })
  }

  // Set appropriate headers
  const headers: Record<string, string> = {}
  if (object.httpMetadata?.contentType) {
    headers['Content-Type'] = object.httpMetadata.contentType
  }
  if (object.httpMetadata?.contentDisposition) {
    headers['Content-Disposition'] = object.httpMetadata.contentDisposition
  }

  // Return the file
  return new Response(object.body, { headers })
})

