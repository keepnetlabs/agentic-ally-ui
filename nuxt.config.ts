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