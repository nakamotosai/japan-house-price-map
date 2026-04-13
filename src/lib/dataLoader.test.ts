import { describe, expect, it } from 'vitest'
import {
  loadConvenience,
  loadHazards,
  loadPopulation,
  loadSchools,
  loadStations,
} from './dataLoader'

function createFetcher(payload: unknown, ok = true) {
  return async () =>
    ({
      ok,
      status: ok ? 200 : 500,
      json: async () => payload,
    }) as Response
}

describe('dataLoader', () => {
  it('loads stations from the expected resource path', async () => {
    const stations = await loadStations(createFetcher([{ id: 'tokyo' }]))
    expect(stations[0]?.id).toBe('tokyo')
  })

  it('loads point and area layers through the shared JSON loader', async () => {
    const schools = await loadSchools(createFetcher([{ id: 'school-1' }]))
    const convenience = await loadConvenience(createFetcher([{ id: 'facility-1' }]))
    const hazards = await loadHazards(createFetcher([{ id: 'hazard-1' }]))
    const population = await loadPopulation(createFetcher([{ id: 'mesh-1' }]))

    expect(schools[0]?.id).toBe('school-1')
    expect(convenience[0]?.id).toBe('facility-1')
    expect(hazards[0]?.id).toBe('hazard-1')
    expect(population[0]?.id).toBe('mesh-1')
  })

  it('throws when a resource fails to load', async () => {
    await expect(loadStations(createFetcher([], false))).rejects.toThrow(
      'failed_to_load:/data/tokyo/stations.json:500',
    )
  })
})
