import { useEffect, useRef, useState } from 'react'
import maplibregl from 'maplibre-gl'
import {
  ensureOverlayLayers,
  getStationMarkerColor,
  getTokyoCenter,
  setModeOverlays,
  TOKYO_MAP_STYLE,
} from '../lib/mapLayers'
import type { HazardZone, ModeId, SchoolPoint, Station } from '../types'

type TokyoMapProps = {
  activeMode: ModeId
  hazards: HazardZone[]
  schools: SchoolPoint[]
  stations: Station[]
  selectedStationId: string | null
  resetToken: number
  onSelectStation: (stationId: string) => void
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
  const markersRef = useRef<maplibregl.Marker[]>([])
  const [mapReady, setMapReady] = useState(false)

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

    map.on('load', () => {
      setMapReady(true)
    })

    mapRef.current = map

    return () => {
      markersRef.current.forEach((marker) => marker.remove())
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

    setModeOverlays(map, activeMode)

    markersRef.current.forEach((marker) => marker.remove())
    markersRef.current = []

    for (const station of stations) {
      const markerNode = document.createElement('button')
      const isSelected = station.id === selectedStationId
      markerNode.className = `station-marker ${isSelected ? 'station-marker--selected' : ''}`
      markerNode.style.backgroundColor = getStationMarkerColor(station, activeMode)
      markerNode.type = 'button'
      markerNode.setAttribute('aria-label', `查看 ${station.name}`)
      markerNode.innerHTML = `
        <span class="station-marker__dot"></span>
        <span class="station-marker__label">${station.name}</span>
      `
      markerNode.addEventListener('click', () => onSelectStation(station.id))

      const marker = new maplibregl.Marker({ element: markerNode, anchor: 'bottom' })
        .setLngLat([station.lng, station.lat])
        .addTo(map)

      markersRef.current.push(marker)
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
