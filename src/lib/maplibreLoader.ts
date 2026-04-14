import type * as MapLibreNS from 'maplibre-gl'

type MapLibreModule = typeof MapLibreNS

const MAPLIBRE_SCRIPT_PATH = '/vendor/maplibre/maplibre-gl.js'
const MAPLIBRE_STYLE_PATH = '/vendor/maplibre/maplibre-gl.css'
const MAPLIBRE_SCRIPT_ID = 'tokyo-maplibre-runtime'
const MAPLIBRE_STYLE_ID = 'tokyo-maplibre-style'

declare global {
  interface Window {
    maplibregl?: MapLibreModule
    __maplibreRuntimePromise?: Promise<MapLibreModule>
  }
}

function ensureMapLibreStyle() {
  if (typeof document === 'undefined' || document.getElementById(MAPLIBRE_STYLE_ID)) {
    return
  }

  const link = document.createElement('link')
  link.id = MAPLIBRE_STYLE_ID
  link.rel = 'stylesheet'
  link.href = MAPLIBRE_STYLE_PATH
  document.head.appendChild(link)
}

export async function loadMapLibreRuntime() {
  if (typeof window === 'undefined') {
    throw new Error('maplibre_runtime_requires_window')
  }

  ensureMapLibreStyle()

  if (window.maplibregl) {
    return window.maplibregl
  }

  if (!window.__maplibreRuntimePromise) {
    window.__maplibreRuntimePromise = new Promise<MapLibreModule>((resolve, reject) => {
      const existing = document.getElementById(MAPLIBRE_SCRIPT_ID) as HTMLScriptElement | null
      if (existing) {
        existing.addEventListener('load', () => {
          if (window.maplibregl) {
            resolve(window.maplibregl)
            return
          }

          reject(new Error('maplibre_runtime_missing_after_load'))
        })
        existing.addEventListener('error', () => reject(new Error('maplibre_runtime_load_failed')))
        return
      }

      const script = document.createElement('script')
      script.id = MAPLIBRE_SCRIPT_ID
      script.src = MAPLIBRE_SCRIPT_PATH
      script.async = true
      script.onload = () => {
        if (window.maplibregl) {
          resolve(window.maplibregl)
          return
        }

        reject(new Error('maplibre_runtime_missing_after_load'))
      }
      script.onerror = () => reject(new Error('maplibre_runtime_load_failed'))
      document.head.appendChild(script)
    })
  }

  return window.__maplibreRuntimePromise
}
