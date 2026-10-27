import { BILLING_ENABLED, DONATION_URL } from '../billing/plan'
import { ADS_ENABLED, adFrame } from './config'
import type { AdConsent } from './config'

/**
 * Espacio publicitario del plan gratuito. Con consentimiento muestra un anuncio de AdSense
 * aislado en un iframe; sin él (o sin AdSense configurado) muestra un aviso propio que invita
 * a quitar los anuncios con Pro o a apoyar con una donación.
 */
export function AdSlot({ consent }: { consent: AdConsent | null }) {
  const showAd = ADS_ENABLED && (consent === 'personalized' || consent === 'non-personalized')
  if (showAd) {
    const { src, sandbox } = adFrame(consent, window.location.origin)
    return (
      <aside className="ad-slot" aria-label="Publicidad">
        <span className="ad-label">Publicidad</span>
        <iframe title="Publicidad" src={src} sandbox={sandbox} loading="lazy" referrerPolicy="strict-origin-when-cross-origin" />
      </aside>
    )
  }
  if (!BILLING_ENABLED && !DONATION_URL) return null
  return (
    <aside className="ad-slot house" aria-label="Apoya DataClean">
      <p>
        <strong>DataClean es gratis gracias a quienes lo apoyan.</strong>{' '}
        {BILLING_ENABLED && (
          <>
            <a href="#/precios">Hazte Pro</a> para archivos más grandes{ADS_ENABLED ? ' y sin anuncios' : ''}
          </>
        )}
        {BILLING_ENABLED && DONATION_URL && ' o '}
        {DONATION_URL && (
          <a href={DONATION_URL} target="_blank" rel="noopener noreferrer">
            {BILLING_ENABLED ? 'invítanos un café' : 'Invítanos un café'}
          </a>
        )}
        .
      </p>
    </aside>
  )
}
