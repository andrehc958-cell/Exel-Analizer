import type { CaseVariantGroup, Cell, ColumnProfile, DateOrder, QualityReport, Table, ValueKind } from './types'
import { caseKey, cellKey, inspectDateText, isEmpty, kindOf, parseNumericText } from './values'

const MAX_CASE_GROUPS = 50
const MAX_DISTINCT = 100_000
const MAX_EXAMPLES = 5

/** Sólo detecta: nunca modifica la tabla (RF-04 a RF-07). */
export function profileTable(table: Table, duplicateKey: number[] = []): QualityReport {
  const columns = table.columns.map((name, i) => profileColumn(table.rows, i, name))
  return {
    rowCount: table.rows.length,
    columnCount: table.columns.length,
    emptyRows: countEmptyRows(table.rows),
    duplicateRows: countDuplicates(table.rows, duplicateKey),
    duplicateKey,
    emptyColumns: columns.filter((c) => c.empty === table.rows.length).map((c) => c.index),
    columns,
  }
}

export function countEmptyRows(rows: Cell[][]): number {
  let n = 0
  for (const r of rows) if (r.every(isEmpty)) n++
  return n
}

/** Filas que repiten otra anterior (la primera aparición no cuenta). Ignora filas totalmente vacías. */
export function countDuplicates(rows: Cell[][], key: number[] = []): number {
  return duplicateFlags(rows, key).reduce((n, d) => n + (d ? 1 : 0), 0)
}

export function duplicateFlags(rows: Cell[][], key: number[] = []): boolean[] {
  const seen = new Set<string>()
  return rows.map((r) => {
    const cells = key.length ? key.map((k) => r[k] ?? null) : r
    if (cells.every(isEmpty)) return false
    const k = rowKey(cells)
    if (seen.has(k)) return true
    seen.add(k)
    return false
  })
}

export function rowKey(cells: Cell[]): string {
  let k = ''
  for (const c of cells) k += cellKey(c) + '\u0001'
  return k
}

function profileColumn(rows: Cell[][], index: number, name: string): ColumnProfile {
  const counts: Record<ValueKind, number> = { empty: 0, number: 0, boolean: 0, date: 0, text: 0 }
  let whitespaceOnly = 0
  let untrimmed = 0
  let repeatedSpaces = 0
  let numericText = 0
  let dateText = 0
  let dmyEvidence = 0
  let mdyEvidence = 0
  let ymd = 0
  const distinct = new Set<string>()
  const variants = new Map<string, Map<string, number>>()
  const numbers: number[] = []
  const examples: Cell[] = []

  for (const row of rows) {
    const c = row[index] ?? null
    const kind = kindOf(c)
    counts[kind]++
    if (distinct.size < MAX_DISTINCT) distinct.add(cellKey(c))
    if (kind !== 'empty' && examples.length < MAX_EXAMPLES && !examples.some((e) => cellKey(e) === cellKey(c))) {
      examples.push(c)
    }
    if (kind === 'number') numbers.push(c as number)
    if (kind !== 'text') continue

    const s = c as string
    const trimmed = s.trim()
    if (trimmed === '') {
      whitespaceOnly++
      continue
    }
    if (trimmed !== s) untrimmed++
    if (/\s{2,}/.test(trimmed)) repeatedSpaces++
    if (parseNumericText(s) !== null) numericText++
    const dt = inspectDateText(s)
    if (dt) {
      dateText++
      if (dt.orders.includes('YMD')) ymd++
      else if (dt.orders.length === 1) {
        if (dt.orders[0] === 'DMY') dmyEvidence++
        else mdyEvidence++
      }
    }
    const key = caseKey(s)
    let group = variants.get(key)
    if (!group) {
      group = new Map()
      variants.set(key, group)
    }
    group.set(s, (group.get(s) ?? 0) + 1)
  }

  const caseVariants: CaseVariantGroup[] = []
  for (const group of variants.values()) {
    // Sólo cuenta como inconsistencia si difieren en mayúsculas, acentos o espacios.
    if (group.size < 2) continue
    caseVariants.push({
      variants: [...group.entries()].map(([value, count]) => ({ value, count })).sort((a, b) => b.count - a.count),
    })
    if (caseVariants.length >= MAX_CASE_GROUPS) break
  }

  let dateOrder: DateOrder | 'ambiguous' | null = null
  if (dateText > 0) {
    if (dmyEvidence && !mdyEvidence) dateOrder = 'DMY'
    else if (mdyEvidence && !dmyEvidence) dateOrder = 'MDY'
    else if (ymd === dateText) dateOrder = 'YMD'
    else dateOrder = 'ambiguous'
  }

  const { count: outliers, examples: outlierExamples } = findOutliers(numbers)
  const nonEmpty = rows.length - counts.empty
  const kind = (['number', 'date', 'boolean', 'text'] as ValueKind[]).reduce<ValueKind>(
    (best, k) => (counts[k] > counts[best] ? k : best),
    nonEmpty ? 'text' : 'empty',
  )

  return {
    index,
    name,
    kind: nonEmpty ? kind : 'empty',
    counts,
    empty: counts.empty,
    whitespaceOnly,
    untrimmed,
    repeatedSpaces,
    numericText,
    dateText,
    dateOrder,
    caseVariants,
    outliers,
    outlierExamples,
    distinct: distinct.size,
    examples,
  }
}

/** Regla de Tukey (1.5 × IQR). Sólo marca, nunca elimina. */
export function findOutliers(values: number[]): { count: number; examples: number[] } {
  if (values.length < 8) return { count: 0, examples: [] }
  const sorted = Float64Array.from(values).sort()
  const q = (p: number) => {
    const pos = (sorted.length - 1) * p
    const lo = Math.floor(pos)
    const hi = Math.ceil(pos)
    return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo)
  }
  const q1 = q(0.25)
  const q3 = q(0.75)
  const iqr = q3 - q1
  if (iqr === 0) return { count: 0, examples: [] }
  const lo = q1 - 1.5 * iqr
  const hi = q3 + 1.5 * iqr
  const out = values.filter((v) => v < lo || v > hi)
  return { count: out.length, examples: [...new Set(out)].slice(0, MAX_EXAMPLES) }
}
