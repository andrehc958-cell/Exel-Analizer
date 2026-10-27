import { describe, expect, it } from 'vitest'
import { cleanTable } from '../clean'
import { DEFAULT_LIMITS, matrixToTable, readCsv, sniffFile, writeCsv } from '../io'
import { profileTable } from '../profile'
import { CleaningSession } from '../session'
import type { Table } from '../types'

const enc = (s: string) => new TextEncoder().encode(s)

function sample(): Table {
  return {
    columns: ['Nombre', 'Ciudad', 'Monto', 'Fecha', 'Vacía'],
    rows: [
      ['Ana', 'México', 0, '03/04/2024', null],
      [' Luis ', 'mexico', '1,250.50', '25/04/2024', null],
      ['Ana', 'México', 0, '03/04/2024', null],
      [null, null, null, null, null],
      ['Eva  María', 'MÉXICO', 'n/d', '', null],
    ],
  }
}

describe('profileTable', () => {
  const r = profileTable(sample())
  it('cuenta vacíos sin confundir el cero', () => {
    expect(r.columns[2].empty).toBe(1)
    expect(r.columns[2].counts.number).toBe(2)
  })
  it('detecta duplicados, filas y columnas vacías', () => {
    expect(r.duplicateRows).toBe(1)
    expect(r.emptyRows).toBe(1)
    expect(r.emptyColumns).toEqual([4])
  })
  it('detecta espacios, mayúsculas, números y fechas en texto', () => {
    expect(r.columns[0].untrimmed).toBe(1)
    expect(r.columns[0].repeatedSpaces).toBe(1)
    expect(r.columns[1].caseVariants[0].variants.map((v) => v.value)).toEqual(['México', 'mexico', 'MÉXICO'])
    expect(r.columns[2].numericText).toBe(1)
    expect(r.columns[3].dateText).toBe(3)
    expect(r.columns[3].dateOrder).toBe('DMY')
  })
  it('duplicados por columnas elegidas', () => {
    expect(profileTable(sample(), [1]).duplicateRows).toBe(1)
  })
})

describe('cleanTable', () => {
  it('sin correcciones seleccionadas conserva los datos', () => {
    const t = sample()
    const res = cleanTable(t, {})
    expect(res.table).toEqual(t)
    expect(res.audit).toEqual([])
  })

  it('no modifica la tabla original', () => {
    const t = sample()
    const copy = structuredClone(t)
    cleanTable(t, { trimWhitespace: [0], removeEmptyRows: true, removeEmptyColumns: true })
    expect(t).toEqual(copy)
  })

  it('aplica correcciones seleccionadas y registra auditoría', () => {
    const res = cleanTable(sample(), {
      trimWhitespace: [0],
      collapseSpaces: [0],
      normalizeCase: [{ column: 1, mode: 'mostFrequent' }],
      toNumber: [2],
      toDate: [{ column: 3, order: 'DMY' }],
      removeEmptyRows: true,
      removeDuplicates: { key: [] },
      removeEmptyColumns: true,
    })
    expect(res.table.columns).toEqual(['Nombre', 'Ciudad', 'Monto', 'Fecha'])
    expect(res.table.rows.length).toBe(3)
    expect(res.sourceRows).toEqual([0, 1, 4])
    expect(res.table.rows[1][0]).toBe('Luis')
    expect(res.table.rows[2][0]).toBe('Eva María')
    expect(res.table.rows.map((r) => r[1])).toEqual(['México', 'México', 'México'])
    expect(res.table.rows[1][2]).toBe(1250.5)
    expect(res.table.rows[2][2]).toBe('n/d')
    expect((res.table.rows[0][3] as Date).toISOString()).toBe('2024-04-03T00:00:00.000Z')
    const num = res.audit.find((a) => a.operation === 'Convertir texto a número')!
    expect(num.failures).toBe(1)
    expect(num.failureExamples).toEqual(['n/d'])
    expect(res.audit.find((a) => a.operation === 'Eliminar filas duplicadas')!.rowsAffected).toBe(1)
  })
})

describe('io', () => {
  it('valida el tipo real del archivo', () => {
    expect(sniffFile(enc('a,b\n1,2'), 'x.csv')).toBe('csv')
    expect(() => sniffFile(new Uint8Array(), 'x.csv')).toThrow(/vacío/)
    expect(() => sniffFile(enc('hola'), 'x.xlsx')).toThrow(/no es un libro/)
    expect(() => sniffFile(new Uint8Array([0xd0, 0xcf, 0x11, 0xe0]), 'x.xls')).toThrow(/xls/)
    expect(() => sniffFile(enc('abc'), 'x.pdf')).toThrow(/no soportado/)
    expect(() => sniffFile(enc('a,b'), 'x.csv', { ...DEFAULT_LIMITS, maxBytes: 2 })).toThrow(/máximo/)
  })

  it('lee CSV con ; y Windows-1252 sin perder ceros a la izquierda', () => {
    const bytes = new Uint8Array([...enc('cp;nombre;n\n'), ...enc('01234;Pe'), 0xf1, ...enc('a;3.5\n')])
    const { matrix, encoding, delimiter } = readCsv(bytes)
    expect(encoding).toBe('windows-1252')
    expect(delimiter).toBe(';')
    const t = matrixToTable(matrix, true)
    expect(t.rows).toEqual([['01234', 'Peña', 3.5]])
  })

  it('renombra encabezados vacíos o repetidos y rechaza exceso de filas', () => {
    const t = matrixToTable([['a', null, 'a'], [1, 2, 3]], true)
    expect(t.columns).toEqual(['a', 'Columna 2', 'a (2)'])
    expect(() => matrixToTable([['a'], [1], [2]], true, { ...DEFAULT_LIMITS, maxRows: 1 })).toThrow(/máximo/)
  })

  it('exporta CSV neutralizando fórmulas', () => {
    const csv = writeCsv({ columns: ['x'], rows: [['=1+1'], [-5], ['a,b'], [new Date(Date.UTC(2024, 0, 2))]] })
    expect(csv).toBe("﻿x\r\n'=1+1\r\n-5\r\n\"a,b\"\r\n2024-01-02\r\n")
  })
})

describe('CleaningSession con Excel', () => {
  it('lee varias hojas, limpia y exporta un .xlsx válido', async () => {
    const ExcelJS = (await import('exceljs')).default
    const wb = new ExcelJS.Workbook()
    wb.addWorksheet('Vacía')
    const ws = wb.addWorksheet('Ventas')
    ws.addRow(['Cliente', 'Total', 'Calc'])
    ws.addRow([' Ana ', '1,000', { formula: 'B2*2', result: 2000 }])
    ws.addRow(['Ana', 1000, { formula: 'B3*2', result: 2000 }])
    const buf = new Uint8Array(await wb.xlsx.writeBuffer())

    const s = new CleaningSession()
    const opened = await s.open(buf, 'ventas.xlsx')
    expect(opened.sheets.map((x) => x.name)).toEqual(['Vacía', 'Ventas'])
    expect(() => s.selectSheet(0, true)).toThrow(/no tiene datos/)
    const report = s.selectSheet(1, true)
    expect(report.rowCount).toBe(2)
    expect(report.duplicateRows).toBe(0)
    const summary = s.clean({ trimWhitespace: [0], toNumber: [1], removeDuplicates: { key: [] } })
    expect(summary.rowsAfter).toBe(1)
    const page = s.page('clean', 0, 10)
    expect(page.rows).toEqual([['Ana', 1000, 2000]])
    expect(page.changed).toEqual([[true, true, false]])

    const out = await s.export('xlsx', true)
    const back = new ExcelJS.Workbook()
    await back.xlsx.load(out.data)
    expect(back.worksheets.map((w) => w.name)).toEqual(['Datos', 'Registro de cambios'])
    expect(back.getWorksheet('Datos')!.getRow(2).values).toEqual([undefined, 'Ana', 1000, 2000])
  })
})
