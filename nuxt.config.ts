export default defineNuxtConfig({
  compatibilityDate: '2026-05-10',

  modules: [
    '@vite-pwa/nuxt'
  ],

  runtimeConfig: {
    appsScriptUrl: process.env.APPS_SCRIPT_URL,
    appsScriptSecret: process.env.APPS_SCRIPT_SECRET
  },

  pwa: {
    registerType: 'autoUpdate',

    manifest: {
      name: 'Registro de Comprobantes',
      short_name: 'Comprobantes',
      description: 'App para registrar facturas, boletas y guías desde una foto.',
      theme_color: '#2563eb',
      background_color: '#ffffff',
      display: 'standalone',
      start_url: '/',
      scope: '/',
      icons: [
        {
          src: '/icon-192.png',
          sizes: '192x192',
          type: 'image/png'
        },
        {
          src: '/icon-512.png',
          sizes: '512x512',
          type: 'image/png'
        }
      ]
    },

    workbox: {
      navigateFallback: '/'
    }
  }
})