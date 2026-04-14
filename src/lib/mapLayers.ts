import type { FeatureCollection, GeoJsonProperties, Geometry, Point } from 'geojson'
import type {
  AddLayerObject,
  GeoJSONSource,
  Map as MapLibreMap,
  StyleSpecification,
} from 'maplibre-gl'
import type { StationRenderSelection } from './stationVisibility'
import type {
  AreaLayerFeature,
  ModeId,
  PointLayerFeature,
  PopulationTrend,
  RiskLevel,
  Station,
  StationBase,
} from '../types'

const TOKYO_CENTER: [number, number] = [139.767125, 35.681236]
const GLYPHS_URL = 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf'

const TILE_ATTRIBUTION =
  '<a href="https://maps.gsi.go.jp/development/ichiran.html" target="_blank" rel="noreferrer">地理院タイル</a>'

const STATION_SOURCE_ID = 'stations-source'
const SCHOOL_SOURCE_ID = 'schools-source'
const CONVENIENCE_SOURCE_ID = 'convenience-source'
const HAZARD_SOURCE_ID = 'hazards-source'
const POPULATION_SOURCE_ID = 'population-source'

export const STATION_INTERACTIVE_LAYER_IDS = [
  'station-hit',
  'station-circle',
  'station-badge',
  'station-name',
]

export const NON_BLANK_INTERACTIVE_LAYER_IDS = [
  ...STATION_INTERACTIVE_LAYER_IDS,
  'schools-clusters',
  'schools-unclustered',
  'convenience-clusters',
  'convenience-unclustered',
  'hazards-fill',
  'population-fill',
]

const SCHOOL_LAYER_IDS = ['schools-clusters', 'schools-cluster-count', 'schools-unclustered']
const CONVENIENCE_LAYER_IDS = [
  'convenience-clusters',
  'convenience-cluster-count',
  'convenience-unclustered',
]
const HAZARD_LAYER_IDS = ['hazards-fill', 'hazards-line']
const POPULATION_LAYER_IDS = ['population-fill', 'population-line']
const ALL_OVERLAY_LAYER_IDS = [
  ...SCHOOL_LAYER_IDS,
  ...CONVENIENCE_LAYER_IDS,
  ...HAZARD_LAYER_IDS,
  ...POPULATION_LAYER_IDS,
]

export const TOKYO_MAP_STYLE: StyleSpecification = {
  version: 8,
  glyphs: GLYPHS_URL,
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

function emptyFeatureCollection<G extends Geometry = Geometry>(): FeatureCollection<G, GeoJsonProperties> {
  return {
    type: 'FeatureCollection',
    features: [],
  }
}

function ensureGeoJsonSource(
  map: MapLibreMap,
  id: string,
  options?: Record<string, unknown>,
) {
  if (map.getSource(id)) {
    return
  }

  map.addSource(id, {
    type: 'geojson',
    data: emptyFeatureCollection(),
    ...options,
  })
}

function bandColor(
  value: number,
  high: number,
  medium: number,
  colors: [string, string, string],
) {
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

function populationColor(trend: PopulationTrend) {
  if (trend === '增长') {
    return '#2f855a'
  }
  if (trend === '收缩') {
    return '#d9485f'
  }
  if (trend === '稳定') {
    return '#d97706'
  }
  return '#94a3b8'
}

export function getStationMarkerColor(station: StationBase | Station, mode: ModeId) {
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

  if (mode === 'schools') {
    return station.metrics.coverage.schools ? '#2563eb' : '#94a3b8'
  }

  if (mode === 'convenience') {
    if (!station.metrics.coverage.convenience) {
      return '#94a3b8'
    }
    return bandColor(station.metrics.convenienceScore, 75, 50, [
      '#0f766e',
      '#14b8a6',
      '#84cc16',
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

  if (!station.metrics.coverage.population) {
    return '#94a3b8'
  }

  return populationColor(station.metrics.populationTrend)
}

export function formatMarkerPrice(value: number) {
  if (value >= 100) {
    const yi = (value / 100).toFixed(2).replace(/\.00$/, '').replace(/(\.\d)0$/, '$1')
    return `${yi}亿`
  }

  return `${value}00万`
}

function buildStationFeatureCollection(
  stations: StationBase[],
  activeMode: ModeId,
  selectedStationId: string | null,
  selection: StationRenderSelection,
): FeatureCollection<Point, GeoJsonProperties> {
  return {
    type: 'FeatureCollection',
    features: stations.map((station) => {
      const isSelected = station.id === selectedStationId
      const showBadge = selection.badgeIds.has(station.id)
      const showName = selection.nameIds.has(station.id)
      const markerRadius = showBadge
        ? station.labelTier === 'major'
          ? 24
          : 21
        : station.labelTier === 'major'
          ? 8
          : 5

      return {
        type: 'Feature' as const,
        geometry: {
          type: 'Point' as const,
          coordinates: [station.lng, station.lat],
        },
        properties: {
          id: station.id,
          stationId: station.id,
          name: station.name,
          markerColor: getStationMarkerColor(station, activeMode),
          markerRadius,
          isSelected,
          badgeText:
            showBadge && activeMode === 'price'
              ? formatMarkerPrice(station.metrics.medianPriceMJPY)
              : '',
          badgeSize: showBadge ? (station.labelTier === 'major' ? 12 : 11) : 0,
          nameLabel: showName ? station.name : '',
          nameSize: station.labelTier === 'major' ? 13 : 12,
        },
      }
    }),
  }
}

function buildPointFeatureCollection(
  points: PointLayerFeature[],
): FeatureCollection<Point, GeoJsonProperties> {
  return {
    type: 'FeatureCollection',
    features: points.map((point) => ({
      type: 'Feature' as const,
      geometry: {
        type: 'Point' as const,
        coordinates: [point.lng, point.lat],
      },
      properties: {
        id: point.id,
        name: point.name,
        categoryId: point.categoryId,
        categoryLabel: point.categoryLabel,
        stationId: point.stationId,
        note: point.note,
        pointWeight: point.count ?? 1,
        pointLevel: point.level ?? 'detail',
      },
    })),
  }
}

function buildAreaFeatureCollection(areas: AreaLayerFeature[]): FeatureCollection<Geometry, GeoJsonProperties> {
  return {
    type: 'FeatureCollection',
    features: areas.map((area) => ({
      type: 'Feature' as const,
      geometry: area.geometry as Geometry,
      properties: {
        id: area.id,
        name: area.name,
        categoryId: area.categoryId,
        categoryLabel: area.categoryLabel,
        summary: area.summary,
        metricValue: area.metricValue,
        metricLabel: area.metricLabel,
        stationCount: area.stationIds.length,
      },
    })),
  }
}

function updateSource(
  map: MapLibreMap,
  sourceId: string,
  data: FeatureCollection,
) {
  const source = map.getSource(sourceId) as GeoJSONSource | undefined
  if (source) {
    source.setData(data)
  }
}

export function ensureMapDataLayers(map: MapLibreMap) {
  ensureGeoJsonSource(map, HAZARD_SOURCE_ID)
  ensureGeoJsonSource(map, POPULATION_SOURCE_ID)
  ensureGeoJsonSource(map, SCHOOL_SOURCE_ID, {
    cluster: true,
    clusterMaxZoom: 13,
    clusterRadius: 40,
    clusterProperties: {
      weightedCount: ['+', ['get', 'pointWeight']],
    },
  })
  ensureGeoJsonSource(map, CONVENIENCE_SOURCE_ID, {
    cluster: true,
    clusterMaxZoom: 13,
    clusterRadius: 42,
    clusterProperties: {
      weightedCount: ['+', ['get', 'pointWeight']],
    },
  })
  ensureGeoJsonSource(map, STATION_SOURCE_ID)

  if (!map.getLayer('hazards-fill')) {
    map.addLayer({
      id: 'hazards-fill',
      type: 'fill',
      source: HAZARD_SOURCE_ID,
      paint: {
        'fill-color': [
          'match',
          ['get', 'categoryId'],
          'high',
          '#d62828',
          'medium',
          '#f77f00',
          'low',
          '#2a9d8f',
          '#94a3b8',
        ],
        'fill-opacity': 0.2,
      },
      layout: {
        visibility: 'none',
      },
    } as AddLayerObject)
  }

  if (!map.getLayer('hazards-line')) {
    map.addLayer({
      id: 'hazards-line',
      type: 'line',
      source: HAZARD_SOURCE_ID,
      paint: {
        'line-color': [
          'match',
          ['get', 'categoryId'],
          'high',
          '#b91c1c',
          'medium',
          '#d97706',
          'low',
          '#166534',
          '#64748b',
        ],
        'line-width': 1.4,
      },
      layout: {
        visibility: 'none',
      },
    } as AddLayerObject)
  }

  if (!map.getLayer('population-fill')) {
    map.addLayer({
      id: 'population-fill',
      type: 'fill',
      source: POPULATION_SOURCE_ID,
      paint: {
        'fill-color': [
          'match',
          ['get', 'categoryId'],
          '增长',
          '#2f855a',
          '稳定',
          '#d97706',
          '收缩',
          '#d9485f',
          '#94a3b8',
        ],
        'fill-opacity': 0.18,
      },
      layout: {
        visibility: 'none',
      },
    } as AddLayerObject)
  }

  if (!map.getLayer('population-line')) {
    map.addLayer({
      id: 'population-line',
      type: 'line',
      source: POPULATION_SOURCE_ID,
      paint: {
        'line-color': [
          'match',
          ['get', 'categoryId'],
          '增长',
          '#166534',
          '稳定',
          '#92400e',
          '收缩',
          '#be123c',
          '#64748b',
        ],
        'line-width': 1,
      },
      layout: {
        visibility: 'none',
      },
    } as AddLayerObject)
  }

  if (!map.getLayer('schools-clusters')) {
    map.addLayer({
      id: 'schools-clusters',
      type: 'circle',
      source: SCHOOL_SOURCE_ID,
      filter: ['has', 'point_count'],
      paint: {
        'circle-color': '#2563eb',
        'circle-radius': [
          'step',
          ['coalesce', ['get', 'weightedCount'], ['get', 'point_count']],
          16,
          20,
          20,
          60,
          26,
          140,
          30,
        ],
        'circle-stroke-color': '#ffffff',
        'circle-stroke-width': 2,
      },
      layout: {
        visibility: 'none',
      },
    } as AddLayerObject)
  }

  if (!map.getLayer('schools-cluster-count')) {
    map.addLayer({
      id: 'schools-cluster-count',
      type: 'symbol',
      source: SCHOOL_SOURCE_ID,
      filter: ['has', 'point_count'],
      layout: {
        'text-field': ['to-string', ['coalesce', ['get', 'weightedCount'], ['get', 'point_count']]],
        'text-size': 12,
        'text-font': ['Noto Sans Regular'],
        visibility: 'none',
      },
      paint: {
        'text-color': '#ffffff',
      },
    } as AddLayerObject)
  }

  if (!map.getLayer('schools-unclustered')) {
    map.addLayer({
      id: 'schools-unclustered',
      type: 'circle',
      source: SCHOOL_SOURCE_ID,
      minzoom: 9,
      filter: ['!', ['has', 'point_count']],
      paint: {
        'circle-color': [
          'match',
          ['get', 'categoryId'],
          'university',
          '#1d4ed8',
          'high_school',
          '#2563eb',
          'junior_high',
          '#0ea5e9',
          'elementary',
          '#22c55e',
          'kindergarten',
          '#f97316',
          '#64748b',
        ],
        'circle-radius': [
          'step',
          ['coalesce', ['get', 'pointWeight'], 1],
          4.5,
          10,
          7,
          25,
          9,
          60,
          11,
        ],
        'circle-stroke-color': '#ffffff',
        'circle-stroke-width': 1.4,
      },
      layout: {
        visibility: 'none',
      },
    } as AddLayerObject)
  }

  if (!map.getLayer('convenience-clusters')) {
    map.addLayer({
      id: 'convenience-clusters',
      type: 'circle',
      source: CONVENIENCE_SOURCE_ID,
      filter: ['has', 'point_count'],
      paint: {
        'circle-color': '#0f766e',
        'circle-radius': [
          'step',
          ['coalesce', ['get', 'weightedCount'], ['get', 'point_count']],
          15,
          30,
          20,
          80,
          26,
          180,
          30,
        ],
        'circle-stroke-color': '#ffffff',
        'circle-stroke-width': 2,
      },
      layout: {
        visibility: 'none',
      },
    } as AddLayerObject)
  }

  if (!map.getLayer('convenience-cluster-count')) {
    map.addLayer({
      id: 'convenience-cluster-count',
      type: 'symbol',
      source: CONVENIENCE_SOURCE_ID,
      filter: ['has', 'point_count'],
      layout: {
        'text-field': ['to-string', ['coalesce', ['get', 'weightedCount'], ['get', 'point_count']]],
        'text-size': 12,
        'text-font': ['Noto Sans Regular'],
        visibility: 'none',
      },
      paint: {
        'text-color': '#ffffff',
      },
    } as AddLayerObject)
  }

  if (!map.getLayer('convenience-unclustered')) {
    map.addLayer({
      id: 'convenience-unclustered',
      type: 'circle',
      source: CONVENIENCE_SOURCE_ID,
      minzoom: 9,
      filter: ['!', ['has', 'point_count']],
      paint: {
        'circle-color': [
          'match',
          ['get', 'categoryId'],
          'medical',
          '#e11d48',
          'library',
          '#0f766e',
          'community',
          '#14b8a6',
          'sports',
          '#22c55e',
          '#0f766e',
        ],
        'circle-radius': [
          'step',
          ['coalesce', ['get', 'pointWeight'], 1],
          3.8,
          10,
          6,
          25,
          8,
          80,
          10,
        ],
        'circle-stroke-color': '#ffffff',
        'circle-stroke-width': 1.2,
      },
      layout: {
        visibility: 'none',
      },
    } as AddLayerObject)
  }

  if (!map.getLayer('station-selected')) {
    map.addLayer({
      id: 'station-selected',
      type: 'circle',
      source: STATION_SOURCE_ID,
      filter: ['==', ['get', 'isSelected'], true],
      paint: {
        'circle-color': 'rgba(255,255,255,0)',
        'circle-radius': ['+', ['get', 'markerRadius'], 5],
        'circle-stroke-color': '#ffffff',
        'circle-stroke-width': 3,
      },
    } as AddLayerObject)
  }

  if (!map.getLayer('station-circle')) {
    map.addLayer({
      id: 'station-circle',
      type: 'circle',
      source: STATION_SOURCE_ID,
      paint: {
        'circle-color': ['get', 'markerColor'],
        'circle-radius': ['get', 'markerRadius'],
        'circle-stroke-color': '#ffffff',
        'circle-stroke-width': 1.8,
        'circle-opacity': 0.96,
      },
    } as AddLayerObject)
  }

  if (!map.getLayer('station-badge')) {
    map.addLayer({
      id: 'station-badge',
      type: 'symbol',
      source: STATION_SOURCE_ID,
      filter: ['!=', ['get', 'badgeText'], ''],
      layout: {
        'text-field': ['get', 'badgeText'],
        'text-size': ['get', 'badgeSize'],
        'text-font': ['Noto Sans Regular'],
        'text-allow-overlap': true,
        'text-ignore-placement': true,
      },
      paint: {
        'text-color': '#ffffff',
        'text-halo-color': 'rgba(0,0,0,0.08)',
        'text-halo-width': 0.5,
      },
    } as AddLayerObject)
  }

  if (!map.getLayer('station-name')) {
    map.addLayer({
      id: 'station-name',
      type: 'symbol',
      source: STATION_SOURCE_ID,
      filter: ['!=', ['get', 'nameLabel'], ''],
      layout: {
        'text-field': ['get', 'nameLabel'],
        'text-size': ['get', 'nameSize'],
        'text-font': ['Noto Sans Regular'],
        'text-anchor': 'top',
        'text-offset': [0, 1.05],
        'text-allow-overlap': true,
      },
      paint: {
        'text-color': '#172033',
        'text-halo-color': 'rgba(255,255,255,0.94)',
        'text-halo-width': 1.4,
      },
    } as AddLayerObject)
  }

  if (!map.getLayer('station-hit')) {
    map.addLayer({
      id: 'station-hit',
      type: 'circle',
      source: STATION_SOURCE_ID,
      paint: {
        'circle-radius': ['+', ['get', 'markerRadius'], 9],
        'circle-color': '#000000',
        'circle-opacity': 0,
      },
    } as AddLayerObject)
  }
}

export function syncStationLayer(
  map: MapLibreMap,
  stations: StationBase[],
  activeMode: ModeId,
  selectedStationId: string | null,
  selection: StationRenderSelection,
) {
  updateSource(
    map,
    STATION_SOURCE_ID,
    buildStationFeatureCollection(stations, activeMode, selectedStationId, selection),
  )
}

export function syncPointLayers(
  map: MapLibreMap,
  schools: PointLayerFeature[],
  convenience: PointLayerFeature[],
) {
  updateSource(map, SCHOOL_SOURCE_ID, buildPointFeatureCollection(schools))
  updateSource(map, CONVENIENCE_SOURCE_ID, buildPointFeatureCollection(convenience))
}

export function syncAreaLayers(
  map: MapLibreMap,
  hazards: AreaLayerFeature[],
  population: AreaLayerFeature[],
) {
  updateSource(map, HAZARD_SOURCE_ID, buildAreaFeatureCollection(hazards))
  updateSource(map, POPULATION_SOURCE_ID, buildAreaFeatureCollection(population))
}

export function setModeOverlays(map: MapLibreMap, mode: ModeId) {
  const visibleLayerIds = new Set<string>()

  if (mode === 'schools') {
    SCHOOL_LAYER_IDS.forEach((id) => visibleLayerIds.add(id))
  }

  if (mode === 'convenience') {
    CONVENIENCE_LAYER_IDS.forEach((id) => visibleLayerIds.add(id))
  }

  if (mode === 'hazard') {
    HAZARD_LAYER_IDS.forEach((id) => visibleLayerIds.add(id))
  }

  if (mode === 'population') {
    POPULATION_LAYER_IDS.forEach((id) => visibleLayerIds.add(id))
  }

  for (const layerId of ALL_OVERLAY_LAYER_IDS) {
    if (!map.getLayer(layerId)) {
      continue
    }

    map.setLayoutProperty(
      layerId,
      'visibility',
      visibleLayerIds.has(layerId) ? 'visible' : 'none',
    )
  }
}

export function getPointMatches(points: PointLayerFeature[], stationId: string | null) {
  if (!stationId) {
    return []
  }

  return points.filter((point) => point.stationId === stationId)
}

export function getAreaMatches(areas: AreaLayerFeature[], stationId: string | null) {
  if (!stationId) {
    return []
  }

  return areas.filter((area) => area.stationIds.includes(stationId))
}
