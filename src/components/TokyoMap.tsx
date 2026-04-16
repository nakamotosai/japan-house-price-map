import { useEffect, useEffectEvent, useRef, useState } from 'react'
import type { Map as MapLibreMap, MapMouseEvent } from 'maplibre-gl'
import {
  ensureMapDataLayers,
  getKantoBounds,
  getKantoCenter,
  setModeOverlays,
  STATION_INTERACTIVE_LAYER_IDS,
  syncAreaLayers,
  syncPointLayers,
  syncStationLayer,
  TOKYO_MAP_STYLE,
} from '../lib/mapLayers'
import { loadMapLibreRuntime } from '../lib/maplibreLoader'
import {
  getVisibilityBandForZoom,
  selectStationRenderSelection,
} from '../lib/stationVisibility'
import { ensurePmtilesProtocol } from '../lib/protomapsStyle'
import type {
  AreaLayerFeature,
  MapViewport,
  ModeId,
  PointLayerFeature,
  StationBase,
} from '../types'

type TokyoMapProps = {
  activeMode: ModeId
  convenience: PointLayerFeature[]
  hazards: AreaLayerFeature[]
  population: AreaLayerFeature[]
  schools: PointLayerFeature[]
  stations: StationBase[]
  selectedStationId: string | null
  resetToken: number
  onSelectStation: (stationId: string | null) => void
  onViewportChange: (viewport: MapViewport) => void
}

const DEFAULT_KANTO_ZOOM = 8.35
const WEBGL_ERROR_PATTERN = /(Failed to initialize WebGL|webglcontextcreationerror|WebGL)/i

const KANTO_MAX_BOUNDS: [[number, number], [number, number]] = [
  [getKantoBounds().west, getKantoBounds().south],
  [getKantoBounds().east, getKantoBounds().north],
]

function getMapInitErrorMessage(error: unknown) {
  if (error instanceof Error) {
    if (WEBGL_ERROR_PATTERN.test(error.message)) {
      return {
        title: '当前浏览器没有可用的地图渲染能力',
        detail:
          '这不是页面没更新，而是浏览器没能创建 WebGL。请先检查浏览器硬件加速 / WebGL 是否被禁用，或改用支持 WebGL 的 Chrome / Edge 普通窗口。',
        technical: error.message,
      }
    }

    if (error.message === 'maplibre_runtime_load_failed') {
      return {
        title: '地图运行时文件没有成功加载',
        detail: '页面壳层已经打开，但地图脚本没有正确到达浏览器。请检查浏览器插件、网络拦截或公司策略。',
        technical: error.message,
      }
    }

    if (error.message === 'maplibre_runtime_missing_after_load') {
      return {
        title: '地图运行时已下载，但没有成功挂到页面',
        detail: '这通常说明浏览器策略或扩展拦截了地图运行时执行。',
        technical: error.message,
      }
    }

    return {
      title: '地图初始化失败',
      detail: '页面壳层已经打开，但地图层没有成功启动。请打开浏览器控制台查看详细错误。',
      technical: error.message,
    }
  }

  return {
    title: '地图初始化失败',
    detail: '页面壳层已经打开，但地图层没有成功启动。',
    technical: typeof error === 'string' ? error : 'unknown_error',
  }
}

export function TokyoMap(props: TokyoMapProps) {
  const {
    activeMode,
    convenience,
    hazards,
    onSelectStation,
    onViewportChange,
    population,
    resetToken,
    schools,
    selectedStationId,
    stations,
  } = props
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<MapLibreMap | null>(null)
  const lastStationSignatureRef = useRef('')
  const [mapReady, setMapReady] = useState(false)
  const [mapInitError, setMapInitError] = useState<{
    title: string
    detail: string
    technical: string
  } | null>(null)
  const onSelectStationEvent = useEffectEvent(onSelectStation)
  const onViewportChangeEvent = useEffectEvent(onViewportChange)

  const emitViewportChangeEvent = useEffectEvent(() => {
    const map = mapRef.current
    if (!map) {
      return
    }

    const bounds = map.getBounds()
    onViewportChangeEvent({
      zoom: map.getZoom(),
      bounds: {
        west: bounds.getWest(),
        south: bounds.getSouth(),
        east: bounds.getEast(),
        north: bounds.getNorth(),
      },
    })
  })

  const syncStationLayerEvent = useEffectEvent((force = false) => {
    const map = mapRef.current
    if (!map || !mapReady) {
      return
    }

    const zoom = map.getZoom()
    const bounds = map.getBounds()
    const visibilityBand = getVisibilityBandForZoom(zoom)
    const signature = [
      activeMode,
      selectedStationId ?? 'none',
      visibilityBand,
      bounds.getWest().toFixed(3),
      bounds.getSouth().toFixed(3),
      bounds.getEast().toFixed(3),
      bounds.getNorth().toFixed(3),
      zoom >= 9.8 ? 'label-on' : 'label-off',
      stations.length,
    ].join(':')

    if (!force && signature === lastStationSignatureRef.current) {
      return
    }

    const renderSelection = selectStationRenderSelection({
      bounds: {
        west: bounds.getWest(),
        south: bounds.getSouth(),
        east: bounds.getEast(),
        north: bounds.getNorth(),
      },
      project: (station) => map.project([station.lng, station.lat]),
      stations,
      mode: activeMode,
      zoom,
      selectedStationId,
    })
    const visibleStations = stations.filter((station) =>
      renderSelection.anchorIds.has(station.id),
    )

    syncStationLayer(map, visibleStations, activeMode, selectedStationId, renderSelection)
    lastStationSignatureRef.current = signature
  })

  const syncOverlayLayersEvent = useEffectEvent(() => {
    const map = mapRef.current
    if (!map || !mapReady) {
      return
    }

    syncPointLayers(map, schools, convenience)
    syncAreaLayers(map, hazards, population)
  })

  const applyModeOverlaysEvent = useEffectEvent(() => {
    const map = mapRef.current
    if (!map || !mapReady) {
      return
    }

    setModeOverlays(map, activeMode)
  })

  useEffect(() => {
    if (!containerRef.current || mapRef.current) {
      return
    }

    let cancelled = false
    let cleanup: (() => void) | undefined

    void loadMapLibreRuntime()
      .then((maplibre) => {
        if (cancelled || !containerRef.current) {
          return
        }

        try {
          ensurePmtilesProtocol(maplibre)

          const map = new maplibre.Map({
            container: containerRef.current,
            style: TOKYO_MAP_STYLE,
            center: getKantoCenter(),
            zoom: DEFAULT_KANTO_ZOOM,
            minZoom: 7.8,
            maxZoom: 16.5,
            maxBounds: KANTO_MAX_BOUNDS,
            pitchWithRotate: false,
            dragRotate: false,
            attributionControl: false,
            localIdeographFontFamily: '"Noto Sans JP", "Noto Sans SC", sans-serif',
          })

          map.addControl(new maplibre.NavigationControl({ showCompass: false }), 'bottom-right')
          map.addControl(new maplibre.AttributionControl({ compact: true }), 'bottom-right')

          const handleClick = (event: MapMouseEvent) => {
            const features = map.queryRenderedFeatures(event.point, {
              layers: STATION_INTERACTIVE_LAYER_IDS,
            })
            const stationFeature = features.find((feature) =>
              STATION_INTERACTIVE_LAYER_IDS.includes(feature.layer.id),
            )

            if (stationFeature) {
              const stationId = stationFeature.properties?.stationId
              if (typeof stationId === 'string') {
                onSelectStationEvent(stationId)
                return
              }
            }

            onSelectStationEvent(null)
          }

          const handlePointerMove = (event: MapMouseEvent) => {
            const features = map.queryRenderedFeatures(event.point, {
              layers: STATION_INTERACTIVE_LAYER_IDS,
            })
            map.getCanvas().style.cursor = features.length ? 'pointer' : ''
          }

          const handleZoom = () => {
            syncStationLayerEvent(false)
          }

          const handleViewportSettled = () => {
            emitViewportChangeEvent()
            syncStationLayerEvent(false)
          }

          map.on('click', handleClick)
          map.on('mousemove', handlePointerMove)
          map.on('zoom', handleZoom)
          map.on('moveend', handleViewportSettled)
          map.on('zoomend', handleViewportSettled)
          map.on('load', () => {
            ensureMapDataLayers(map)
            setMapInitError(null)
            setMapReady(true)
            emitViewportChangeEvent()
          })

          mapRef.current = map
          ;(window as Window & { __TOKYO_MAP__?: MapLibreMap }).__TOKYO_MAP__ = map

          cleanup = () => {
            map.off('click', handleClick)
            map.off('mousemove', handlePointerMove)
            map.off('zoom', handleZoom)
            map.off('moveend', handleViewportSettled)
            map.off('zoomend', handleViewportSettled)
            map.getCanvas().style.cursor = ''
            delete (window as Window & { __TOKYO_MAP__?: MapLibreMap }).__TOKYO_MAP__
            map.remove()
            mapRef.current = null
          }
        } catch (error) {
          if (!cancelled) {
            setMapReady(false)
            setMapInitError(getMapInitErrorMessage(error))
          }
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setMapReady(false)
          setMapInitError(getMapInitErrorMessage(error))
        }
      })

    return () => {
      cancelled = true
      cleanup?.()
    }
  }, [])

  useEffect(() => {
    if (!mapReady) {
      return
    }

    syncOverlayLayersEvent()
  }, [convenience, hazards, mapReady, population, schools])

  useEffect(() => {
    if (!mapReady) {
      return
    }

    applyModeOverlaysEvent()
  }, [activeMode, mapReady])

  useEffect(() => {
    if (!mapReady) {
      return
    }

    lastStationSignatureRef.current = ''
    syncStationLayerEvent(true)
  }, [activeMode, mapReady, selectedStationId, stations])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapReady) {
      return
    }

    const station = stations.find((item) => item.id === selectedStationId)
    if (!station) {
      return
    }

    map.flyTo({
      center: [station.lng, station.lat],
      zoom: Math.max(map.getZoom(), 12.4),
      speed: 0.8,
      essential: true,
      offset: [160, 0],
    })
  }, [mapReady, selectedStationId, stations])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapReady) {
      return
    }

    map.flyTo({
      center: getKantoCenter(),
      zoom: DEFAULT_KANTO_ZOOM,
      speed: 0.7,
      essential: true,
    })
  }, [mapReady, resetToken])

  return (
    <>
      <div className="map-canvas" ref={containerRef} />
      {mapInitError ? (
        <section className="map-init-error" aria-live="polite">
          <div className="map-init-error__card">
            <span className="map-init-error__eyebrow">地图未启动</span>
            <h2>{mapInitError.title}</h2>
            <p>{mapInitError.detail}</p>
            <code>{mapInitError.technical}</code>
          </div>
        </section>
      ) : null}
    </>
  )
}
