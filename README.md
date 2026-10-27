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
| `POST /api/checkout` | Crea la sesión de Stripe Checkout (exige aceptar Términos y Aviso de privacidad) |
| `POST /api/license` | Emite o renueva el comprobante tras verificar la suscripción en Stripe |
| `POST /api/portal` | Abre el portal de cliente de Stripe (tarjeta, facturas, cancelación) |
| `POST /api/webhook` | Recibe eventos de Stripe y verifica su firma |

Las funciones usan el formato de Vercel (`vercel.json` incluye también cabeceras de seguridad y una
CSP que impide que la página envíe datos a otros dominios).

### Configuración

1. En Stripe crea un producto «DataClean Pro» con un precio recurrente mensual en MXN y copia su `price_…`.
2. Activa el portal de cliente en Stripe (Configuración → Facturación → Portal de clientes) con la opción de cancelar.
3. Crea un webhook hacia `https://tu-dominio.com/api/webhook` y copia su `whsec_…`.
4. En el hosting define las variables de `.env.example`: `STRIPE_SECRET_KEY`, `STRIPE_PRICE_PRO`,
   `STRIPE_WEBHOOK_SECRET`, `LICENSE_SECRET`, `APP_URL` y `VITE_BILLING_ENABLED=true`.

Mientras `VITE_BILLING_ENABLED` no sea `true`, la aplicación funciona sin límites de plan y sin pagos.
**Las claves de Stripe nunca deben subirse al repositorio.**

Limitación conocida: como no hay cuentas, la licencia vive en el navegador donde se pagó. Para usarla
en otro equipo hará falta inicio de sesión (MVP 2 del plan).

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
