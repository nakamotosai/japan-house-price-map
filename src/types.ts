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

export type Station = {
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
  summary: string
  metrics: {
    district: string
    medianPriceMJPY: number
    medianPriceManPerSqm: number
    priceSampleCount: number
    landValueManPerSqm: number
    landSampleCount: number
    ridershipDaily: number
    heatScore: number
    transferLines: number
    schoolsNearby: number
    convenienceNearby: number
    convenienceScore: number
    convenienceBreakdown: {
      medical: number
      publicService: number
    }
    populationTrend: PopulationTrend
    populationChangeRate: number | null
    hazardMaxDepthRank: number | null
    hazard: {
      flood: RiskLevel
      liquefaction: RiskLevel
      landslide: RiskLevel
    }
    coverage: {
      price: boolean
      land: boolean
      ridership: boolean
      schools: boolean
      convenience: boolean
      population: boolean
      hazard: boolean
    }
    note: string
  }
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
  geometry: {
    type: 'Polygon' | 'MultiPolygon'
    coordinates: number[][][] | number[][][][]
  }
}

export type TokyoMapData = {
  stations: Station[]
  schools: PointLayerFeature[]
  convenience: PointLayerFeature[]
  hazards: AreaLayerFeature[]
  population: AreaLayerFeature[]
}
