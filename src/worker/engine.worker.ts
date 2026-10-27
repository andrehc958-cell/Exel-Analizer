/// <reference lib="webworker" />
import { CleaningSession } from '../engine/session'
import { EngineError } from '../engine/types'
import type { Request, Response } from './protocol'

// Todo el procesamiento ocurre aquí, fuera del hilo de la interfaz:
// el archivo llega como ArrayBuffer transferido (sin copia) y nunca sale del navegador.
const session = new CleaningSession()
const scope = self as unknown as DedicatedWorkerGlobalScope

scope.onmessage = async (event: MessageEvent<Request>) => {
  const { id, method, args } = event.data
  try {
    let value: unknown
    const transfer: Transferable[] = []
    switch (method) {
      case 'open':
        value = await session.open(new Uint8Array(args.buffer), args.name, args.limits)
        break
      case 'selectSheet':
        value = session.selectSheet(args.sheet, args.hasHeader)
        break
      case 'duplicates':
        value = session.duplicates(args.key)
        break
      case 'clean':
        value = session.clean(args.options)
        break
      case 'page':
        value = session.page(args.which, args.offset, args.limit)
        break
      case 'export': {
        const out = await session.export(args.format, args.includeAudit)
        transfer.push(out.data)
        value = out
        break
      }
      case 'reset':
        session.reset()
        value = null
        break
    }
    scope.postMessage({ id, ok: true, value } satisfies Response, transfer)
  } catch (err) {
    const error =
      err instanceof EngineError
        ? { code: err.code, message: err.message }
        : { code: 'internal', message: 'Ocurrió un error inesperado al procesar el archivo.' }
    if (!(err instanceof EngineError)) console.error(err)
    scope.postMessage({ id, ok: false, error } satisfies Response)
  }
}
