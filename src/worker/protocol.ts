import type { CleanSummary, OpenResult, Page } from '../engine/session'
import type { CleanOptions, QualityReport } from '../engine/types'

export interface Methods {
  open: { args: { buffer: ArrayBuffer; name: string }; result: OpenResult }
  selectSheet: { args: { sheet: number; hasHeader: boolean }; result: QualityReport }
  duplicates: { args: { key: number[] }; result: number }
  clean: { args: { options: CleanOptions }; result: CleanSummary }
  page: { args: { which: 'original' | 'clean'; offset: number; limit: number }; result: Page }
  export: {
    args: { format: 'csv' | 'xlsx'; includeAudit: boolean }
    result: { data: ArrayBuffer; mime: string; filename: string }
  }
  reset: { args: Record<string, never>; result: null }
}

export type Method = keyof Methods

export type Request = {
  [M in Method]: { id: number; method: M; args: Methods[M]['args'] }
}[Method]

export type Response =
  | { id: number; ok: true; value: unknown }
  | { id: number; ok: false; error: { code: string; message: string } }
