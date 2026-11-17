import { sendContact } from '../server/contact.js'
import { guard } from '../server/guard.js'

// Cada envío manda un correo con Resend: se limita a 5 por IP cada 10 minutos para evitar spam.
export const POST = guard({ name: 'contact', limit: 5, windowSeconds: 600 }, (request) =>
  sendContact(
    { resendApiKey: process.env.RESEND_API_KEY, to: process.env.CONTACT_TO, from: process.env.CONTACT_FROM },
    request,
  ),
)
