import { extractCompanyId } from '../utils/company-id'
import * as tables from '../database/schema'
import { eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const companyId = extractCompanyId(event)

  if (!companyId) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Company ID not found in token or header'
    })
  }

  const db = useDrizzle()

  const policies = await db.query.policies.findMany({
    where: (policy, { eq }) => eq(policy.companyId, companyId),
    orderBy: (policy, { desc }) => desc(policy.createdAt)
  })

  return policies
})

