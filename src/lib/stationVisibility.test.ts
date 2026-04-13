import { describe, expect, it } from 'vitest'
import {
  getStationVisibilityBand,
  getVisibilityBandForZoom,
  shouldShowStationMarker,
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
      landValueManPerSqm: 0,
      ridershipDaily: 50_000,
      heatScore: 60,
      transferLines: 1,
      schoolsNearby: 0,
      populationTrend: '待补',
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
  it('maps zoom levels to progressively wider visibility bands', () => {
    expect(getVisibilityBandForZoom(10.4)).toBe(1)
    expect(getVisibilityBandForZoom(11.2)).toBe(2)
    expect(getVisibilityBandForZoom(12.2)).toBe(3)
    expect(getVisibilityBandForZoom(13.0)).toBe(4)
  })

  it('treats major stations as the highest priority band', () => {
    const majorStation = createStation({ labelTier: 'major' })
    expect(getStationVisibilityBand(majorStation)).toBe(1)
  })

  it('keeps price-covered stations visible in price mode at far zoom', () => {
    const pricedStation = createStation({
      metrics: {
        ...createStation().metrics,
        coverage: {
          price: true,
          land: false,
          ridership: true,
          schools: false,
          population: false,
          hazard: false,
        },
      },
    })

    expect(
      shouldShowStationMarker({
        station: pricedStation,
        mode: 'price',
        zoom: 10.2,
        isSelected: false,
      }),
    ).toBe(true)
    expect(shouldShowStationPrice({ station: pricedStation, mode: 'price' })).toBe(true)
  })

  it('hides low-priority local stations at the default zoom', () => {
    const localStation = createStation()
    expect(
      shouldShowStationMarker({
        station: localStation,
        mode: 'heat',
        zoom: 10.4,
        isSelected: false,
      }),
    ).toBe(false)
  })

  it('always keeps the selected station visible', () => {
    const localStation = createStation()
    expect(
      shouldShowStationMarker({
        station: localStation,
        mode: 'heat',
        zoom: 10.4,
        isSelected: true,
      }),
    ).toBe(true)
  })

  it('only shows station names for major stations', () => {
    expect(shouldShowStationName({ station: createStation({ labelTier: 'major' }), zoom: 10.2 })).toBe(true)
    expect(shouldShowStationName({ station: createStation(), zoom: 12.8 })).toBe(false)
  })
})
