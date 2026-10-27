/**
 * Anuncios de Google AdSense, sólo para el plan gratuito y sólo con consentimiento.
 *
 * Los anuncios nunca se cargan en la página del limpiador: se muestran dentro de un iframe
 * aislado (public/anuncio.html). Si el iframe es del mismo dominio se le quita
 * `allow-same-origin`, así el código publicitario corre con un origen opaco y no puede leer
 * la página ni los datos del archivo. Si se aloja en otro dominio (VITE_AD_FRAME_URL), el
 * navegador ya lo separa por origen y puede conservar sus cookies.
 */
export const ADSENSE_CLIENT = /^ca-pub-\d+$/.test(import.meta.env.VITE_ADSENSE_CLIENT ?? '') ? import.meta.env.VITE_ADSENSE_CLIENT! : ''
export const ADSENSE_SLOT = /^\d+$/.test(import.meta.env.VITE_ADSENSE_SLOT ?? '') ? import.meta.env.VITE_ADSENSE_SLOT! : ''
export const ADS_ENABLED = Boolean(ADSENSE_CLIENT && ADSENSE_SLOT)
const AD_FRAME_URL = import.meta.env.VITE_AD_FRAME_URL || '/anuncio.html'

export type AdConsent = 'personalized' | 'non-personalized' | 'none'

const BASE_SANDBOX = 'allow-scripts allow-popups allow-popups-to-escape-sandbox'

/** Dirección y permisos del iframe del anuncio. */
export function adFrame(consent: AdConsent, pageOrigin: string, frameUrl = AD_FRAME_URL) {
  const url = new URL(frameUrl, pageOrigin)
  url.searchParams.set('client', ADSENSE_CLIENT)
  url.searchParams.set('slot', ADSENSE_SLOT)
  if (consent !== 'personalized') url.searchParams.set('npa', '1')
  const sameOrigin = url.origin === new URL(pageOrigin).origin
  return { src: url.toString(), sandbox: sameOrigin ? BASE_SANDBOX : `${BASE_SANDBOX} allow-same-origin` }
}
