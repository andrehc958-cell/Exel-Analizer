import { createServer } from 'node:http'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { readdirSync, readFileSync } from 'node:fs'
import { readFile, stat } from 'node:fs/promises'
import { dirname, extname, join, normalize, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * Servidor para hostings con un proceso de Node (Render, Railway, un VPS…).
 * Sirve el build de Vite (dist/), ejecuta las funciones de api/ y aplica las mismas
 * cabeceras y reescrituras declaradas en vercel.json, para que ambos hostings se comporten igual.
 */

const here = dirname(fileURLToPath(import.meta.url))
// Compilado en build-server/server/http.js: la raíz del proyecto está dos niveles arriba.
const root = resolve(here, '..', '..')
const distDir = join(root, 'dist')
const apiDir = resolve(here, '..', 'api')
const MAX_BODY = 1024 * 1024

interface VercelConfig {
  rewrites?: { source: string; destination: string }[]
  headers?: { source: string; headers: { key: string; value: string }[] }[]
}

const config = JSON.parse(readFileSync(join(root, 'vercel.json'), 'utf8')) as VercelConfig
// Las fuentes de vercel.json usadas aquí son expresiones regulares sobre la ruta completa.
const toRegex = (source: string) => new RegExp(`^${source}$`)
const rewrites = (config.rewrites ?? []).map((r) => ({ re: toRegex(r.source), destination: r.destination }))
const headerRules = (config.headers ?? []).map((h) => ({ re: toRegex(h.source), headers: h.headers }))

const apiNames = new Set(
  readdirSync(apiDir)
    .filter((f) => f.endsWith('.js'))
    .map((f) => f.slice(0, -3)),
)

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.woff2': 'font/woff2',
}

type Handler = (request: Request) => Response | Promise<Response>

async function handleApi(name: string, req: IncomingMessage, res: ServerResponse, url: URL) {
  const mod = (await import(`../api/${name}.js`)) as Record<string, Handler | undefined>
  const handler = mod[req.method ?? 'GET']
  if (!handler) {
    res.writeHead(405, { allow: Object.keys(mod).join(', ') }).end()
    return
  }
  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of req) {
    size += (chunk as Buffer).length
    if (size > MAX_BODY) {
      res.writeHead(413).end()
      return
    }
    chunks.push(chunk as Buffer)
  }
  const headers = new Headers()
  for (const [key, value] of Object.entries(req.headers)) {
    if (typeof value === 'string') headers.set(key, value)
    else if (Array.isArray(value)) value.forEach((v) => headers.append(key, v))
  }
  const hasBody = req.method !== 'GET' && req.method !== 'HEAD'
  const response = await handler(
    new Request(url, { method: req.method, headers, body: hasBody ? Buffer.concat(chunks) : undefined }),
  )
  res.statusCode = response.status
  response.headers.forEach((value, key) => res.setHeader(key, value))
  res.end(Buffer.from(await response.arrayBuffer()))
}

async function serveStatic(pathname: string, res: ServerResponse, method: string) {
  let file = normalize(join(distDir, decodeURIComponent(pathname)))
  if (file !== distDir && !file.startsWith(distDir + sep)) {
    res.writeHead(400).end()
    return
  }
  let info = await stat(file).catch(() => null)
  if (info?.isDirectory()) {
    file = join(file, 'index.html')
    info = await stat(file).catch(() => null)
  }
  if (!info) {
    // Rutas sin extensión: es una página de la app (usa rutas con #), se sirve index.html.
    if (extname(pathname)) {
      res.writeHead(404, { 'content-type': TYPES['.txt'] }).end('No encontrado')
      return
    }
    file = join(distDir, 'index.html')
  }
  const body = await readFile(file)
  res.setHeader('content-type', TYPES[extname(file)] ?? 'application/octet-stream')
  res.setHeader('cache-control', pathname.startsWith('/assets/') ? 'public, max-age=31536000, immutable' : 'no-cache')
  res.end(method === 'HEAD' ? undefined : body)
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`)
    let pathname = url.pathname
    for (const r of rewrites) {
      if (r.re.test(pathname)) {
        pathname = r.destination
        break
      }
    }
    for (const rule of headerRules) {
      if (rule.re.test(pathname)) rule.headers.forEach((h) => res.setHeader(h.key, h.value))
    }
    const api = /^\/api\/([a-z0-9-]+)\/?$/.exec(pathname)
    if (api) {
      if (apiNames.has(api[1])) await handleApi(api[1], req, res, url)
      else res.writeHead(404).end()
      return
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.writeHead(405, { allow: 'GET, HEAD' }).end()
      return
    }
    await serveStatic(pathname, res, req.method)
  } catch (err) {
    console.error('[http]', err instanceof Error ? err.message : err)
    if (!res.headersSent) res.writeHead(500)
    res.end()
  }
})

const port = Number(process.env.PORT) || 3000
server.listen(port, () => console.info(`DataClean escuchando en el puerto ${port}`))
