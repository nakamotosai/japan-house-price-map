import type { FeatureCollection, Point, Polygon } from 'geojson'
import type {
  GeoJSONSource,
  Map as MapLibreMap,
  StyleSpecification,
} from 'maplibre-gl'
import type { HazardZone, ModeId, RiskLevel, SchoolPoint, Station } from '../types'

const TOKYO_CENTER: [number, number] = [139.767125, 35.681236]

const TILE_ATTRIBUTION =
  '<a href="https://maps.gsi.go.jp/development/ichiran.html" target="_blank" rel="noreferrer">地理院タイル</a>'

export const TOKYO_MAP_STYLE: StyleSpecification = {
  version: 8,
  sources: {
    gsi: {
      type: 'raster',
      tiles: ['https://cyberjapandata.gsi.go.jp/xyz/pale/{z}/{x}/{y}.png'],
      tileSize: 256,
      attribution: TILE_ATTRIBUTION,
    },
  },
  layers: [
    {
      id: 'gsi-base',
      type: 'raster',
      source: 'gsi',
    },
  ],
}

export function getTokyoCenter() {
  return TOKYO_CENTER
}

function buildSchoolFeature(point: SchoolPoint) {
  return {
    type: 'Feature' as const,
    geometry: {
      type: 'Point' as const,
      coordinates: [point.lng, point.lat],
    },
    properties: {
      id: point.id,
      name: point.name,
      category: point.category,
    },
  }
}

function buildHazardFeature(zone: HazardZone) {
  return {
    type: 'Feature' as const,
    geometry: {
      type: 'Polygon' as const,
      coordinates: zone.coordinates,
    },
    properties: {
      id: zone.id,
      name: zone.name,
      summary: zone.summary,
      riskLevel: zone.riskLevel,
    },
  }
}

export function buildSchoolFeatures(points: SchoolPoint[]): FeatureCollection<Point> {
  return {
    type: 'FeatureCollection',
    features: points.map(buildSchoolFeature),
  }
}

export function buildHazardFeatures(zones: HazardZone[]): FeatureCollection<Polygon> {
  return {
    type: 'FeatureCollection',
    features: zones.map(buildHazardFeature),
  }
}

export function ensureOverlayLayers(
  map: MapLibreMap,
  schools: SchoolPoint[],
  hazards: HazardZone[],
) {
  const schoolFeatures = buildSchoolFeatures(schools)
  const hazardFeatures = buildHazardFeatures(hazards)

  if (!map.getSource('schools')) {
    map.addSource('schools', {
      type: 'geojson',
      data: schoolFeatures,
    })
  } else {
    const source = map.getSource('schools') as GeoJSONSource | undefined
    if (source) {
      source.setData(schoolFeatures)
    }
  }

  if (!map.getLayer('schools-circle')) {
    map.addLayer({
      id: 'schools-circle',
      type: 'circle',
      source: 'schools',
      paint: {
        'circle-radius': 7,
        'circle-color': '#2563eb',
        'circle-stroke-color': '#ffffff',
        'circle-stroke-width': 2,
      },
      layout: {
        visibility: 'none',
      },
    })
  }

  if (!map.getSource('hazards')) {
    map.addSource('hazards', {
      type: 'geojson',
      data: hazardFeatures,
    })
  } else {
    const source = map.getSource('hazards') as GeoJSONSource | undefined
    if (source) {
      source.setData(hazardFeatures)
    }
  }

  if (!map.getLayer('hazards-fill')) {
    map.addLayer({
      id: 'hazards-fill',
      type: 'fill',
      source: 'hazards',
      paint: {
        'fill-color': [
          'match',
          ['get', 'riskLevel'],
          'high',
          '#d62828',
          'medium',
          '#f77f00',
          '#2a9d8f',
        ],
        'fill-opacity': 0.18,
      },
      layout: {
        visibility: 'none',
      },
    })
  }

  if (!map.getLayer('hazards-line')) {
    map.addLayer({
      id: 'hazards-line',
      type: 'line',
      source: 'hazards',
      paint: {
        'line-color': [
          'match',
          ['get', 'riskLevel'],
          'high',
          '#b91c1c',
          'medium',
          '#d97706',
          '#166534',
        ],
        'line-width': 2,
      },
      layout: {
        visibility: 'none',
      },
    })
  }
}

export function setModeOverlays(map: MapLibreMap, mode: ModeId) {
  const showSchools = mode === 'schools'
  const showHazards = mode === 'hazard'

  if (map.getLayer('schools-circle')) {
    map.setLayoutProperty(
      'schools-circle',
      'visibility',
      showSchools ? 'visible' : 'none',
    )
  }

  for (const layerId of ['hazards-fill', 'hazards-line']) {
    if (map.getLayer(layerId)) {
      map.setLayoutProperty(layerId, 'visibility', showHazards ? 'visible' : 'none')
    }
  }
}

function bandColor(value: number, high: number, medium: number, colors: [string, string, string]) {
  if (value >= high) {
    return colors[0]
  }
  if (value >= medium) {
    return colors[1]
  }
  return colors[2]
}

function riskScore(level: RiskLevel) {
  if (level === 'unknown') {
    return 0
  }
  if (level === 'high') {
    return 3
  }
  if (level === 'medium') {
    return 2
  }
  return 1
}

export function getStationMarkerColor(station: Station, mode: ModeId) {
  if (mode === 'price') {
    if (!station.metrics.coverage.price) {
      return '#94a3b8'
    }
    return bandColor(station.metrics.medianPriceMJPY, 90, 60, [
      '#d9485f',
      '#f08c4a',
      '#2f855a',
    ])
  }

  if (mode === 'land') {
    if (!station.metrics.coverage.land) {
      return '#94a3b8'
    }
    return bandColor(station.metrics.landValueManPerSqm, 400, 240, [
      '#8b5cf6',
      '#6366f1',
      '#3b82f6',
    ])
  }

  if (mode === 'heat') {
    if (!station.metrics.coverage.ridership) {
      return '#94a3b8'
    }
    return bandColor(station.metrics.heatScore, 90, 75, [
      '#ef476f',
      '#f4a261',
      '#2a9d8f',
    ])
  }

  if (mode === 'hazard') {
    if (!station.metrics.coverage.hazard) {
      return '#94a3b8'
    }
    const maxRisk = Math.max(
      riskScore(station.metrics.hazard.flood),
      riskScore(station.metrics.hazard.liquefaction),
      riskScore(station.metrics.hazard.landslide),
    )

    if (maxRisk === 3) {
      return '#d62828'
    }
    if (maxRisk === 2) {
      return '#f77f00'
    }
    if (maxRisk === 0) {
      return '#94a3b8'
    }
    return '#2a9d8f'
  }

  return '#334155'
}

export function formatMarkerPrice(value: number) {
  if (value >= 100) {
    const yi = (value / 100).toFixed(2).replace(/\.00$/, '').replace(/(\.\d)0$/, '$1')
    return `${yi}亿`
  }

  return `${value}00万`
}

export function getSchoolMatches(points: SchoolPoint[], stationId: string | null) {
  if (!stationId) {
    return []
  }

  return points.filter((point) => point.stationIds.includes(stationId))
}

export function getHazardMatches(zones: HazardZone[], stationId: string | null) {
  if (!stationId) {
    return []
  }

  return zones.filter((zone) => zone.stationIds.includes(stationId))
}
