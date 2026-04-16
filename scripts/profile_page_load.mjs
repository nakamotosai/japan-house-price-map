#!/usr/bin/env node
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { spawn } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'

const PROJECT_ROOT = '/home/ubuntu/codex/日本房价地图'
const ARTIFACT_ROOT = resolve(PROJECT_ROOT, '.artifacts', 'load-profiles')
const CHROME_BIN = process.env.CHROME_BIN || '/usr/bin/chromium-browser'
const DEFAULT_URL = 'http://127.0.0.1:4173/'

function parseArgs(argv) {
  const args = {
    label: 'run',
    timeoutMs: 20000,
    url: DEFAULT_URL,
  }

  for (let index = 2; index < argv.length; index += 1) {
    const item = argv[index]
    if (item === '--url' && argv[index + 1]) {
      args.url = argv[index + 1]
      index += 1
    } else if (item === '--label' && argv[index + 1]) {
      args.label = argv[index + 1]
      index += 1
    } else if (item === '--timeout' && argv[index + 1]) {
      args.timeoutMs = Number(argv[index + 1])
      index += 1
    }
  }

  return args
}

async function waitForJson(url, timeoutMs = 15000) {
  const startedAt = Date.now()
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(url)
      if (response.ok) {
        return response.json()
      }
    } catch {
      // Wait for DevTools endpoint.
    }
    await delay(150)
  }

  throw new Error(`timeout_waiting_for:${url}`)
}

async function waitForHttpOk(url, timeoutMs = 15000) {
  const startedAt = Date.now()
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(url, { method: 'HEAD' })
      if (response.ok) {
        return
      }
    } catch {
      // Wait for preview server.
    }
    await delay(150)
  }

  throw new Error(`timeout_waiting_for_http_ok:${url}`)
}

class CDPClient {
  constructor(wsUrl) {
    this.ws = new WebSocket(wsUrl)
    this.id = 0
    this.pending = new Map()
    this.listeners = new Map()
  }

  async connect() {
    await new Promise((resolvePromise, rejectPromise) => {
      this.ws.addEventListener('open', () => resolvePromise())
      this.ws.addEventListener('error', (event) =>
        rejectPromise(event.error ?? new Error('ws_open_failed')),
      )
    })

    this.ws.addEventListener('message', (event) => {
      const payload = JSON.parse(event.data)
      if (payload.id) {
        const pending = this.pending.get(payload.id)
        if (!pending) {
          return
        }
        this.pending.delete(payload.id)
        if (payload.error) {
          pending.reject(new Error(payload.error.message))
          return
        }
        pending.resolve(payload.result)
        return
      }

      const callbacks = this.listeners.get(payload.method) ?? []
      callbacks.forEach((callback) => callback(payload.params))
    })
  }

  close() {
    this.ws.close()
  }

  send(method, params = {}) {
    const id = this.id + 1
    this.id = id

    return new Promise((resolvePromise, rejectPromise) => {
      this.pending.set(id, { resolve: resolvePromise, reject: rejectPromise })
      this.ws.send(JSON.stringify({ id, method, params }))
    })
  }

  on(method, callback) {
    const current = this.listeners.get(method) ?? []
    current.push(callback)
    this.listeners.set(method, current)
  }
}

async function evaluate(client, expression) {
  const result = await client.send('Runtime.evaluate', {
    expression,
    awaitPromise: true,
    returnByValue: true,
  })

  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.text ?? 'runtime_evaluate_failed')
  }

  return result.result?.value
}

async function waitForExpression(client, expression, timeoutMs) {
  const startedAt = Date.now()
  while (Date.now() - startedAt < timeoutMs) {
    const value = await evaluate(client, expression)
    if (value) {
      return value
    }
    await delay(100)
  }

  throw new Error(`timeout_waiting_for_expression:${expression}`)
}

async function main() {
  const args = parseArgs(process.argv)
  const timestamp = new Date().toISOString().replaceAll(':', '').replace(/\..+$/, 'Z')
  const artifactDir = resolve(ARTIFACT_ROOT, timestamp)
  await mkdir(artifactDir, { recursive: true })

  await waitForHttpOk(args.url)

  const chromeProfile = await mkdtemp(join(tmpdir(), 'tokyo-load-profile-'))
  const debugPort = 9700 + Math.floor(Math.random() * 200)
  const chromeProcess = spawn(
    CHROME_BIN,
    [
      '--headless=new',
      '--disable-dev-shm-usage',
      '--enable-webgl',
      '--ignore-gpu-blocklist',
      '--use-angle=swiftshader',
      `--remote-debugging-port=${debugPort}`,
      `--user-data-dir=${chromeProfile}`,
      '--window-size=1440,960',
      'about:blank',
    ],
    { stdio: 'ignore' },
  )

  let client
  try {
    const version = await waitForJson(`http://127.0.0.1:${debugPort}/json/version`)
    const targets = await waitForJson(`http://127.0.0.1:${debugPort}/json/list`)
    const pageTarget = targets.find((target) => target.type === 'page') ?? targets[0]
    client = new CDPClient(pageTarget.webSocketDebuggerUrl ?? version.webSocketDebuggerUrl)
    await client.connect()

    const requestLog = []
    await client.send('Page.enable')
    await client.send('Network.enable')
    await client.send('Runtime.enable')
    await client.send('Page.addScriptToEvaluateOnNewDocument', {
      source: `
        (() => {
          const metrics = {
            marks: { navStart: 0 },
            requests: [],
          }
          window.__TOKYO_LOAD_PROFILE__ = metrics

          const mark = (name, value = performance.now()) => {
            if (typeof metrics.marks[name] !== 'number') {
              metrics.marks[name] = Number(value.toFixed(1))
            }
          }

          mark('navStart', 0)

          try {
            new PerformanceObserver((list) => {
              for (const entry of list.getEntries()) {
                if (entry.name === 'first-contentful-paint') {
                  mark('firstContentfulPaint', entry.startTime)
                }
              }
            }).observe({ type: 'paint', buffered: true })
          } catch {}

          const poll = () => {
            if (document.querySelector('#app-boot')) {
              mark('bootShellPresent')
            }
            if (document.querySelector('.search-card, .left-rail')) {
              mark('shellVisible')
            }
            if (window.maplibregl) {
              mark('maplibreReady')
            }
            if (window.__TOKYO_MAP__) {
              mark('mapObjectReady')
            }
            const map = window.__TOKYO_MAP__
            if (map?.loaded && map.loaded()) {
              mark('mapLoaded')
            }
            if (map?.areTilesLoaded && map.areTilesLoaded()) {
              mark('tilesLoaded')
            }
            window.requestAnimationFrame(poll)
          }

          window.requestAnimationFrame(poll)
        })();
      `,
    })

    client.on('Network.loadingFinished', (params) => {
      requestLog.push({ requestId: params.requestId, encodedDataLength: params.encodedDataLength })
    })
    client.on('Network.responseReceived', (params) => {
      requestLog.push({
        url: params.response.url,
        status: params.response.status,
        mimeType: params.response.mimeType,
        fromDiskCache: params.response.fromDiskCache,
        fromServiceWorker: params.response.fromServiceWorker,
        fromPrefetchCache: params.response.fromPrefetchCache,
      })
    })

    await client.send('Page.navigate', { url: args.url })
    await waitForExpression(
      client,
      `Boolean(window.__TOKYO_LOAD_PROFILE__?.marks?.shellVisible) && (Boolean(window.__TOKYO_MAP__) || Boolean(document.querySelector('.map-init-error__card')))`,
      args.timeoutMs,
    )

    await waitForExpression(
      client,
      `Boolean(window.__TOKYO_LOAD_PROFILE__?.marks?.mapLoaded) || Boolean(document.querySelector('.map-init-error__card'))`,
      args.timeoutMs,
    )

    await delay(300)

    const profile = await evaluate(
      client,
      `(() => {
        const profile = window.__TOKYO_LOAD_PROFILE__ || { marks: {} }
        const map = window.__TOKYO_MAP__
        return {
          marks: profile.marks || {},
          mapError: document.querySelector('.map-init-error__card')?.textContent?.trim() ?? null,
          viewport: map ? {
            zoom: Number(map.getZoom().toFixed(2)),
            center: {
              lng: Number(map.getCenter().lng.toFixed(4)),
              lat: Number(map.getCenter().lat.toFixed(4)),
            },
          } : null,
        }
      })()`,
    )

    const report = {
      artifactDir,
      label: args.label,
      requestCount: requestLog.filter((entry) => entry.url).length,
      requests: requestLog.filter((entry) => entry.url),
      ...profile,
    }

    await writeFile(resolve(artifactDir, 'report.json'), `${JSON.stringify(report, null, 2)}\n`)
    process.stdout.write(`${resolve(artifactDir, 'report.json')}\n`)
  } finally {
    client?.close()
    chromeProcess.kill('SIGKILL')
    await rm(chromeProfile, { recursive: true, force: true })
  }
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : 'unknown_error'}\n`)
  process.exit(1)
})
