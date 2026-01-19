import { extractCompanyId } from '../../utils/company-id'

type PolicyCacheEntry = {
  text: string
  policyId: string
  policyName: string
  blobUrl: string
  expiresAt: number
}

const POLICY_TEXT_CACHE_TTL_MS = 2 * 60 * 1000
const MAX_POLICY_TEXT_CACHE_SIZE = 200
const policyTextCache = new Map<string, PolicyCacheEntry>()

const getCachedPolicyText = (cacheKey: string) => {
  const cached = policyTextCache.get(cacheKey)
  if (!cached) {
    return null
  }
  if (cached.expiresAt < Date.now()) {
    policyTextCache.delete(cacheKey)
    return null
  }
  return cached
}

const setCachedPolicyText = (cacheKey: string, entry: PolicyCacheEntry) => {
  if (policyTextCache.size >= MAX_POLICY_TEXT_CACHE_SIZE) {
    const oldestKey = policyTextCache.keys().next().value as string | undefined
    if (oldestKey) {
      policyTextCache.delete(oldestKey)
    }
  }
  policyTextCache.set(cacheKey, entry)
}

/**
 * Extract text from PDF using pdfjs-serverless
 * Works in Cloudflare Workers edge environment
 */
async function extractTextFromPDF(buffer: ArrayBuffer): Promise<string> {
  try {
    const { getDocument } = await import('pdfjs-serverless')
    const uint8Array = new Uint8Array(buffer)

    const document = await getDocument({
      data: uint8Array,
      useSystemFonts: true,
    }).promise

    const pages: string[] = []

    // Iterate through each page and extract text
    for (let i = 1; i <= document.numPages; i++) {
      const page = await document.getPage(i)
      const textContent = await page.getTextContent()
      const pageText = textContent.items.map((item: any) => item.str).join(' ')
      pages.push(pageText)
    }

    const fullText = pages.join('\n')

    if (!fullText || fullText.trim().length === 0) {
      return 'Unable to extract text from PDF. The PDF may be image-based or encrypted.'
    }

    return fullText.trim()
  } catch (error) {
    return `Error extracting text: ${error instanceof Error ? error.message : 'Unknown error'}`
  }
}

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

  // Common headers
  const headers: Record<string, string> = {
    'Content-Type': 'application/json; charset=utf-8'
  }

  // Handling missing policy gracefully (Soft 404)
  const returnNotFound = (msg: string) => {
    return new Response(JSON.stringify({
      text: msg,
      policyId: null,
      policyName: null,
      blobUrl: null
    }), { headers })
  }

  const db = useDrizzle()
  const policy = await db.query.policies.findFirst({
    where: (policy, { eq, and }) => and(
      eq(policy.blobUrl, fullBlobUrl),
      eq(policy.companyId, companyId)
    )
  })

  if (!policy) {
    return returnNotFound('Policy information not found.')
  }

  const cacheKey = `${companyId}:${policy.blobUrl}`
  const cached = getCachedPolicyText(cacheKey)

  if (cached) {
    return new Response(JSON.stringify({
      text: cached.text,
      policyId: cached.policyId,
      policyName: cached.policyName,
      blobUrl: cached.blobUrl
    }), { headers })
  }

  const r2 = event?.context?.cloudflare?.env?.agentic_ally_policies

  if (!r2) {
    throw createError({
      statusCode: 500,
      statusMessage: 'R2 bucket binding not found'
    })
  }

  // Read PDF from R2 and extract text
  // Safely handle R2 get errors
  let object
  try {
    object = await r2.get(policy.blobUrl)
  } catch (e) {
    console.error('R2 Get Error:', e)
  }

  if (!object) {
    return returnNotFound('Policy file content not found.')
  }

  let pdfText = 'PDF text extraction not implemented yet'
  try {
    // Check if object has arrayBuffer method
    if (object && typeof (object as any).arrayBuffer === 'function') {
      const pdfBuffer = await (object as any).arrayBuffer()

      if (pdfBuffer && pdfBuffer.byteLength > 0) {
        pdfText = await extractTextFromPDF(pdfBuffer)
      } else {
        pdfText = 'PDF file is empty'
      }
    } else {
      pdfText = 'R2 object does not support arrayBuffer()'
    }
  } catch (error) {
    pdfText = `Error reading PDF: ${error instanceof Error ? error.message : 'Unknown error'}`
  }

  setCachedPolicyText(cacheKey, {
    text: pdfText,
    policyId: policy.id,
    policyName: policy.name,
    blobUrl: policy.blobUrl,
    expiresAt: Date.now() + POLICY_TEXT_CACHE_TTL_MS
  })

  return new Response(JSON.stringify({
    text: pdfText,
    policyId: policy.id,
    policyName: policy.name,
    blobUrl: policy.blobUrl
  }), { headers })
})

