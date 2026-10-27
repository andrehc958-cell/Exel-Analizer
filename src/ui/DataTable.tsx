import { useEffect, useState } from 'react'
import type { Page } from '../engine/session'
import type { EngineClient } from '../worker/client'
import { displayCell, nf } from './format'

const PAGE_SIZE = 50

interface Props {
  engine: EngineClient
  which: 'original' | 'clean'
  /** Cambia cuando los datos subyacentes cambian, para volver a pedir la página. */
  version: number
  onError: (e: unknown) => void
}

/** Tabla paginada: sólo la página visible viaja desde el worker. */
export function DataTable({ engine, which, version, onError }: Props) {
  const [offset, setOffset] = useState(0)
  const [page, setPage] = useState<Page | null>(null)

  useEffect(() => setOffset(0), [which, version])

  useEffect(() => {
    let alive = true
    engine
      .call('page', { which, offset, limit: PAGE_SIZE })
      .then((p) => alive && setPage(p))
      .catch((e) => alive && onError(e))
    return () => {
      alive = false
    }
  }, [engine, which, offset, version, onError])

  if (!page) return <div className="table-empty">Cargando vista previa…</div>
  const last = Math.max(0, Math.ceil(page.total / PAGE_SIZE) - 1) * PAGE_SIZE
  const changedCount = page.changed?.reduce((n, r) => n + r.filter(Boolean).length, 0) ?? 0

  return (
    <div className="table-block">
      <div className="table-scroll" tabIndex={0} aria-label="Vista previa de datos">
        <table>
          <thead>
            <tr>
              <th className="rownum" title="Fila en el archivo original">#</th>
              {page.columns.map((c, i) => (
                <th key={i}>{c}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {page.rows.map((row, r) => (
              <tr key={page.rowNumbers[r]}>
                <td className="rownum">{page.rowNumbers[r]}</td>
                {row.map((cell, c) => {
                  const changed = page.changed?.[r][c]
                  const text = displayCell(cell)
                  return (
                    <td
                      key={c}
                      className={[
                        cell === null ? 'null' : '',
                        typeof cell === 'number' ? 'num' : '',
                        changed ? 'changed' : '',
                        typeof cell === 'string' && cell !== cell.trim() ? 'ws' : '',
                      ].join(' ')}
                      title={changed ? 'Valor modificado' : undefined}
                    >
                      {cell === null ? '—' : text}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
        {!page.rows.length && <div className="table-empty">No quedan filas.</div>}
      </div>
      <div className="pager">
        <span>
          {page.total ? `${nf.format(offset + 1)}–${nf.format(offset + page.rows.length)} de ${nf.format(page.total)} filas` : '0 filas'}
          {page.changed && changedCount > 0 && <span className="legend"> · {nf.format(changedCount)} celdas cambiadas en esta página</span>}
        </span>
        <span className="pager-buttons">
          <button className="ghost" onClick={() => setOffset(0)} disabled={offset === 0} aria-label="Primera página">«</button>
          <button className="ghost" onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))} disabled={offset === 0}>Anterior</button>
          <button className="ghost" onClick={() => setOffset(offset + PAGE_SIZE)} disabled={offset >= last}>Siguiente</button>
          <button className="ghost" onClick={() => setOffset(last)} disabled={offset >= last} aria-label="Última página">»</button>
        </span>
      </div>
    </div>
  )
}
