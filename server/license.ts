import { createHmac, timingSafeEqual } from 'node:crypto'

/**
 * Comprobante de licencia firmado (HMAC-SHA256). No hay base de datos: Stripe es la
 * fuente de verdad y el comprobante sólo resume "este cliente tiene Pro hasta tal fecha".
 * Caduca pronto para obligar a revalidar contra Stripe (cancelaciones, impagos).
 */
export interface LicensePayload {
  /** Id de cliente de Stripe. */
  customer: string
  plan: 'pro'
  /** Origen del acceso: suscripción (se renueva) o pase de pago único (no se renueva). Sin valor = suscripción. */
  kind?: LicenseKind
  /** Caducidad en segundos Unix. */
  exp: number
}

export type LicenseKind = 'sub' | 'pass'

export const LICENSE_TTL_SECONDS = 7 * 24 * 60 * 60

export function signLicense(payload: LicensePayload, secret: string): string {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url')
  return `${body}.${mac(body, secret)}`
}

export function verifyLicense(token: string, secret: string, now = Date.now() / 1000): LicensePayload | null {
  const [body, sig, extra] = token.split('.')
  if (!body || !sig || extra !== undefined) return null
  const expected = Buffer.from(mac(body, secret))
  const given = Buffer.from(sig)
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString()) as LicensePayload
    if (typeof payload.customer !== 'string' || payload.plan !== 'pro' || typeof payload.exp !== 'number') return null
    if (payload.kind !== undefined && payload.kind !== 'sub' && payload.kind !== 'pass') return null
    return payload.exp > now ? payload : null
  } catch {
    return null
  }
}

function mac(body: string, secret: string): string {
  return createHmac('sha256', secret).update(body).digest('base64url')
}
