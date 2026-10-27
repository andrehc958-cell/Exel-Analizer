import { BILLING_ENABLED } from '../billing/plan'
import { LEGAL } from '../legal/config'
import { ContactForm } from './ContactForm'

const FAQ: { q: string; a: string; billing?: boolean }[] = [
  {
    q: '¿Mis archivos se suben a algún servidor?',
    a: 'No. Todo el análisis y la limpieza ocurren en tu navegador. Ni nosotros ni nadie más puede ver el contenido de tus archivos.',
  },
  {
    q: '¿Se modifica mi archivo original?',
    a: 'Nunca. DataClean trabaja sobre una copia y te entrega un archivo nuevo con el sufijo «_limpio».',
  },
  {
    q: '¿Qué formatos acepta?',
    a: 'Archivos .xlsx y .csv. Si tienes un .xls antiguo, ábrelo en Excel y guárdalo como .xlsx. No se admiten libros con macros (.xlsm).',
  },
  {
    q: '¿Por qué no se convirtió una fecha o un número?',
    a: 'Las fechas como 03/04/2024 son ambiguas: debes elegir si es día/mes o mes/día. Los valores que no se pueden convertir se dejan intactos y aparecen en el resumen de cambios.',
  },
  {
    q: 'Pagué el plan Pro pero sigo en el plan gratuito',
    a: 'La suscripción se activa en el navegador donde pagaste. Si cambiaste de navegador o borraste los datos del sitio, escríbenos con el correo que usaste en Stripe y te ayudamos.',
    billing: true,
  },
  {
    q: '¿Cómo cancelo mi suscripción?',
    a: 'En «Planes» pulsa «Administrar suscripción». Puedes cancelar en cualquier momento y conservas Pro hasta el final del periodo pagado.',
    billing: true,
  },
]

const TOPICS = [
  { value: 'archivo', label: 'Problema al cargar un archivo' },
  { value: 'resultado', label: 'El resultado no es el esperado' },
  ...(BILLING_ENABLED ? [{ value: 'pagos', label: 'Pagos y suscripción' }] : []),
  { value: 'privacidad', label: 'Privacidad y mis datos (derechos ARCO)' },
  { value: 'otro', label: 'Otro' },
]

export function Support() {
  return (
    <section aria-labelledby="support-title" className="page">
      <a href="#/" className="back-link">
        ← Volver
      </a>
      <h1 id="support-title">Servicio al cliente</h1>
      <p className="muted">
        Revisa las preguntas frecuentes o escríbenos. Respondemos por correo, normalmente en uno o dos días hábiles.
      </p>

      <div className="card">
        <h2>Preguntas frecuentes</h2>
        {FAQ.filter((f) => !f.billing || BILLING_ENABLED).map((f) => (
          <details key={f.q} className="faq">
            <summary>{f.q}</summary>
            <p>{f.a}</p>
          </details>
        ))}
      </div>

      <div className="card">
        <h2>Escríbenos</h2>
        <p className="muted small">
          No adjuntes ni pegues datos personales o confidenciales de tus archivos. Si prefieres, escribe directamente a{' '}
          <a href={`mailto:${LEGAL.email}`}>{LEGAL.email}</a>.
        </p>
        <ContactForm kind="soporte" topics={TOPICS} />
      </div>
    </section>
  )
}
