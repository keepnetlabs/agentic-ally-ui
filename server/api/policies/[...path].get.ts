import { extractCompanyId } from '../../utils/company-id'

export default defineEventHandler(async (event) => {
  const { path } = getRouterParams(event)
  const companyId = extractCompanyId(event)

  if (!companyId) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Company ID not found in token or header'
    })
  }

  let pathStr: string
  if (Array.isArray(path)) {
    pathStr = path.join('/')
  } else {
    pathStr = path
  }

  const decodedPath = decodeURIComponent(pathStr)

  if (!decodedPath.startsWith('policies/')) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Invalid path format'
    })
  }

  const filename = decodedPath.replace(/^policies\//, '')
  const fullBlobUrl = `policies/${companyId}/${filename}`

  const db = useDrizzle()
  const policy = await db.query.policies.findFirst({
    where: (policy, { eq, and }) => and(
      eq(policy.blobUrl, fullBlobUrl),
      eq(policy.companyId, companyId)
    )
  })

  if (!policy) {
    throw createError({
      statusCode: 404,
      statusMessage: 'File not found or access denied'
    })
  }

  const r2 = event?.context?.cloudflare?.env?.agentic_ally_policies

  if (!r2) {
    throw createError({
      statusCode: 500,
      statusMessage: 'R2 bucket binding not found'
    })
  }

  // Just return policy info, no PDF reading
  const pdfText = 'PDF text extraction not implemented yet'

  const headers: Record<string, string> = {
    'Content-Type': 'application/json; charset=utf-8'
  }

  const origin = getRequestHeader(event, 'origin')
  if (origin) {
    headers['Access-Control-Allow-Origin'] = origin
  } else {
    headers['Access-Control-Allow-Origin'] = '*'
  }
  headers['Access-Control-Allow-Methods'] = 'GET, OPTIONS'
  headers['Access-Control-Allow-Headers'] = 'Content-Type, x-company-id, x-agentic-ally-token'
  headers['Access-Control-Allow-Credentials'] = 'true'

  return new Response(JSON.stringify({
    text: pdfText,
    policyId: policy.id,
    policyName: policy.name,
    blobUrl: policy.blobUrl
  }), { headers })
})

