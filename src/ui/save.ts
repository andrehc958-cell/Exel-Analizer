interface SaveFilePickerWindow {
  showSaveFilePicker?: (opts: {
    suggestedName: string
    types: { description: string; accept: Record<string, string[]> }[]
  }) => Promise<FileSystemFileHandle>
}

/**
 * Guarda un archivo generado en el navegador. Con la File System Access API (Chrome, Edge)
 * el usuario elige dónde guardarlo; si no existe, se descarga de la forma habitual.
 * El diálogo se abre antes de generar el archivo para conservar el gesto del usuario.
 */
export async function saveGenerated(
  suggestedName: string,
  mime: string,
  extension: string,
  generate: () => Promise<{ data: ArrayBuffer; filename: string }>,
): Promise<boolean> {
  const w = window as unknown as SaveFilePickerWindow
  if (w.showSaveFilePicker && window.isSecureContext && window.self === window.top) {
    let handle: FileSystemFileHandle
    try {
      handle = await w.showSaveFilePicker({
        suggestedName,
        types: [{ description: extension.toUpperCase(), accept: { [mime.split(';')[0]]: [`.${extension}`] } }],
      })
    } catch (e) {
      if ((e as DOMException).name === 'AbortError') return false
      return download(await generate(), mime)
    }
    const { data } = await generate()
    const writable = await handle.createWritable()
    await writable.write(data)
    await writable.close()
    return true
  }
  return download(await generate(), mime)
}

function download({ data, filename }: { data: ArrayBuffer; filename: string }, mime: string): boolean {
  const url = URL.createObjectURL(new Blob([data], { type: mime }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
  return true
}
