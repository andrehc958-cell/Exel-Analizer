import type { Cell, DateOrder, ValueKind } from './types'

export function isEmpty(c: Cell): boolean {
  return c === null || c === ''
}

export function kindOf(c: Cell): ValueKind {
  if (isEmpty(c)) return 'empty'
  if (typeof c === 'number') return 'number'
  if (typeof c === 'boolean') return 'boolean'
  if (c instanceof Date) return 'date'
  return 'text'
}

export function cellToString(c: Cell): string {
  if (c === null) return ''
  if (c instanceof Date) return formatDate(c)
  if (typeof c === 'boolean') return c ? 'TRUE' : 'FALSE'
  return String(c)
}

/** Fechas en UTC para no desplazar el día por la zona horaria del navegador. */
export function formatDate(d: Date): string {
  if (Number.isNaN(d.getTime())) return ''
  const iso = d.toISOString()
  const hasTime = d.getUTCHours() || d.getUTCMinutes() || d.getUTCSeconds()
  return hasTime ? iso.slice(0, 19).replace('T', ' ') : iso.slice(0, 10)
}

/** Clave estable para comparar celdas (duplicados, valores distintos). */
export function cellKey(c: Cell): string {
  if (c === null || c === '') return '∅'
  if (typeof c === 'number') return 'n' + c
  if (typeof c === 'boolean') return c ? 'bT' : 'bF'
  if (c instanceof Date) return 'd' + c.getTime()
  return 's' + c
}

// --- Números escritos como texto -------------------------------------------------

const NUMBER_CLEAN = /^\(?[-+]?\$?\s*[\d.,]+\)?$/

/**
 * Interpreta textos como " 1,250.50 ", "$300", "(45)" o "1.250,5".
 * Devuelve null si el texto no es un número sin ambigüedad.
 * Regla de separadores: si aparecen "." y "," el último es el decimal; si sólo hay
 * comas en grupos de tres se toman como miles (convención de México).
 */
export function parseNumericText(raw: string): number | null {
  let s = raw.trim().replace(/\s+/g, '')
  if (s === '' || !NUMBER_CLEAN.test(s)) return null
  let negative = false
  if (s.startsWith('(') && s.endsWith(')')) {
    negative = true
    s = s.slice(1, -1)
  } else if (s.startsWith('(') || s.endsWith(')')) {
    return null
  }
  if (s.startsWith('-')) {
    negative = !negative
    s = s.slice(1)
  } else if (s.startsWith('+')) {
    s = s.slice(1)
  }
  s = s.replace(/^\$/, '')
  if (!/^[\d.,]+$/.test(s) || !/\d/.test(s)) return null
  // Ceros a la izquierda ("01234"): es un código (postal, cliente), no una cantidad.
  if (/^0\d/.test(s)) return null

  const lastDot = s.lastIndexOf('.')
  const lastComma = s.lastIndexOf(',')
  let normalized: string
  if (lastDot >= 0 && lastComma >= 0) {
    const decimalSep = lastDot > lastComma ? '.' : ','
    const thousandSep = decimalSep === '.' ? ',' : '.'
    const [intPart, decPart, ...rest] = s.split(decimalSep)
    if (rest.length || !validGroups(intPart, thousandSep)) return null
    normalized = intPart.split(thousandSep).join('') + '.' + decPart
  } else if (lastComma >= 0) {
    if (validGroups(s, ',') && s.includes(',')) normalized = s.split(',').join('')
    else if (/^\d+,\d{1,2}$/.test(s)) normalized = s.replace(',', '.')
    else return null
  } else {
    const dots = s.split('.').length - 1
    if (dots <= 1) normalized = s
    else if (validGroups(s, '.')) normalized = s.split('.').join('')
    else return null
  }
  if (!/^\d+(\.\d+)?$/.test(normalized) && !/^\.\d+$/.test(normalized)) return null
  // Más de 15 dígitos perdería precisión: probablemente es un identificador.
  if (normalized.replace('.', '').replace(/^0+/, '').length > 15) return null
  const n = Number(normalized)
  if (!Number.isFinite(n)) return null
  return negative ? -n : n
}

function validGroups(s: string, sep: string): boolean {
  if (!s.includes(sep)) return /^\d+$/.test(s)
  const parts = s.split(sep)
  return /^\d{1,3}$/.test(parts[0]) && parts.slice(1).every((p) => /^\d{3}$/.test(p))
}

/** Un texto numérico "canónico" que puede leerse como número sin cambiar su significado. */
export function isCanonicalNumber(s: string): boolean {
  // Excluye ceros a la izquierda ("007", códigos postales) y números demasiado largos.
  return /^-?(0|[1-9]\d{0,14})(\.\d+)?$/.test(s)
}

// --- Fechas escritas como texto ---------------------------------------------------

const YMD = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/
const XYZ = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4}|\d{2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/

export interface DateTextInfo {
  /** Órdenes posibles para este texto. */
  orders: DateOrder[]
}

export function inspectDateText(raw: string): DateTextInfo | null {
  const s = raw.trim()
  let m = YMD.exec(s)
  if (m) return validDate(+m[1], +m[2], +m[3]) ? { orders: ['YMD'] } : null
  m = XYZ.exec(s)
  if (!m) return null
  const a = +m[1]
  const b = +m[2]
  const y = expandYear(+m[3], m[3].length)
  const orders: DateOrder[] = []
  if (validDate(y, b, a)) orders.push('DMY')
  if (validDate(y, a, b)) orders.push('MDY')
  return orders.length ? { orders } : null
}

export function parseDateText(raw: string, order: DateOrder): Date | null {
  const s = raw.trim()
  let y: number, mo: number, d: number
  let time: RegExpExecArray | null
  const ymd = YMD.exec(s)
  if (ymd) {
    // Una fecha año-mes-día no es ambigua: se acepta con cualquier orden elegido.
    ;[y, mo, d] = [+ymd[1], +ymd[2], +ymd[3]]
    time = ymd
  } else {
    const m = XYZ.exec(s)
    if (!m || order === 'YMD') return null
    y = expandYear(+m[3], m[3].length)
    ;[d, mo] = order === 'DMY' ? [+m[1], +m[2]] : [+m[2], +m[1]]
    time = m
  }
  if (!validDate(y, mo, d)) return null
  const h = time[4] ? +time[4] : 0
  const mi = time[5] ? +time[5] : 0
  const sec = time[6] ? +time[6] : 0
  if (h > 23 || mi > 59 || sec > 59) return null
  return new Date(Date.UTC(y, mo - 1, d, h, mi, sec))
}

function expandYear(y: number, digits: number): number {
  if (digits === 4) return y
  return y < 50 ? 2000 + y : 1900 + y
}

function validDate(y: number, m: number, d: number): boolean {
  if (m < 1 || m > 12 || d < 1 || d > 31) return false
  const dt = new Date(Date.UTC(y, m - 1, d))
  return dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d
}

// --- Texto ------------------------------------------------------------------------

/** Clave para agrupar variantes de un mismo valor: ignora mayúsculas, acentos y espacios. */
export function caseKey(s: string): string {
  return s
    .trim()
    .replace(/\s+/g, ' ')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLocaleLowerCase('es')
}

export function toTitleCase(s: string): string {
  return s
    .toLocaleLowerCase('es')
    .replace(/(^|[\s\-'"(/])(\p{L})/gu, (_, sep: string, ch: string) => sep + ch.toLocaleUpperCase('es'))
}
