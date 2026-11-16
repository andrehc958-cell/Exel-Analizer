import ExcelJS from 'exceljs'
import { describe, expect, it } from 'vitest'
import { sniffFile } from '../io'
import { CleaningSession } from '../session'
import { inspectZip } from '../zipguard'

/** ZIP mínimo (sin datos) cuyo directorio central declara las entradas indicadas. */
function fakeZip(entries: { name: string; compressed: number; uncompressed: number; flags?: number }[]): Uint8Array {
  const enc = new TextEncoder()
  const parts: number[] = []
  const u16 = (n: number) => parts.push(n & 0xff, (n >> 8) & 0xff)
  const u32 = (n: number) => parts.push(n & 0xff, (n >>> 8) & 0xff, (n >>> 16) & 0xff, (n >>> 24) & 0xff)
  // Encabezado local vacío para que empiece con la firma PK\x03\x04.
  u32(0x04034b50)
  for (let i = 0; i < 26; i++) parts.push(0)
  const cenStart = parts.length
  for (const e of entries) {
    const name = enc.encode(e.name)
    u32(0x02014b50)
    u16(20); u16(20); u16(e.flags ?? 0); u16(8); u16(0); u16(0); u32(0)
    u32(e.compressed); u32(e.uncompressed)
    u16(name.length); u16(0); u16(0); u16(0); u16(0); u32(0); u32(0)
    parts.push(...name)
  }
  const cenSize = parts.length - cenStart
  u32(0x06054b50); u16(0); u16(0); u16(entries.length); u16(entries.length); u32(cenSize); u32(cenStart); u16(0)
  return new Uint8Array(parts)
}

describe('defensa contra bombas ZIP', () => {
  it('acepta un .xlsx real', async () => {
    const wb = new ExcelJS.Workbook()
    wb.addWorksheet('Hoja').addRows([['a', 'b'], [1, 2]])
    const bytes = new Uint8Array((await wb.xlsx.writeBuffer()) as ArrayBuffer)
    const summary = inspectZip(bytes)
    expect(summary.entries).toBeGreaterThan(3)
    expect(sniffFile(bytes, 'ok.xlsx')).toBe('xlsx')
    await expect(new CleaningSession().open(bytes, 'ok.xlsx')).resolves.toMatchObject({ kind: 'xlsx' })
  })

  it('rechaza un archivo que declara gigabytes al descomprimirse', () => {
    const bomb = fakeZip([
      { name: 'xl/worksheets/sheet1.xml', compressed: 4_000_000, uncompressed: 3_000_000_000 },
    ])
    expect(() => sniffFile(bomb, 'bomba.xlsx')).toThrow(/no se procesará/)
  })

  it('rechaza tasas de compresión imposibles aunque el total sea pequeño', () => {
    const bomb = fakeZip([{ name: 'xl/sharedStrings.xml', compressed: 1_000, uncompressed: 100 * 1024 * 1024 }])
    expect(() => inspectZip(bomb)).toThrow(/se expande más de lo normal/)
  })

  it('rechaza demasiadas entradas', () => {
    const many = fakeZip(Array.from({ length: 6000 }, (_, i) => ({ name: `f${i}`, compressed: 10, uncompressed: 10 })))
    expect(() => inspectZip(many)).toThrow(/partes internas/)
  })

  it('rechaza libros cifrados con un mensaje claro', () => {
    const enc = fakeZip([{ name: 'xl/workbook.xml', compressed: 10, uncompressed: 10, flags: 1 }])
    expect(() => inspectZip(enc)).toThrow(/contraseña/)
  })

  it('rechaza un ZIP truncado', () => {
    expect(() => sniffFile(new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0, 0, 0]), 'roto.xlsx')).toThrow(/dañada/)
  })
})
