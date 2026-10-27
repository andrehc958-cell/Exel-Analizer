import { createPortal } from '../server/billing.js'
import { withBilling } from '../server/stripe.js'

export const POST = withBilling(createPortal)
