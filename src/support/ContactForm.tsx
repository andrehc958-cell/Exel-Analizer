import { useState } from 'react'
import type { FormEvent } from 'react'
import { LEGAL } from '../legal/config'

type Kind = 'soporte' | 'sugerencia'

interface Props {
  kind: Kind
  topics: { value: string; label: string }[]
}

type Status = { state: 'idle' | 'sending' | 'sent' } | { state: 'error'; message: string; fallback: boolean }

/** Formulario que envía a /api/contact; si el envío no está configurado, ofrece el correo directo. */
export function ContactForm({ kind, topics }: Props) {
  const [topic, setTopic] = useState(topics[0].value)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [website, setWebsite] = useState('')
  const [acceptedPrivacy, setAcceptedPrivacy] = useState(false)
  const [status, setStatus] = useState<Status>({ state: 'idle' })
  const support = kind === 'soporte'

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setStatus({ state: 'sending' })
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ kind, topic, name, email, message, website, acceptedPrivacy }),
      })
      const data = (await res.json().catch(() => ({}))) as { error?: string; fallback?: boolean }
      if (res.ok) {
        setStatus({ state: 'sent' })
        setMessage('')
        return
      }
      setStatus({ state: 'error', message: data.error ?? 'No se pudo enviar el mensaje.', fallback: res.status >= 500 || !!data.fallback })
    } catch {
      setStatus({ state: 'error', message: 'No hay conexión.', fallback: true })
    }
  }

  if (status.state === 'sent') {
    return (
      <div className="notice" role="status">
        <span>
          {support
            ? '¡Gracias! Recibimos tu mensaje y te responderemos por correo lo antes posible.'
            : '¡Gracias por tu sugerencia! La leemos para decidir las próximas mejoras.'}
        </span>
        <button className="ghost" onClick={() => setStatus({ state: 'idle' })}>
          Enviar otro
        </button>
      </div>
    )
  }

  const mailto = `mailto:${LEGAL.email}?subject=${encodeURIComponent(`DataClean · ${support ? 'Soporte' : 'Sugerencia'} · ${topic}`)}&body=${encodeURIComponent(message)}`
  const id = (f: string) => `${kind}-${f}`

  return (
    <form className="contact-form" onSubmit={submit} noValidate>
      <div className="form-row">
        <label htmlFor={id('topic')}>Tema</label>
        <select id={id('topic')} value={topic} onChange={(e) => setTopic(e.target.value)}>
          {topics.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </div>
      <div className="form-grid">
        <div className="form-row">
          <label htmlFor={id('name')}>Nombre {support ? '' : '(opcional)'}</label>
          <input id={id('name')} value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" maxLength={120} />
        </div>
        <div className="form-row">
          <label htmlFor={id('email')}>Correo {support ? '' : '(opcional, si quieres respuesta)'}</label>
          <input
            id={id('email')}
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required={support}
            maxLength={254}
          />
        </div>
      </div>
      <div className="form-row">
        <label htmlFor={id('message')}>{support ? '¿En qué te ayudamos?' : 'Tu sugerencia'}</label>
        <textarea
          id={id('message')}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={5}
          maxLength={4000}
          required
          placeholder={
            support
              ? 'Describe el problema. No pegues datos sensibles de tus archivos.'
              : '¿Qué te gustaría que hiciera DataClean? ¿Qué te sobra o te falta?'
          }
        />
      </div>
      {/* Campo trampa para bots: oculto a las personas. */}
      <input className="hp" tabIndex={-1} autoComplete="off" aria-hidden="true" value={website} onChange={(e) => setWebsite(e.target.value)} name="website" />
      {support && (
        <label className="check">
          <input type="checkbox" checked={acceptedPrivacy} onChange={(e) => setAcceptedPrivacy(e.target.checked)} />
          <span>
            Acepto el <a href="#/privacidad">Aviso de privacidad</a> para que usen mis datos y así atender mi solicitud.
          </span>
        </label>
      )}
      {status.state === 'error' && (
        <p className="warn-text small" role="alert">
          {status.message}
          {status.fallback && (
            <>
              {' '}
              También puedes escribirnos a <a href={mailto}>{LEGAL.email}</a>.
            </>
          )}
        </p>
      )}
      <div>
        <button className="primary" type="submit" disabled={status.state === 'sending' || (support && !acceptedPrivacy)}>
          {status.state === 'sending' ? 'Enviando…' : support ? 'Enviar mensaje' : 'Enviar sugerencia'}
        </button>
      </div>
    </form>
  )
}
