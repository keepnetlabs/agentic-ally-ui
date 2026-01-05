const ALLOWED_ORIGINS = [
  // Development
  'http://localhost:3001',
  'http://localhost:5173',
  'http://127.0.0.1:3001',
  'http://127.0.0.1:5173',
  // Production: Sites that embed this app in iframes
  'https://test-ui.devkeepnet.com',
  'https://dash.keepnetlabs.com'
]

export default defineEventHandler((event) => {
  const origin = getRequestHeader(event, 'origin')

  // Whitelist validation
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    setHeader(event, 'Access-Control-Allow-Origin', origin)
    setHeader(event, 'Access-Control-Allow-Credentials', 'true')
  } else if (!origin) {
    // Same-origin requests don't include origin header
    setHeader(event, 'Access-Control-Allow-Origin', '*')
  }
  // Else: origin not in whitelist, don't set CORS header → request blocked

  setHeader(event, 'Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
  setHeader(event, 'Access-Control-Allow-Headers', 'Content-Type, Authorization')

  // Handle preflight requests
  if (event.node.req.method === 'OPTIONS') {
    event.node.res.statusCode = 204
    event.node.res.end()
  }
})
