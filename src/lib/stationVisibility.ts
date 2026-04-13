import type { ModeId, Station } from '../types'

export type VisibilityBand = 1 | 2 | 3 | 4

const BAND_TARGET_COUNTS: Record<VisibilityBand, number> = {
  1: 28,
  2: 72,
  3: 180,
  4: Number.POSITIVE_INFINITY,
}

export function getVisibilityBandForZoom(zoom: number): VisibilityBand {
  if (zoom < 10.8) {
    return 1
  }

  if (zoom < 11.6) {
    return 2
  }

  if (zoom < 12.6) {
    return 3
  }

  return 4
}

export function getStationTargetCountForZoom(zoom: number) {
  return BAND_TARGET_COUNTS[getVisibilityBandForZoom(zoom)]
}

export function getStationVisibilityBand(station: Station): VisibilityBand {
  if (
    station.labelTier === 'major'
    || station.metrics.transferLines >= 5
    || station.metrics.ridershipDaily >= 900_000
  ) {
    return 1
  }

  if (station.metrics.transferLines >= 4 || station.metrics.ridershipDaily >= 280_000) {
    return 2
  }

  if (station.metrics.transferLines >= 2 || station.metrics.ridershipDaily >= 90_000) {
    return 3
  }

  return 4
}

function getModeCoverageBoost(station: Station, mode: ModeId) {
  if (mode === 'price' && station.metrics.coverage.price) {
    return (
      360_000
      + station.metrics.medianPriceMJPY * 320
      + station.metrics.priceSampleCount * 2_800
    )
  }

  if (mode === 'land' && station.metrics.coverage.land) {
    return (
      320_000
      + station.metrics.landValueManPerSqm * 240
      + station.metrics.landSampleCount * 1_600
    )
  }

  if (mode === 'heat' && station.metrics.coverage.ridership) {
    return 260_000 + station.metrics.heatScore * 4_000
  }

  if (mode === 'schools' && station.metrics.coverage.schools) {
    return 220_000 + station.metrics.schoolsNearby * 2_500
  }

  if (mode === 'convenience' && station.metrics.coverage.convenience) {
    return 220_000 + station.metrics.convenienceScore * 3_000
  }

  if (mode === 'hazard' && station.metrics.coverage.hazard) {
    return 180_000 + (station.metrics.hazardMaxDepthRank ?? 0) * 28_000
  }

  if (mode === 'population' && station.metrics.coverage.population) {
    return (
      180_000 + Math.round(Math.abs(station.metrics.populationChangeRate ?? 0) * 8_000)
    )
  }

  return 0
}

export function getStationPriorityScore(station: Station, mode: ModeId) {
  let score = 0

  if (station.labelTier === 'major') {
    score += 850_000
  }

  score += (5 - getStationVisibilityBand(station)) * 260_000
  score += Math.min(station.metrics.ridershipDaily, 3_000_000) / 12
  score += station.metrics.transferLines * 36_000
  score += getModeCoverageBoost(station, mode)

  return score
}

export function getVisibleStationIds(props: {
  stations: Station[]
  mode: ModeId
  zoom: number
  selectedStationId: string | null
}) {
  const { mode, selectedStationId, stations, zoom } = props
  const visibleIds = new Set<string>()
  const targetCount = getStationTargetCountForZoom(zoom)

  if (!Number.isFinite(targetCount)) {
    for (const station of stations) {
      visibleIds.add(station.id)
    }
  } else {
    const rankedStations = [...stations].sort((left, right) => {
      return (
        getStationPriorityScore(right, mode) - getStationPriorityScore(left, mode)
        || left.name.localeCompare(right.name)
      )
    })

    for (const station of rankedStations.slice(0, targetCount)) {
      visibleIds.add(station.id)
    }
  }

  if (selectedStationId) {
    visibleIds.add(selectedStationId)
  }

  return visibleIds
}

export function shouldShowStationName(props: {
  station: Station
  zoom: number
}) {
  const { station, zoom } = props
  return station.labelTier === 'major' && zoom >= 9.8
}

export function shouldShowStationPrice(props: {
  station: Station
  mode: ModeId
}) {
  const { mode, station } = props
  return mode === 'price' && station.metrics.coverage.price
}
