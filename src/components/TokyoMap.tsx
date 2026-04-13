import { useEffect, useEffectEvent, useRef, useState } from 'react'
import maplibregl from 'maplibre-gl'
import {
  ensureMapDataLayers,
  getTokyoCenter,
  NON_BLANK_INTERACTIVE_LAYER_IDS,
  setModeOverlays,
  STATION_INTERACTIVE_LAYER_IDS,
  syncAreaLayers,
  syncPointLayers,
  syncStationLayer,
  TOKYO_MAP_STYLE,
} from '../lib/mapLayers'
import { getVisibleStationIds, getVisibilityBandForZoom } from '../lib/stationVisibility'
import type { AreaLayerFeature, ModeId, PointLayerFeature, Station } from '../types'

type TokyoMapProps = {
  activeMode: ModeId
  convenience: PointLayerFeature[]
  hazards: AreaLayerFeature[]
  population: AreaLayerFeature[]
  schools: PointLayerFeature[]
  stations: Station[]
  selectedStationId: string | null
  resetToken: number
  onSelectStation: (stationId: string | null) => void
}

export function TokyoMap(props: TokyoMapProps) {
  const {
    activeMode,
    convenience,
    hazards,
    onSelectStation,
    population,
    resetToken,
    schools,
    selectedStationId,
    stations,
  } = props
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const lastStationSignatureRef = useRef('')
  const [mapReady, setMapReady] = useState(false)
  const onSelectStationEvent = useEffectEvent(onSelectStation)

  const syncStationLayerEvent = useEffectEvent((force = false) => {
    const map = mapRef.current
    if (!map || !mapReady) {
      return
    }

    const zoom = map.getZoom()
    const visibilityBand = getVisibilityBandForZoom(zoom)
    const signature = [
      activeMode,
      selectedStationId ?? 'none',
      visibilityBand,
      zoom >= 9.8 ? 'label-on' : 'label-off',
      stations.length,
    ].join(':')

    if (!force && signature === lastStationSignatureRef.current) {
      return
    }

    const visibleStationIds = getVisibleStationIds({
      stations,
      mode: activeMode,
      zoom,
      selectedStationId,
    })
    const visibleStations = stations.filter((station) => visibleStationIds.has(station.id))

    syncStationLayer(map, visibleStations, activeMode, selectedStationId, zoom)
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

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: TOKYO_MAP_STYLE,
      center: getTokyoCenter(),
      zoom: 10.4,
      minZoom: 9,
      maxZoom: 16.5,
      pitchWithRotate: false,
      dragRotate: false,
      attributionControl: false,
      localIdeographFontFamily: '"Noto Sans JP", "Noto Sans SC", sans-serif',
    })

    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'bottom-right')
    map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right')

    const handleClick = (event: maplibregl.MapMouseEvent) => {
      const features = map.queryRenderedFeatures(event.point, {
        layers: NON_BLANK_INTERACTIVE_LAYER_IDS,
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

      if (features.length > 0) {
        return
      }

      onSelectStationEvent(null)
    }

    const handlePointerMove = (event: maplibregl.MapMouseEvent) => {
      const features = map.queryRenderedFeatures(event.point, {
        layers: STATION_INTERACTIVE_LAYER_IDS,
      })
      map.getCanvas().style.cursor = features.length ? 'pointer' : ''
    }

    const handleZoom = () => {
      syncStationLayerEvent(false)
    }

    map.on('click', handleClick)
    map.on('mousemove', handlePointerMove)
    map.on('zoom', handleZoom)
    map.on('load', () => {
      ensureMapDataLayers(map)
      setMapReady(true)
    })

    mapRef.current = map
    ;(window as Window & { __TOKYO_MAP__?: maplibregl.Map }).__TOKYO_MAP__ = map

    return () => {
      map.off('click', handleClick)
      map.off('mousemove', handlePointerMove)
      map.off('zoom', handleZoom)
      map.getCanvas().style.cursor = ''
      delete (window as Window & { __TOKYO_MAP__?: maplibregl.Map }).__TOKYO_MAP__
      map.remove()
      mapRef.current = null
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
      zoom: 10.4,
      speed: 0.7,
      essential: true,
    })
  }, [mapReady, resetToken])

  return <div className="map-canvas" ref={containerRef} />
}
