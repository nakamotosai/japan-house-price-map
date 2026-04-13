import { describe, expect, it } from 'vitest'
import { searchStations } from './search'
import type { Station } from '../types'

const STATIONS: Station[] = [
  {
    id: 'tokyo',
    name: '东京',
    nameJa: '東京',
    nameEn: 'Tokyo',
    lat: 35.681236,
    lng: 139.767125,
    operator: 'JR 东日本',
    lines: ['JR 山手线'],
    ward: '千代田区',
    labelTier: 'major',
    summary: '核心站点',
    metrics: {
      district: '丸之内',
      medianPriceMJPY: 118,
      medianPriceManPerSqm: 212,
      landValueManPerSqm: 560,
      ridershipDaily: 860000,
      heatScore: 96,
      transferLines: 3,
      schoolsNearby: 4,
      populationTrend: '稳定',
      hazard: { flood: 'low', liquefaction: 'low', landslide: 'low' },
      note: 'seed',
    },
  },
  {
    id: 'shibuya',
    name: '涩谷',
    nameJa: '渋谷',
    nameEn: 'Shibuya',
    lat: 35.658034,
    lng: 139.701636,
    operator: 'JR 东日本',
    lines: ['JR 山手线'],
    ward: '涩谷区',
    labelTier: 'major',
    summary: '商业热度高',
    metrics: {
      district: '涩谷核心区',
      medianPriceMJPY: 103,
      medianPriceManPerSqm: 188,
      landValueManPerSqm: 470,
      ridershipDaily: 2400000,
      heatScore: 98,
      transferLines: 4,
      schoolsNearby: 3,
      populationTrend: '增长',
      hazard: { flood: 'low', liquefaction: 'low', landslide: 'low' },
      note: 'seed',
    },
  },
]

describe('searchStations', () => {
  it('matches station names in Chinese', () => {
    const results = searchStations('涩谷', STATIONS)
    expect(results[0]?.id).toBe('shibuya')
  })

  it('matches line names and limits result count', () => {
    const results = searchStations('山手线', STATIONS, 3)
    expect(results.length).toBeLessThanOrEqual(3)
    expect(results.some((station) => station.id === 'tokyo')).toBe(true)
  })

  it('returns no result for empty query', () => {
    expect(searchStations('', STATIONS)).toHaveLength(0)
  })
})
