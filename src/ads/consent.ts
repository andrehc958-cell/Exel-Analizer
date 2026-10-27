import { useCallback, useState } from 'react'
import type { AdConsent } from './config'

const STORAGE_KEY = 'dataclean.adConsent'
const VALUES: AdConsent[] = ['personalized', 'non-personalized', 'none']

function load(): AdConsent | null {
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    return (VALUES as (string | null)[]).includes(v) ? (v as AdConsent) : null
  } catch {
    return null
  }
}

/** Preferencia de anuncios del visitante. `null` = todavía no decide: no se carga ningún anuncio. */
export function useAdConsent() {
  const [consent, setConsent] = useState<AdConsent | null>(load)
  const choose = useCallback((value: AdConsent | null) => {
    try {
      if (value) localStorage.setItem(STORAGE_KEY, value)
      else localStorage.removeItem(STORAGE_KEY)
    } catch {
      // Almacenamiento bloqueado: la preferencia dura lo que dure la pestaña.
    }
    setConsent(value)
  }, [])
  return { consent, choose }
}
