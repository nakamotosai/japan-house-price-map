import { useEffect, useEffectEvent, useRef, useState } from 'react'
import maplibregl from 'maplibre-gl'
import {
  ensureOverlayLayers,
  formatMarkerPrice,
  getStationMarkerColor,
  getTokyoCenter,
  setModeOverlays,
  TOKYO_MAP_STYLE,
} from '../lib/mapLayers'
import {
  shouldShowStationMarker,
  shouldShowStationName,
  shouldShowStationPrice,
} from '../lib/stationVisibility'
import type { HazardZone, ModeId, SchoolPoint, Station } from '../types'

type TokyoMapProps = {
  activeMode: ModeId
  hazards: HazardZone[]
  schools: SchoolPoint[]
  stations: Station[]
  selectedStationId: string | null
  resetToken: number
  onSelectStation: (stationId: string | null) => void
}

type StationMarkerEntry = {
  marker: maplibregl.Marker
  markerNode: HTMLButtonElement
  station: Station
}

export function TokyoMap(props: TokyoMapProps) {
  const {
    activeMode,
    hazards,
    onSelectStation,
    resetToken,
    schools,
    selectedStationId,
    stations,
  } = props
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const markersRef = useRef<StationMarkerEntry[]>([])
  const [mapReady, setMapReady] = useState(false)
  const onSelectStationEvent = useEffectEvent(onSelectStation)

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
    })

    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'bottom-right')
    map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right')

    const handleBlankMapClick = () => {
      onSelectStationEvent(null)
    }

    map.on('click', handleBlankMapClick)

    map.on('load', () => {
      setMapReady(true)
    })

    mapRef.current = map

    return () => {
      map.off('click', handleBlankMapClick)
      markersRef.current.forEach((entry) => entry.marker.remove())
      markersRef.current = []
      map.remove()
      mapRef.current = null
    }
  }, [])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapReady) {
      return
    }

    ensureOverlayLayers(map, schools, hazards)
  }, [hazards, mapReady, schools])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapReady) {
      return
    }

    function syncMarkerPresentation(zoom: number) {
      for (const entry of markersRef.current) {
        const { markerNode, station } = entry
        const isSelected = station.id === selectedStationId
        const visible = shouldShowStationMarker({
          station,
          mode: activeMode,
          zoom,
          isSelected,
        })

        markerNode.style.display = visible ? '' : 'none'
        if (!visible) {
          continue
        }

        const showName = shouldShowStationName({ station, zoom })
        const showPrice = shouldShowStationPrice({ station, mode: activeMode })
        const compactIconOnly = !showName && !showPrice

        markerNode.className = [
          'station-marker',
          showName ? 'station-marker--major' : 'station-marker--minor',
          showPrice ? 'station-marker--price' : '',
          compactIconOnly ? 'station-marker--icon-only' : '',
          isSelected ? 'station-marker--selected' : '',
        ]
          .filter(Boolean)
          .join(' ')
        markerNode.style.backgroundColor = getStationMarkerColor(station, activeMode)
        markerNode.innerHTML = compactIconOnly
          ? '<span class="station-marker__dot"></span>'
          : `
            <span class="station-marker__dot"></span>
            <span class="station-marker__content">
              ${showName ? `<span class="station-marker__name">${station.name}</span>` : ''}
              ${showPrice ? `<span class="station-marker__price">${formatMarkerPrice(station.metrics.medianPriceMJPY)}</span>` : ''}
            </span>
          `
      }
    }

    const handleZoom = () => {
      syncMarkerPresentation(map.getZoom())
    }

    setModeOverlays(map, activeMode)

    map.on('zoom', handleZoom)

    markersRef.current.forEach((entry) => entry.marker.remove())
    markersRef.current = []

    for (const station of stations) {
      const markerNode = document.createElement('button')
      markerNode.type = 'button'
      markerNode.setAttribute('aria-label', `查看 ${station.name}`)
      markerNode.addEventListener('click', (event) => {
        event.stopPropagation()
        onSelectStationEvent(station.id)
      })

      const marker = new maplibregl.Marker({ element: markerNode, anchor: 'bottom' })
        .setLngLat([station.lng, station.lat])
        .addTo(map)

      markersRef.current.push({
        marker,
        markerNode,
        station,
      })
    }

    syncMarkerPresentation(map.getZoom())

    return () => {
      map.off('zoom', handleZoom)
    }
  }, [activeMode, mapReady, onSelectStation, selectedStationId, stations])

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
      zoom: 12.5,
      speed: 0.8,
      essential: true,
      offset: [120, 0],
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
