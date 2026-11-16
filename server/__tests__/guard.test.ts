import { beforeEach, describe, expect, it, vi } from 'vitest'
import { guard, rateLimit, resetRateLimits } from '../guard'

const ok = vi.fn(async () => new Response('ok'))
const req = (headers: Record<string, string> = {}, method = 'POST', body = '{}') =>
  new Request('https://dataclean.test/api/x', {
    method,
    body: method === 'POST' ? body : undefined,
    headers: { 'content-type': 'application/json', host: 'dataclean.test', 'x-real-ip': '1.2.3.4', ...headers },
  })

beforeEach(() => {
  resetRateLimits()
  ok.mockClear()
})

describe('guard', () => {
  const h = guard({ name: 't', limit: 3, windowSeconds: 60 }, ok)

  it('deja pasar una petición normal del mismo sitio', async () => {
    expect((await h(req({ origin: 'https://dataclean.test' }))).status).toBe(200)
  })

  it('rechaza otros métodos, otros sitios, cuerpos que no son JSON y cuerpos enormes', async () => {
    expect((await h(req({}, 'GET'))).status).toBe(405)
    expect((await h(req({ origin: 'https://atacante.example' }))).status).toBe(403)
    expect((await h(req({ 'content-type': 'text/plain' }))).status).toBe(415)
    expect((await h(req({ 'content-length': String(1024 * 1024) }))).status).toBe(413)
    expect(ok).not.toHaveBeenCalled()
  })

  it('limita ráfagas por IP con 429 y Retry-After', async () => {
    for (let i = 0; i < 3; i++) expect((await h(req())).status).toBe(200)
    const blocked = await h(req())
    expect(blocked.status).toBe(429)
    expect(Number(blocked.headers.get('retry-after'))).toBeGreaterThan(0)
    // Otra IP no se ve afectada.
    expect((await h(req({ 'x-real-ip': '5.6.7.8' }))).status).toBe(200)
  })

  it('el webhook acepta peticiones sin Origin ni JSON estricto', async () => {
    const hook = guard({ name: 'wh', limit: 5, windowSeconds: 60, sameOrigin: false }, ok)
    expect((await hook(req({ 'content-type': 'application/json; charset=utf-8', origin: '' }))).status).toBe(200)
  })
})

describe('rateLimit', () => {
  it('se reinicia al terminar la ventana', () => {
    expect(rateLimit('k', 1, 10, 0)).toBe(0)
    expect(rateLimit('k', 1, 10, 1000)).toBe(9)
    expect(rateLimit('k', 1, 10, 10_001)).toBe(0)
  })
})
