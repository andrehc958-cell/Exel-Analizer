// Tipos del motor de limpieza. El motor no depende del DOM ni de React (RNF-06):
// se ejecuta dentro de un Web Worker y también en Node para las pruebas.

export type Cell = string | number | boolean | Date | null

export interface Table {
  columns: string[]
  rows: Cell[][]
}

export interface SheetInfo {
  name: string
  rowCount: number
  columnCount: number
}

export type ValueKind = 'empty' | 'number' | 'boolean' | 'date' | 'text'

export interface ColumnProfile {
  index: number
  name: string
  /** Tipo dominante entre las celdas no vacías. */
  kind: ValueKind
  counts: Record<ValueKind, number>
  /** Celdas null o cadena vacía. El 0 nunca cuenta como vacío. */
  empty: number
  /** Cadenas formadas solo por espacios (posible vacío disfrazado). */
  whitespaceOnly: number
  /** Cadenas con espacios al inicio o al final. */
  untrimmed: number
  /** Cadenas con espacios internos repetidos. */
  repeatedSpaces: number
  /** Textos que parecen números (p. ej. "1,250.50"). */
  numericText: number
  /** Textos que parecen fechas. */
  dateText: number
  /** Orden de fecha deducido a partir del texto; 'ambiguous' si no se puede decidir. */
  dateOrder: DateOrder | 'ambiguous' | null
  /** Grupos de valores que sólo difieren en mayúsculas/espacios. */
  caseVariants: CaseVariantGroup[]
  /** Valores atípicos (regla IQR 1.5) en columnas numéricas. */
  outliers: number
  outlierExamples: number[]
  distinct: number
  examples: Cell[]
}

export interface CaseVariantGroup {
  variants: { value: string; count: number }[]
}

export type DateOrder = 'DMY' | 'MDY' | 'YMD'

export interface QualityReport {
  rowCount: number
  columnCount: number
  emptyRows: number
  duplicateRows: number
  /** Columnas usadas como criterio de duplicado (vacío = fila completa). */
  duplicateKey: number[]
  emptyColumns: number[]
  columns: ColumnProfile[]
}

export type CaseMode = 'lower' | 'upper' | 'title' | 'mostFrequent'

/**
 * Correcciones seleccionadas por el usuario. Nada se aplica por defecto:
 * una opción ausente o vacía significa "no tocar" (RF-08, RNF-08).
 */
export interface CleanOptions {
  trimWhitespace?: number[]
  collapseSpaces?: number[]
  whitespaceToEmpty?: number[]
  normalizeCase?: { column: number; mode: CaseMode }[]
  toNumber?: number[]
  toDate?: { column: number; order: DateOrder }[]
  removeEmptyRows?: boolean
  removeEmptyColumns?: boolean
  removeDuplicates?: { key: number[] } | null
  dropRowsWithEmpty?: number[]
}

export type AuditStatus = 'applied' | 'skipped' | 'failed'

export interface AuditEntry {
  operation: string
  status: AuditStatus
  detail: string
  rowsAffected: number
  cellsChanged: number
  /** Valores que no se pudieron transformar (se dejan intactos). */
  failures?: number
  failureExamples?: string[]
}

export const STATUS_LABELS: Record<AuditStatus, string> = {
  applied: 'Aplicada',
  skipped: 'Sin cambios',
  failed: 'Fallida',
}

export interface CleanResult {
  table: Table
  /** Para cada fila resultante, índice de la fila original. */
  sourceRows: number[]
  /** Para cada columna resultante, índice de la columna original. */
  sourceColumns: number[]
  audit: AuditEntry[]
  startedAt: string
  durationMs: number
}

export interface Limits {
  maxBytes: number
  maxRows: number
  maxColumns: number
  maxCells: number
}

export class EngineError extends Error {
  readonly code: string
  constructor(code: string, message: string) {
    super(message)
    this.code = code
    this.name = 'EngineError'
  }
}
