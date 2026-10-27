import { duplicateFlags } from './profile'
import type { AuditEntry, CaseMode, Cell, CleanOptions, CleanResult, DateOrder, Table } from './types'
import { caseKey, isEmpty, parseDateText, parseNumericText, toTitleCase } from './values'

const MAX_FAILURE_EXAMPLES = 5

/**
 * Aplica sólo las correcciones seleccionadas, sobre una copia de la tabla (RNF-03).
 * Cada operación deja una entrada en el registro de auditoría, también si se omite.
 */
export function cleanTable(original: Table, options: CleanOptions): CleanResult {
  const t0 = now()
  const startedAt = new Date().toISOString()
  let rows: Cell[][] = original.rows.map((r) => r.slice())
  let sourceRows = rows.map((_, i) => i)
  let columns = original.columns.slice()
  let sourceColumns = columns.map((_, i) => i)
  const audit: AuditEntry[] = []
  const colName = (i: number) => original.columns[i] ?? `#${i + 1}`
  const names = (cols: number[]) => cols.map(colName).join(', ')

  const mapCells = (
    operation: string,
    cols: number[] | undefined,
    fn: (c: Cell, col: number) => Cell | typeof FAIL,
  ) => {
    if (!cols?.length) return
    let changed = 0
    let failures = 0
    const failureExamples: string[] = []
    const touchedRows = new Set<number>()
    for (const col of cols) {
      for (let r = 0; r < rows.length; r++) {
        const before = rows[r][col] ?? null
        const after = fn(before, col)
        if (after === FAIL) {
          failures++
          if (failureExamples.length < MAX_FAILURE_EXAMPLES) failureExamples.push(String(before))
          continue
        }
        if (!sameCell(before, after)) {
          rows[r][col] = after
          changed++
          touchedRows.add(r)
        }
      }
    }
    audit.push({
      operation,
      status: changed ? 'applied' : 'skipped',
      detail: changed ? `Columnas: ${names(cols)}` : `Sin cambios en: ${names(cols)}`,
      rowsAffected: touchedRows.size,
      cellsChanged: changed,
      ...(failures ? { failures, failureExamples } : {}),
    })
  }

  mapCells('Espacios en blanco → celda vacía', options.whitespaceToEmpty, (c) =>
    typeof c === 'string' && c.trim() === '' ? null : c,
  )
  mapCells('Recortar espacios al inicio y al final', options.trimWhitespace, (c) =>
    typeof c === 'string' ? c.trim() : c,
  )
  mapCells('Reducir espacios repetidos', options.collapseSpaces, (c) =>
    typeof c === 'string' ? c.replace(/\s{2,}/g, ' ') : c,
  )

  for (const { column, mode } of options.normalizeCase ?? []) {
    const fn = caseFunction(rows, column, mode)
    mapCells(`Normalizar texto (${CASE_LABELS[mode]})`, [column], (c) => (typeof c === 'string' ? fn(c) : c))
  }

  mapCells('Convertir texto a número', options.toNumber, (c) => {
    if (typeof c !== 'string' || c.trim() === '') return c
    const n = parseNumericText(c)
    return n === null ? FAIL : n
  })

  for (const { column, order } of options.toDate ?? []) {
    mapCells(`Convertir texto a fecha (${ORDER_LABELS[order]})`, [column], (c) => {
      if (typeof c !== 'string' || c.trim() === '') return c
      return parseDateText(c, order) ?? FAIL
    })
  }

  const filterRows = (operation: string, detail: string, keep: (row: Cell[], i: number) => boolean) => {
    const nextRows: Cell[][] = []
    const nextSource: number[] = []
    rows.forEach((row, i) => {
      if (keep(row, i)) {
        nextRows.push(row)
        nextSource.push(sourceRows[i])
      }
    })
    const removed = rows.length - nextRows.length
    audit.push({ operation, status: removed ? 'applied' : 'skipped', detail, rowsAffected: removed, cellsChanged: 0 })
    rows = nextRows
    sourceRows = nextSource
  }

  if (options.dropRowsWithEmpty?.length) {
    const cols = options.dropRowsWithEmpty
    filterRows('Eliminar filas con valores vacíos', `Columnas requeridas: ${names(cols)}`, (row) =>
      cols.every((c) => !isEmpty(row[c] ?? null)),
    )
  }
  if (options.removeEmptyRows) {
    filterRows('Eliminar filas vacías', 'Filas sin ningún valor', (row) => !row.every(isEmpty))
  }
  if (options.removeDuplicates) {
    const key = options.removeDuplicates.key
    const dup = duplicateFlags(rows, key)
    filterRows(
      'Eliminar filas duplicadas',
      key.length ? `Criterio: ${names(key)} (se conserva la primera)` : 'Criterio: fila completa (se conserva la primera)',
      (_, i) => !dup[i],
    )
  }

  if (options.removeEmptyColumns) {
    const keep = columns.map((_, c) => rows.some((r) => !isEmpty(r[c] ?? null)))
    const removed = columns.filter((_, c) => !keep[c])
    if (removed.length) {
      rows = rows.map((r) => r.filter((_, c) => keep[c]))
      columns = columns.filter((_, c) => keep[c])
      sourceColumns = sourceColumns.filter((_, c) => keep[c])
    }
    audit.push({
      operation: 'Eliminar columnas vacías',
      status: removed.length ? 'applied' : 'skipped',
      detail: removed.length ? `Columnas: ${removed.join(', ')}` : 'No había columnas vacías',
      rowsAffected: 0,
      cellsChanged: 0,
    })
  }

  return {
    table: { columns, rows },
    sourceRows,
    sourceColumns,
    audit,
    startedAt,
    durationMs: Math.round(now() - t0),
  }
}

const FAIL = Symbol('fail')

const CASE_LABELS: Record<CaseMode, string> = {
  lower: 'minúsculas',
  upper: 'MAYÚSCULAS',
  title: 'Tipo Título',
  mostFrequent: 'variante más frecuente',
}

const ORDER_LABELS: Record<DateOrder, string> = { DMY: 'día/mes/año', MDY: 'mes/día/año', YMD: 'año-mes-día' }

function caseFunction(rows: Cell[][], column: number, mode: CaseMode): (s: string) => string {
  if (mode === 'lower') return (s) => s.toLocaleLowerCase('es')
  if (mode === 'upper') return (s) => s.toLocaleUpperCase('es')
  if (mode === 'title') return toTitleCase
  // Variante más frecuente: unifica valores que sólo difieren en mayúsculas, acentos o espacios.
  const counts = new Map<string, Map<string, number>>()
  for (const row of rows) {
    const c = row[column]
    if (typeof c !== 'string' || c.trim() === '') continue
    const key = caseKey(c)
    const group = counts.get(key) ?? new Map<string, number>()
    group.set(c, (group.get(c) ?? 0) + 1)
    counts.set(key, group)
  }
  const winner = new Map<string, string>()
  for (const [key, group] of counts) {
    let best = ''
    let bestCount = -1
    for (const [value, n] of group) {
      // En caso de empate se prefiere la variante sin espacios sobrantes.
      if (n > bestCount || (n === bestCount && value === value.trim() && best !== best.trim())) {
        best = value
        bestCount = n
      }
    }
    winner.set(key, best)
  }
  return (s) => (s.trim() === '' ? s : (winner.get(caseKey(s)) ?? s))
}

function sameCell(a: Cell, b: Cell): boolean {
  if (a instanceof Date && b instanceof Date) return a.getTime() === b.getTime()
  return a === b
}

function now(): number {
  return typeof performance !== 'undefined' ? performance.now() : Date.now()
}
