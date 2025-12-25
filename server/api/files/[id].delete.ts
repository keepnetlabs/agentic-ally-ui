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

  // Delete from R2 storage
  try {
    const r2 = event?.context?.cloudflare?.env?.POLICIES_BUCKET

    if (r2) {
      // blobUrl is the pathname directly
      await r2.delete(policy.blobUrl)
    }
  } catch (error) {
    console.error('Failed to delete from R2:', error)
    // Continue with DB deletion even if R2 deletion fails
  }

  // Delete from D1
  await db.delete(tables.policies)
    .where(and(
      eq(tables.policies.id, id),
      eq(tables.policies.companyId, companyId)
    ))

  return { success: true, id }
})

