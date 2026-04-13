import type { Station } from '../types'

function normalize(value: string) {
  return value.trim().toLowerCase()
}

function stationHaystack(station: Station) {
  return normalize(
    [
      station.name,
      station.nameJa,
      station.nameEn,
      station.ward,
      station.operator,
      station.metrics.district,
      ...station.lines,
    ].join(' '),
  )
}

export function searchStations(query: string, stations: Station[], limit = 6) {
  const keyword = normalize(query)

  if (!keyword) {
    return []
  }

  return stations
    .filter((station) => stationHaystack(station).includes(keyword))
    .sort((left, right) => {
      const leftStarts = stationHaystack(left).startsWith(keyword) ? 1 : 0
      const rightStarts = stationHaystack(right).startsWith(keyword) ? 1 : 0
      return rightStarts - leftStarts || left.name.localeCompare(right.name)
    })
    .slice(0, limit)
}
