import { issueLicense } from '../server/billing.js';
import { withBilling } from '../server/stripe.js';
export const POST = withBilling(issueLicense);
