import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import type { CaseMode, ColumnProfile, DateOrder, QualityReport } from '../engine/types'
import type { EngineClient } from '../worker/client'
import { displayCell, KIND_LABELS, nf, plural } from './format'
import type { Selection } from './selection'
import { countSelected, EMPTY_SELECTION, recommended, toggle } from './selection'

interface Props {
  engine: EngineClient
  report: QualityReport
  selection: Selection
  onChange: (s: Selection) => void
  onApply: () => void
  busy: boolean
}

export function ReportView({ engine, report, selection, onChange, onApply, busy }: Props) {
  const [dupCount, setDupCount] = useState(report.duplicateRows)
  const keyString = selection.duplicateKey.join(',')

  useEffect(() => {
    let alive = true
    const key = keyString ? keyString.split(',').map(Number) : []
    engine
      .call('duplicates', { key })
      .then((n) => alive && setDupCount(n))
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [engine, keyString])

  const set = (patch: Partial<Selection>) => onChange({ ...selection, ...patch })
  const totalEmpty = report.columns.reduce((n, c) => n + c.empty, 0)
  const cells = report.rowCount * report.columnCount
  const issueColumns = report.columns.filter(hasIssues)
  const okColumns = report.columns.filter((c) => !hasIssues(c))
  const selected = countSelected(selection)

  return (
    <section className="report" aria-labelledby="report-title">
      <h2 id="report-title">Informe de calidad</h2>
      <p className="muted">
        Nada se corrige automáticamente. Marca las correcciones que quieras aplicar; el archivo original no se modifica.
      </p>

      <div className="stats">
        <Stat label="Filas" value={nf.format(report.rowCount)} />
        <Stat label="Columnas" value={nf.format(report.columnCount)} />
        <Stat label="Celdas vacías" value={`${nf.format(totalEmpty)}`} hint={cells ? `${pct(totalEmpty, cells)} del total` : ''} />
        <Stat label="Duplicados" value={nf.format(report.duplicateRows)} hint="filas completas" />
      </div>

      <div className="card">
        <h3>Toda la tabla</h3>
        <Issue
          tone={dupCount ? 'warn' : 'ok'}
          title={
            dupCount
              ? `${plural(dupCount, 'fila duplicada', 'filas duplicadas')}`
              : 'Sin filas duplicadas con este criterio'
          }
        >
          <div className="field">
            <span className="field-label">Criterio de duplicado:</span>
            <div className="chips" role="group" aria-label="Columnas que definen un duplicado">
              <button
                className={`chip ${selection.duplicateKey.length === 0 ? 'on' : ''}`}
                aria-pressed={selection.duplicateKey.length === 0}
                onClick={() => set({ duplicateKey: [] })}
              >
                Fila completa
              </button>
              {report.columns.map((c) => {
                const on = selection.duplicateKey.includes(c.index)
                return (
                  <button
                    key={c.index}
                    className={`chip ${on ? 'on' : ''}`}
                    aria-pressed={on}
                    onClick={() => set({ duplicateKey: toggle(selection.duplicateKey, c.index, !on) })}
                  >
                    {c.name}
                  </button>
                )
              })}
            </div>
          </div>
          <Check
            checked={selection.removeDuplicates}
            onChange={(v) => set({ removeDuplicates: v })}
            label="Eliminar duplicados (se conserva la primera aparición)"
          />
          <p className="note">Se compara después de aplicar las demás correcciones, así que pueden aparecer más duplicados.</p>
        </Issue>

        <Issue tone={report.emptyRows ? 'warn' : 'ok'} title={report.emptyRows ? plural(report.emptyRows, 'fila vacía', 'filas vacías') : 'Sin filas vacías'}>
          {report.emptyRows > 0 && (
            <Check checked={selection.removeEmptyRows} onChange={(v) => set({ removeEmptyRows: v })} label="Eliminar filas vacías" />
          )}
        </Issue>

        <Issue
          tone={report.emptyColumns.length ? 'warn' : 'ok'}
          title={
            report.emptyColumns.length
              ? `${plural(report.emptyColumns.length, 'columna vacía', 'columnas vacías')}: ${report.emptyColumns.map((i) => report.columns[i].name).join(', ')}`
              : 'Sin columnas vacías'
          }
        >
          {report.emptyColumns.length > 0 && (
            <Check checked={selection.removeEmptyColumns} onChange={(v) => set({ removeEmptyColumns: v })} label="Eliminar columnas vacías" />
          )}
        </Issue>
      </div>

      {issueColumns.map((c) => (
        <ColumnCard key={c.index} column={c} rows={report.rowCount} selection={selection} onChange={onChange} />
      ))}

      {okColumns.length > 0 && (
        <details className="card ok-columns">
          <summary>{plural(okColumns.length, 'columna sin problemas detectados', 'columnas sin problemas detectados')}</summary>
          {okColumns.map((c) => (
            <ColumnCard key={c.index} column={c} rows={report.rowCount} selection={selection} onChange={onChange} />
          ))}
        </details>
      )}

      <div className="action-bar">
        <span className="action-count">
          {selected ? plural(selected, 'corrección seleccionada', 'correcciones seleccionadas') : 'Ninguna corrección seleccionada'}
        </span>
        <span className="action-buttons">
          <button className="ghost" onClick={() => onChange({ ...recommended(report), duplicateKey: selection.duplicateKey })}>
            Seleccionar recomendadas
          </button>
          <button className="ghost" onClick={() => onChange({ ...EMPTY_SELECTION, duplicateKey: selection.duplicateKey })} disabled={!selected}>
            Quitar selección
          </button>
          <button className="primary" onClick={onApply} disabled={busy}>
            {busy ? 'Aplicando…' : selected ? 'Aplicar y ver resultado' : 'Continuar sin cambios'}
          </button>
        </span>
      </div>
    </section>
  )
}

function ColumnCard({
  column: c,
  rows,
  selection,
  onChange,
}: {
  column: ColumnProfile
  rows: number
  selection: Selection
  onChange: (s: Selection) => void
}) {
  const set = (patch: Partial<Selection>) => onChange({ ...selection, ...patch })
  const listToggle = (key: 'whitespaceToEmpty' | 'trim' | 'collapse' | 'toNumber' | 'dropRowsWithEmpty') => ({
    checked: selection[key].includes(c.index),
    onChange: (v: boolean) => set({ [key]: toggle(selection[key], c.index, v) }),
  })
  const textual = c.counts.text > 0
  const caseMode = selection.caseMode[c.index] ?? ''
  const dateOrder = selection.toDate[c.index] ?? ''
  const mixed = c.kind === 'number' && c.counts.text > 0

  return (
    <article className="card column-card">
      <header>
        <h3>{c.name}</h3>
        <span className="badge">{KIND_LABELS[c.kind]}</span>
        <span className="muted small">
          {plural(c.distinct, 'valor distinto', 'valores distintos')}
          {c.examples.length > 0 && <> · ej.: {c.examples.slice(0, 3).map((e) => `“${displayCell(e)}”`).join(', ')}</>}
        </span>
      </header>

      {c.empty > 0 && (
        <Issue tone="info" title={`${plural(c.empty, 'celda vacía', 'celdas vacías')} (${pct(c.empty, rows)})`}>
          <p className="note">Un vacío no siempre es un error. Sólo elimina filas si esta columna es obligatoria.</p>
          <Check {...listToggle('dropRowsWithEmpty')} label="Eliminar las filas donde esta columna esté vacía" danger />
        </Issue>
      )}
      {c.whitespaceOnly > 0 && (
        <Issue tone="warn" title={`${plural(c.whitespaceOnly, 'celda contiene', 'celdas contienen')} sólo espacios`}>
          <Check {...listToggle('whitespaceToEmpty')} label="Convertirlas en celdas vacías" />
        </Issue>
      )}
      {c.untrimmed > 0 && (
        <Issue tone="warn" title={`${plural(c.untrimmed, 'valor tiene', 'valores tienen')} espacios al inicio o al final`}>
          <Check {...listToggle('trim')} label="Recortar espacios sobrantes" />
        </Issue>
      )}
      {c.repeatedSpaces > 0 && (
        <Issue tone="warn" title={`${plural(c.repeatedSpaces, 'valor tiene', 'valores tienen')} espacios repetidos dentro del texto`}>
          <Check {...listToggle('collapse')} label="Dejar un solo espacio entre palabras" />
        </Issue>
      )}
      {c.caseVariants.length > 0 && (
        <Issue
          tone="warn"
          title={`${plural(c.caseVariants.length, 'valor escrito', 'valores escritos')}${c.caseVariants.length >= 50 ? ' (o más)' : ''} de distintas formas`}
        >
          <ul className="variants">
            {c.caseVariants.slice(0, 4).map((g, i) => (
              <li key={i}>
                {g.variants.map((v, j) => (
                  <span key={j} className="variant">
                    “{v.value}” <small>×{nf.format(v.count)}</small>
                  </span>
                ))}
              </li>
            ))}
          </ul>
        </Issue>
      )}
      {textual && (c.caseVariants.length > 0 || c.kind === 'text') && (
        <div className="field inline">
          <label className="field-label" htmlFor={`case-${c.index}`}>
            Normalizar texto:
          </label>
          <select
            id={`case-${c.index}`}
            value={caseMode}
            onChange={(e) => {
              const next = { ...selection.caseMode }
              if (e.target.value) next[c.index] = e.target.value as CaseMode
              else delete next[c.index]
              set({ caseMode: next })
            }}
          >
            <option value="">No cambiar</option>
            {c.caseVariants.length > 0 && <option value="mostFrequent">Unificar a la variante más frecuente</option>}
            <option value="title">Tipo Título</option>
            <option value="lower">minúsculas</option>
            <option value="upper">MAYÚSCULAS</option>
          </select>
        </div>
      )}
      {c.numericText > 0 && (
        <Issue
          tone={mixed ? 'warn' : 'info'}
          title={`${plural(c.numericText, 'número escrito', 'números escritos')} como texto${mixed ? ' en una columna numérica' : ''}`}
        >
          <Check {...listToggle('toNumber')} label="Convertir a número (los que no se puedan convertir se dejan igual)" />
        </Issue>
      )}
      {c.dateText > 0 && (
        <Issue
          tone={c.dateOrder === 'ambiguous' ? 'warn' : 'info'}
          title={`${plural(c.dateText, 'fecha escrita', 'fechas escritas')} como texto`}
        >
          {c.dateOrder === 'ambiguous' && (
            <p className="note warn-text">
              Formato ambiguo: “03/04/2024” puede ser 3 de abril o 4 de marzo. Elige el orden; no se convertirá sin tu decisión.
            </p>
          )}
          <div className="field inline">
            <label className="field-label" htmlFor={`date-${c.index}`}>
              Convertir a fecha:
            </label>
            <select
              id={`date-${c.index}`}
              value={dateOrder}
              onChange={(e) => {
                const next = { ...selection.toDate }
                if (e.target.value) next[c.index] = e.target.value as DateOrder
                else delete next[c.index]
                set({ toDate: next })
              }}
            >
              <option value="">No convertir</option>
              <option value="DMY">Día/Mes/Año{c.dateOrder === 'DMY' ? ' (detectado)' : ''}</option>
              <option value="MDY">Mes/Día/Año{c.dateOrder === 'MDY' ? ' (detectado)' : ''}</option>
              {c.dateOrder === 'YMD' && <option value="YMD">Año-Mes-Día (detectado)</option>}
            </select>
          </div>
        </Issue>
      )}
      {c.outliers > 0 && (
        <Issue tone="info" title={`${plural(c.outliers, 'posible valor atípico', 'posibles valores atípicos')}`}>
          <p className="note">
            Ej.: {c.outlierExamples.map((n) => nf.format(n)).join(', ')}. Sólo se señalan para que los revises; no se eliminan.
          </p>
        </Issue>
      )}
    </article>
  )
}

function hasIssues(c: ColumnProfile): boolean {
  return (
    c.whitespaceOnly + c.untrimmed + c.repeatedSpaces + c.caseVariants.length + c.numericText + c.dateText + c.outliers > 0 ||
    (c.kind !== 'empty' && c.empty > 0)
  )
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="stat">
      <span className="stat-value">{value}</span>
      <span className="stat-label">{label}</span>
      {hint && <span className="stat-hint">{hint}</span>}
    </div>
  )
}

function Issue({ tone, title, children }: { tone: 'ok' | 'warn' | 'info'; title: string; children?: ReactNode }) {
  return (
    <div className={`issue ${tone}`}>
      <div className="issue-title">
        <span className="dot" aria-hidden="true" />
        {title}
      </div>
      {children && <div className="issue-body">{children}</div>}
    </div>
  )
}

function Check({ checked, onChange, label, danger }: { checked: boolean; onChange: (v: boolean) => void; label: string; danger?: boolean }) {
  return (
    <label className={`check ${danger ? 'danger' : ''}`}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>{label}</span>
    </label>
  )
}

function pct(n: number, total: number): string {
  if (!total) return '0%'
  const p = (n / total) * 100
  return `${p < 1 && p > 0 ? p.toFixed(1) : Math.round(p)}%`
}
