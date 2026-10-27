import type Stripe from 'stripe'
import { LICENSE_TTL_SECONDS, signLicense, verifyLicense } from './license.js'

export interface BillingEnv {
  appUrl: string
  /** Precio recurrente mensual. Sin él se cobra DEFAULT_PRO_PRICE, definido aquí. */
  pricePro?: string
  /** Precio recurrente anual (opcional). */
  priceProAnnual?: string
  /** Precio de pago único del pase de 24 horas (opcional). */
  pricePass?: string
  licenseSecret: string
  webhookSecret?: string
}

export interface BillingDeps {
  stripe: Stripe
  env: BillingEnv
  now?: () => number
}

const ACTIVE = new Set(['active', 'trialing'])

/** Duración del pase de pago único, contada desde la compra. */
export const PASS_SECONDS = 24 * 60 * 60

/** Marca en los metadatos de Checkout: sólo estas sesiones de pago único activan un pase (no las donaciones). */
const PASS_METADATA = { product: 'pass' }

/** Precio mensual por defecto ($199 MXN), coincide con la etiqueta por defecto de la página de precios. */
export const DEFAULT_PRO_PRICE: Stripe.Checkout.SessionCreateParams.LineItem.PriceData = {
  currency: 'mxn',
  unit_amount: 19900,
  recurring: { interval: 'month' },
  product_data: { name: 'DataClean Pro' },
}

export type CheckoutProduct = 'monthly' | 'annual' | 'pass'

/** Crea una sesión de Stripe Checkout: suscripción Pro mensual o anual, o pase de 24 horas. */
export async function createCheckout({ stripe, env }: BillingDeps, request: Request): Promise<Response> {
  const body = await readJson(request)
  if (body?.acceptedTerms !== true) {
    return json({ error: 'Debes aceptar los Términos y el Aviso de privacidad.' }, 400)
  }
  const product = (body.product ?? 'monthly') as CheckoutProduct
  const acceptedAt = { accepted_terms_at: new Date().toISOString() }
  const common = {
    success_url: `${env.appUrl}/?checkout=success&session_id={CHECKOUT_SESSION_ID}#/precios`,
    cancel_url: `${env.appUrl}/?checkout=cancel#/precios`,
    locale: 'es' as const,
    allow_promotion_codes: true,
    billing_address_collection: 'auto' as const,
  }

  let session: Stripe.Checkout.Session
  if (product === 'pass') {
    if (!env.pricePass) return json({ error: 'El pase de 24 horas no está disponible.' }, 400)
    session = await stripe.checkout.sessions.create({
      ...common,
      mode: 'payment',
      line_items: [{ price: env.pricePass, quantity: 1 }],
      metadata: { ...PASS_METADATA, ...acceptedAt },
    })
  } else if (product === 'monthly' || product === 'annual') {
    let item: Stripe.Checkout.SessionCreateParams.LineItem
    if (product === 'annual') {
      if (!env.priceProAnnual) return json({ error: 'El plan anual no está disponible.' }, 400)
      item = { price: env.priceProAnnual, quantity: 1 }
    } else {
      item = env.pricePro ? { price: env.pricePro, quantity: 1 } : { price_data: DEFAULT_PRO_PRICE, quantity: 1 }
    }
    session = await stripe.checkout.sessions.create({
      ...common,
      mode: 'subscription',
      line_items: [item],
      // Se registra la aceptación de los términos en los metadatos de la suscripción.
      subscription_data: { metadata: acceptedAt },
    })
  } else {
    return json({ error: 'Producto no válido.' }, 400)
  }
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
  const nowSec = Math.floor((deps.now?.() ?? Date.now()) / 1000)
  let customer: string | null = null

  if (typeof body?.sessionId === 'string' && body.sessionId.startsWith('cs_')) {
    const session = await stripe.checkout.sessions.retrieve(body.sessionId)
    if (session.mode === 'payment') return issuePass(session, env, nowSec)
    if (session.status !== 'complete' || typeof session.customer !== 'string') {
      return json({ error: 'El pago no se ha completado.' }, 402)
    }
    customer = session.customer
  } else if (typeof body?.token === 'string') {
    // Se acepta un comprobante caducado hace poco para poder renovarlo, pero la firma debe ser válida.
    const payload = verifyLicense(body.token, env.licenseSecret, nowSec - LICENSE_TTL_SECONDS)
    if (!payload) return json({ error: 'Comprobante de licencia no válido.' }, 401)
    if (payload.kind === 'pass') return json({ error: 'El pase de 24 horas terminó.', plan: 'free' }, 402)
    customer = payload.customer
  } else {
    return json({ error: 'Solicitud no válida.' }, 400)
  }

  const subs = await stripe.subscriptions.list({ customer, status: 'all', limit: 10 })
  const sub = subs.data.find((s) => ACTIVE.has(s.status))
  if (!sub) return json({ error: 'No hay una suscripción activa.', plan: 'free' }, 402)

  const periodEnd = sub.items.data[0]?.current_period_end ?? nowSec
  const exp = Math.min(nowSec + LICENSE_TTL_SECONDS, Math.max(periodEnd, nowSec) + 24 * 60 * 60)
  const token = signLicense({ customer, plan: 'pro', kind: 'sub', exp }, env.licenseSecret)
  return json({ token, plan: 'pro', kind: 'sub', expiresAt: exp, cancelAtPeriodEnd: sub.cancel_at_period_end })
}

/**
 * Pase de pago único: vale 24 horas desde la compra y no se renueva. Volver a pedirlo con la misma
 * sesión no lo alarga. Sólo cuentan las sesiones creadas por /api/checkout (otras ventas, como las
 * donaciones, no dan acceso).
 */
function issuePass(session: Stripe.Checkout.Session, env: BillingEnv, nowSec: number): Response {
  if (session.status !== 'complete' || session.payment_status !== 'paid') {
    return json({ error: 'El pago no se ha completado.' }, 402)
  }
  if (session.metadata?.product !== PASS_METADATA.product) return json({ error: 'Este pago no corresponde a un pase.' }, 402)
  const exp = session.created + PASS_SECONDS
  if (exp <= nowSec) return json({ error: 'El pase de 24 horas terminó.', plan: 'free' }, 402)
  const token = signLicense({ customer: session.id, plan: 'pro', kind: 'pass', exp }, env.licenseSecret)
  return json({ token, plan: 'pro', kind: 'pass', expiresAt: exp })
}

/** Abre el portal de cliente de Stripe (cambiar tarjeta, facturas, cancelar). */
export async function createPortal({ stripe, env, now }: BillingDeps, request: Request): Promise<Response> {
  const body = await readJson(request)
  const nowSec = (now?.() ?? Date.now()) / 1000
  const payload = typeof body?.token === 'string' ? verifyLicense(body.token, env.licenseSecret, nowSec - LICENSE_TTL_SECONDS) : null
  if (!payload) return json({ error: 'Comprobante de licencia no válido.' }, 401)
  if (payload.kind === 'pass') return json({ error: 'El pase de 24 horas no tiene una suscripción que administrar.' }, 400)
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
