import type { HazardZone, SchoolPoint, Station } from '../types'

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
  return readJson<SchoolPoint[]>('/data/tokyo/schools.json', fetcher)
}

export async function loadHazards(fetcher?: FetchLike) {
  return readJson<HazardZone[]>('/data/tokyo/hazards.json', fetcher)
}
