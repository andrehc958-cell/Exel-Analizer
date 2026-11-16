import { EngineError } from './types'

/**
 * Defensa contra "bombas ZIP" en archivos .xlsx.
 *
 * Un .xlsx es un ZIP. Un archivo malicioso de pocos MB puede declarar gigabytes al descomprimirse
 * y agotar la memoria del navegador (o de un servidor, si algún día se procesa allá). Antes de entregar
 * el archivo a ExcelJS se lee el directorio central del ZIP y se rechaza si:
 * - declara demasiadas entradas,
 * - el tamaño total descomprimido supera el límite,
 * - alguna entrada tiene una tasa de compresión imposible para un libro de Excel real,
 * - usa ZIP64, cifrado o un directorio central incoherente.
 *
 * Es una verificación de lo que el ZIP declara; los límites de filas, columnas y celdas y el Web Worker
 * aislado siguen siendo la segunda línea de defensa.
 */
export interface ZipLimits {
  maxEntries: number
  maxUncompressedBytes: number
  maxRatio: number
}

export const DEFAULT_ZIP_LIMITS: ZipLimits = {
  maxEntries: 5_000,
  maxUncompressedBytes: 800 * 1024 * 1024,
  maxRatio: 200,
}

const EOCD_SIG = 0x06054b50
const CEN_SIG = 0x02014b50
const ZIP64_LOCATOR_SIG = 0x07064b50

export interface ZipSummary {
  entries: number
  compressedBytes: number
  uncompressedBytes: number
}

export function inspectZip(bytes: Uint8Array, limits: ZipLimits = DEFAULT_ZIP_LIMITS): ZipSummary {
  const corrupt = () => new EngineError('corrupt', 'El archivo dice ser .xlsx pero su estructura está dañada.')
  const bomb = (detail: string) =>
    new EngineError('zip-bomb', `El archivo no parece un libro de Excel normal (${detail}). Por seguridad no se procesará.`)

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const len = bytes.byteLength
  // El registro "fin de directorio central" mide 22 bytes más un comentario de hasta 65 535.
  let eocd = -1
  for (let i = len - 22; i >= Math.max(0, len - 22 - 0xffff); i--) {
    if (view.getUint32(i, true) === EOCD_SIG) {
      eocd = i
      break
    }
  }
  if (eocd < 0) throw corrupt()
  if (eocd >= 20 && view.getUint32(eocd - 20, true) === ZIP64_LOCATOR_SIG) throw bomb('usa ZIP64')

  const total = view.getUint16(eocd + 10, true)
  const cenSize = view.getUint32(eocd + 12, true)
  const cenOffset = view.getUint32(eocd + 16, true)
  if (total === 0xffff || cenSize === 0xffffffff || cenOffset === 0xffffffff) throw bomb('usa ZIP64')
  if (total > limits.maxEntries) throw bomb(`contiene ${total} partes internas`)
  if (cenOffset + cenSize > eocd) throw corrupt()

  let p = cenOffset
  let compressedBytes = 0
  let uncompressedBytes = 0
  for (let n = 0; n < total; n++) {
    if (p + 46 > eocd || view.getUint32(p, true) !== CEN_SIG) throw corrupt()
    const flags = view.getUint16(p + 8, true)
    const compressed = view.getUint32(p + 20, true)
    const uncompressed = view.getUint32(p + 24, true)
    const nameLen = view.getUint16(p + 28, true)
    const extraLen = view.getUint16(p + 30, true)
    const commentLen = view.getUint16(p + 32, true)
    if (flags & 0x1) {
      throw new EngineError('encrypted', 'El libro está protegido con contraseña. Quita la protección en Excel y vuelve a intentarlo.')
    }
    if (compressed === 0xffffffff || uncompressed === 0xffffffff) throw bomb('usa ZIP64')
    // Una tasa absurda sólo es sospechosa en entradas grandes; los XML diminutos comprimen mucho.
    if (uncompressed > 1024 * 1024 && uncompressed > compressed * limits.maxRatio) {
      throw bomb('una parte interna se expande más de lo normal')
    }
    compressedBytes += compressed
    uncompressedBytes += uncompressed
    if (uncompressedBytes > limits.maxUncompressedBytes) {
      throw bomb(`se expande a más de ${Math.round(limits.maxUncompressedBytes / 1024 / 1024)} MB`)
    }
    p += 46 + nameLen + extraLen + commentLen
  }
  return { entries: total, compressedBytes, uncompressedBytes }
}
