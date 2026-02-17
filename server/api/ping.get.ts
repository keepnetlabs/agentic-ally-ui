export default defineEventHandler((event) => {
    // Set only a lightweight init cookie
    setCookie(event, 'app-init', '1', {
        sameSite: 'none',
        // false on localhost, true in production
        secure: process.env.NODE_ENV === 'production',
        httpOnly: false
    })
    return 'ok'
})

