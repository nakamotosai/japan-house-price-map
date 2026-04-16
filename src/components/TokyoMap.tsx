import { useEffect, useEffectEvent, useRef, useState } from 'react'
import type { Map as MapLibreMap, MapMouseEvent } from 'maplibre-gl'
import {
  ensureMapDataLayers,
  getTokyoCenter,
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

const DEFAULT_TOKYO_ZOOM = 11.55

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

    void loadMapLibreRuntime().then((maplibre) => {
      if (cancelled || !containerRef.current) {
        return
      }

      ensurePmtilesProtocol(maplibre)

      const map = new maplibre.Map({
        container: containerRef.current,
        style: TOKYO_MAP_STYLE,
        center: getTokyoCenter(),
        zoom: DEFAULT_TOKYO_ZOOM,
        minZoom: 9,
        maxZoom: 16.5,
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
      center: getTokyoCenter(),
      zoom: DEFAULT_TOKYO_ZOOM,
      speed: 0.7,
      essential: true,
    })
  }, [mapReady, resetToken])

  return <div className="map-canvas" ref={containerRef} />
}
