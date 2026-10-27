import { ContactForm } from './ContactForm'

const TOPICS = [
  { value: 'mejora', label: 'Mejorar algo que ya existe' },
  { value: 'nueva-funcion', label: 'Una función nueva' },
  { value: 'error', label: 'Algo no funciona bien' },
  { value: 'otro', label: 'Otro comentario' },
]

export function Suggestions() {
  return (
    <section aria-labelledby="suggestions-title" className="page">
      <a href="#/" className="back-link">
        ← Volver
      </a>
      <h1 id="suggestions-title">Buzón de sugerencias</h1>
      <p className="muted">
        DataClean crece con lo que nos cuentas. Comparte ideas, críticas o tareas que te gustaría automatizar. Puedes enviar
        tu sugerencia de forma anónima.
      </p>
      <div className="card">
        <ContactForm kind="sugerencia" topics={TOPICS} />
      </div>
    </section>
  )
}
