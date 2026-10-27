import { useState } from 'react'
import { bytes, nf } from '../ui/format'
import { BILLING_ENABLED, PLAN_LIMITS, PRO_PRICE_LABEL } from './plan'
import type { useLicense } from './license'

type License = ReturnType<typeof useLicense>

export function Pricing({ license }: { license: License }) {
  const [accepted, setAccepted] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const isPro = license.plan === 'pro'

  const go = async (fn: () => Promise<void>) => {
    setBusy(true)
    setError(null)
    try {
      await fn()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo completar la operación.')
      setBusy(false)
    }
  }

  const describe = (plan: 'free' | 'pro') => {
    const l = PLAN_LIMITS[plan]
    return `Archivos de hasta ${bytes(l.maxBytes)} y ${nf.format(l.maxRows)} filas`
  }

  return (
    <section aria-labelledby="pricing-title">
      <a href="#/" className="back-link">
        ← Volver
      </a>
      <h1 id="pricing-title">Planes</h1>
      {license.message && (
        <div className="notice" role="status">
          <span>{license.message}</span>
          <button className="ghost" onClick={license.clearMessage} aria-label="Cerrar aviso">
            ✕
          </button>
        </div>
      )}
      {!BILLING_ENABLED && (
        <p className="notice">Los pagos todavía no están activados: por ahora todas las funciones están disponibles sin costo.</p>
      )}

      <div className="plans">
        <div className="card plan">
          <h2>Gratis</h2>
          <p className="price">$0</p>
          <ul>
            <li>{describe('free')}</li>
            <li>Informe de calidad completo</li>
            <li>Descarga en CSV y Excel con registro de cambios</li>
            <li>Tus archivos nunca salen de tu navegador</li>
          </ul>
          {!isPro && <p className="muted small">Tu plan actual</p>}
        </div>

        <div className="card plan featured">
          <h2>Pro</h2>
          <p className="price">{PRO_PRICE_LABEL}</p>
          <ul>
            <li>{describe('pro')}</li>
            <li>Todo lo del plan gratuito</li>
            <li>Cancela cuando quieras</li>
          </ul>

          {isPro ? (
            <>
              <p className="muted small">
                Plan Pro activo en este navegador
                {license.license?.cancelAtPeriodEnd ? ' (cancelado: termina al final del periodo pagado)' : ''}.
              </p>
              <button className="secondary" disabled={busy} onClick={() => go(license.portal)}>
                Administrar suscripción
              </button>
            </>
          ) : (
            BILLING_ENABLED && (
              <>
                <label className="check">
                  <input type="checkbox" checked={accepted} onChange={(e) => setAccepted(e.target.checked)} />
                  <span>
                    Acepto los <a href="#/terminos">Términos y condiciones</a> y el{' '}
                    <a href="#/privacidad">Aviso de privacidad</a>.
                  </span>
                </label>
                <button className="primary" disabled={!accepted || busy} onClick={() => go(license.checkout)}>
                  {busy ? 'Abriendo Stripe…' : 'Suscribirme con Stripe'}
                </button>
                <p className="muted small">El pago se realiza en la página segura de Stripe. No guardamos los datos de tu tarjeta.</p>
              </>
            )
          )}
          {error && (
            <p className="warn-text small" role="alert">
              {error}
            </p>
          )}
        </div>
      </div>
    </section>
  )
}
