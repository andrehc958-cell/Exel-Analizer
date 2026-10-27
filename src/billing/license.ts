import { useCallback, useEffect, useState } from 'react'
import { BILLING_ENABLED } from './plan'
import type { PlanId } from './plan'

const STORAGE_KEY = 'dataclean.license'
const REFRESH_BEFORE_SECONDS = 2 * 24 * 60 * 60

export interface StoredLicense {
  token: string
  expiresAt: number
  cancelAtPeriodEnd?: boolean
}

export class BillingError extends Error {}

function load(): StoredLicense | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as StoredLicense) : null
  } catch {
    return null
  }
}

function store(license: StoredLicense | null) {
  try {
    if (license) localStorage.setItem(STORAGE_KEY, JSON.stringify(license))
    else localStorage.removeItem(STORAGE_KEY)
  } catch {
    // Navegación privada o almacenamiento bloqueado: la licencia dura lo que dure la pestaña.
  }
}

async function post<T>(path: string, body: unknown): Promise<T> {
  let res: Response
  try {
    res = await fetch(path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
  } catch {
    throw new BillingError('No hay conexión con el servidor de pagos.')
  }
  const data = (await res.json().catch(() => ({}))) as T & { error?: string }
  if (!res.ok) throw new BillingError(data.error ?? 'No se pudo completar la operación.')
  return data
}

const now = () => Date.now() / 1000

/**
 * Estado de la suscripción en este navegador. El comprobante lo firma el servidor tras
 * consultar Stripe y se renueva solo antes de caducar.
 */
export function useLicense() {
  const [license, setLicense] = useState<StoredLicense | null>(() => (BILLING_ENABLED ? load() : null))
  const [message, setMessage] = useState<string | null>(null)

  const save = useCallback((l: StoredLicense | null) => {
    store(l)
    setLicense(l)
  }, [])

  // Vuelta desde Stripe Checkout o renovación del comprobante.
  useEffect(() => {
    if (!BILLING_ENABLED) return
    const params = new URLSearchParams(window.location.search)
    const sessionId = params.get('session_id')
    const checkout = params.get('checkout')
    if (checkout) {
      params.delete('checkout')
      params.delete('session_id')
      const qs = params.toString()
      window.history.replaceState(null, '', `${window.location.pathname}${qs ? `?${qs}` : ''}${window.location.hash}`)
    }
    if (checkout === 'cancel') setMessage('El pago se canceló. No se realizó ningún cargo.')
    if (checkout === 'success' && sessionId) {
      post<StoredLicense>('/api/license', { sessionId })
        .then((l) => {
          save(l)
          setMessage('¡Listo! Tu plan Pro está activo en este navegador.')
        })
        .catch((e: Error) => setMessage(e.message))
      return
    }
    const current = load()
    if (current && current.expiresAt - now() < REFRESH_BEFORE_SECONDS) {
      post<StoredLicense>('/api/license', { token: current.token })
        .then(save)
        .catch((e) => {
          // Sin suscripción activa se vuelve al plan gratuito; si sólo falla la red, se conserva hasta caducar.
          if (e instanceof BillingError && current.expiresAt < now()) save(null)
        })
    }
  }, [save])

  const plan: PlanId = license && license.expiresAt > now() ? 'pro' : 'free'

  const checkout = useCallback(async () => {
    const { url } = await post<{ url: string }>('/api/checkout', { acceptedTerms: true })
    window.location.assign(url)
  }, [])

  const portal = useCallback(async () => {
    if (!license) return
    const { url } = await post<{ url: string }>('/api/portal', { token: license.token })
    window.location.assign(url)
  }, [license])

  return { plan, license, message, clearMessage: () => setMessage(null), checkout, portal, signOut: () => save(null) }
}
