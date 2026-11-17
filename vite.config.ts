/// <reference types="vitest/config" />
import { defineConfig, loadEnv } from 'vite'
import type { Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { readFileSync } from 'node:fs'

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

/**
 * Aplica las cabeceras de vercel.json en `npm run preview`, para probar la CSP antes de publicar.
 * Las rutas de vercel.json de este proyecto son expresiones regulares simples; se evalúan igual aquí.
 */
function productionHeaders(): Plugin {
  const vercel = JSON.parse(readFileSync(new URL('./vercel.json', import.meta.url), 'utf8')) as {
    headers: { source: string; headers: { key: string; value: string }[] }[]
  }
  const rules = vercel.headers.map((r) => ({ re: new RegExp(`^${r.source}$`), headers: r.headers }))
  return {
    name: 'production-headers',
    configurePreviewServer(server) {
      server.middlewares.use((req, res, next) => {
        const path = (req.url ?? '/').split('?')[0]
        for (const r of rules) if (r.re.test(path)) for (const h of r.headers) res.setHeader(h.key, h.value)
        next()
      })
    },
  }
}

export default defineConfig(({ mode }) => ({
  plugins: [react(), productionHeaders(), adsenseAccount(loadEnv(mode, process.cwd(), 'VITE_').VITE_ADSENSE_CLIENT)],
  worker: { format: 'es' },
  test: { environment: 'node' },
}))
