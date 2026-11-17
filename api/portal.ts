import { createPortal } from '../server/billing.js'
import { guard } from '../server/guard.js'
import { withBilling } from '../server/stripe.js'

export const POST = guard({ name: 'portal', limit: 10, windowSeconds: 600 }, withBilling(createPortal))
