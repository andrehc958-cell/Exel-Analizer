import { sendContact } from '../server/contact.js';
export function POST(request) {
    return sendContact({ resendApiKey: process.env.RESEND_API_KEY, to: process.env.CONTACT_TO, from: process.env.CONTACT_FROM }, request);
}
