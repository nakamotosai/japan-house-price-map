import { describe, expect, it } from 'vitest'
import {
  getStationPriorityScore,
  getStationTargetCountForZoom,
  getStationVisibilityBand,
  getVisibilityBandForZoom,
  getVisibleStationIds,
  shouldShowStationName,
  shouldShowStationPrice,
} from './stationVisibility'
import type { Station } from '../types'

function createStation(partial: Partial<Station> = {}): Station {
  const baseStation: Station = {
    id: 'sample',
    name: '样本站',
    nameJa: 'サンプル',
    nameEn: 'Sample',
    lat: 35.68,
    lng: 139.76,
    operator: 'Sample Operator',
    lines: ['山手線'],
    ward: '',
    labelTier: 'minor',
    summary: '',
    metrics: {
      district: '样本区',
      medianPriceMJPY: 0,
      medianPriceManPerSqm: 0,
      priceSampleCount: 0,
      landValueManPerSqm: 0,
      landSampleCount: 0,
      ridershipDaily: 50_000,
      heatScore: 60,
      transferLines: 1,
      schoolsNearby: 0,
      convenienceNearby: 0,
      convenienceScore: 0,
      convenienceBreakdown: {
        medical: 0,
        publicService: 0,
      },
      populationTrend: '待补',
      populationChangeRate: null,
      hazardMaxDepthRank: null,
      hazard: {
        flood: 'unknown',
        liquefaction: 'unknown',
        landslide: 'unknown',
      },
      coverage: {
        price: false,
        land: false,
        ridership: true,
        schools: false,
        convenience: false,
        population: false,
        hazard: false,
      },
      note: '',
    },
  }

  return {
    ...baseStation,
    ...partial,
    metrics: {
      ...baseStation.metrics,
      ...partial.metrics,
    },
  }
}

describe('stationVisibility', () => {
  it('maps zoom levels to progressively wider visibility bands and target counts', () => {
    expect(getVisibilityBandForZoom(10.4)).toBe(1)
    expect(getVisibilityBandForZoom(11.2)).toBe(2)
    expect(getVisibilityBandForZoom(12.2)).toBe(3)
    expect(getVisibilityBandForZoom(13.0)).toBe(4)
    expect(getStationTargetCountForZoom(10.4)).toBe(28)
    expect(getStationTargetCountForZoom(11.2)).toBe(72)
  })

  it('treats major stations as the highest priority band', () => {
    const majorStation = createStation({ labelTier: 'major' })
    expect(getStationVisibilityBand(majorStation)).toBe(1)
  })

  it('boosts price-covered stations in price mode', () => {
    const pricedStation = createStation({
      metrics: {
        ...createStation().metrics,
        medianPriceMJPY: 96,
        priceSampleCount: 12,
        coverage: {
          price: true,
          land: false,
          ridership: true,
          schools: false,
          convenience: false,
          population: false,
          hazard: false,
        },
      },
    })
    const localStation = createStation()

    expect(getStationPriorityScore(pricedStation, 'price')).toBeGreaterThan(
      getStationPriorityScore(localStation, 'price'),
    )
    expect(shouldShowStationPrice({ station: pricedStation, mode: 'price' })).toBe(true)
  })

  it('always keeps the selected station visible even if it falls outside the zoom quota', () => {
    const stations = Array.from({ length: 40 }, (_, index) =>
      createStation({
        id: `station-${index}`,
        name: `站点-${index}`,
        metrics: {
          ...createStation().metrics,
          ridershipDaily: 300_000 - index * 5_000,
        },
      }),
    )

    const visibleIds = getVisibleStationIds({
      stations,
      mode: 'heat',
      zoom: 10.4,
      selectedStationId: 'station-39',
    })

    expect(visibleIds.has('station-39')).toBe(true)
  })

  it('only shows station names for major stations', () => {
    expect(shouldShowStationName({ station: createStation({ labelTier: 'major' }), zoom: 10.2 })).toBe(true)
    expect(shouldShowStationName({ station: createStation(), zoom: 12.8 })).toBe(false)
  })
})
