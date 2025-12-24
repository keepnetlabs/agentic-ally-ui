// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  ssr: false,

  modules: [
    "nitro-cloudflare-dev",
    "@nuxt/eslint",
    "@nuxt/ui-pro",
    "@nuxtjs/mdc",
    "@nuxthub/core",
    "nuxt-auth-utils"
  ],

  hub: {
    blob: true
  },

  runtimeConfig: {
    session: {
      name: 'nuxt-session',
      password: process.env.NUXT_SESSION_PASSWORD || 'change-this-to-a-secure-password-with-at-least-32-characters-minimum',
      cookie: {
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
        // Localhost için false, production için true
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true
      }
    }
  },

  devtools: {
    enabled: true
  },
  devServer: {
    port: 3001
  },
  css: ['~/assets/css/main.css'],

  mdc: {
    highlight: {
      // noApiRoute: true
      shikiEngine: 'javascript'
    }
  },

  experimental: {
    viewTransition: true
  },

  compatibilityDate: '2025-07-15',

  nitro: {
    preset: "cloudflare-pages",

    cloudflare: {
      deployConfig: true,
      nodeCompat: true
    },

    experimental: {
      openAPI: true
    }
  },

  eslint: {
    config: {
      stylistic: {
        commaDangle: 'never',
        braceStyle: '1tbs'
      }
    }
  }
})