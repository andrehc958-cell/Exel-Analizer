import { json } from './billing.js'

export interface ContactEnv {
  resendApiKey?: string
  to?: string
  from?: string
}

export type ContactKind = 'soporte' | 'sugerencia'

const KINDS: Record<ContactKind, string> = { soporte: 'Servicio al cliente', sugerencia: 'Buzón de sugerencias' }
const TOPICS = new Set(['pagos', 'archivo', 'resultado', 'privacidad', 'otro', 'mejora', 'nueva-funcion', 'error'])
const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,}$/
const MAX_MESSAGE = 4000

export interface ContactMessage {
  kind: ContactKind
  topic: string
  name: string
  email: string
  message: string
}

/** Valida el formulario. Devuelve el mensaje limpio o el texto del error para el usuario. */
export function parseContact(body: unknown): ContactMessage | string {
  if (!body || typeof body !== 'object') return 'Solicitud no válida.'
  const b = body as Record<string, unknown>
  // Campo trampa invisible para bots: si viene lleno, se descarta sin avisar.
  if (typeof b.website === 'string' && b.website !== '') return 'spam'
  const kind = b.kind === 'soporte' || b.kind === 'sugerencia' ? b.kind : null
  if (!kind) return 'Tipo de mensaje no válido.'
  const str = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '')
  const topic = str(b.topic, 40)
  const name = str(b.name, 120)
  const email = str(b.email, 254)
  const message = str(b.message, MAX_MESSAGE)
  if (!TOPICS.has(topic)) return 'Elige un tema.'
  if (kind === 'soporte' && !EMAIL.test(email)) return 'Escribe un correo válido para poder responderte.'
  if (email && !EMAIL.test(email)) return 'El correo no es válido.'
  if (message.length < 10) return 'Cuéntanos un poco más (al menos 10 caracteres).'
  if (kind === 'soporte' && b.acceptedPrivacy !== true) return 'Debes aceptar el Aviso de privacidad.'
  return { kind, topic, name, email, message }
}

/** Envía el mensaje por correo con la API de Resend. Sin configuración responde 503 y la app ofrece el correo directo. */
export async function sendContact(env: ContactEnv, request: Request, fetcher: typeof fetch = fetch): Promise<Response> {
  if (!env.resendApiKey || !env.to) return json({ error: 'El formulario no está configurado.', fallback: true }, 503)
  const parsed = parseContact(await request.json().catch(() => null))
  if (parsed === 'spam') return json({ ok: true })
  if (typeof parsed === 'string') return json({ error: parsed }, 400)

  const subject = `[DataClean · ${KINDS[parsed.kind]}] ${parsed.topic}`
  const text = [
    `Tipo: ${KINDS[parsed.kind]}`,
    `Tema: ${parsed.topic}`,
    `Nombre: ${parsed.name || '(no indicado)'}`,
    `Correo: ${parsed.email || '(anónimo)'}`,
    '',
    parsed.message,
  ].join('\n')

  const res = await fetcher('https://api.resend.com/emails', {
    method: 'POST',
    headers: { authorization: `Bearer ${env.resendApiKey}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      from: env.from || 'DataClean <onboarding@resend.dev>',
      to: [env.to],
      subject,
      text,
      ...(parsed.email ? { reply_to: parsed.email } : {}),
    }),
  })
  if (!res.ok) {
    console.error('[contact] Resend respondió', res.status)
    return json({ error: 'No se pudo enviar el mensaje. Inténtalo más tarde.', fallback: true }, 502)
  }
  return json({ ok: true })
}
