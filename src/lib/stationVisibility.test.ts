import { describe, expect, it } from 'vitest'
import {
  getStationPriorityScore,
  getVisibilityBandForZoom,
  selectStationRenderSelection,
} from './stationVisibility'
import type { Bounds, StationBase } from '../types'

function createStation(partial: Partial<StationBase> = {}): StationBase {
  const baseStation: StationBase = {
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
    metrics: {
      district: '样本区',
      medianPriceMJPY: 0,
      medianPriceManPerSqm: 0,
      landValueManPerSqm: 0,
      ridershipDaily: 50_000,
      heatScore: 60,
      transferLines: 1,
      schoolsNearby: 0,
      convenienceScore: 0,
      populationTrend: '待补',
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
    },
  }

  return {
    ...baseStation,
    ...partial,
    metrics: {
      ...baseStation.metrics,
      ...partial.metrics,
      hazard: {
        ...baseStation.metrics.hazard,
        ...partial.metrics?.hazard,
      },
      coverage: {
        ...baseStation.metrics.coverage,
        ...partial.metrics?.coverage,
      },
    },
  }
}

const VIEWPORT: Bounds = {
  west: 139.68,
  south: 35.62,
  east: 139.82,
  north: 35.74,
}

function project(station: StationBase) {
  return {
    x: (station.lng - VIEWPORT.west) * 10_000,
    y: (VIEWPORT.north - station.lat) * 10_000,
  }
}

describe('stationVisibility', () => {
  it('maps zoom levels to progressively wider visibility bands', () => {
    expect(getVisibilityBandForZoom(10.4)).toBe(1)
    expect(getVisibilityBandForZoom(11.2)).toBe(2)
    expect(getVisibilityBandForZoom(12.2)).toBe(3)
    expect(getVisibilityBandForZoom(13.0)).toBe(4)
  })

  it('boosts price-covered stations in price mode', () => {
    const pricedStation = createStation({
      metrics: {
        ...createStation().metrics,
        medianPriceMJPY: 96,
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
  })

  it('keeps the selected station visible even when it falls outside the viewport', () => {
    const stations = [
      createStation({ id: 'inside', labelTier: 'major' }),
      createStation({ id: 'outside', lng: 140.12, lat: 35.95 }),
    ]

    const selection = selectStationRenderSelection({
      bounds: VIEWPORT,
      mode: 'heat',
      project: (station) => ({ x: station.lng * 10, y: station.lat * 10 }),
      selectedStationId: 'outside',
      stations,
      zoom: 10.4,
    })

    expect(selection.anchorIds.has('outside')).toBe(true)
  })

  it('compresses dense price badges in the same screen area', () => {
    const stations = Array.from({ length: 20 }, (_, index) =>
      createStation({
        id: `station-${index}`,
        labelTier: 'major',
        lng: 139.72 + index * 0.002,
        lat: 35.67 + index * 0.001,
        metrics: {
          ...createStation().metrics,
          medianPriceMJPY: 90 + index,
          ridershipDaily: 600_000 - index * 5_000,
          transferLines: 4,
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
      }),
    )

    const selection = selectStationRenderSelection({
      bounds: VIEWPORT,
      mode: 'price',
      project,
      selectedStationId: null,
      stations,
      zoom: 10.4,
    })

    expect(selection.anchorIds.size).toBeLessThan(stations.length)
    expect(selection.badgeIds.size).toBeLessThanOrEqual(9)
  })

  it('keeps low-zoom hazard labels focused on major stations', () => {
    const selection = selectStationRenderSelection({
      bounds: VIEWPORT,
      mode: 'hazard',
      project,
      selectedStationId: null,
      stations: [
        createStation({ id: 'major', labelTier: 'major' }),
        createStation({ id: 'minor', labelTier: 'minor', lng: 139.73, lat: 35.69 }),
      ],
      zoom: 10.4,
    })

    expect(selection.nameIds.has('major')).toBe(true)
    expect(selection.nameIds.has('minor')).toBe(false)
  })
})
