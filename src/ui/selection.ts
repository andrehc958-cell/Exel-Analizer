import type { CaseMode, CleanOptions, DateOrder, QualityReport } from '../engine/types'

/** Correcciones elegidas en la interfaz. Empieza vacía: detectar no implica corregir. */
export interface Selection {
  whitespaceToEmpty: number[]
  trim: number[]
  collapse: number[]
  caseMode: Record<number, CaseMode>
  toNumber: number[]
  toDate: Record<number, DateOrder>
  dropRowsWithEmpty: number[]
  removeEmptyRows: boolean
  removeEmptyColumns: boolean
  removeDuplicates: boolean
  duplicateKey: number[]
}

export const EMPTY_SELECTION: Selection = {
  whitespaceToEmpty: [],
  trim: [],
  collapse: [],
  caseMode: {},
  toNumber: [],
  toDate: {},
  dropRowsWithEmpty: [],
  removeEmptyRows: false,
  removeEmptyColumns: false,
  removeDuplicates: false,
  duplicateKey: [],
}

/** Correcciones seguras: no cambian el significado de los datos ni eliminan información. */
export function recommended(report: QualityReport): Selection {
  const cols = report.columns
  return {
    ...EMPTY_SELECTION,
    whitespaceToEmpty: cols.filter((c) => c.whitespaceOnly).map((c) => c.index),
    trim: cols.filter((c) => c.untrimmed).map((c) => c.index),
    collapse: cols.filter((c) => c.repeatedSpaces).map((c) => c.index),
    removeEmptyRows: report.emptyRows > 0,
    removeEmptyColumns: report.emptyColumns.length > 0,
  }
}

export function toOptions(s: Selection): CleanOptions {
  return {
    whitespaceToEmpty: s.whitespaceToEmpty,
    trimWhitespace: s.trim,
    collapseSpaces: s.collapse,
    normalizeCase: Object.entries(s.caseMode).map(([column, mode]) => ({ column: +column, mode })),
    toNumber: s.toNumber,
    toDate: Object.entries(s.toDate).map(([column, order]) => ({ column: +column, order })),
    dropRowsWithEmpty: s.dropRowsWithEmpty,
    removeEmptyRows: s.removeEmptyRows,
    removeEmptyColumns: s.removeEmptyColumns,
    removeDuplicates: s.removeDuplicates ? { key: s.duplicateKey } : null,
  }
}

export function countSelected(s: Selection): number {
  return (
    s.whitespaceToEmpty.length +
    s.trim.length +
    s.collapse.length +
    Object.keys(s.caseMode).length +
    s.toNumber.length +
    Object.keys(s.toDate).length +
    s.dropRowsWithEmpty.length +
    Number(s.removeEmptyRows) +
    Number(s.removeEmptyColumns) +
    Number(s.removeDuplicates)
  )
}

export function toggle(list: number[], value: number, on: boolean): number[] {
  return on ? [...new Set([...list, value])].sort((a, b) => a - b) : list.filter((v) => v !== value)
}
