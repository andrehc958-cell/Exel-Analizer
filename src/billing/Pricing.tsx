import { useState } from 'react'
import { ADS_ENABLED } from '../ads/config'
import { bytes, nf } from '../ui/format'
import { until } from './license'
import {
  BILLING_ENABLED,
  DONATION_URL,
  PASS_PRICE_LABEL,
  PLAN_LIMITS,
  PRO_ANNUAL_NOTE,
  PRO_ANNUAL_PRICE_LABEL,
  PRO_PRICE_LABEL,
} from './plan'
import type { CheckoutProduct } from './plan'
import type { useLicense } from './license'

type License = ReturnType<typeof useLicense>

export function Pricing({ license }: { license: License }) {
  const [accepted, setAccepted] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [interval, setBillingInterval] = useState<'monthly' | 'annual'>(PRO_ANNUAL_PRICE_LABEL ? 'annual' : 'monthly')
  const isPro = license.plan === 'pro'
  const isPass = isPro && license.license?.kind === 'pass'

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
  const buy = (product: CheckoutProduct) => go(() => license.checkout(product))

  const describe = (plan: 'free' | 'pro') => {
    const l = PLAN_LIMITS[plan]
    return `Archivos de hasta ${bytes(l.maxBytes)} y ${nf.format(l.maxRows)} filas`
  }

  const terms = (
    <label className="check">
      <input type="checkbox" checked={accepted} onChange={(e) => setAccepted(e.target.checked)} />
      <span>
        Acepto los <a href="#/terminos">Términos y condiciones</a> y el <a href="#/privacidad">Aviso de privacidad</a>.
      </span>
    </label>
  )

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

      {BILLING_ENABLED && !isPro && terms}

      <div className="plans">
        <div className="card plan">
          <h2>Gratis</h2>
          <p className="price">$0</p>
          <ul>
            <li>{describe('free')}</li>
            <li>Informe de calidad completo</li>
            <li>Descarga en CSV y Excel con registro de cambios</li>
            <li>Tus archivos nunca salen de tu navegador</li>
            {ADS_ENABLED && <li>Con anuncios discretos</li>}
          </ul>
          {!isPro && <p className="muted small">Tu plan actual</p>}
        </div>

        <div className="card plan featured">
          <h2>Pro</h2>
          {PRO_ANNUAL_PRICE_LABEL && !isPro && (
            <div className="segmented" role="group" aria-label="Periodo de facturación">
              <button className={interval === 'monthly' ? 'on' : ''} aria-pressed={interval === 'monthly'} onClick={() => setBillingInterval('monthly')}>
                Mensual
              </button>
              <button className={interval === 'annual' ? 'on' : ''} aria-pressed={interval === 'annual'} onClick={() => setBillingInterval('annual')}>
                Anual
              </button>
            </div>
          )}
          <p className="price">{interval === 'annual' ? PRO_ANNUAL_PRICE_LABEL : PRO_PRICE_LABEL}</p>
          {interval === 'annual' && PRO_ANNUAL_NOTE && <p className="savings small">{PRO_ANNUAL_NOTE}</p>}
          <ul>
            <li>{describe('pro')}</li>
            <li>Todo lo del plan gratuito</li>
            {ADS_ENABLED && <li>Sin anuncios</li>}
            <li>Cancela cuando quieras</li>
          </ul>

          {isPro && !isPass ? (
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
                <button className="primary" disabled={!accepted || busy} onClick={() => buy(interval)}>
                  {busy ? 'Abriendo Stripe…' : interval === 'annual' ? 'Suscribirme por un año' : 'Suscribirme con Stripe'}
                </button>
                <p className="muted small">El pago se realiza en la página segura de Stripe. No guardamos los datos de tu tarjeta.</p>
              </>
            )
          )}
        </div>

        {PASS_PRICE_LABEL && (
          <div className="card plan">
            <h2>Pase de 24 horas</h2>
            <p className="price">{PASS_PRICE_LABEL}</p>
            <ul>
              <li>Todo lo de Pro durante 24 horas</li>
              <li>Pago único, sin suscripción ni renovación</li>
              <li>Ideal para un proyecto puntual</li>
            </ul>
            {isPass ? (
              <p className="muted small">Pase activo hasta el {until(license.license!.expiresAt)}.</p>
            ) : (
              BILLING_ENABLED &&
              !isPro && (
                <button className="secondary" disabled={!accepted || busy} onClick={() => buy('pass')}>
                  Comprar pase
                </button>
              )
            )}
          </div>
        )}
      </div>

      {error && (
        <p className="warn-text small" role="alert">
          {error}
        </p>
      )}

      {DONATION_URL && (
        <div className="card donate">
          <div>
            <h2>¿Te ahorró tiempo?</h2>
            <p className="muted">
              Si DataClean te sirve, puedes apoyar su desarrollo con una aportación voluntaria del monto que quieras. No
              cambia tu plan, pero nos ayuda a mantener gratis la versión básica.
            </p>
          </div>
          <a className="button-link" href={DONATION_URL} target="_blank" rel="noopener noreferrer">
            Invítanos un café ☕
          </a>
        </div>
      )}
    </section>
  )
}
