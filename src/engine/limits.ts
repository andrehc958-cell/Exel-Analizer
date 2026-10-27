import type { Limits } from './types'

export const DEFAULT_LIMITS: Limits = {
  maxBytes: 50 * 1024 * 1024,
  maxRows: 500_000,
  maxColumns: 500,
  maxCells: 10_000_000,
}
