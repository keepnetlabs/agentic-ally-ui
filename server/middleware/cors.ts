export default defineEventHandler((event) => {
  // Allow cross-origin requests from any origin (for iframe support)
  const origin = getRequestHeader(event, 'origin')

  // Reflect the origin back to allow credentials from any site
  if (origin) {
    setHeader(event, 'Access-Control-Allow-Origin', origin)
  } else {
    setHeader(event, 'Access-Control-Allow-Origin', '*')
  }

  setHeader(event, 'Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
  setHeader(event, 'Access-Control-Allow-Headers', 'Content-Type, Authorization')
  setHeader(event, 'Access-Control-Allow-Credentials', 'true')

  // Handle preflight requests
  if (event.node.req.method === 'OPTIONS') {
    event.node.res.statusCode = 204
    event.node.res.end()
  }
})
