import { describe, expect, it } from 'vitest'
import { billingDeps } from '../stripe'

describe('billingDeps', () => {
  it('sin clave o sin dominio, los pagos quedan desactivados', () => {
    expect(billingDeps({ STRIPE_PRICE_PRO: 'price_1', APP_URL: 'https://a.mx' })).toBeNull()
    expect(billingDeps({ STRIPE_SECRET_KEY: 'sk_test_1' })).toBeNull()
  })

  it('acepta las variables con prefijo de la integración de Vercel y la URL de producción', () => {
    const deps = billingDeps({
      DANA_STRIPE_SECRET_KEY: 'sk_test_1',
      DANA_STRIPE_WEBHOOK_SECRET: 'whsec_1',
      VERCEL_PROJECT_PRODUCTION_URL: 'exel-analizer.vercel.app',
    })
    expect(deps?.env.appUrl).toBe('https://exel-analizer.vercel.app')
    expect(deps?.env.webhookSecret).toBe('whsec_1')
    expect(deps?.env.pricePro).toBeUndefined()
    expect(deps?.env.licenseSecret).toMatch(/^[0-9a-f]{64}$/)
  })

  it('las variables explícitas tienen prioridad', () => {
    const deps = billingDeps({
      STRIPE_SECRET_KEY: 'sk_test_1',
      STRIPE_PRICE_PRO: 'price_1',
      LICENSE_SECRET: 'propio',
      APP_URL: 'https://dataclean.mx/',
      VERCEL_PROJECT_PRODUCTION_URL: 'exel-analizer.vercel.app',
    })
    expect(deps?.env.appUrl).toBe('https://dataclean.mx')
    expect(deps?.env.licenseSecret).toBe('propio')
  })
})
