import { describe, expect, it, vi } from 'vitest'
import { parseContact, sendContact } from '../contact'

const env = { resendApiKey: 're_test', to: 'soporte@dataclean.test' }
const post = (body: unknown) => new Request('https://x/api/contact', { method: 'POST', body: JSON.stringify(body) })
const support = { kind: 'soporte', topic: 'pagos', name: 'Ana', email: 'ana@correo.mx', message: 'No se activó mi plan Pro', acceptedPrivacy: true }

describe('parseContact', () => {
  it('valida campos obligatorios', () => {
    expect(parseContact({ ...support, email: 'x' })).toMatch(/correo/)
    expect(parseContact({ ...support, message: 'corto' })).toMatch(/más/)
    expect(parseContact({ ...support, acceptedPrivacy: false })).toMatch(/Aviso/)
    expect(parseContact({ ...support, topic: 'hack' })).toMatch(/tema/)
    expect(parseContact({ ...support, website: 'http://spam' })).toBe('spam')
  })
  it('las sugerencias pueden ser anónimas', () => {
    expect(parseContact({ kind: 'sugerencia', topic: 'mejora', message: 'Exportar a JSON también' })).toMatchObject({ email: '' })
  })
})

describe('sendContact', () => {
  it('sin configuración pide usar el correo directo', async () => {
    const res = await sendContact({}, post(support))
    expect(res.status).toBe(503)
    expect(await res.json()).toMatchObject({ fallback: true })
  })

  it('envía el correo con reply_to del usuario', async () => {
    const fetcher = vi.fn(async () => new Response('{}', { status: 200 }))
    const res = await sendContact(env, post(support), fetcher as unknown as typeof fetch)
    expect(res.status).toBe(200)
    const [url, init] = fetcher.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('https://api.resend.com/emails')
    const sent = JSON.parse(init.body as string)
    expect(sent).toMatchObject({ to: ['soporte@dataclean.test'], reply_to: 'ana@correo.mx' })
    expect(sent.subject).toContain('Servicio al cliente')
  })

  it('descarta spam sin enviar y reporta fallos del proveedor', async () => {
    const fetcher = vi.fn(async () => new Response('{}', { status: 500 }))
    expect((await sendContact(env, post({ ...support, website: 'x' }), fetcher as unknown as typeof fetch)).status).toBe(200)
    expect(fetcher).not.toHaveBeenCalled()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    expect((await sendContact(env, post(support), fetcher as unknown as typeof fetch)).status).toBe(502)
  })
})
