import type Stripe from 'stripe'
import { LICENSE_TTL_SECONDS, signLicense, verifyLicense } from './license.js'

export interface BillingEnv {
  appUrl: string
  pricePro: string
  licenseSecret: string
  webhookSecret?: string
}

export interface BillingDeps {
  stripe: Stripe
  env: BillingEnv
  now?: () => number
}

const ACTIVE = new Set(['active', 'trialing'])

/** Crea una sesión de Stripe Checkout para la suscripción Pro. */
export async function createCheckout({ stripe, env }: BillingDeps, request: Request): Promise<Response> {
  const body = await readJson(request)
  if (body?.acceptedTerms !== true) {
    return json({ error: 'Debes aceptar los Términos y el Aviso de privacidad.' }, 400)
  }
  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    line_items: [{ price: env.pricePro, quantity: 1 }],
    success_url: `${env.appUrl}/?checkout=success&session_id={CHECKOUT_SESSION_ID}#/precios`,
    cancel_url: `${env.appUrl}/?checkout=cancel#/precios`,
    locale: 'es',
    allow_promotion_codes: true,
    billing_address_collection: 'auto',
    // Se registra la aceptación de los términos en los metadatos de la suscripción.
    subscription_data: { metadata: { accepted_terms_at: new Date().toISOString() } },
  })
  if (!session.url) return json({ error: 'Stripe no devolvió la página de pago.' }, 502)
  return json({ url: session.url })
}

/**
 * Emite un comprobante de licencia, ya sea tras volver de Checkout (sessionId)
 * o para renovar uno existente (token). Siempre se consulta el estado real en Stripe.
 */
export async function issueLicense(deps: BillingDeps, request: Request): Promise<Response> {
  const { stripe, env } = deps
  const body = await readJson(request)
  let customer: string | null = null

  if (typeof body?.sessionId === 'string' && body.sessionId.startsWith('cs_')) {
    const session = await stripe.checkout.sessions.retrieve(body.sessionId)
    if (session.status !== 'complete' || typeof session.customer !== 'string') {
      return json({ error: 'El pago no se ha completado.' }, 402)
    }
    customer = session.customer
  } else if (typeof body?.token === 'string') {
    // Se acepta un comprobante caducado hace poco para poder renovarlo, pero la firma debe ser válida.
    const nowSec = (deps.now?.() ?? Date.now()) / 1000
    const payload = verifyLicense(body.token, env.licenseSecret, nowSec - LICENSE_TTL_SECONDS)
    if (!payload) return json({ error: 'Comprobante de licencia no válido.' }, 401)
    customer = payload.customer
  } else {
    return json({ error: 'Solicitud no válida.' }, 400)
  }

  const subs = await stripe.subscriptions.list({ customer, status: 'all', limit: 10 })
  const sub = subs.data.find((s) => ACTIVE.has(s.status))
  if (!sub) return json({ error: 'No hay una suscripción activa.', plan: 'free' }, 402)

  const nowSec = Math.floor((deps.now?.() ?? Date.now()) / 1000)
  const periodEnd = sub.items.data[0]?.current_period_end ?? nowSec
  const exp = Math.min(nowSec + LICENSE_TTL_SECONDS, Math.max(periodEnd, nowSec) + 24 * 60 * 60)
  const token = signLicense({ customer, plan: 'pro', exp }, env.licenseSecret)
  return json({ token, plan: 'pro', expiresAt: exp, cancelAtPeriodEnd: sub.cancel_at_period_end })
}

/** Abre el portal de cliente de Stripe (cambiar tarjeta, facturas, cancelar). */
export async function createPortal({ stripe, env, now }: BillingDeps, request: Request): Promise<Response> {
  const body = await readJson(request)
  const nowSec = (now?.() ?? Date.now()) / 1000
  const payload = typeof body?.token === 'string' ? verifyLicense(body.token, env.licenseSecret, nowSec - LICENSE_TTL_SECONDS) : null
  if (!payload) return json({ error: 'Comprobante de licencia no válido.' }, 401)
  const portal = await stripe.billingPortal.sessions.create({
    customer: payload.customer,
    return_url: `${env.appUrl}/#/precios`,
  })
  return json({ url: portal.url })
}

/**
 * Webhook de Stripe. Verifica la firma; como Stripe es la fuente de verdad no se guarda nada,
 * sólo se registra el tipo de evento (sin datos personales) para diagnóstico.
 */
export async function handleWebhook({ stripe, env }: BillingDeps, request: Request): Promise<Response> {
  const signature = request.headers.get('stripe-signature')
  if (!env.webhookSecret || !signature) return json({ error: 'Firma ausente.' }, 400)
  const payload = await request.text()
  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(payload, signature, env.webhookSecret)
  } catch {
    return json({ error: 'Firma no válida.' }, 400)
  }
  console.info(`[stripe] ${event.type} ${event.id}`)
  return json({ received: true })
}

export function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  })
}

async function readJson(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const data = await request.json()
    return data && typeof data === 'object' ? (data as Record<string, unknown>) : null
  } catch {
    return null
  }
}
