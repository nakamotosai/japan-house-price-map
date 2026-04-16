export type ModeId =
  | 'price'
  | 'land'
  | 'heat'
  | 'schools'
  | 'convenience'
  | 'hazard'
  | 'population'

export type ModeCategory = 'station' | 'point' | 'area'

export type RiskLevel = 'low' | 'medium' | 'high' | 'unknown'

export type PopulationTrend = '增长' | '稳定' | '收缩' | '待补'

export type AsyncStatus = 'idle' | 'loading' | 'ready' | 'error'
export type RuntimeLayerLevel = 'summary' | 'overview' | 'detail'

export type Bounds = {
  west: number
  south: number
  east: number
  north: number
}

export type MapViewport = {
  bounds: Bounds
  zoom: number
}

export type ModeDefinition = {
  id: ModeId
  label: string
  shortLabel: string
  category: ModeCategory
  description: string
  panelTitle: string
  legend: Array<{
    label: string
    color: string
    note?: string
  }>
}

export type StationCoverage = {
  price: boolean
  land: boolean
  ridership: boolean
  schools: boolean
  convenience: boolean
  population: boolean
  hazard: boolean
}

export type StationHazard = {
  flood: RiskLevel
  liquefaction: RiskLevel
  landslide: RiskLevel
}

export type StationMetricsBase = {
  district: string
  medianPriceMJPY: number
  medianPriceManPerSqm: number
  landValueManPerSqm: number
  ridershipDaily: number
  heatScore: number
  transferLines: number
  schoolsNearby: number
  convenienceScore: number
  populationTrend: PopulationTrend
  hazardMaxDepthRank: number | null
  hazard: StationHazard
  coverage: StationCoverage
}

export type StationBase = {
  id: string
  name: string
  nameJa: string
  nameEn: string
  lat: number
  lng: number
  operator: string
  lines: string[]
  ward: string
  labelTier: 'major' | 'minor'
  metrics: StationMetricsBase
}

export type StationMetrics = StationMetricsBase & {
  priceSampleCount: number
  landSampleCount: number
  convenienceNearby: number
  convenienceBreakdown: {
    medical: number
    publicService: number
  }
  populationChangeRate: number | null
  note: string
}

export type Station = StationBase & {
  summary: string
  metrics: StationMetrics
}

export type PointLayerFeature = {
  id: string
  name: string
  categoryId: string
  categoryLabel: string
  lat: number
  lng: number
  stationId: string | null
  note: string
  count?: number
  level?: RuntimeLayerLevel
}

export type AreaLayerFeature = {
  id: string
  name: string
  categoryId: string
  categoryLabel: string
  summary: string
  stationIds: string[]
  metricValue: number | null
  metricLabel: string
  level?: RuntimeLayerLevel
  geometry: {
    type: 'Polygon' | 'MultiPolygon'
    coordinates: number[][][] | number[][][][]
  }
}

export type TokyoOverlayData = {
  schools: PointLayerFeature[]
  convenience: PointLayerFeature[]
  hazards: AreaLayerFeature[]
  population: AreaLayerFeature[]
}

export type RuntimeModeManifestRef = {
  path: string
  minZoom: number
  maxZoom: number
}

export type RuntimeModeIndex = {
  kind: 'point' | 'area'
  manifests: RuntimeModeManifestRef[]
}

export type RuntimeIndex = {
  generatedAt: string
  stationCount: number
  stations: {
    basePath: string
    initialPath?: string
    fullPath?: string
    detailsManifestPath: string
    bootstrapBounds?: Bounds
  }
  metadataPath?: string
  modes: Partial<
    Record<'schools' | 'convenience' | 'hazard' | 'population', RuntimeModeIndex>
  >
  summary: Record<string, number>
}

export type ChunkManifestItem = {
  id: string
  path: string
  bounds: Bounds
  featureCount: number
}

export type ChunkManifest = {
  generatedAt: string
  modeId: string
  kind: 'point' | 'area'
  level?: RuntimeLayerLevel
  chunkCount: number
  featureCount: number
  weightedFeatureCount?: number
  geometryPointCount?: number
  catalogPath?: string
  chunks: ChunkManifestItem[]
}

export type StationDetailManifest = {
  generatedAt: string
  shardCount: number
  stationToShard: Record<string, string>
}

export type StationDetailShard = Record<string, Station>

export type AreaCatalog = Record<string, AreaLayerFeature>

export type TokyoStationsMeta = {
  generatedAt: string
  stationCount: number
  priceCoverageCount: number
  landCoverageCount: number
  schoolsCoverageCount: number
  convenienceCoverageCount: number
  hazardCoverageCount: number
  populationCoverageCount: number
  schoolsPointCount: number
  conveniencePointCount: number
  hazardAreaCount: number
  populationAreaCount: number
  sources: {
    price: string
    land: string
    schools: string
    convenience: string[]
    hazard: string
    population: string
  }
  runtime: Record<string, number>
}

export type OverlayRuntimeInfo = {
  mode: 'schools' | 'convenience' | 'hazard' | 'population'
  level: RuntimeLayerLevel
  manifestPath: string
  matchedChunkCount: number
  featureCount: number
}
