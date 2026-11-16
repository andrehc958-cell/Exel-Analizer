import { json } from './billing.js'

/**
 * Primera línea de defensa de los endpoints /api. Rechaza antes de tocar Stripe o Resend:
 * - métodos distintos de POST,
 * - cuerpos que no son JSON (un formulario de otro sitio no puede enviar application/json sin CORS),
 * - peticiones hechas desde otro sitio (cabecera Origin distinta),
 * - cuerpos de más de 16 KB,
 * - ráfagas desde la misma IP (límite por ventana de tiempo).
 *
 * El límite de ráfagas vive en la memoria de cada instancia de la función: frena abusos simples
 * (un script que repite el formulario de contacto) pero no un ataque distribuido. Para eso está
 * el firewall de Vercel o Cloudflare delante del sitio (ver README, sección Seguridad).
 */
export interface GuardOptions {
  /** Nombre del cubo de límite (cada endpoint lleva su propia cuenta). */
  name: string
  /** Peticiones permitidas por IP dentro de la ventana. */
  limit: number
  windowSeconds: number
  /** El webhook de Stripe no trae Origin y se autentica con su firma. */
  sameOrigin?: boolean
  maxBytes?: number
}

type Handler = (request: Request) => Promise<Response>

const buckets = new Map<string, { count: number; reset: number }>()
const MAX_TRACKED = 10_000

export function clientIp(request: Request): string {
  const h = request.headers
  return (
    h.get('x-vercel-forwarded-for')?.split(',')[0].trim() ||
    h.get('x-real-ip')?.trim() ||
    h.get('x-forwarded-for')?.split(',')[0].trim() ||
    'desconocida'
  )
}

/** Devuelve los segundos que faltan para poder reintentar, o 0 si la petición entra. */
export function rateLimit(key: string, limit: number, windowSeconds: number, now = Date.now()): number {
  const entry = buckets.get(key)
  if (!entry || entry.reset <= now) {
    if (buckets.size >= MAX_TRACKED) {
      for (const [k, v] of buckets) if (v.reset <= now) buckets.delete(k)
      // Si aún está lleno (ataque con muchas IP), se vacía: preferible a crecer sin límite.
      if (buckets.size >= MAX_TRACKED) buckets.clear()
    }
    buckets.set(key, { count: 1, reset: now + windowSeconds * 1000 })
    return 0
  }
  if (entry.count >= limit) return Math.ceil((entry.reset - now) / 1000)
  entry.count++
  return 0
}

export function resetRateLimits(): void {
  buckets.clear()
}

export function guard(options: GuardOptions, handler: Handler): Handler {
  const { name, limit, windowSeconds, sameOrigin = true, maxBytes = 16 * 1024 } = options
  return async (request) => {
    if (request.method !== 'POST') return json({ error: 'Método no permitido.' }, 405)
    const length = Number(request.headers.get('content-length') ?? 0)
    if (length > maxBytes) return json({ error: 'La solicitud es demasiado grande.' }, 413)
    if (sameOrigin) {
      if (!(request.headers.get('content-type') ?? '').toLowerCase().startsWith('application/json')) {
        return json({ error: 'Solicitud no válida.' }, 415)
      }
      const origin = request.headers.get('origin')
      if (origin && !sameSite(origin, request)) return json({ error: 'Origen no permitido.' }, 403)
    }
    const wait = rateLimit(`${name}:${clientIp(request)}`, limit, windowSeconds)
    if (wait > 0) {
      const res = json({ error: 'Demasiadas solicitudes. Espera un momento e inténtalo de nuevo.' }, 429)
      res.headers.set('retry-after', String(wait))
      return res
    }
    return handler(request)
  }
}

function sameSite(origin: string, request: Request): boolean {
  try {
    const o = new URL(origin)
    const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host') ?? new URL(request.url).host
    const allowed = new Set([host])
    const app = process.env.APP_URL
    if (app) allowed.add(new URL(app).host)
    return allowed.has(o.host)
  } catch {
    return false
  }
}
