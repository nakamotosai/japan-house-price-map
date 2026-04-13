import type { AreaLayerFeature, PointLayerFeature, Station } from '../types'

type FetchLike = typeof fetch

async function readJson<T>(resource: string, fetcher: FetchLike = fetch): Promise<T> {
  const response = await fetcher(resource)

  if (!response.ok) {
    throw new Error(`failed_to_load:${resource}:${response.status}`)
  }

  return (await response.json()) as T
}

export async function loadStations(fetcher?: FetchLike) {
  return readJson<Station[]>('/data/tokyo/stations.json', fetcher)
}

export async function loadSchools(fetcher?: FetchLike) {
  return readJson<PointLayerFeature[]>('/data/tokyo/schools.json', fetcher)
}

export async function loadConvenience(fetcher?: FetchLike) {
  return readJson<PointLayerFeature[]>('/data/tokyo/convenience.json', fetcher)
}

export async function loadHazards(fetcher?: FetchLike) {
  return readJson<AreaLayerFeature[]>('/data/tokyo/hazards.json', fetcher)
}

export async function loadPopulation(fetcher?: FetchLike) {
  return readJson<AreaLayerFeature[]>('/data/tokyo/population.json', fetcher)
}
