/**
 * Datos del responsable para los textos legales. Completa los campos entre corchetes
 * antes de publicar. Los textos son una plantilla y deben revisarse con un abogado.
 */
export const LEGAL = {
  product: 'DataClean',
  owner: import.meta.env.VITE_LEGAL_OWNER || '[Nombre completo o razón social del responsable]',
  address: import.meta.env.VITE_LEGAL_ADDRESS || '[Domicilio completo: calle, número, colonia, municipio, estado, C.P.]',
  email: import.meta.env.VITE_LEGAL_EMAIL || '[correo de contacto para privacidad]',
  jurisdiction: import.meta.env.VITE_LEGAL_JURISDICTION || '[Ciudad, Estado]',
  updated: '27 de octubre de 2026',
}

export const LEGAL_IS_TEMPLATE = Object.values(LEGAL).some((v) => v.startsWith('['))
