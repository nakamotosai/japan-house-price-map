import type { StationBase } from '../types'

const NORMALIZE_MAP: Record<string, string> = {
  線: '线',
  鉄: '铁',
  東: '东',
  渋: '涩',
  豊: '丰',
  浜: '滨',
  駅: '站',
}

function normalize(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[線鉄東渋豊浜駅]/g, (character) => NORMALIZE_MAP[character] ?? character)
    .replaceAll('地下铁', '地铁')
}

function stationHaystack(station: StationBase) {
  return normalize(
    [
      station.name,
      station.nameJa,
      station.nameEn,
      station.ward,
      station.operator,
      station.metrics.district,
      ...station.lines,
    ]
      .filter(Boolean)
      .join(' '),
  )
}

export function searchStations(query: string, stations: StationBase[], limit = 6) {
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
