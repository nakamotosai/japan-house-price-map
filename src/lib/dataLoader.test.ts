import { describe, expect, it } from 'vitest'
import {
  loadAreaChunk,
  loadChunkManifest,
  loadPointChunk,
  loadRuntimeIndex,
  loadStationBases,
  loadStationDetailManifest,
  loadStationDetailShard,
} from './dataLoader'

function createFetcher(payload: unknown, ok = true) {
  return async (resource: string) =>
    ({
      ok,
      status: ok ? 200 : 500,
      url: resource,
      json: async () => payload,
    }) as Response
}

describe('dataLoader', () => {
  it('loads runtime index from the expected resource path', async () => {
    const runtimeIndex = await loadRuntimeIndex(
      createFetcher({
        stations: { basePath: '/data/tokyo/runtime/stations.base.json', detailsManifestPath: '/details.json' },
        modes: {},
        summary: {},
      }),
    )

    expect(runtimeIndex.stations.basePath).toBe('/data/tokyo/runtime/stations.base.json')
  })

  it('loads station and chunk resources through the shared JSON reader', async () => {
    const stationBases = await loadStationBases(
      '/data/tokyo/runtime/stations.base.json',
      createFetcher([{ id: 'tokyo' }]),
    )
    const detailManifest = await loadStationDetailManifest(
      '/data/tokyo/runtime/stations/details/manifest.json',
      createFetcher({ stationToShard: { tokyo: 'shard-00' } }),
    )
    const detailShard = await loadStationDetailShard(
      '/data/tokyo/runtime/stations/details/shard-00.json',
      createFetcher({ tokyo: { id: 'tokyo' } }),
    )
    const chunkManifest = await loadChunkManifest(
      '/data/tokyo/runtime/schools/manifest.json',
      createFetcher({ chunks: [{ id: '00-00' }] }),
    )
    const pointChunk = await loadPointChunk(
      '/data/tokyo/runtime/schools/chunks/00-00.json',
      createFetcher([{ id: 'school-1' }]),
    )
    const areaChunk = await loadAreaChunk(
      '/data/tokyo/runtime/hazard/detail/chunks/00-00.json',
      createFetcher([{ id: 'hazard-1' }]),
    )

    expect(stationBases[0]?.id).toBe('tokyo')
    expect(detailManifest.stationToShard.tokyo).toBe('shard-00')
    expect(detailShard.tokyo?.id).toBe('tokyo')
    expect(chunkManifest.chunks[0]?.id).toBe('00-00')
    expect(pointChunk[0]?.id).toBe('school-1')
    expect(areaChunk[0]?.id).toBe('hazard-1')
  })

  it('throws when a runtime resource fails to load', async () => {
    await expect(loadRuntimeIndex(createFetcher({}, false))).rejects.toThrow(
      'failed_to_load:/data/tokyo/runtime/index.json:500',
    )
  })
})
