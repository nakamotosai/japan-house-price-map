import type { RuntimeIndex, StationBase, TokyoStationsMeta } from '../types'
import { loadRuntimeIndex, loadStationBases, loadTokyoStationsMeta } from './dataLoader'
import { loadMapLibreRuntime } from './maplibreLoader'

let bootstrapPrimed = false
let primedRuntimeIndexPromise: Promise<RuntimeIndex> | null = null
let primedInitialStationsPromise: Promise<StationBase[]> | null = null
let primedStationsMetaPromise: Promise<TokyoStationsMeta> | null = null

export function primeTokyoAppBootstrap() {
  if (bootstrapPrimed || typeof window === 'undefined') {
    return
  }

  bootstrapPrimed = true

  void loadMapLibreRuntime().catch(() => {
    // Keep startup warmup best-effort.
  })

  primedRuntimeIndexPromise = loadRuntimeIndex().catch((error) => {
    primedRuntimeIndexPromise = null
    throw error
  })

  primedInitialStationsPromise = primedRuntimeIndexPromise
    .then((runtimeIndex) =>
      loadStationBases(
        runtimeIndex.stations.initialPath ?? runtimeIndex.stations.basePath,
        undefined,
        undefined,
        {
          persistent: true,
          cacheVersion: runtimeIndex.generatedAt,
        },
      ),
    )
    .catch((error) => {
      primedInitialStationsPromise = null
      throw error
    })

  primedStationsMetaPromise = primedRuntimeIndexPromise
    .then((runtimeIndex) =>
      loadTokyoStationsMeta(
        runtimeIndex.metadataPath ?? '/data/tokyo/stations.meta.json',
        undefined,
        undefined,
        {
          persistent: true,
          cacheVersion: runtimeIndex.generatedAt,
        },
      ),
    )
    .catch((error) => {
      primedStationsMetaPromise = null
      throw error
    })

  void primedInitialStationsPromise.catch(() => {})
  void primedStationsMetaPromise.catch(() => {})
}

export function getPrimedRuntimeIndexPromise() {
  return primedRuntimeIndexPromise
}

export function getPrimedInitialStationsPromise() {
  return primedInitialStationsPromise
}

export function getPrimedStationsMetaPromise() {
  return primedStationsMetaPromise
}
