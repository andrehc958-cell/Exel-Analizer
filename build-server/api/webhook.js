import { handleWebhook } from '../server/billing.js';
import { withBilling } from '../server/stripe.js';
export const POST = withBilling(handleWebhook);
