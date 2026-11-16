import { handleWebhook } from '../server/billing.js'
import { guard } from '../server/guard.js'
import { withBilling } from '../server/stripe.js'

// Stripe no envía Origin y puede mandar ráfagas legítimas; la firma es la verdadera autenticación.
export const POST = guard(
  { name: 'webhook', limit: 300, windowSeconds: 60, sameOrigin: false, maxBytes: 512 * 1024 },
  withBilling(handleWebhook),
)
