import type { Workbook } from 'exceljs'
import { cleanTable } from './clean'
import { listSheets, matrixToTable, readCsv, readWorkbook, sheetMatrix, sniffFile, writeCsv, writeXlsx } from './io'
import type { FileKind } from './io'
import { DEFAULT_LIMITS } from './limits'
import { countDuplicates, profileTable } from './profile'
import type { Cell, CleanOptions, CleanResult, Limits, QualityReport, SheetInfo, Table } from './types'
import { EngineError } from './types'

export interface OpenResult {
  kind: FileKind
  name: string
  size: number
  sheets: SheetInfo[]
  encoding?: string
  delimiter?: string
}

export interface Page {
  columns: string[]
  rows: Cell[][]
  /** Número de fila en el archivo original (1 = primera fila de datos). */
  rowNumbers: number[]
  total: number
  /** Celdas cuyo valor cambió respecto al original (sólo en la vista limpia). */
  changed?: boolean[][]
}

export interface CleanSummary {
  audit: CleanResult['audit']
  rowsBefore: number
  rowsAfter: number
  columnsBefore: number
  columnsAfter: number
  durationMs: number
  report: QualityReport
}

/**
 * Estado de una sesión de limpieza. Vive dentro del Web Worker: los datos completos
 * nunca pasan al hilo de la interfaz, sólo páginas pequeñas y resúmenes.
 */
export class CleaningSession {
  private kind: FileKind | null = null
  private name = ''
  private workbook: Workbook | null = null
  private csvMatrix: Cell[][] | null = null
  private original: Table | null = null
  private result: CleanResult | null = null
  private limits: Limits

  constructor(limits: Limits = DEFAULT_LIMITS) {
    this.limits = limits
  }

  /** Los límites dependen del plan del usuario y se fijan al abrir cada archivo. */
  async open(bytes: Uint8Array, name: string, limits: Limits = this.limits): Promise<OpenResult> {
    this.reset()
    this.limits = limits
    const kind = sniffFile(bytes, name, this.limits)
    this.kind = kind
    this.name = name
    if (kind === 'csv') {
      const parsed = readCsv(bytes)
      this.csvMatrix = parsed.matrix
      const width = parsed.matrix.reduce((m, r) => Math.max(m, r.length), 0)
      return {
        kind,
        name,
        size: bytes.byteLength,
        sheets: [{ name: 'CSV', rowCount: parsed.matrix.length, columnCount: width }],
        encoding: parsed.encoding,
        delimiter: parsed.delimiter,
      }
    }
    this.workbook = await readWorkbook(bytes)
    return { kind, name, size: bytes.byteLength, sheets: listSheets(this.workbook) }
  }

  selectSheet(sheet: number, hasHeader: boolean): QualityReport {
    let matrix: Cell[][]
    if (this.kind === 'csv' && this.csvMatrix) matrix = this.csvMatrix
    else if (this.workbook) {
      const ws = this.workbook.worksheets[sheet]
      if (!ws) throw new EngineError('sheet', 'La hoja seleccionada no existe.')
      matrix = sheetMatrix(ws)
    } else throw new EngineError('state', 'Primero carga un archivo.')
    this.original = matrixToTable(matrix, hasHeader, this.limits)
    this.result = null
    return profileTable(this.original)
  }

  duplicates(key: number[]): number {
    return countDuplicates(this.requireOriginal().rows, key)
  }

  clean(options: CleanOptions): CleanSummary {
    const original = this.requireOriginal()
    this.result = cleanTable(original, options)
    const t = this.result.table
    return {
      audit: this.result.audit,
      rowsBefore: original.rows.length,
      rowsAfter: t.rows.length,
      columnsBefore: original.columns.length,
      columnsAfter: t.columns.length,
      durationMs: this.result.durationMs,
      report: profileTable(t),
    }
  }

  page(which: 'original' | 'clean', offset: number, limit: number): Page {
    const original = this.requireOriginal()
    if (which === 'original' || !this.result) {
      const rows = original.rows.slice(offset, offset + limit)
      return {
        columns: original.columns,
        rows,
        rowNumbers: rows.map((_, i) => offset + i + 1),
        total: original.rows.length,
      }
    }
    const { table, sourceRows, sourceColumns } = this.result
    const rows = table.rows.slice(offset, offset + limit)
    const changed = rows.map((row, i) => {
      const src = original.rows[sourceRows[offset + i]]
      return row.map((c, j) => !sameCell(c, src[sourceColumns[j]] ?? null))
    })
    return {
      columns: table.columns,
      rows,
      rowNumbers: rows.map((_, i) => sourceRows[offset + i] + 1),
      total: table.rows.length,
      changed,
    }
  }

  async export(format: 'csv' | 'xlsx', includeAudit = true): Promise<{ data: ArrayBuffer; mime: string; filename: string }> {
    const table = this.result?.table ?? this.requireOriginal()
    const base = this.name.replace(/\.[^.]+$/, '') || 'datos'
    if (format === 'csv') {
      const data = new TextEncoder().encode(writeCsv(table)).buffer as ArrayBuffer
      return { data, mime: 'text/csv;charset=utf-8', filename: `${base}_limpio.csv` }
    }
    const data = await writeXlsx(table, includeAudit ? this.result?.audit : undefined)
    return {
      data,
      mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      filename: `${base}_limpio.xlsx`,
    }
  }

  reset() {
    this.kind = null
    this.workbook = null
    this.csvMatrix = null
    this.original = null
    this.result = null
  }

  private requireOriginal(): Table {
    if (!this.original) throw new EngineError('state', 'Primero selecciona una hoja.')
    return this.original
  }
}

function sameCell(a: Cell, b: Cell): boolean {
  if (a instanceof Date && b instanceof Date) return a.getTime() === b.getTime()
  return a === b
}
