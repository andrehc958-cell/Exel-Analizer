import type { ReactNode } from 'react'
import { LEGAL, LEGAL_IS_TEMPLATE } from './config'

export function LegalPage({ title, children }: { title: string; children: ReactNode }) {
  return (
    <article className="card legal">
      <a href="#/" className="back-link">
        ← Volver
      </a>
      <h1>{title}</h1>
      <p className="muted small">Última actualización: {LEGAL.updated}</p>
      {LEGAL_IS_TEMPLATE && (
        <p className="template-warning" role="note">
          Plantilla pendiente: completa los datos entre corchetes y haz que un abogado revise este texto antes de publicar.
        </p>
      )}
      {children}
    </article>
  )
}
