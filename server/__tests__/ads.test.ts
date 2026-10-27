import { describe, expect, it } from 'vitest'
import { adsTxt } from '../ads'

describe('ads.txt', () => {
  it('declara la cuenta de AdSense configurada', async () => {
    const res = adsTxt('ca-pub-1234567890')
    expect(res.status).toBe(200)
    expect(await res.text()).toBe('google.com, pub-1234567890, DIRECT, f08c47fec0942fa0\n')
  })

  it('responde 404 sin cuenta o con un valor no válido', () => {
    expect(adsTxt(undefined).status).toBe(404)
    expect(adsTxt('pub-123\nmalicioso').status).toBe(404)
  })
})
