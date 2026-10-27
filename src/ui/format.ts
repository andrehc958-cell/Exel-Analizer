import type { Cell, ValueKind } from '../engine/types'
import { formatDate } from '../engine/values'

export const nf = new Intl.NumberFormat('es-MX')

export function displayCell(c: Cell): string {
  if (c === null) return ''
  if (c instanceof Date) return formatDate(c)
  if (typeof c === 'boolean') return c ? 'VERDADERO' : 'FALSO'
  if (typeof c === 'number') return String(c)
  return c
}

export const KIND_LABELS: Record<ValueKind, string> = {
  empty: 'vacía',
  number: 'número',
  boolean: 'sí/no',
  date: 'fecha',
  text: 'texto',
}

export function bytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / 1024 / 1024).toFixed(1)} MB`
}

export function plural(n: number, one: string, many: string) {
  return `${nf.format(n)} ${n === 1 ? one : many}`
}
