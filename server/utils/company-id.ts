import { getHeader } from 'h3'

/**
 * Extract company ID from request headers
 * Priority: x-company-id header > JWT token decode (user_company_id)
 */
export const extractCompanyId = (event: any): string | null => {
    // Try header first
    const headerCompanyId = getHeader(event, 'x-company-id')
    if (headerCompanyId) {
        // Clean: remove trailing slashes and whitespace
        return headerCompanyId.trim().replace(/\/+$/, '')
    }

    // Fallback to JWT token decode
    const accessToken = getHeader(event, 'x-agentic-ally-token')
    if (accessToken) {
        try {
            // JWT format: header.payload.signature
            const parts = accessToken.split('.')
            if (parts.length === 3) {
                // Decode payload (base64url)
                const payload = JSON.parse(
                    Buffer.from(parts[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString()
                )
                // Extract user_company_id from token
                if (payload.user_company_id) {
                    // Clean: remove trailing slashes and whitespace
                    return String(payload.user_company_id).trim().replace(/\/+$/, '')
                }
            }
        } catch (error) {
            // Silent fail - return null
        }
    }

    return null
}

