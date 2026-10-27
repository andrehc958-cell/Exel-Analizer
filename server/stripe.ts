import { createHmac } from 'node:crypto'
import Stripe from 'stripe'
import type { BillingDeps } from './billing.js'
import { json } from './billing.js'

/**
 * Lee la configuración desde variables de entorno del hosting. Las claves de Stripe
 * nunca se guardan en el repositorio (ver .env.example).
 */
export function billingDeps(env: NodeJS.ProcessEnv = process.env): BillingDeps | null {
  const secretKey = env.STRIPE_SECRET_KEY || prefixed(env, 'STRIPE_SECRET_KEY')
  const { STRIPE_PRICE_PRO, STRIPE_PRICE_PRO_ANNUAL, STRIPE_PRICE_PASS } = env
  const appUrl = env.APP_URL || (env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${env.VERCEL_PROJECT_PRODUCTION_URL}` : '')
  if (!secretKey || !appUrl) return null
  return {
    stripe: new Stripe(secretKey),
    env: {
      appUrl: appUrl.replace(/\/$/, ''),
      pricePro: STRIPE_PRICE_PRO || undefined,
      priceProAnnual: STRIPE_PRICE_PRO_ANNUAL || undefined,
      pricePass: STRIPE_PRICE_PASS || undefined,
      // Sin LICENSE_SECRET propio se deriva uno estable de la clave de Stripe (cambiarla invalida las licencias guardadas).
      licenseSecret: env.LICENSE_SECRET || createHmac('sha256', secretKey).update('dataclean-license-v1').digest('hex'),
      webhookSecret: env.STRIPE_WEBHOOK_SECRET || prefixed(env, 'STRIPE_WEBHOOK_SECRET'),
    },
  }
}

/** Integraciones como la de Stripe en Vercel crean las variables con un prefijo (p. ej. `MITIENDA_STRIPE_SECRET_KEY`). */
function prefixed(env: NodeJS.ProcessEnv, name: string): string | undefined {
  const key = Object.keys(env).find((k) => k.endsWith(`_${name}`) && env[k])
  return key ? env[key] : undefined
}

type Handler = (deps: BillingDeps, request: Request) => Promise<Response>

/** Envuelve un manejador: configuración ausente y errores de Stripe se responden sin filtrar detalles. */
export function withBilling(handler: Handler) {
  return async (request: Request): Promise<Response> => {
    const deps = billingDeps()
    if (!deps) return json({ error: 'Los pagos no están configurados.' }, 503)
    try {
      return await handler(deps, request)
    } catch (err) {
      console.error('[billing]', err instanceof Error ? err.message : err)
      return json({ error: 'No se pudo completar la operación con Stripe. Inténtalo más tarde.' }, 502)
    }
  }
}
