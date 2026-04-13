export type ModeId = 'price' | 'land' | 'heat' | 'schools' | 'hazard'

export type ModeCategory = 'station' | 'overlay'

export type RiskLevel = 'low' | 'medium' | 'high'

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
  summary: string
  metrics: {
    district: string
    medianPriceMJPY: number
    medianPriceManPerSqm: number
    landValueManPerSqm: number
    ridershipDaily: number
    heatScore: number
    transferLines: number
    schoolsNearby: number
    populationTrend: '增长' | '稳定' | '收缩'
    hazard: {
      flood: RiskLevel
      liquefaction: RiskLevel
      landslide: RiskLevel
    }
    note: string
  }
}

export type SchoolPoint = {
  id: string
  name: string
  category: string
  lat: number
  lng: number
  stationIds: string[]
}

export type HazardZone = {
  id: string
  name: string
  summary: string
  riskLevel: RiskLevel
  stationIds: string[]
  coordinates: [number, number][][]
}

export type TokyoSeedData = {
  stations: Station[]
  schools: SchoolPoint[]
  hazards: HazardZone[]
}
