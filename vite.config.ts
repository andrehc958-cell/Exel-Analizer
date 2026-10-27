/// <reference types="vitest/config" />
import { defineConfig, loadEnv } from 'vite'
import type { Plugin } from 'vite'
import react from '@vitejs/plugin-react'

/** Etiqueta con la que AdSense verifica la propiedad del sitio, sin cargar su código en la página. */
function adsenseAccount(client: string | undefined): Plugin {
  return {
    name: 'adsense-account',
    transformIndexHtml: () =>
      client && /^ca-pub-\d+$/.test(client)
        ? [{ tag: 'meta', attrs: { name: 'google-adsense-account', content: client }, injectTo: 'head' }]
        : [],
  }
}

export default defineConfig(({ mode }) => ({
  plugins: [react(), adsenseAccount(loadEnv(mode, process.cwd(), 'VITE_').VITE_ADSENSE_CLIENT)],
  worker: { format: 'es' },
  test: { environment: 'node' },
}))
