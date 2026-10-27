import Stripe from 'stripe'
import { describe, expect, it, vi } from 'vitest'
import { createCheckout, createPortal, handleWebhook, issueLicense } from '../billing'
import type { BillingDeps } from '../billing'
import { signLicense, verifyLicense } from '../license'

const SECRET = 'test-secret'
const NOW = 1_800_000_000_000
const env = {
  appUrl: 'https://dataclean.test',
  pricePro: 'price_123',
  priceProAnnual: 'price_year',
  pricePass: 'price_pass',
  licenseSecret: SECRET,
  webhookSecret: 'whsec_test',
}

function deps(overrides: Record<string, unknown> = {}): BillingDeps {
  const stripe = {
    checkout: {
      sessions: {
        create: vi.fn(async () => ({ url: 'https://checkout.stripe.test/s' })),
        retrieve: vi.fn(async () => ({ status: 'complete', customer: 'cus_1' })),
      },
    },
    subscriptions: {
      list: vi.fn(async () => ({
        data: [{ status: 'active', cancel_at_period_end: false, items: { data: [{ current_period_end: NOW / 1000 + 86400 }] } }],
      })),
    },
    billingPortal: { sessions: { create: vi.fn(async () => ({ url: 'https://billing.stripe.test/p' })) } },
    webhooks: new Stripe('sk_test_x').webhooks,
    ...overrides,
  }
  return { stripe: stripe as unknown as Stripe, env, now: () => NOW }
}

const post = (body: unknown) => new Request('https://x/api', { method: 'POST', body: JSON.stringify(body) })

describe('license', () => {
  it('firma, verifica y rechaza manipulaciones o caducidad', () => {
    const t = signLicense({ customer: 'cus_1', plan: 'pro', exp: 2000 }, SECRET)
    expect(verifyLicense(t, SECRET, 1000)?.customer).toBe('cus_1')
    expect(verifyLicense(t, SECRET, 3000)).toBeNull()
    expect(verifyLicense(t, 'otro', 1000)).toBeNull()
    const forged = Buffer.from(JSON.stringify({ customer: 'cus_2', plan: 'pro', exp: 2000 })).toString('base64url')
    expect(verifyLicense(`${forged}.${t.split('.')[1]}`, SECRET, 1000)).toBeNull()
  })
})

describe('billing', () => {
  it('checkout exige aceptar los términos', async () => {
    const d = deps()
    expect((await createCheckout(d, post({}))).status).toBe(400)
    const res = await createCheckout(d, post({ acceptedTerms: true }))
    expect(await res.json()).toEqual({ url: 'https://checkout.stripe.test/s' })
    expect(d.stripe.checkout.sessions.create).toHaveBeenCalledWith(
      expect.objectContaining({ mode: 'subscription', line_items: [{ price: 'price_123', quantity: 1 }] }),
    )
  })

  it('checkout anual y pase de 24 horas', async () => {
    const d = deps()
    const create = d.stripe.checkout.sessions.create as unknown as ReturnType<typeof vi.fn>
    await createCheckout(d, post({ acceptedTerms: true, product: 'annual' }))
    expect(create).toHaveBeenLastCalledWith(
      expect.objectContaining({ mode: 'subscription', line_items: [{ price: 'price_year', quantity: 1 }] }),
    )
    await createCheckout(d, post({ acceptedTerms: true, product: 'pass' }))
    expect(create).toHaveBeenLastCalledWith(
      expect.objectContaining({
        mode: 'payment',
        line_items: [{ price: 'price_pass', quantity: 1 }],
        metadata: expect.objectContaining({ product: 'pass' }),
      }),
    )
    expect((await createCheckout(d, post({ acceptedTerms: true, product: 'otro' }))).status).toBe(400)
    const sinExtras = { ...d, env: { ...env, priceProAnnual: undefined, pricePass: undefined } }
    expect((await createCheckout(sinExtras, post({ acceptedTerms: true, product: 'annual' }))).status).toBe(400)
    expect((await createCheckout(sinExtras, post({ acceptedTerms: true, product: 'pass' }))).status).toBe(400)
  })

  it('el pase dura 24 horas desde la compra, no se renueva y no abre el portal', async () => {
    const d = deps()
    const retrieve = d.stripe.checkout.sessions.retrieve as unknown as ReturnType<typeof vi.fn>
    const created = NOW / 1000 - 3600
    retrieve.mockResolvedValue({ id: 'cs_pass', mode: 'payment', status: 'complete', payment_status: 'paid', created, metadata: { product: 'pass' } })
    const res = await issueLicense(d, post({ sessionId: 'cs_pass' }))
    expect(res.status).toBe(200)
    const { token, expiresAt, kind } = (await res.json()) as { token: string; expiresAt: number; kind: string }
    expect(kind).toBe('pass')
    expect(expiresAt).toBe(created + 24 * 3600)
    expect((await issueLicense(d, post({ token }))).status).toBe(402)
    expect((await createPortal(d, post({ token }))).status).toBe(400)

    retrieve.mockResolvedValue({ id: 'cs_old', mode: 'payment', status: 'complete', payment_status: 'paid', created: NOW / 1000 - 25 * 3600, metadata: { product: 'pass' } })
    expect((await issueLicense(d, post({ sessionId: 'cs_old' }))).status).toBe(402)
  })

  it('un pago que no es pase (p. ej. una donación) no da acceso', async () => {
    const d = deps()
    const retrieve = d.stripe.checkout.sessions.retrieve as unknown as ReturnType<typeof vi.fn>
    retrieve.mockResolvedValue({ id: 'cs_don', mode: 'payment', status: 'complete', payment_status: 'paid', created: NOW / 1000, metadata: {} })
    expect((await issueLicense(d, post({ sessionId: 'cs_don' }))).status).toBe(402)
    retrieve.mockResolvedValue({ id: 'cs_unpaid', mode: 'payment', status: 'complete', payment_status: 'unpaid', created: NOW / 1000, metadata: { product: 'pass' } })
    expect((await issueLicense(d, post({ sessionId: 'cs_unpaid' }))).status).toBe(402)
  })

  it('emite licencia tras un pago completado y la renueva con el comprobante', async () => {
    const d = deps()
    const res = await issueLicense(d, post({ sessionId: 'cs_test_1' }))
    expect(res.status).toBe(200)
    const { token, expiresAt } = (await res.json()) as { token: string; expiresAt: number }
    expect(verifyLicense(token, SECRET, NOW / 1000)?.customer).toBe('cus_1')
    expect(expiresAt).toBe(NOW / 1000 + 2 * 86400)
    expect((await issueLicense(d, post({ token }))).status).toBe(200)
    expect((await issueLicense(d, post({ token: token + 'x' }))).status).toBe(401)
  })

  it('niega licencia sin suscripción activa o sin pago', async () => {
    const noSub = deps({ subscriptions: { list: vi.fn(async () => ({ data: [{ status: 'canceled', items: { data: [] } }] })) } })
    expect((await issueLicense(noSub, post({ sessionId: 'cs_1' }))).status).toBe(402)
    const unpaid = deps()
    ;(unpaid.stripe.checkout.sessions.retrieve as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ status: 'open', customer: null })
    expect((await issueLicense(unpaid, post({ sessionId: 'cs_1' }))).status).toBe(402)
    expect((await issueLicense(unpaid, post({ sessionId: 'otro' }))).status).toBe(400)
  })

  it('portal sólo con comprobante válido', async () => {
    const d = deps()
    expect((await createPortal(d, post({ token: 'x.y' }))).status).toBe(401)
    const token = signLicense({ customer: 'cus_1', plan: 'pro', exp: NOW / 1000 + 10 }, SECRET)
    expect(await (await createPortal(d, post({ token }))).json()).toEqual({ url: 'https://billing.stripe.test/p' })
  })

  it('webhook verifica la firma de Stripe', async () => {
    const d = deps()
    const payload = JSON.stringify({ id: 'evt_1', object: 'event', type: 'customer.subscription.deleted' })
    const header = d.stripe.webhooks.generateTestHeaderString({ payload, secret: env.webhookSecret })
    const ok = new Request('https://x', { method: 'POST', body: payload, headers: { 'stripe-signature': header } })
    vi.spyOn(console, 'info').mockImplementation(() => {})
    expect((await handleWebhook(d, ok)).status).toBe(200)
    const bad = new Request('https://x', { method: 'POST', body: payload, headers: { 'stripe-signature': 't=1,v1=bad' } })
    expect((await handleWebhook(d, bad)).status).toBe(400)
  })
})
