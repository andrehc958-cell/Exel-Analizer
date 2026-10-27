import { LEGAL } from './config'
import { LegalPage } from './LegalPage'

export function Terms() {
  return (
    <LegalPage title="Términos y condiciones de uso">
      <p>
        Estos términos regulan el uso de {LEGAL.product} (el «Servicio»), ofrecido por {LEGAL.owner} (el «Titular»). Al
        usar el Servicio o contratar una suscripción aceptas estos términos y el{' '}
        <a href="#/privacidad">Aviso de privacidad</a>. Si no estás de acuerdo, no utilices el Servicio.
      </p>

      <h2>1. Descripción del Servicio</h2>
      <p>
        El Servicio es una herramienta que analiza archivos Excel y CSV y aplica las correcciones que el usuario elige.
        El procesamiento ocurre en el navegador del usuario; el Titular no recibe ni almacena el contenido de los
        archivos.
      </p>

      <h2>2. Responsabilidades del usuario</h2>
      <ul>
        <li>Conservar una copia de sus archivos originales antes de usar el Servicio.</li>
        <li>
          Revisar y validar los resultados antes de utilizarlos para cualquier fin, en particular para decisiones
          contables, fiscales, legales, financieras, médicas o de cualquier tipo con consecuencias relevantes.
        </li>
        <li>Contar con los derechos y autorizaciones necesarios sobre los datos que procesa, incluidos datos personales de terceros.</li>
        <li>No usar el Servicio para fines ilícitos ni intentar vulnerar su seguridad o eludir los límites de los planes.</li>
      </ul>

      <h2>3. Servicio «tal cual»</h2>
      <p>
        El Servicio se ofrece «tal cual» y «según disponibilidad». Las detecciones y correcciones son automáticas y pueden
        contener errores u omisiones: la limpieza de datos depende del formato y significado de cada archivo, que el
        Servicio no puede conocer con certeza. En la medida permitida por la ley, el Titular no garantiza que el Servicio
        esté libre de errores, que sea ininterrumpido ni que los resultados sean adecuados para un propósito particular.
      </p>

      <h2>4. Limitación de responsabilidad</h2>
      <p>En la máxima medida permitida por la legislación aplicable:</p>
      <ul>
        <li>
          El Titular no será responsable por pérdida o alteración de datos, lucro cesante, pérdida de oportunidades de
          negocio ni daños indirectos o consecuenciales derivados del uso o de la imposibilidad de usar el Servicio, ni de
          las decisiones tomadas con base en sus resultados.
        </li>
        <li>
          La responsabilidad total del Titular por cualquier reclamación relacionada con el Servicio se limita al monto
          efectivamente pagado por el usuario durante los doce meses anteriores al hecho que la origine. Para usuarios
          del plan gratuito, dicha responsabilidad se limita a cero pesos.
        </li>
        <li>
          Nada de lo anterior excluye la responsabilidad que no pueda limitarse conforme a la ley, incluida la derivada
          de dolo o mala fe, ni los derechos irrenunciables que la Ley Federal de Protección al Consumidor otorga a los
          consumidores.
        </li>
      </ul>

      <h2>5. Planes, pagos y cancelación</h2>
      <ul>
        <li>
          El plan gratuito tiene límites de tamaño y número de filas por archivo, que pueden cambiar, y puede mostrar
          publicidad de terceros conforme al <a href="#/privacidad">Aviso de privacidad</a>.
        </li>
        <li>
          El plan Pro es una suscripción mensual o anual, según elijas, que se cobra por adelantado a través de Stripe y
          se renueva automáticamente por el mismo periodo hasta que la canceles. El precio vigente se muestra antes de pagar e incluye los impuestos
          aplicables, salvo que se indique otra cosa.
        </li>
        <li>
          Puedes cancelar en cualquier momento desde «Administrar suscripción». La cancelación surte efecto al final del
          periodo ya pagado y no se generan cargos posteriores. Salvo que la ley disponga otra cosa, no se hacen
          reembolsos proporcionales por periodos parciales.
        </li>
        <li>
          El pase de 24 horas es un pago único que habilita las funciones de Pro en el navegador donde se compra
          durante 24 horas contadas desde el pago. No se renueva ni genera cargos posteriores. Como el acceso se entrega
          de inmediato, salvo que la ley disponga otra cosa, no es reembolsable una vez activado.
        </li>
        <li>
          Las donaciones son aportaciones voluntarias para apoyar el desarrollo del Servicio. No constituyen la compra
          de un producto o servicio, no cambian tu plan ni dan derecho a funciones adicionales y no son deducibles de
          impuestos. Si hiciste una donación por error, escríbenos dentro de los 30 días siguientes para devolverla.
        </li>
        <li>Los cambios de precio se avisarán con anticipación y aplicarán a partir del siguiente periodo de facturación.</li>
      </ul>

      <h2>6. Propiedad intelectual</h2>
      <p>
        El software, la marca y el contenido del Servicio pertenecen al Titular o a sus licenciantes. Los archivos y
        resultados del usuario son siempre del usuario.
      </p>

      <h2>7. Suspensión y modificaciones</h2>
      <p>
        El Titular puede modificar, suspender o descontinuar el Servicio o estos términos. Los cambios relevantes se
        publicarán en esta página con su fecha de actualización; el uso continuado posterior implica su aceptación.
      </p>

      <h2>8. Ley aplicable y jurisdicción</h2>
      <p>
        Estos términos se rigen por las leyes de los Estados Unidos Mexicanos. Para su interpretación y cumplimiento las
        partes se someten a los tribunales competentes de {LEGAL.jurisdiction}, sin perjuicio de los derechos del
        consumidor de acudir a la Procuraduría Federal del Consumidor.
      </p>

      <h2>9. Contacto</h2>
      <p>
        Para cualquier duda o aclaración escribe a <strong>{LEGAL.email}</strong>.
      </p>
    </LegalPage>
  )
}
