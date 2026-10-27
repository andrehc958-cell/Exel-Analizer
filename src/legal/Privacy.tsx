import { LEGAL } from './config'
import { LegalPage } from './LegalPage'

export function Privacy() {
  return (
    <LegalPage title="Aviso de privacidad integral">
      <p>
        {LEGAL.owner} (en adelante, «el Responsable»), con domicilio en {LEGAL.address}, es responsable del tratamiento de
        los datos personales que se recaban a través de {LEGAL.product} (en adelante, «el Servicio»), conforme a la Ley
        Federal de Protección de Datos Personales en Posesión de los Particulares y demás normativa aplicable en México.
      </p>

      <h2>1. Archivos que procesas: no los recibimos</h2>
      <p>
        Los archivos de Excel y CSV que cargas se procesan <strong>exclusivamente en tu navegador</strong>. No se envían,
        copian ni almacenan en nuestros servidores, y el Responsable no tiene acceso a su contenido. Al cerrar o recargar
        la página, los datos se eliminan de la memoria de tu navegador. Eres responsable de contar con la autorización
        necesaria para tratar los datos personales de terceros que contengan tus archivos.
      </p>

      <h2>2. Datos personales que sí tratamos</h2>
      <ul>
        <li>
          <strong>Datos de suscripción y facturación</strong> (sólo si contratas el plan Pro): nombre, correo electrónico,
          país y, en su caso, datos fiscales; identificador de cliente y estado de la suscripción. Los datos de tu
          tarjeta los recaba y procesa directamente Stripe; el Responsable nunca recibe el número completo de tu tarjeta.
        </li>
        <li>
          <strong>Datos técnicos</strong>: dirección IP, tipo de navegador, fecha y hora de las solicitudes a nuestros
          servidores, que el proveedor de hospedaje registra por seguridad.
        </li>
        <li>
          <strong>Almacenamiento local</strong>: guardamos en tu navegador un comprobante de licencia para recordar tu
          plan. No usamos cookies publicitarias ni herramientas de rastreo de terceros.
        </li>
      </ul>
      <p>No solicitamos datos personales sensibles.</p>

      <h2>3. Finalidades</h2>
      <p>Tus datos se utilizan para las siguientes finalidades necesarias para prestar el Servicio:</p>
      <ul>
        <li>Gestionar tu suscripción, cobros, renovaciones, cancelaciones y comprobantes fiscales.</li>
        <li>Verificar tu plan y habilitar las funciones contratadas.</li>
        <li>Atender solicitudes de soporte, aclaraciones y ejercicio de derechos.</li>
        <li>Mantener la seguridad del Servicio y prevenir fraudes.</li>
        <li>Cumplir obligaciones legales, fiscales y requerimientos de autoridades.</li>
      </ul>
      <p>No utilizamos tus datos para finalidades secundarias como publicidad o elaboración de perfiles.</p>

      <h2>4. Transferencias y encargados</h2>
      <p>Para prestar el Servicio compartimos datos con:</p>
      <ul>
        <li>
          <strong>Stripe</strong>, procesador de pagos, que puede tratar los datos fuera de México conforme a su propio
          aviso de privacidad.
        </li>
        <li>
          <strong>El proveedor de hospedaje</strong> del sitio y de las funciones de pago, como encargado del tratamiento.
        </li>
        <li>Autoridades competentes, cuando lo exija la ley o un mandato judicial.</li>
      </ul>
      <p>
        Estas comunicaciones son necesarias para cumplir la relación contractual contigo o una obligación legal, por lo
        que no requieren tu consentimiento conforme a la ley. No vendemos tus datos personales.
      </p>

      <h2>5. Conservación</h2>
      <p>
        Conservamos los datos de suscripción mientras esté vigente y, después, durante los plazos que exijan las
        disposiciones fiscales y legales aplicables. Al concluir, se eliminan o bloquean.
      </p>

      <h2>6. Derechos ARCO y revocación del consentimiento</h2>
      <p>
        Puedes ejercer tus derechos de Acceso, Rectificación, Cancelación y Oposición, revocar tu consentimiento o
        limitar el uso y divulgación de tus datos enviando una solicitud a <strong>{LEGAL.email}</strong> que incluya:
        tu nombre y un medio para comunicarte contigo; un documento que acredite tu identidad o, en su caso, la
        representación legal; la descripción clara de los datos y del derecho que deseas ejercer; y cualquier elemento
        que facilite localizar tus datos.
      </p>
      <p>
        Responderemos dentro de los plazos que establece la ley (actualmente, 20 días hábiles para comunicarte la
        determinación y 15 días hábiles adicionales para hacerla efectiva). Si consideras que tu derecho no fue
        atendido, puedes acudir ante la autoridad competente en materia de protección de datos personales.
      </p>

      <h2>7. Cambios a este aviso</h2>
      <p>
        Cualquier modificación se publicará en esta misma página, indicando la fecha de la última actualización. Si el
        cambio afecta las finalidades del tratamiento, te lo notificaremos por correo electrónico cuando tengamos tu
        dirección.
      </p>
    </LegalPage>
  )
}
