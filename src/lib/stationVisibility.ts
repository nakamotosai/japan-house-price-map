import type { ModeId, Station } from '../types'

export type VisibilityBand = 1 | 2 | 3 | 4

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

export function getStationVisibilityBand(station: Station): VisibilityBand {
  if (station.labelTier === 'major') {
    return 1
  }

  if (
    station.metrics.coverage.price
    || station.metrics.coverage.land
    || station.metrics.transferLines >= 3
    || station.metrics.ridershipDaily >= 250_000
  ) {
    return 2
  }

  if (station.metrics.transferLines >= 2 || station.metrics.ridershipDaily >= 80_000) {
    return 3
  }

  return 4
}

export function shouldShowStationMarker(props: {
  station: Station
  mode: ModeId
  zoom: number
  isSelected: boolean
}) {
  const { isSelected, mode, station, zoom } = props

  if (isSelected) {
    return true
  }

  if (mode === 'price' && station.metrics.coverage.price) {
    return true
  }

  if (mode === 'land' && station.metrics.coverage.land) {
    return true
  }

  return getStationVisibilityBand(station) <= getVisibilityBandForZoom(zoom)
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
