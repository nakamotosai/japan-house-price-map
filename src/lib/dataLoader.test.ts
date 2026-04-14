import { describe, expect, it } from 'vitest'
import {
  loadAreaCatalog,
  loadAreaChunk,
  loadAreaChunkRefs,
  loadChunkManifest,
  loadPointChunk,
  loadRuntimeIndex,
  loadStationBases,
  loadStationDetailManifest,
  loadStationDetailShard,
  loadTokyoStationsMeta,
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
        generatedAt: '2026-04-14T01:49:48Z',
        stationCount: 589,
        stations: { basePath: '/data/tokyo/runtime/stations.base.json', detailsManifestPath: '/details.json' },
        metadataPath: '/data/tokyo/stations.meta.json',
        modes: {},
        summary: {},
      }),
    )

    expect(runtimeIndex.stations.basePath).toBe('/data/tokyo/runtime/stations.base.json')
    expect(runtimeIndex.metadataPath).toBe('/data/tokyo/stations.meta.json')
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
    const stationsMeta = await loadTokyoStationsMeta(
      '/data/tokyo/stations.meta.json',
      createFetcher({ stationCount: 589, sources: { price: 'price', land: 'land', schools: 'schools', convenience: ['medical'], hazard: 'hazard', population: 'population' }, runtime: {} }),
    )
    const chunkManifest = await loadChunkManifest(
      '/data/tokyo/runtime/schools/detail.manifest.json',
      createFetcher({ chunks: [{ id: '00-00' }], level: 'summary' }),
    )
    const pointChunk = await loadPointChunk(
      '/data/tokyo/runtime/schools/detail/chunks/00-00.json',
      createFetcher([{ id: 'school-1' }]),
    )
    const areaChunk = await loadAreaChunk(
      '/data/tokyo/runtime/hazard/detail/chunks/00-00.json',
      createFetcher([{ id: 'hazard-1' }]),
    )
    const areaCatalog = await loadAreaCatalog(
      '/data/tokyo/runtime/hazard/detail.catalog.json',
      createFetcher({ 'hazard-1': { id: 'hazard-1' } }),
    )
    const areaChunkRefs = await loadAreaChunkRefs(
      '/data/tokyo/runtime/hazard/detail/chunks/00-00.json',
      createFetcher(['hazard-1']),
    )

    expect(stationBases[0]?.id).toBe('tokyo')
    expect(detailManifest.stationToShard.tokyo).toBe('shard-00')
    expect(detailShard.tokyo?.id).toBe('tokyo')
    expect(stationsMeta.stationCount).toBe(589)
    expect(chunkManifest.level).toBe('summary')
    expect(chunkManifest.chunks[0]?.id).toBe('00-00')
    expect(pointChunk[0]?.id).toBe('school-1')
    expect(areaChunk[0]?.id).toBe('hazard-1')
    expect(areaCatalog['hazard-1']?.id).toBe('hazard-1')
    expect(areaChunkRefs[0]).toBe('hazard-1')
  })

  it('throws when a runtime resource fails to load', async () => {
    await expect(loadRuntimeIndex(createFetcher({}, false))).rejects.toThrow(
      'failed_to_load:/data/tokyo/runtime/index.json:500',
    )
  })
})
