import { describe, expect, it } from 'vitest'
import { inspectDateText, parseDateText, parseNumericText, toTitleCase } from '../values'

describe('parseNumericText', () => {
  it.each([
    [' 42 ', 42],
    ['1,250.50', 1250.5],
    ['$1,250', 1250],
    ['1.250,5', 1250.5],
    ['3,5', 3.5],
    ['(45)', -45],
    ['-0.5', -0.5],
    ['1.234.567', 1234567],
  ])('%s → %d', (raw, expected) => {
    expect(parseNumericText(raw)).toBe(expected)
  })

  it.each(['abc', '01234', '12a', '1,2,3', '', '1234567890123456789', '(5'])('rechaza %s', (raw) => {
    expect(parseNumericText(raw)).toBeNull()
  })
})

describe('fechas en texto', () => {
  it('detecta ambigüedad', () => {
    expect(inspectDateText('03/04/2024')?.orders).toEqual(['DMY', 'MDY'])
    expect(inspectDateText('25/04/2024')?.orders).toEqual(['DMY'])
    expect(inspectDateText('04/25/2024')?.orders).toEqual(['MDY'])
    expect(inspectDateText('2024-04-25')?.orders).toEqual(['YMD'])
    expect(inspectDateText('31/02/2024')).toBeNull()
  })

  it('convierte según el orden elegido, en UTC', () => {
    expect(parseDateText('03/04/2024', 'DMY')?.toISOString()).toBe('2024-04-03T00:00:00.000Z')
    expect(parseDateText('03/04/2024', 'MDY')?.toISOString()).toBe('2024-03-04T00:00:00.000Z')
    expect(parseDateText('2024-04-25 13:05', 'DMY')?.toISOString()).toBe('2024-04-25T13:05:00.000Z')
    expect(parseDateText('25/04/2024', 'MDY')).toBeNull()
  })
})

it('tipo título respeta acentos', () => {
  expect(toTitleCase('ÁLVARO de la PEÑA')).toBe('Álvaro De La Peña')
})
