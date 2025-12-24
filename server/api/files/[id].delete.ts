import { extractCompanyId } from '../../utils/company-id'
import * as tables from '../../database/schema'
import { eq, and } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const companyId = extractCompanyId(event)

  if (!companyId) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Company ID not found in token or header'
    })
  }

  const { id } = getRouterParams(event)

  const db = useDrizzle()

  // Verify ownership and get policy
  const policy = await db.query.policies.findFirst({
    where: (policy, { eq, and }) => and(
      eq(policy.id, id),
      eq(policy.companyId, companyId)
    )
  })

  if (!policy) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Policy not found or access denied'
    })
  }

  // Delete from Blob storage
  try {
    const blob = hubBlob()
    // Extract pathname from blobUrl - remove /api/_hub/blob/ prefix if present
    let blobPath = policy.blobUrl
    if (blobPath.includes('/api/_hub/blob/')) {
      blobPath = blobPath.split('/api/_hub/blob/')[1]
      blobPath = decodeURIComponent(blobPath)
    } else if (blobPath.startsWith('http')) {
      // Extract pathname from full URL
      const url = new URL(blobPath)
      blobPath = url.pathname.replace('/api/_hub/blob/', '')
    }
    await blob.del(blobPath)
  } catch (error) {
    console.error('Failed to delete blob:', error)
    // Continue with DB deletion even if blob deletion fails
  }

  // Delete from D1
  await db.delete(tables.policies)
    .where(and(
      eq(tables.policies.id, id),
      eq(tables.policies.companyId, companyId)
    ))

  return { success: true, id }
})

