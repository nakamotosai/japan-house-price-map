#!/usr/bin/env node
import { createReadStream } from 'node:fs'
import { access, stat } from 'node:fs/promises'
import { createServer } from 'node:http'
import { extname, join, normalize, resolve } from 'node:path'
import { Readable } from 'node:stream'
import { fileURLToPath } from 'node:url'

const PROJECT_ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)))
const DIST_ROOT = resolve(PROJECT_ROOT, 'dist')
const HOST = process.env.HOST || '127.0.0.1'
const PORT = Number(process.env.PORT || '4173')

const PROTOMAPS_PM_TILES_URL =
  'https://data.source.coop/protomaps/openstreetmap/v4.pmtiles'
const PROTOMAPS_SPRITE_BASE_URL =
  'https://protomaps.github.io/basemaps-assets/sprites/v4/'
const PROTOMAPS_FONTS_BASE_URL =
  'https://protomaps.github.io/basemaps-assets/fonts/'

const MIME_TYPES = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.jpg': 'image/jpeg',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.pbf': 'application/x-protobuf',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
  '.woff2': 'font/woff2',
}

function sendPlainText(res, statusCode, message) {
  res.writeHead(statusCode, { 'Content-Type': 'text/plain; charset=utf-8' })
  res.end(message)
}

function applyCacheHeaders(res, headers) {
  const passthroughHeaders = [
    'accept-ranges',
    'cache-control',
    'content-length',
    'content-range',
    'content-type',
    'etag',
    'expires',
    'last-modified',
  ]

  for (const headerName of passthroughHeaders) {
    const headerValue = headers.get(headerName)
    if (headerValue) {
      res.setHeader(headerName, headerValue)
    }
  }
}

function hasImmutableAssetName(pathname) {
  return /\/assets\/.+-[A-Za-z0-9_-]{8,}\./.test(pathname)
}

function getStaticCacheControl(pathname, searchParams) {
  if (pathname === '/' || pathname.endsWith('.html')) {
    return 'no-cache'
  }

  if (pathname === '/data/tokyo/runtime/index.json') {
    return 'no-cache'
  }

  if (hasImmutableAssetName(pathname)) {
    return 'public, max-age=31536000, immutable'
  }

  if (
    pathname.startsWith('/data/tokyo/runtime/')
    || pathname === '/data/tokyo/stations.meta.json'
  ) {
    if (searchParams.has('v')) {
      return 'public, max-age=31536000, immutable'
    }

    return 'public, max-age=300, stale-while-revalidate=86400'
  }

  if (pathname.startsWith('/vendor/maplibre/')) {
    return 'public, max-age=604800, stale-while-revalidate=2592000'
  }

  return 'public, max-age=3600, stale-while-revalidate=86400'
}

function resolveProtomapsTarget(pathname) {
  if (pathname === '/vendor/protomaps/openstreetmap-v4.pmtiles') {
    return PROTOMAPS_PM_TILES_URL
  }

  const spritePath = pathname.match(/^\/vendor\/protomaps\/sprites\/v4\/(.+)$/)
  if (spritePath) {
    return new URL(spritePath[1], PROTOMAPS_SPRITE_BASE_URL).toString()
  }

  const fontPath = pathname.match(/^\/vendor\/protomaps\/fonts\/(.+)$/)
  if (fontPath) {
    return new URL(fontPath[1], PROTOMAPS_FONTS_BASE_URL).toString()
  }

  return null
}

async function proxyProtomapsRequest(req, res, targetUrl) {
  const headers = {
    'accept-encoding': 'identity',
  }

  if (typeof req.headers.range === 'string') {
    headers.range = req.headers.range
  }
  if (typeof req.headers['if-none-match'] === 'string') {
    headers['if-none-match'] = req.headers['if-none-match']
  }
  if (typeof req.headers['if-modified-since'] === 'string') {
    headers['if-modified-since'] = req.headers['if-modified-since']
  }

  const upstream = await fetch(targetUrl, {
    method: req.method,
    headers,
    redirect: 'follow',
  })

  res.statusCode = upstream.status
  applyCacheHeaders(res, upstream.headers)
  if (!res.hasHeader('Cache-Control')) {
    res.setHeader('Cache-Control', 'public, max-age=86400, stale-while-revalidate=604800')
  }
  res.setHeader('Access-Control-Allow-Origin', '*')

  if (req.method === 'HEAD' || !upstream.body) {
    res.end()
    return
  }

  Readable.fromWeb(upstream.body).pipe(res)
}

async function resolveStaticFile(pathname) {
  const decodedPath = decodeURIComponent(pathname)
  const normalizedPath = normalize(decodedPath).replace(/^(\.\.[/\\])+/, '')
  const candidatePath = resolve(join(DIST_ROOT, normalizedPath.slice(1)))

  if (!candidatePath.startsWith(DIST_ROOT)) {
    return null
  }

  try {
    const fileStat = await stat(candidatePath)
    if (fileStat.isFile()) {
      return candidatePath
    }
  } catch {
    // Fall through to SPA index handling.
  }

  if (extname(candidatePath)) {
    return null
  }

  const indexPath = resolve(DIST_ROOT, 'index.html')
  await access(indexPath)
  return indexPath
}

async function serveStaticFile(req, res, requestUrl) {
  const pathname = requestUrl.pathname
  const filePath = await resolveStaticFile(pathname)
  if (!filePath) {
    sendPlainText(res, 404, 'Not Found')
    return
  }

  const fileStat = await stat(filePath)
  const contentType =
    MIME_TYPES[extname(filePath)] || 'application/octet-stream'

  res.writeHead(200, {
    'Content-Length': fileStat.size,
    'Cache-Control': getStaticCacheControl(pathname, requestUrl.searchParams),
    'Content-Type': contentType,
  })

  if (req.method === 'HEAD') {
    res.end()
    return
  }

  createReadStream(filePath).pipe(res)
}

const server = createServer(async (req, res) => {
  if (!req.url || !req.method) {
    sendPlainText(res, 400, 'Bad Request')
    return
  }

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    sendPlainText(res, 405, 'Method Not Allowed')
    return
  }

  const requestUrl = new URL(req.url, `http://${req.headers.host || `${HOST}:${PORT}`}`)
  const protomapsTarget = resolveProtomapsTarget(requestUrl.pathname)

  try {
    if (protomapsTarget) {
      await proxyProtomapsRequest(req, res, protomapsTarget)
      return
    }

    await serveStaticFile(req, res, requestUrl)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown_error'
    sendPlainText(res, 502, `proxy_failed:${message}`)
  }
})

server.listen(PORT, HOST, () => {
  process.stdout.write(`dist proxy listening on http://${HOST}:${PORT}\n`)
})

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    server.close(() => process.exit(0))
  })
}
