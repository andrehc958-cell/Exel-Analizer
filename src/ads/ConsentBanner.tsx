import type { AdConsent } from './config'

/** Pregunta una sola vez cómo quiere ver los anuncios. Hasta que responda no se carga ninguno. */
export function ConsentBanner({ onChoose }: { onChoose: (value: AdConsent) => void }) {
  return (
    <div className="consent" role="dialog" aria-labelledby="consent-title" aria-describedby="consent-text">
      <div>
        <p id="consent-title" className="consent-title">
          DataClean gratis se mantiene con anuncios
        </p>
        <p id="consent-text" className="small">
          Los anuncios de Google se muestran en un recuadro aislado que no puede ver tus archivos. Si los aceptas
          personalizados, Google puede usar cookies para elegirlos según tus intereses. Más detalles en el{' '}
          <a href="#/privacidad">Aviso de privacidad</a>.
        </p>
      </div>
      <div className="consent-buttons">
        <button className="primary" onClick={() => onChoose('personalized')}>
          Aceptar
        </button>
        <button className="secondary" onClick={() => onChoose('non-personalized')}>
          Sólo no personalizados
        </button>
        <button className="ghost" onClick={() => onChoose('none')}>
          Rechazar
        </button>
      </div>
    </div>
  )
}
