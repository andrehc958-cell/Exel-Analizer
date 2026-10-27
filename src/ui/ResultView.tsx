import { useState } from 'react'
import type { CleanSummary } from '../engine/session'
import { STATUS_LABELS } from '../engine/types'
import type { EngineClient } from '../worker/client'
import { DataTable } from './DataTable'
import { nf } from './format'

interface Props {
  engine: EngineClient
  summary: CleanSummary
  version: number
  onBack: () => void
  onDownload: (format: 'csv' | 'xlsx') => void
  downloading: boolean
  onError: (e: unknown) => void
}

export function ResultView({ engine, summary, version, onBack, onDownload, downloading, onError }: Props) {
  const [view, setView] = useState<'clean' | 'original'>('clean')
  const applied = summary.audit.filter((a) => a.status === 'applied')

  return (
    <section aria-labelledby="result-title">
      <h2 id="result-title">Resultado</h2>
      <div className="stats">
        <div className="stat">
          <span className="stat-value">{nf.format(summary.rowsAfter)}</span>
          <span className="stat-label">Filas</span>
          <span className="stat-hint">antes {nf.format(summary.rowsBefore)}</span>
        </div>
        <div className="stat">
          <span className="stat-value">{nf.format(summary.columnsAfter)}</span>
          <span className="stat-label">Columnas</span>
          <span className="stat-hint">antes {nf.format(summary.columnsBefore)}</span>
        </div>
        <div className="stat">
          <span className="stat-value">{nf.format(applied.reduce((n, a) => n + a.cellsChanged, 0))}</span>
          <span className="stat-label">Celdas cambiadas</span>
        </div>
        <div className="stat">
          <span className="stat-value">{nf.format(summary.durationMs)} ms</span>
          <span className="stat-label">Procesado en tu navegador</span>
        </div>
      </div>

      <div className="card">
        <h3>Resumen de cambios</h3>
        {summary.audit.length === 0 ? (
          <p className="muted">No se seleccionó ninguna corrección: los datos se conservan tal cual.</p>
        ) : (
          <div className="table-scroll compact">
            <table className="audit">
              <thead>
                <tr>
                  <th>Operación</th>
                  <th>Estado</th>
                  <th>Detalle</th>
                  <th className="num">Filas</th>
                  <th className="num">Celdas</th>
                </tr>
              </thead>
              <tbody>
                {summary.audit.map((a, i) => (
                  <tr key={i}>
                    <td>{a.operation}</td>
                    <td>
                      <span className={`status ${a.status}`}>{STATUS_LABELS[a.status]}</span>
                    </td>
                    <td>
                      {a.detail}
                      {a.failures ? (
                        <div className="warn-text small">
                          {nf.format(a.failures)} sin convertir (se dejaron igual), p. ej.: {a.failureExamples?.map((f) => `“${f}”`).join(', ')}
                        </div>
                      ) : null}
                    </td>
                    <td className="num">{nf.format(a.rowsAffected)}</td>
                    <td className="num">{nf.format(a.cellsChanged)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="card">
        <div className="tabs" role="tablist">
          <button role="tab" aria-selected={view === 'clean'} className={view === 'clean' ? 'on' : ''} onClick={() => setView('clean')}>
            Después
          </button>
          <button role="tab" aria-selected={view === 'original'} className={view === 'original' ? 'on' : ''} onClick={() => setView('original')}>
            Antes
          </button>
          {view === 'clean' && <span className="legend-chip">Celdas cambiadas resaltadas</span>}
        </div>
        <DataTable engine={engine} which={view} version={version} onError={onError} />
      </div>

      <div className="action-bar">
        <button className="ghost" onClick={onBack}>
          ← Ajustar correcciones
        </button>
        <span className="action-buttons">
          <button className="secondary" onClick={() => onDownload('csv')} disabled={downloading}>
            Descargar CSV
          </button>
          <button className="primary" onClick={() => onDownload('xlsx')} disabled={downloading}>
            {downloading ? 'Generando…' : 'Descargar Excel'}
          </button>
        </span>
      </div>
    </section>
  )
}
