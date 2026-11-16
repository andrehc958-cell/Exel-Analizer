import { createCheckout } from '../server/billing.js'
import { guard } from '../server/guard.js'
import { withBilling } from '../server/stripe.js'

export const POST = guard({ name: 'checkout', limit: 10, windowSeconds: 600 }, withBilling(createCheckout))
