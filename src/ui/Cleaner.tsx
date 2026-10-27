import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { CleanSummary, OpenResult } from '../engine/session'
import type { Limits, QualityReport } from '../engine/types'
import { EngineCallError, EngineClient } from '../worker/client'
import { DataTable } from './DataTable'
import { ReportView } from './ReportView'
import { ResultView } from './ResultView'
import { bytes, nf, plural } from './format'
import { saveGenerated } from './save'
import type { Selection } from './selection'
import { EMPTY_SELECTION, toOptions } from './selection'

type Stage = 'upload' | 'sheet' | 'report' | 'result'

const STEPS: { id: Stage; label: string }[] = [
  { id: 'upload', label: 'Cargar' },
  { id: 'sheet', label: 'Hoja' },
  { id: 'report', label: 'Revisar' },
  { id: 'result', label: 'Descargar' },
]

interface Props {
  limits: Limits
  /** Si los límites del plan gratuito bloquean un archivo, se ofrece pasar a Pro. */
  canUpgrade: boolean
}

const LIMIT_CODES = new Set(['too-large', 'limit'])

export function Cleaner({ limits, canUpgrade }: Props) {
  const engine = useMemo(() => new EngineClient(), [])
  const [stage, setStage] = useState<Stage>('upload')
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<{ message: string; upgrade: boolean } | null>(null)
  const [file, setFile] = useState<OpenResult | null>(null)
  const [sheet, setSheet] = useState(0)
  const [hasHeader, setHasHeader] = useState(true)
  const [report, setReport] = useState<QualityReport | null>(null)
  const [selection, setSelection] = useState<Selection>(EMPTY_SELECTION)
  const [summary, setSummary] = useState<CleanSummary | null>(null)
  const [version, setVersion] = useState(0)

  const fail = useCallback((e: unknown) => {
    if (e instanceof EngineCallError) setError({ message: e.message, upgrade: canUpgrade && LIMIT_CODES.has(e.code) })
    else {
      setError({ message: 'Algo salió mal. Inténtalo de nuevo.', upgrade: false })
      console.error(e)
    }
  }, [canUpgrade])

  const run = async <T,>(label: string, fn: () => Promise<T>): Promise<T | undefined> => {
    setBusy(label)
    setError(null)
    try {
      return await fn()
    } catch (e) {
      fail(e)
      return undefined
    } finally {
      setBusy(null)
    }
  }

  const analyze = async (sheetIndex: number, header: boolean) => {
    const r = await run('Analizando la calidad de los datos…', () =>
      engine.call('selectSheet', { sheet: sheetIndex, hasHeader: header }),
    )
    if (!r) return
    setReport(r)
    setSelection(EMPTY_SELECTION)
    setSummary(null)
    setVersion((v) => v + 1)
    setStage('report')
  }

  const openFile = async (f: File) => {
    // El archivo se lee aquí y se transfiere al worker sin copiarlo; nunca se sube a ningún servidor.
    const opened = await run(`Leyendo ${f.name}…`, async () => {
      const buffer = await f.arrayBuffer()
      return engine.call('open', { buffer, name: f.name, limits }, [buffer])
    })
    if (!opened) return
    setFile(opened)
    setReport(null)
    setSummary(null)
    // Preselecciona la hoja con más filas: suele ser la de datos.
    const biggest = opened.sheets.reduce((best, s, i) => (s.rowCount > opened.sheets[best].rowCount ? i : best), 0)
    setSheet(biggest)
    if (opened.sheets.length > 1) setStage('sheet')
    else await analyze(0, hasHeader)
  }

  const apply = async () => {
    const s = await run('Aplicando correcciones…', () => engine.call('clean', { options: toOptions(selection) }))
    if (!s) return
    setSummary(s)
    setVersion((v) => v + 1)
    setStage('result')
    window.scrollTo({ top: 0 })
  }

  const download = async (format: 'csv' | 'xlsx') => {
    const base = (file?.name ?? 'datos').replace(/\.[^.]+$/, '')
    const mime =
      format === 'csv' ? 'text/csv;charset=utf-8' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    await run('Generando archivo…', () =>
      saveGenerated(`${base}_limpio.${format}`, mime, format, () =>
        engine.call('export', { format, includeAudit: true }),
      ),
    )
  }

  const restart = () => {
    void engine.call('reset', {})
    setFile(null)
    setReport(null)
    setSummary(null)
    setError(null)
    setStage('upload')
  }

  const stepIndex = STEPS.findIndex((s) => s.id === stage)

  return (
    <>
      <main>
        <ol className="steps" aria-label="Pasos">
          {STEPS.map((s, i) => (
            <li key={s.id} className={i === stepIndex ? 'current' : i < stepIndex ? 'done' : ''} aria-current={i === stepIndex ? 'step' : undefined}>
              <span className="step-num">{i + 1}</span>
              {s.label}
            </li>
          ))}
        </ol>

        {error && (
          <div className="alert" role="alert">
            <span>
              {error.message}
              {error.upgrade && (
                <>
                  {' '}
                  <a href="#/precios">Con el plan Pro puedes procesar archivos más grandes.</a>
                </>
              )}
            </span>
            <button className="ghost" onClick={() => setError(null)} aria-label="Cerrar aviso">
              ✕
            </button>
          </div>
        )}

        {file && stage !== 'upload' && (
          <div className="file-bar">
            <span>
              <strong>{file.name}</strong> · {bytes(file.size)}
              {file.kind === 'csv' && file.encoding && <> · {file.encoding.toUpperCase()} · separador “{file.delimiter === '\t' ? 'tab' : file.delimiter}”</>}
              {file.kind === 'xlsx' && stage !== 'sheet' && <> · hoja “{file.sheets[sheet]?.name}”</>}
            </span>
            <button className="ghost" onClick={restart}>
              Cargar otro archivo
            </button>
          </div>
        )}

        {stage === 'upload' && <Dropzone onFile={openFile} disabled={!!busy} limits={limits} />}

        {stage === 'sheet' && file && (
          <section className="card" aria-labelledby="sheet-title">
            <h2 id="sheet-title">Elige la hoja</h2>
            <div className="sheet-list" role="radiogroup">
              {file.sheets.map((s, i) => (
                <label key={i} className={`sheet ${sheet === i ? 'on' : ''}`}>
                  <input type="radio" name="sheet" checked={sheet === i} onChange={() => setSheet(i)} />
                  <span className="sheet-name">{s.name}</span>
                  <span className="muted small">
                    {s.rowCount ? `${plural(s.rowCount, 'fila', 'filas')} · ${plural(s.columnCount, 'columna', 'columnas')}` : 'vacía'}
                  </span>
                </label>
              ))}
            </div>
            <HeaderToggle value={hasHeader} onChange={setHasHeader} />
            <div className="actions">
              <button className="primary" onClick={() => analyze(sheet, hasHeader)} disabled={!!busy}>
                Analizar hoja
              </button>
            </div>
          </section>
        )}

        {stage === 'report' && report && (
          <>
            <div className="card">
              <div className="card-head">
                <h2>Vista previa</h2>
                <HeaderToggle
                  value={hasHeader}
                  onChange={(v) => {
                    setHasHeader(v)
                    void analyze(sheet, v)
                  }}
                />
              </div>
              <DataTable engine={engine} which="original" version={version} onError={fail} />
            </div>
            <ReportView engine={engine} report={report} selection={selection} onChange={setSelection} onApply={apply} busy={!!busy} />
          </>
        )}

        {stage === 'result' && summary && (
          <ResultView
            engine={engine}
            summary={summary}
            version={version}
            onBack={() => setStage('report')}
            onDownload={download}
            downloading={!!busy}
            onError={fail}
          />
        )}
      </main>

      {busy && (
        <div className="busy" role="status" aria-live="polite">
          <span className="spinner" aria-hidden="true" />
          {busy}
        </div>
      )}
    </>
  )
}

function HeaderToggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="check">
      <input type="checkbox" checked={value} onChange={(e) => onChange(e.target.checked)} />
      <span>La primera fila contiene los encabezados</span>
    </label>
  )
}

function Dropzone({ onFile, disabled, limits }: { onFile: (f: File) => void; disabled: boolean; limits: Limits }) {
  const input = useRef<HTMLInputElement>(null)
  const [over, setOver] = useState(false)

  // También acepta archivos pegados con Ctrl+V.
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const f = e.clipboardData?.files?.[0]
      if (f && !disabled) onFile(f)
    }
    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
  }, [onFile, disabled])

  return (
    <section className="hero">
      <h1>Limpia tus archivos de Excel y CSV en minutos</h1>
      <p className="muted">
        Sube tu archivo, revisa los problemas detectados, decide qué corregir y descarga tus datos limpios con un resumen de
        los cambios.
      </p>
      <div
        className={`dropzone ${over ? 'over' : ''}`}
        role="button"
        tabIndex={0}
        aria-disabled={disabled}
        onClick={() => !disabled && input.current?.click()}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && !disabled && input.current?.click()}
        onDragOver={(e) => {
          e.preventDefault()
          setOver(true)
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault()
          setOver(false)
          const f = e.dataTransfer.files[0]
          if (f && !disabled) onFile(f)
        }}
      >
        <span className="drop-icon" aria-hidden="true">
          ⬆
        </span>
        <strong>Arrastra tu archivo aquí o haz clic para elegirlo</strong>
        <span className="muted small">
          .xlsx o .csv · hasta {bytes(limits.maxBytes)} · {nf.format(limits.maxRows)} filas
        </span>
        <input
          ref={input}
          type="file"
          accept=".xlsx,.csv,.tsv,.txt,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0]
            e.target.value = ''
            if (f) onFile(f)
          }}
        />
      </div>
      <ul className="features">
        <li>Detecta vacíos, duplicados, espacios sobrantes, texto inconsistente, números y fechas mal escritos</li>
        <li>Tú eliges qué corregir; nada se cambia sin tu decisión</li>
        <li>El archivo original nunca se modifica</li>
      </ul>
    </section>
  )
}
