import type { Method, Methods, Response } from './protocol'

export class EngineCallError extends Error {
  readonly code: string
  constructor(code: string, message: string) {
    super(message)
    this.code = code
  }
}

/** Cliente RPC mínimo sobre postMessage para hablar con el Web Worker del motor. */
export class EngineClient {
  private worker: Worker
  private nextId = 1
  private pending = new Map<number, { resolve: (v: unknown) => void; reject: (e: Error) => void }>()

  constructor() {
    this.worker = new Worker(new URL('./engine.worker.ts', import.meta.url), { type: 'module' })
    this.worker.onmessage = (e: MessageEvent<Response>) => {
      const p = this.pending.get(e.data.id)
      if (!p) return
      this.pending.delete(e.data.id)
      if (e.data.ok) p.resolve(e.data.value)
      else p.reject(new EngineCallError(e.data.error.code, e.data.error.message))
    }
    this.worker.onerror = (e) => {
      const err = new EngineCallError('worker', 'El procesador del navegador se detuvo. Recarga la página e inténtalo de nuevo.')
      console.error(e)
      for (const p of this.pending.values()) p.reject(err)
      this.pending.clear()
    }
  }

  call<M extends Method>(method: M, args: Methods[M]['args'], transfer: Transferable[] = []): Promise<Methods[M]['result']> {
    const id = this.nextId++
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve: resolve as (v: unknown) => void, reject })
      this.worker.postMessage({ id, method, args }, transfer)
    })
  }
}
