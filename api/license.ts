import { issueLicense } from '../server/billing.js'
import { guard } from '../server/guard.js'
import { withBilling } from '../server/stripe.js'

export const POST = guard({ name: 'license', limit: 30, windowSeconds: 600 }, withBilling(issueLicense))
