import { describe, expect, it } from 'vitest'
import { adFrame } from '../config'

describe('adFrame', () => {
  it('en el mismo dominio aísla el anuncio con un origen opaco', () => {
    const f = adFrame('personalized', 'https://dataclean.mx', '/anuncio.html')
    expect(f.src.startsWith('https://dataclean.mx/anuncio.html?')).toBe(true)
    expect(f.sandbox).not.toContain('allow-same-origin')
    expect(new URL(f.src).searchParams.has('npa')).toBe(false)
  })

  it('en otro dominio conserva el origen propio del anuncio', () => {
    const f = adFrame('personalized', 'https://dataclean.mx', 'https://ads.dataclean-anuncios.com/anuncio.html')
    expect(f.sandbox).toContain('allow-same-origin')
  })

  it('pide anuncios no personalizados si no hay consentimiento completo', () => {
    const f = adFrame('non-personalized', 'https://dataclean.mx', '/anuncio.html')
    expect(new URL(f.src).searchParams.get('npa')).toBe('1')
  })
})
