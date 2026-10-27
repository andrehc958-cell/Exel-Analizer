import Stripe from 'stripe'
import type { BillingDeps } from './billing'
import { json } from './billing'

/**
 * Lee la configuración desde variables de entorno del hosting. Las claves de Stripe
 * nunca se guardan en el repositorio (ver .env.example).
 */
export function billingDeps(): BillingDeps | null {
  const { STRIPE_SECRET_KEY, STRIPE_PRICE_PRO, STRIPE_PRICE_PRO_ANNUAL, STRIPE_PRICE_PASS, LICENSE_SECRET, APP_URL, STRIPE_WEBHOOK_SECRET } =
    process.env
  if (!STRIPE_SECRET_KEY || !STRIPE_PRICE_PRO || !LICENSE_SECRET || !APP_URL) return null
  return {
    stripe: new Stripe(STRIPE_SECRET_KEY),
    env: {
      appUrl: APP_URL.replace(/\/$/, ''),
      pricePro: STRIPE_PRICE_PRO,
      priceProAnnual: STRIPE_PRICE_PRO_ANNUAL || undefined,
      pricePass: STRIPE_PRICE_PASS || undefined,
      licenseSecret: LICENSE_SECRET,
      webhookSecret: STRIPE_WEBHOOK_SECRET,
    },
  }
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
