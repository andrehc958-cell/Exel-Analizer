import { sendContact } from '../server/contact'

export function POST(request: Request): Promise<Response> {
  return sendContact(
    { resendApiKey: process.env.RESEND_API_KEY, to: process.env.CONTACT_TO, from: process.env.CONTACT_FROM },
    request,
  )
}
