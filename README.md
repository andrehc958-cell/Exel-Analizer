# DataClean · Limpiador inteligente de Excel

Aplicación web para limpiar, validar y transformar archivos **Excel (.xlsx)** y **CSV**.
El usuario carga un archivo, revisa los problemas detectados, elige qué corregir y descarga
el resultado junto con un registro de los cambios.

**Todo el procesamiento ocurre en el navegador**: los archivos nunca se suben a un servidor.

## Uso

```bash
npm install
npm run dev       # servidor de desarrollo en http://localhost:5173
npm test          # pruebas del motor y de los pagos (Vitest)
npm run build     # build de producción en dist/ (sitio estático)
```

El resultado de `npm run build` es un sitio estático: se puede publicar en cualquier hosting
(GitHub Pages, Netlify, Cloudflare Pages, Vercel…) sin backend.

## Qué hace (MVP 1)

| Requerimiento | Estado |
| --- | --- |
| RF-01 Cargar CSV y .xlsx (arrastrar, elegir o pegar) | ✅ |
| RF-02 Validar extensión, tipo real (firma del archivo), tamaño y estructura | ✅ |
| RF-03 Vista previa paginada | ✅ |
| RF-04 Vacíos (el 0 nunca cuenta como vacío; celdas sólo con espacios aparte) | ✅ |
| RF-05 Duplicados por fila completa o por columnas elegidas | ✅ |
| RF-06 Espacios sobrantes y texto escrito de distintas formas (mayúsculas, acentos) | ✅ |
| RF-07 Números y fechas escritos como texto; fechas ambiguas (03/04 ¿abril o marzo?) | ✅ |
| RF-08 El usuario elige qué corregir; nada se aplica por defecto | ✅ |
| RF-09 Vista antes/después con celdas cambiadas resaltadas | ✅ |
| RF-10 Descarga en CSV o Excel | ✅ |
| RF-11 Resumen de cambios (también como hoja «Registro de cambios» en el Excel) | ✅ |
| RF-12 Errores comprensibles sin bloquear la aplicación | ✅ |

Además marca valores atípicos (regla IQR) sin eliminarlos, y ofrece eliminar filas y columnas vacías.

## Arquitectura

```
src/
  engine/        Motor de limpieza en TypeScript puro (sin DOM ni React)
    io.ts        Validación, lectura CSV/XLSX, exportación CSV/XLSX
    profile.ts   Detección (informe de calidad). Nunca modifica datos
    clean.ts     Correcciones seleccionadas + registro de auditoría
    session.ts   Estado de una sesión (archivo, hoja, resultado)
  worker/        Web Worker que ejecuta el motor y protocolo RPC tipado
  ui/            Componentes React
  App.tsx        Flujo: Cargar → Hoja → Revisar → Descargar
```

Aprovechamiento del navegador:

- **Web Worker**: lectura, análisis, limpieza y exportación corren fuera del hilo de la interfaz,
  así la página no se congela con archivos grandes.
- **Transferable ArrayBuffer**: el archivo pasa al worker sin copiarse en memoria, y el archivo
  exportado vuelve igual.
- **Paginación desde el worker**: los datos completos se quedan en el worker; a la interfaz sólo
  llegan páginas de 50 filas y resúmenes.
- **Carga diferida**: la librería de Excel (ExcelJS) sólo se descarga cuando se abre o exporta un .xlsx.
- **File System Access API**: en Chrome/Edge el usuario elige dónde guardar; en otros navegadores
  se descarga de la forma habitual.
- **TextDecoder**: detecta UTF-8 y, si falla, lee como Windows-1252 (CSV guardados por Excel en Windows).

### Diferencia con el plan original

El plan proponía un motor en Python (pandas) con FastAPI. Como la aplicación se construye para
correr en el navegador, el motor está escrito en TypeScript y se ejecuta en un Web Worker:
no hay costos de servidor, los datos no salen del equipo del usuario y el motor sigue separado
de la interfaz (RNF-06), con pruebas automatizadas propias. Si más adelante se necesita
procesamiento en servidor (lotes, API), el mismo motor puede correr en Node.

## Seguridad y reglas de datos

- El archivo original nunca se modifica (se trabaja sobre una copia).
- Las fórmulas no se evalúan: se usa el resultado guardado en el archivo.
- Rechaza `.xls`, `.xlsm` y `.xlsb`, archivos vacíos, binarios o con extensión falsa.
- Límites: 50 MB, 500 000 filas, 500 columnas, 10 millones de celdas (`DEFAULT_LIMITS` en `io.ts`).
- El CSV exportado neutraliza la inyección de fórmulas (`=`, `+`, `-`, `@` al inicio de un texto).
- Los ceros a la izquierda (códigos postales, claves) se conservan como texto.
- Las fechas ambiguas y las conversiones de tipo nunca se aplican sin una decisión explícita.
- Los valores que no se pueden convertir se dejan intactos y se reportan.

## Pagos con Stripe

Planes: **Gratis** (archivos de hasta 5 MB y 20 000 filas) y **Pro** (suscripción mensual, hasta 50 MB y 500 000 filas).
Los límites están en `src/billing/plan.ts`; el precio se define en Stripe.

No hay base de datos ni cuentas: Stripe es la fuente de verdad. Tras pagar, el servidor consulta
la suscripción en Stripe y entrega un comprobante de licencia firmado (HMAC) que el navegador
guarda y renueva cada pocos días. Si la suscripción se cancela o deja de pagarse, el comprobante
ya no se renueva y el navegador vuelve al plan gratuito.

| Función (`api/`) | Qué hace |
| --- | --- |
| `POST /api/checkout` | Crea la sesión de Stripe Checkout: Pro mensual, Pro anual o pase de 24 h (exige aceptar Términos y Aviso de privacidad) |
| `POST /api/license` | Emite o renueva el comprobante tras verificar la suscripción o el pago del pase en Stripe |
| `POST /api/portal` | Abre el portal de cliente de Stripe (tarjeta, facturas, cancelación) |
| `POST /api/webhook` | Recibe eventos de Stripe y verifica su firma |
| `GET /ads.txt` | Declara la cuenta de AdSense (`api/ads-txt.ts`) |

Las funciones usan el formato de Vercel (`vercel.json` incluye también cabeceras de seguridad y una
CSP que impide que la página envíe datos a otros dominios).

### Configuración

1. En Stripe crea un producto «DataClean Pro» con un precio recurrente mensual en MXN y copia su `price_…`.
2. Activa el portal de cliente en Stripe (Configuración → Facturación → Portal de clientes) con la opción de cancelar.
3. Crea un webhook hacia `https://tu-dominio.com/api/webhook` y copia su `whsec_…`.
4. En el hosting define las variables de `.env.example`: `STRIPE_SECRET_KEY`, `STRIPE_PRICE_PRO`,
   `STRIPE_WEBHOOK_SECRET`, `LICENSE_SECRET`, `APP_URL` y `VITE_BILLING_ENABLED=true`.

En Vercel basta con menos: la integración de Stripe crea la clave con prefijo (`ALGO_STRIPE_SECRET_KEY`) y se
usa tal cual; `APP_URL` toma el dominio de producción del proyecto, y si falta `LICENSE_SECRET` se deriva uno
de la clave de Stripe (al rotar esa clave los clientes tendrán que restaurar su licencia). Lo mínimo es
`VITE_BILLING_ENABLED=true`: sin `STRIPE_PRICE_PRO` se cobra el precio por defecto de
`server/billing.ts` ($199 MXN al mes, producto «DataClean Pro»).

Mientras `VITE_BILLING_ENABLED` no sea `true`, la aplicación funciona sin límites de plan y sin pagos.
**Las claves de Stripe nunca deben subirse al repositorio.**

Limitación conocida: como no hay cuentas, la licencia vive en el navegador donde se pagó. Para usarla
en otro equipo hará falta inicio de sesión (MVP 2 del plan).

## Otras fuentes de ingreso

Todas son opcionales y se activan con variables de entorno (ver `.env.example`).

| Fuente | Cómo funciona | Variables |
| --- | --- | --- |
| **Plan Pro anual** | Suscripción anual con descuento (sugerido: $1,990 MXN, 2 meses gratis). Mismo flujo y portal que el mensual. | `STRIPE_PRICE_PRO_ANNUAL`, `VITE_PRO_ANNUAL_PRICE_LABEL`, `VITE_PRO_ANNUAL_NOTE` |
| **Pase de 24 horas** | Pago único (sugerido: $49 MXN) para quien sólo necesita limpiar un archivo grande. Da Pro durante 24 h desde la compra y no se renueva. | `STRIPE_PRICE_PASS`, `VITE_PASS_PRICE_LABEL` |
| **Donaciones** | Botón «Invítanos un café» en Planes, en el pie y en el aviso del plan gratuito. Usa un [Payment Link](https://dashboard.stripe.com/payment-links) de Stripe con «el cliente elige el monto»; no necesita código de servidor. | `VITE_DONATION_URL` |
| **Anuncios** | Google AdSense, sólo para el plan gratuito y sólo tras aceptar en el aviso de consentimiento. Pro y pase no ven anuncios. | `VITE_ADSENSE_CLIENT`, `VITE_ADSENSE_SLOT` |

### Configurar el plan anual y el pase

1. En el producto «DataClean Pro» de Stripe agrega un precio recurrente **anual** en MXN y copia su `price_…`.
2. Crea un producto «Pase DataClean 24 horas» con un precio **único** y copia su `price_…`.
3. Define `STRIPE_PRICE_PRO_ANNUAL`, `STRIPE_PRICE_PASS` y las etiquetas `VITE_…` en el hosting.

El pase sólo se activa con sesiones de Checkout creadas por `/api/checkout` (llevan `metadata.product = pass`),
así que una donación u otro cobro de la misma cuenta nunca da acceso Pro.

### Anuncios sin comprometer la privacidad

La promesa de DataClean es que los archivos no salen del navegador, así que el código de AdSense **nunca se
carga en la página del limpiador**:

- El anuncio vive en `public/anuncio.html`, dentro de un iframe con `sandbox` **sin** `allow-same-origin`. El
  navegador le asigna un origen opaco: no puede leer la página, los datos del archivo ni el almacenamiento local.
- La página principal conserva su CSP estricta (`script-src 'self'`, `connect-src 'self'`); sólo `anuncio.html`
  tiene una CSP que permite los dominios de Google.
- No se carga ningún anuncio hasta que el visitante elige en el aviso: «Aceptar» (personalizados), «Sólo no
  personalizados» (`requestNonPersonalizedAds`) o «Rechazar» (se muestra un aviso propio para apoyar con Pro o
  una donación). La elección se puede cambiar en «Preferencias de anuncios», al pie de la página.
- `/ads.txt` se genera a partir de `VITE_ADSENSE_CLIENT` (`api/ads-txt.ts`) y el build agrega la etiqueta
  `google-adsense-account` para que Google verifique el sitio.

Pasos: crea la cuenta en [AdSense](https://adsense.google.com), agrega el dominio, crea un bloque de anuncios
de display y copia `ca-pub-…` y el id del bloque en `VITE_ADSENSE_CLIENT` y `VITE_ADSENSE_SLOT`.

Compromiso conocido: con origen opaco el anuncio no tiene cookies, por lo que AdSense puede servir menos anuncios
o pagar menos por ellos. Si se quiere mejorar, aloja `anuncio.html` y `anuncio.js` en **otro dominio** (por ejemplo
`anuncios-dataclean.com`), define `VITE_AD_FRAME_URL` con esa dirección y agrega ese origen a `frame-src` en
`vercel.json`: al ser otro origen el navegador sigue impidiendo que lea la página, y el iframe puede conservar
sus cookies.

## Servicio al cliente y buzón de sugerencias

- `#/soporte`: preguntas frecuentes y formulario de contacto (tema, nombre, correo, mensaje y aceptación del aviso de privacidad).
- `#/sugerencias`: buzón donde el nombre y el correo son opcionales, para permitir sugerencias anónimas.

Los dos formularios envían a `POST /api/contact`, que valida los datos, descarta bots con un campo
trampa y manda el mensaje por correo con [Resend](https://resend.com) a `CONTACT_TO`, con
`reply_to` igual al correo del usuario para responderle directamente. Si `RESEND_API_KEY` no está
configurada, el formulario ofrece escribir a `VITE_LEGAL_EMAIL`.

## Aviso de privacidad y Términos

`#/privacidad` y `#/terminos` contienen un aviso de privacidad integral (LFPDPPP) y términos con
servicio «tal cual» y limitación de responsabilidad. Los datos del responsable se completan con las
variables `VITE_LEGAL_*`; mientras falten, las páginas muestran un aviso de plantilla.
**Son una plantilla y deben revisarse con un abogado antes de publicar.** Ningún texto legal elimina
toda responsabilidad: por ejemplo, la ley no permite limitar la responsabilidad por dolo ni renunciar
a los derechos del consumidor.

## Próximos pasos sugeridos

- Procesamiento por streaming para archivos más grandes que la memoria disponible.
- Guardar reglas de limpieza reutilizables (MVP 3) en IndexedDB.
- PWA instalable y uso sin conexión.
