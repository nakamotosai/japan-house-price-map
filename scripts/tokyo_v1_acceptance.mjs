#!/usr/bin/env node
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { spawn } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import { fileURLToPath } from 'node:url'

const PROJECT_ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)))
const ARTIFACT_ROOT = resolve(PROJECT_ROOT, '.artifacts', 'tokyo-v1-acceptance')
const CHROME_BIN = process.env.CHROME_BIN || '/usr/bin/chromium-browser'

function parseArgs(argv) {
  const args = { url: 'http://127.0.0.1:4173/', tailnetUrl: '' }
  for (let index = 2; index < argv.length; index += 1) {
    const item = argv[index]
    if (item === '--url' && argv[index + 1]) {
      args.url = argv[index + 1]
      index += 1
    } else if (item === '--tailnet-url' && argv[index + 1]) {
      args.tailnetUrl = argv[index + 1]
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
      // Wait for Chromium to expose the DevTools endpoint.
    }
    await delay(150)
  }

  throw new Error(`timeout_waiting_for:${url}`)
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
      this.ws.addEventListener('error', (event) => rejectPromise(event.error ?? new Error('ws_open_failed')))
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

  waitFor(method, timeoutMs = 15000) {
    return new Promise((resolvePromise, rejectPromise) => {
      const timeout = setTimeout(() => {
        rejectPromise(new Error(`timeout_waiting_for_event:${method}`))
      }, timeoutMs)

      const callback = (params) => {
        clearTimeout(timeout)
        const current = this.listeners.get(method) ?? []
        this.listeners.set(
          method,
          current.filter((item) => item !== callback),
        )
        resolvePromise(params)
      }

      this.on(method, callback)
    })
  }
}

async function evaluate(client, expression) {
  const result = await client.send('Runtime.evaluate', {
    expression,
    awaitPromise: true,
    returnByValue: true,
  })

  if (result.exceptionDetails) {
    throw new Error(`runtime_evaluate_failed:${result.exceptionDetails.text ?? 'unknown_error'}`)
  }

  return result.result?.value
}

async function waitForExpression(client, expression, timeoutMs = 15000) {
  const startedAt = Date.now()

  while (Date.now() - startedAt < timeoutMs) {
    const value = await evaluate(client, expression)
    if (value) {
      return value
    }
    await delay(150)
  }

  throw new Error(`timeout_waiting_for_expression:${expression}`)
}

async function setViewport(client, width, height, mobile = false) {
  await client.send('Emulation.setDeviceMetricsOverride', {
    width,
    height,
    deviceScaleFactor: mobile ? 2 : 1,
    mobile,
  })
}

async function captureScreenshot(client, outputPath) {
  const { data } = await client.send('Page.captureScreenshot', {
    format: 'png',
    captureBeyondViewport: true,
  })
  await writeFile(outputPath, Buffer.from(data, 'base64'))
}

async function clickSelector(client, selector) {
  const clicked = await evaluate(
    client,
    `(() => {
      const target = document.querySelector(${JSON.stringify(selector)})
      if (!target) {
        return false
      }
      target.click()
      return true
    })()`,
  )

  if (!clicked) {
    throw new Error(`selector_not_found:${selector}`)
  }
}

async function clickMode(client, label) {
  const clicked = await evaluate(
    client,
    `(() => {
      const buttons = Array.from(document.querySelectorAll('.mode-chip'))
      const target = buttons.find((item) => item.textContent?.trim() === ${JSON.stringify(label)})
      if (!target) {
        return false
      }
      target.click()
      return true
    })()`,
  )

  if (!clicked) {
    throw new Error(`mode_not_found:${label}`)
  }
}

async function setSearchQuery(client, query) {
  const updated = await evaluate(
    client,
    `(() => {
      const input = document.querySelector('.search-card__input')
      if (!(input instanceof HTMLInputElement)) {
        return false
      }
      const descriptor = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        'value',
      )
      descriptor?.set?.call(input, ${JSON.stringify(query)})
      input.focus()
      input.dispatchEvent(new Event('input', { bubbles: true }))
      input.dispatchEvent(new Event('change', { bubbles: true }))
      return true
    })()`,
  )

  if (!updated) {
    throw new Error('search_input_not_found')
  }
}

async function pickFirstSearchResult(client) {
  await waitForExpression(
    client,
    `document.querySelectorAll('.search-results__item').length > 0`,
  )
  await clickSelector(client, '.search-results__item')
}

async function clickMapBlank(client, x, y) {
  await client.send('Input.dispatchMouseEvent', {
    type: 'mousePressed',
    x,
    y,
    button: 'left',
    clickCount: 1,
  })
  await client.send('Input.dispatchMouseEvent', {
    type: 'mouseReleased',
    x,
    y,
    button: 'left',
    clickCount: 1,
  })
}

async function findBlankMapPoint(client) {
  return waitForExpression(
    client,
    `(() => {
      const map = window.__TOKYO_MAP__
      if (!map) {
        return null
      }

      const canvas = map.getCanvas()
      const rect = canvas.getBoundingClientRect()
      for (let xRatio = 0.56; xRatio <= 0.94; xRatio += 0.08) {
        for (let yRatio = 0.16; yRatio <= 0.86; yRatio += 0.12) {
          const x = rect.width * xRatio
          const y = rect.height * yRatio
          const features = map.queryRenderedFeatures([x, y])
          if (!features.length) {
            return {
              x: Math.round(rect.left + x),
              y: Math.round(rect.top + y),
            }
          }
        }
      }

      return null
    })()`,
  )
}

function uniqueRuntimeRequests(urls) {
  return [...new Set(urls.filter((item) => item.includes('/data/tokyo/runtime/')))]
}

async function collectModeResult(client, requests, label, screenshotPath) {
  const requestCursor = requests.length
  await clickMode(client, label)
  await delay(1600)
  await captureScreenshot(client, screenshotPath)

  const legendText = await evaluate(
    client,
    `document.querySelector('.legend-card__footnote')?.textContent?.trim() ?? ''`,
  )

  return {
    label,
    legendText,
    requests: uniqueRuntimeRequests(requests.slice(requestCursor)),
  }
}

async function main() {
  const args = parseArgs(process.argv)
  const timestamp = new Date().toISOString().replaceAll(':', '').replace(/\..+$/, 'Z')
  const artifactDir = resolve(ARTIFACT_ROOT, timestamp)
  await mkdir(artifactDir, { recursive: true })

  const chromeProfile = await mkdtemp(join(tmpdir(), 'tokyo-v1-acceptance-'))
  const debugPort = 9200 + Math.floor(Math.random() * 500)
  const chromeProcess = spawn(
    CHROME_BIN,
    [
      '--headless=new',
      '--disable-gpu',
      '--no-sandbox',
      '--hide-scrollbars',
      '--enable-unsafe-swiftshader',
      '--use-angle=swiftshader-webgl',
      `--remote-debugging-port=${debugPort}`,
      `--user-data-dir=${chromeProfile}`,
      'about:blank',
    ],
    { stdio: 'ignore' },
  )

  const shutdown = async () => {
    chromeProcess.kill('SIGTERM')
    await rm(chromeProfile, { recursive: true, force: true })
  }

  try {
    const versionInfo = await waitForJson(`http://127.0.0.1:${debugPort}/json/version`)
    const targets = await waitForJson(`http://127.0.0.1:${debugPort}/json/list`)
    const pageTarget = targets.find((item) => item.type === 'page')
    if (!pageTarget?.webSocketDebuggerUrl) {
      throw new Error('page_target_not_found')
    }

    const client = new CDPClient(pageTarget.webSocketDebuggerUrl)
    await client.connect()
    await Promise.all([
      client.send('Page.enable'),
      client.send('Runtime.enable'),
      client.send('Network.enable'),
    ])

    const runtimeRequests = []
    client.on('Network.requestWillBeSent', (params) => {
      if (typeof params.request?.url === 'string') {
        runtimeRequests.push(params.request.url)
      }
    })

    await setViewport(client, 1440, 960, false)
    await client.send('Page.navigate', { url: args.url })
    await client.waitFor('Page.loadEventFired')
    await waitForExpression(
      client,
      `document.querySelectorAll('.mode-chip').length >= 7 && !!window.__TOKYO_MAP__`,
    )
    await delay(1000)

    const desktopDefaultPath = resolve(artifactDir, 'desktop-price-default.png')
    await captureScreenshot(client, desktopDefaultPath)

    const schoolsResult = await collectModeResult(
      client,
      runtimeRequests,
      '学校分布',
      resolve(artifactDir, 'desktop-schools-overview.png'),
    )
    const convenienceResult = await collectModeResult(
      client,
      runtimeRequests,
      '生活便利度',
      resolve(artifactDir, 'desktop-convenience-overview.png'),
    )
    const hazardResult = await collectModeResult(
      client,
      runtimeRequests,
      '灾害风险',
      resolve(artifactDir, 'desktop-hazard-overview.png'),
    )

    await clickMode(client, '房产均价')
    await delay(1200)
    await setSearchQuery(client, '新宿')
    await pickFirstSearchResult(client)
    await delay(1500)

    const stationOpenPath = resolve(artifactDir, 'desktop-station-open.png')
    await captureScreenshot(client, stationOpenPath)

    const blankPoint = await findBlankMapPoint(client)
    await clickMapBlank(client, blankPoint.x, blankPoint.y)
    await delay(600)
    const stationPanelClosed = await evaluate(
      client,
      `!document.querySelector('.station-panel')`,
    )

    await setViewport(client, 393, 852, true)
    await client.send('Page.reload', { ignoreCache: true })
    await client.waitFor('Page.loadEventFired')
    await waitForExpression(
      client,
      `document.querySelectorAll('.mode-chip').length >= 7 && !!window.__TOKYO_MAP__`,
    )
    await delay(1000)
    const mobileDefaultPath = resolve(artifactDir, 'mobile-price-default.png')
    await captureScreenshot(client, mobileDefaultPath)

    const tailnetHead = args.tailnetUrl
      ? await fetch(args.tailnetUrl, { method: 'HEAD' }).then((response) => ({
          ok: response.ok,
          status: response.status,
        }))
      : null

    const report = {
      artifactDir,
      chromeVersion: versionInfo.Browser,
      url: args.url,
      tailnetUrl: args.tailnetUrl || null,
      tailnetHead,
      stationPanelClosedByBlankClick: stationPanelClosed,
      modeResults: [schoolsResult, convenienceResult, hazardResult],
      screenshots: {
        desktopDefaultPath,
        stationOpenPath,
        mobileDefaultPath,
      },
    }

    await writeFile(
      resolve(artifactDir, 'report.json'),
      `${JSON.stringify(report, null, 2)}\n`,
    )

    console.log(JSON.stringify(report, null, 2))
    client.close()
  } finally {
    await shutdown()
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
