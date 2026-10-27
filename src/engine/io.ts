import Papa from 'papaparse'
import type { Workbook, Worksheet } from 'exceljs'
import type { AuditEntry, Cell, Limits, SheetInfo, Table } from './types'
import { EngineError, STATUS_LABELS } from './types'
import { cellToString, formatDate, isCanonicalNumber, isEmpty } from './values'

export const DEFAULT_LIMITS: Limits = {
  maxBytes: 50 * 1024 * 1024,
  maxRows: 500_000,
  maxColumns: 500,
  maxCells: 10_000_000,
}

export type FileKind = 'csv' | 'xlsx'

/** Valida el tipo real por su contenido, no sólo por la extensión (RF-02). */
export function sniffFile(bytes: Uint8Array, name: string, limits: Limits = DEFAULT_LIMITS): FileKind {
  if (bytes.byteLength === 0) throw new EngineError('empty', 'El archivo está vacío.')
  if (bytes.byteLength > limits.maxBytes) {
    throw new EngineError(
      'too-large',
      `El archivo pesa ${mb(bytes.byteLength)} y el máximo permitido es ${mb(limits.maxBytes)}.`,
    )
  }
  const ext = name.toLowerCase().split('.').pop() ?? ''
  const isZip = bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04
  const isOle = bytes[0] === 0xd0 && bytes[1] === 0xcf && bytes[2] === 0x11 && bytes[3] === 0xe0
  if (isOle || ext === 'xls') {
    throw new EngineError('xls', 'El formato .xls antiguo no está soportado. Ábrelo en Excel y guárdalo como .xlsx.')
  }
  if (ext === 'xlsm' || ext === 'xlsb') {
    throw new EngineError('macro', 'Los libros con macros o binarios (.xlsm, .xlsb) no están soportados. Guárdalo como .xlsx.')
  }
  if (isZip) {
    if (ext !== 'xlsx') throw new EngineError('type', 'El archivo es un ZIP pero no tiene extensión .xlsx.')
    return 'xlsx'
  }
  if (ext === 'xlsx') throw new EngineError('corrupt', 'El archivo dice ser .xlsx pero su contenido no es un libro de Excel válido.')
  if (ext !== 'csv' && ext !== 'txt' && ext !== 'tsv') {
    throw new EngineError('type', 'Formato no soportado. Usa archivos .csv o .xlsx.')
  }
  const head = bytes.subarray(0, 8192)
  if (head.includes(0)) throw new EngineError('binary', 'El archivo parece binario, no un CSV de texto.')
  return 'csv'
}

// --- CSV --------------------------------------------------------------------------

export interface CsvParse {
  matrix: Cell[][]
  encoding: string
  delimiter: string
}

export function readCsv(bytes: Uint8Array): CsvParse {
  let text: string
  let encoding = 'utf-8'
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  } catch {
    // Excel en Windows suele guardar CSV en Windows-1252 (acentos y ñ).
    encoding = 'windows-1252'
    text = new TextDecoder('windows-1252').decode(bytes)
  }
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1)
  const parsed = Papa.parse<string[]>(text, { skipEmptyLines: false, delimiter: '' })
  const fatal = parsed.errors.find((e) => e.type === 'Quotes')
  if (fatal) {
    throw new EngineError('csv', `El CSV tiene comillas sin cerrar cerca de la fila ${(fatal.row ?? 0) + 1}.`)
  }
  const matrix: Cell[][] = parsed.data.map((row) =>
    row.map((v) => (v === '' ? null : isCanonicalNumber(v) ? Number(v) : v)),
  )
  return { matrix, encoding, delimiter: parsed.meta.delimiter }
}

// --- XLSX -------------------------------------------------------------------------

async function loadExcelJS() {
  const mod = await import('exceljs')
  return (mod as unknown as { default?: typeof import('exceljs') }).default ?? mod
}

export async function readWorkbook(bytes: Uint8Array): Promise<Workbook> {
  const ExcelJS = await loadExcelJS()
  const wb = new ExcelJS.Workbook()
  try {
    await wb.xlsx.load(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer)
  } catch {
    throw new EngineError('corrupt', 'No se pudo leer el libro de Excel. Puede estar dañado o protegido con contraseña.')
  }
  if (!wb.worksheets.length) throw new EngineError('empty', 'El libro no contiene hojas.')
  return wb
}

export function listSheets(wb: Workbook): SheetInfo[] {
  return wb.worksheets.map((ws) => ({
    name: ws.name,
    rowCount: ws.actualRowCount,
    columnCount: ws.actualColumnCount,
  }))
}

export function sheetMatrix(ws: Worksheet): Cell[][] {
  const matrix: Cell[][] = []
  const colCount = ws.columnCount
  ws.eachRow({ includeEmpty: true }, (row, rowNumber) => {
    const out: Cell[] = new Array(colCount).fill(null)
    row.eachCell({ includeEmpty: false }, (cell, col) => {
      if (col <= colCount) out[col - 1] = toCell(cell.value)
    })
    matrix[rowNumber - 1] = out
  })
  for (let i = 0; i < matrix.length; i++) if (!matrix[i]) matrix[i] = new Array(colCount).fill(null)
  return matrix
}

/** Convierte un valor de ExcelJS a celda simple. Las fórmulas nunca se evalúan: se usa el resultado guardado. */
export function toCell(v: unknown): Cell {
  if (v === null || v === undefined) return null
  if (typeof v === 'string') return v === '' ? null : v
  if (typeof v === 'number') return Number.isFinite(v) ? v : null
  if (typeof v === 'boolean') return v
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v
  if (typeof v === 'object') {
    const o = v as Record<string, unknown>
    if ('formula' in o || 'sharedFormula' in o) return toCell(o.result)
    if (Array.isArray(o.richText)) return (o.richText as { text: string }[]).map((t) => t.text).join('') || null
    if ('hyperlink' in o || 'text' in o) return toCell(o.text)
    if ('error' in o) return String(o.error)
  }
  return String(v)
}

// --- Matriz → tabla ---------------------------------------------------------------

export function matrixToTable(matrix: Cell[][], hasHeader: boolean, limits: Limits = DEFAULT_LIMITS): Table {
  // Quita filas y columnas vacías al final: son restos de formato, no datos.
  let end = matrix.length
  while (end > 0 && matrix[end - 1].every(isEmpty)) end--
  const rows = matrix.slice(0, end)
  let width = 0
  for (const r of rows) {
    for (let c = r.length - 1; c >= width; c--) {
      if (!isEmpty(r[c] ?? null)) {
        width = c + 1
        break
      }
    }
  }
  if (!rows.length || !width) throw new EngineError('empty', 'La hoja seleccionada no tiene datos.')
  const dataRows = hasHeader ? rows.length - 1 : rows.length
  if (width > limits.maxColumns) {
    throw new EngineError('limit', `La hoja tiene ${width} columnas; el máximo es ${limits.maxColumns}.`)
  }
  if (dataRows > limits.maxRows) {
    throw new EngineError('limit', `La hoja tiene ${fmt(dataRows)} filas; el máximo es ${fmt(limits.maxRows)}.`)
  }
  if (dataRows * width > limits.maxCells) {
    throw new EngineError('limit', `La hoja tiene ${fmt(dataRows * width)} celdas; el máximo es ${fmt(limits.maxCells)}.`)
  }

  const normalize = (r: Cell[]) => {
    const out = r.slice(0, width)
    while (out.length < width) out.push(null)
    for (let i = 0; i < width; i++) if (out[i] === undefined) out[i] = null
    return out
  }
  const header = hasHeader ? normalize(rows[0]) : []
  const used = new Map<string, number>()
  const columns = Array.from({ length: width }, (_, i) => {
    const base = hasHeader ? cellToString(header[i]).trim() || `Columna ${i + 1}` : `Columna ${i + 1}`
    const n = (used.get(base) ?? 0) + 1
    used.set(base, n)
    return n === 1 ? base : `${base} (${n})`
  })
  return { columns, rows: (hasHeader ? rows.slice(1) : rows).map(normalize) }
}

// --- Exportación ------------------------------------------------------------------

const FORMULA_START = /^[=+\-@\t\r]/

/** CSV en UTF-8 con BOM (Excel lo abre con acentos correctos) y protección contra inyección de fórmulas. */
export function writeCsv(table: Table, delimiter = ','): string {
  const quote = (s: string) =>
    s.includes(delimiter) || s.includes('"') || s.includes('\n') || s.includes('\r') ? `"${s.replace(/"/g, '""')}"` : s
  const field = (c: Cell) => {
    if (c === null) return ''
    if (typeof c === 'string') return quote(FORMULA_START.test(c) ? `'${c}` : c)
    return quote(cellToString(c))
  }
  const lines = [table.columns.map((h) => field(h)).join(delimiter)]
  for (const r of table.rows) lines.push(r.map(field).join(delimiter))
  return '﻿' + lines.join('\r\n') + '\r\n'
}

export async function writeXlsx(table: Table, audit?: AuditEntry[]): Promise<ArrayBuffer> {
  const ExcelJS = await loadExcelJS()
  const wb = new ExcelJS.Workbook()
  wb.creator = 'DataClean'
  const ws = wb.addWorksheet('Datos', { views: [{ state: 'frozen', ySplit: 1 }] })
  ws.addRow(table.columns).font = { bold: true }
  // Los textos se escriben como texto: ExcelJS no los interpreta como fórmulas.
  for (const r of table.rows) ws.addRow(r.map((c) => (c === null ? null : c)))
  table.columns.forEach((_, i) => {
    const col = ws.getColumn(i + 1)
    let hasDate = false
    let hasTime = false
    for (const r of table.rows) {
      const c = r[i]
      if (c instanceof Date) {
        hasDate = true
        if (formatDate(c).length > 10) hasTime = true
      }
    }
    if (hasDate) col.numFmt = hasTime ? 'yyyy-mm-dd hh:mm:ss' : 'yyyy-mm-dd'
    col.width = Math.min(50, Math.max(10, table.columns[i].length + 2))
  })
  if (audit?.length) {
    const log = wb.addWorksheet('Registro de cambios')
    log.addRow(['Operación', 'Estado', 'Detalle', 'Filas afectadas', 'Celdas cambiadas', 'Valores no convertidos']).font = {
      bold: true,
    }
    for (const a of audit) {
      log.addRow([a.operation, STATUS_LABELS[a.status], a.detail, a.rowsAffected, a.cellsChanged, a.failures ?? 0])
    }
    log.columns.forEach((c, i) => (c.width = [40, 12, 50, 16, 16, 22][i]))
  }
  // En el navegador ExcelJS devuelve un Uint8Array; se copia a un ArrayBuffer propio para poder transferirlo.
  const out = (await wb.xlsx.writeBuffer()) as ArrayBuffer | Uint8Array
  return out instanceof ArrayBuffer ? out : (out.slice().buffer as ArrayBuffer)
}

function mb(n: number) {
  return `${(n / 1024 / 1024).toFixed(1)} MB`
}

function fmt(n: number) {
  return n.toLocaleString('es-MX')
}
