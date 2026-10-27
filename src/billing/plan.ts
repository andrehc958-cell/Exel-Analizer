import { DEFAULT_LIMITS } from '../engine/limits'
import type { Limits } from '../engine/types'

/** Los pagos se activan al configurar Stripe en el hosting (ver README). */
export const BILLING_ENABLED = import.meta.env.VITE_BILLING_ENABLED === 'true'
export const PRO_PRICE_LABEL = import.meta.env.VITE_PRO_PRICE_LABEL || '$199 MXN al mes'

export type PlanId = 'free' | 'pro'

export const PLAN_LIMITS: Record<PlanId, Limits> = {
  free: { maxBytes: 5 * 1024 * 1024, maxRows: 20_000, maxColumns: 100, maxCells: 1_000_000 },
  pro: DEFAULT_LIMITS,
}

/** Sin pagos configurados la aplicación no se limita: todos usan los límites completos. */
export function limitsFor(plan: PlanId): Limits {
  return BILLING_ENABLED ? PLAN_LIMITS[plan] : PLAN_LIMITS.pro
}
