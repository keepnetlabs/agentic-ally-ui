export default defineEventHandler((event) => {
    // Sadece cookie set et
    setCookie(event, 'app-init', '1', {
        sameSite: 'none',
        // Localhost için false, production için true
        secure: process.env.NODE_ENV === 'production',
        httpOnly: false
    })
    return 'ok'
})

