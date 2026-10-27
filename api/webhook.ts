import { handleWebhook } from '../server/billing'
import { withBilling } from '../server/stripe'

export const POST = withBilling(handleWebhook)
