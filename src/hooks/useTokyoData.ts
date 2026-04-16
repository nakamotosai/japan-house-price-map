import { useEffect, useEffectEvent, useMemo, useRef, useState } from 'react'
import {
  getPrimedInitialStationsPromise,
  getPrimedRuntimeIndexPromise,
  getPrimedStationsMetaPromise,
} from '../lib/appBootstrap'
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
} from '../lib/dataLoader'
import type {
  AreaLayerFeature,
  AreaCatalog,
  AsyncStatus,
  Bounds,
  ChunkManifest,
  MapViewport,
  ModeId,
  OverlayRuntimeInfo,
  PointLayerFeature,
  RuntimeIndex,
  RuntimeLayerLevel,
  RuntimeModeManifestRef,
  Station,
  StationBase,
  StationDetailManifest,
  StationDetailShard,
  TokyoOverlayData,
  TokyoStationsMeta,
} from '../types'

const EMPTY_OVERLAYS: TokyoOverlayData = {
  schools: [],
  convenience: [],
  hazards: [],
  population: [],
}

const POINT_MODE_IDS = new Set<ModeId>(['schools', 'convenience'])
const AREA_MODE_IDS = new Set<ModeId>(['hazard', 'population'])
const OVERLAY_MODE_IDS = new Set<ModeId>([...POINT_MODE_IDS, ...AREA_MODE_IDS])
const MANIFEST_CACHE_LIMIT = 12
const CHUNK_CACHE_LIMIT = 180
const DETAIL_CACHE_LIMIT = 20
const AREA_CATALOG_CACHE_LIMIT = 12
const PREFETCH_DETAIL_SHARD_LIMIT = 4
const PERSISTENT_RUNTIME_CACHE = { persistent: true } as const
const BACKGROUND_STATION_EXPAND_DELAY_MS = 420
const BACKGROUND_DETAIL_MANIFEST_DELAY_MS = 520

type OverlayModeId = 'schools' | 'convenience' | 'hazard' | 'population'
type ChunkPayload = PointLayerFeature[] | AreaLayerFeature[] | string[]

type UseTokyoDataArgs = {
  activeMode: ModeId
  viewport: MapViewport | null
  selectedStationId: string | null
}

type TokyoDataState =
  | {
      status: 'loading'
      stationBases: StationBase[]
      metadata: TokyoStationsMeta | null
      overlays: TokyoOverlayData
      overlayStatus: AsyncStatus
      overlayInfo: OverlayRuntimeInfo | null
      runtimeGeneratedAt: string | null
      stationDetailStatus: AsyncStatus
      selectedStationDetail: Station | null
    }
  | {
      status: 'error'
      message: string
      stationBases: StationBase[]
      metadata: TokyoStationsMeta | null
      overlays: TokyoOverlayData
      overlayStatus: AsyncStatus
      overlayInfo: OverlayRuntimeInfo | null
      runtimeGeneratedAt: string | null
      stationDetailStatus: AsyncStatus
      selectedStationDetail: Station | null
    }
  | {
      status: 'ready'
      stationBases: StationBase[]
      metadata: TokyoStationsMeta | null
      overlays: TokyoOverlayData
      overlayStatus: AsyncStatus
      overlayInfo: OverlayRuntimeInfo | null
      runtimeGeneratedAt: string | null
      stationDetailStatus: AsyncStatus
      selectedStationDetail: Station | null
      overlayErrorMessage?: string
      stationDetailErrorMessage?: string
    }

function cloneOverlays(overlays: TokyoOverlayData): TokyoOverlayData {
  return {
    schools: overlays.schools,
    convenience: overlays.convenience,
    hazards: overlays.hazards,
    population: overlays.population,
  }
}

function dedupePayload<T extends { id: string }>(items: T[]) {
  return [...new Map(items.map((item) => [item.id, item])).values()]
}

function dedupeIds(items: string[]) {
  return [...new Set(items)]
}

function touchCacheEntry<K, V>(cache: Map<K, V>, key: K, value: V, limit: number) {
  if (cache.has(key)) {
    cache.delete(key)
  }

  cache.set(key, value)

  while (cache.size > limit) {
    const oldestKey = cache.keys().next().value as K | undefined
    if (oldestKey === undefined) {
      return
    }
    cache.delete(oldestKey)
  }
}

export function pickRuntimeManifest(
  runtimeIndex: RuntimeIndex | null,
  mode: OverlayModeId,
  zoom: number,
): RuntimeModeManifestRef | null {
  const candidates = runtimeIndex?.modes[mode]?.manifests ?? []
  if (!candidates.length) {
    return null
  }

  const matchedManifest = candidates.find(
    (manifest) => zoom >= manifest.minZoom && zoom < manifest.maxZoom,
  )
  if (matchedManifest) {
    return matchedManifest
  }

  if (zoom < candidates[0].minZoom) {
    return candidates[0]
  }

  return candidates.at(-1) ?? null
}

function getViewportPaddingMultiplier(level: RuntimeLayerLevel, zoom: number) {
  if (level === 'summary') {
    return 1.02
  }

  if (zoom < 11.1) {
    return 1.08
  }

  if (zoom < 12.3) {
    return 1.12
  }

  return 1.18
}

function padBounds(bounds: Bounds, multiplier: number): Bounds {
  const width = bounds.east - bounds.west
  const height = bounds.north - bounds.south
  const extraWidth = (width * (multiplier - 1)) / 2
  const extraHeight = (height * (multiplier - 1)) / 2

  return {
    west: bounds.west - extraWidth,
    south: bounds.south - extraHeight,
    east: bounds.east + extraWidth,
    north: bounds.north + extraHeight,
  }
}

function intersectsBounds(left: Bounds, right: Bounds) {
  return !(
    left.east < right.west
    || left.west > right.east
    || left.north < right.south
    || left.south > right.north
  )
}

function containsBounds(outer: Bounds, inner: Bounds) {
  return (
    inner.west >= outer.west
    && inner.south >= outer.south
    && inner.east <= outer.east
    && inner.north <= outer.north
  )
}

function getInitialStationPath(runtimeIndex: RuntimeIndex) {
  return runtimeIndex.stations.initialPath ?? runtimeIndex.stations.basePath
}

function getFullStationPath(runtimeIndex: RuntimeIndex) {
  return runtimeIndex.stations.fullPath ?? runtimeIndex.stations.basePath
}

function scheduleBackgroundTask(callback: () => void, timeoutMs: number) {
  if (typeof window === 'undefined') {
    callback()
    return () => {}
  }

  if (typeof window.requestIdleCallback === 'function') {
    const idleId = window.requestIdleCallback(() => callback(), { timeout: timeoutMs })
    return () => {
      window.cancelIdleCallback(idleId)
    }
  }

  const timeoutId = window.setTimeout(callback, timeoutMs)
  return () => {
    window.clearTimeout(timeoutId)
  }
}

function chunkKey(mode: OverlayModeId, manifestPath: string, chunkIds: string[]) {
  return `${mode}:${manifestPath}:${chunkIds.join('|')}`
}

async function getChunkManifestCached(
  cache: Map<string, ChunkManifest>,
  path: string,
  cacheVersion: string | null,
  signal: AbortSignal,
) {
  const cached = cache.get(path)
  if (cached) {
    touchCacheEntry(cache, path, cached, MANIFEST_CACHE_LIMIT)
    return cached
  }

  const manifest = await loadChunkManifest(path, undefined, signal, {
    ...PERSISTENT_RUNTIME_CACHE,
    cacheVersion,
  })
  touchCacheEntry(cache, path, manifest, MANIFEST_CACHE_LIMIT)
  return manifest
}

async function getDetailShardCached(
  cache: Map<string, StationDetailShard>,
  shardId: string,
  cacheVersion: string | null,
  signal: AbortSignal,
) {
  const cached = cache.get(shardId)
  if (cached) {
    touchCacheEntry(cache, shardId, cached, DETAIL_CACHE_LIMIT)
    return cached
  }

  const shard = await loadStationDetailShard(
    `/data/tokyo/runtime/stations/details/${shardId}.json`,
    undefined,
    signal,
    {
      ...PERSISTENT_RUNTIME_CACHE,
      cacheVersion,
    },
  )
  touchCacheEntry(cache, shardId, shard, DETAIL_CACHE_LIMIT)
  return shard
}

async function getChunkPayloadCached(
  cache: Map<string, ChunkPayload>,
  path: string,
  kind: 'point' | 'area',
  cacheVersion: string | null,
  signal: AbortSignal,
) {
  const cached = cache.get(path)
  if (cached) {
    touchCacheEntry(cache, path, cached, CHUNK_CACHE_LIMIT)
    return cached
  }

  const payload =
    kind === 'point'
      ? await loadPointChunk(path, undefined, signal, {
          ...PERSISTENT_RUNTIME_CACHE,
          cacheVersion,
        })
      : await loadAreaChunk(path, undefined, signal, {
          ...PERSISTENT_RUNTIME_CACHE,
          cacheVersion,
        })

  touchCacheEntry(cache, path, payload, CHUNK_CACHE_LIMIT)
  return payload
}

async function getAreaCatalogCached(
  cache: Map<string, AreaCatalog>,
  path: string,
  cacheVersion: string | null,
  signal: AbortSignal,
) {
  const cached = cache.get(path)
  if (cached) {
    touchCacheEntry(cache, path, cached, AREA_CATALOG_CACHE_LIMIT)
    return cached
  }

  const catalog = await loadAreaCatalog(path, undefined, signal, {
    ...PERSISTENT_RUNTIME_CACHE,
    cacheVersion,
  })
  touchCacheEntry(cache, path, catalog, AREA_CATALOG_CACHE_LIMIT)
  return catalog
}

async function getAreaChunkRefsCached(
  cache: Map<string, ChunkPayload>,
  path: string,
  cacheVersion: string | null,
  signal: AbortSignal,
) {
  const cached = cache.get(path)
  if (cached) {
    touchCacheEntry(cache, path, cached, CHUNK_CACHE_LIMIT)
    return cached as string[]
  }

  const payload = await loadAreaChunkRefs(path, undefined, signal, {
    ...PERSISTENT_RUNTIME_CACHE,
    cacheVersion,
  })
  touchCacheEntry(cache, path, payload, CHUNK_CACHE_LIMIT)
  return payload
}

function topPriorityShardIds(
  stationBases: StationBase[],
  detailManifest: StationDetailManifest | null,
) {
  if (!detailManifest) {
    return []
  }

  const rankedStations = [...stationBases]
    .sort((left, right) => {
      if (left.labelTier !== right.labelTier) {
        return left.labelTier === 'major' ? -1 : 1
      }
      return right.metrics.ridershipDaily - left.metrics.ridershipDaily
    })
    .slice(0, 18)

  const shardIds = rankedStations
    .map((station) => detailManifest.stationToShard[station.id])
    .filter((shardId): shardId is string => typeof shardId === 'string')

  return [...new Set(shardIds)].slice(0, PREFETCH_DETAIL_SHARD_LIMIT)
}

export function useTokyoData(args: UseTokyoDataArgs): TokyoDataState {
  const { activeMode, selectedStationId, viewport } = args
  const [status, setStatus] = useState<'loading' | 'error' | 'ready'>('loading')
  const [message, setMessage] = useState<string | undefined>()
  const [stationBases, setStationBases] = useState<StationBase[]>([])
  const [metadata, setMetadata] = useState<TokyoStationsMeta | null>(null)
  const [overlays, setOverlays] = useState<TokyoOverlayData>(EMPTY_OVERLAYS)
  const [overlayStatus, setOverlayStatus] = useState<AsyncStatus>('idle')
  const [overlayInfo, setOverlayInfo] = useState<OverlayRuntimeInfo | null>(null)
  const [overlayErrorMessage, setOverlayErrorMessage] = useState<string | undefined>()
  const [runtimeGeneratedAt, setRuntimeGeneratedAt] = useState<string | null>(null)
  const [stationDetailStatus, setStationDetailStatus] = useState<AsyncStatus>('idle')
  const [stationDetailErrorMessage, setStationDetailErrorMessage] = useState<string | undefined>()
  const [selectedStationDetail, setSelectedStationDetail] = useState<Station | null>(null)

  const runtimeIndexRef = useRef<RuntimeIndex | null>(null)
  const detailManifestRef = useRef<StationDetailManifest | null>(null)
  const manifestCacheRef = useRef(new Map<string, ChunkManifest>())
  const chunkCacheRef = useRef(new Map<string, ChunkPayload>())
  const areaCatalogCacheRef = useRef(new Map<string, AreaCatalog>())
  const detailShardCacheRef = useRef(new Map<string, StationDetailShard>())
  const fullStationLoadPromiseRef = useRef<Promise<StationBase[]> | null>(null)
  const detailManifestLoadPromiseRef = useRef<Promise<StationDetailManifest | null> | null>(null)
  const prefetchedShardIdsRef = useRef(new Set<string>())
  const lastOverlayKeyRef = useRef<Record<OverlayModeId, string>>({
    schools: '',
    convenience: '',
    hazard: '',
    population: '',
  })
  const [hasFullStationBases, setHasFullStationBases] = useState(false)
  const [detailManifestReadyToken, setDetailManifestReadyToken] = useState(0)

  const ensureFullStationBasesEvent = useEffectEvent(async () => {
    const runtimeIndex = runtimeIndexRef.current
    if (!runtimeIndex) {
      return stationBases
    }

    const fullPath = getFullStationPath(runtimeIndex)
    const initialPath = getInitialStationPath(runtimeIndex)
    if (fullPath === initialPath) {
      if (!hasFullStationBases) {
        setHasFullStationBases(true)
      }
      return stationBases
    }

    if (hasFullStationBases) {
      return stationBases
    }

    if (!fullStationLoadPromiseRef.current) {
      fullStationLoadPromiseRef.current = loadStationBases(
        fullPath,
        undefined,
        undefined,
        {
          ...PERSISTENT_RUNTIME_CACHE,
          cacheVersion: runtimeGeneratedAt,
        },
      )
        .then((bases) => {
          setStationBases(bases)
          setHasFullStationBases(true)
          return bases
        })
        .finally(() => {
          fullStationLoadPromiseRef.current = null
        })
    }

    return fullStationLoadPromiseRef.current
  })

  const ensureDetailManifestEvent = useEffectEvent(async () => {
    if (detailManifestRef.current) {
      return detailManifestRef.current
    }

    const runtimeIndex = runtimeIndexRef.current
    if (!runtimeIndex) {
      return null
    }

    if (!detailManifestLoadPromiseRef.current) {
      detailManifestLoadPromiseRef.current = loadStationDetailManifest(
        runtimeIndex.stations.detailsManifestPath,
        undefined,
        undefined,
        {
          ...PERSISTENT_RUNTIME_CACHE,
          cacheVersion: runtimeGeneratedAt,
        },
      )
        .then((detailManifest) => {
          detailManifestRef.current = detailManifest
          setDetailManifestReadyToken((value) => value + 1)
          return detailManifest
        })
        .finally(() => {
          detailManifestLoadPromiseRef.current = null
        })
    }

    return detailManifestLoadPromiseRef.current
  })

  useEffect(() => {
    const controller = new AbortController()

    async function run() {
      try {
        const primedRuntimeIndexPromise = getPrimedRuntimeIndexPromise()
        const runtimeIndex = primedRuntimeIndexPromise
          ? await primedRuntimeIndexPromise
          : await loadRuntimeIndex(undefined, controller.signal)
        const initialPath = getInitialStationPath(runtimeIndex)
        const fullPath = getFullStationPath(runtimeIndex)
        const primedInitialStationsPromise = getPrimedInitialStationsPromise()
        const primedStationsMetaPromise = getPrimedStationsMetaPromise()
        const [bases, stationsMeta] = await Promise.all([
          primedInitialStationsPromise
            ?? loadStationBases(initialPath, undefined, controller.signal, {
              ...PERSISTENT_RUNTIME_CACHE,
              cacheVersion: runtimeIndex.generatedAt,
            }),
          primedStationsMetaPromise
            ?? loadTokyoStationsMeta(
              runtimeIndex.metadataPath ?? '/data/tokyo/stations.meta.json',
              undefined,
              controller.signal,
              {
                ...PERSISTENT_RUNTIME_CACHE,
                cacheVersion: runtimeIndex.generatedAt,
              },
            ),
        ])

        runtimeIndexRef.current = runtimeIndex
        setStationBases(bases)
        setMetadata(stationsMeta)
        setRuntimeGeneratedAt(runtimeIndex.generatedAt)
        setHasFullStationBases(initialPath === fullPath)
        setStatus('ready')
        setMessage(undefined)
      } catch (error) {
        if (controller.signal.aborted) {
          return
        }

        setStatus('error')
        setMessage(error instanceof Error ? error.message : 'unknown_error')
      }
    }

    run()

    return () => {
      controller.abort()
    }
  }, [])

  useEffect(() => {
    if (status !== 'ready' || hasFullStationBases) {
      return
    }

    return scheduleBackgroundTask(() => {
      void ensureFullStationBasesEvent()
    }, BACKGROUND_STATION_EXPAND_DELAY_MS)
  }, [hasFullStationBases, status])

  useEffect(() => {
    if (status !== 'ready' || detailManifestRef.current) {
      return
    }

    return scheduleBackgroundTask(() => {
      void ensureDetailManifestEvent()
    }, BACKGROUND_DETAIL_MANIFEST_DELAY_MS)
  }, [detailManifestReadyToken, status])

  useEffect(() => {
    if (status !== 'ready' || hasFullStationBases || !viewport) {
      return
    }

    const bootstrapBounds = runtimeIndexRef.current?.stations.bootstrapBounds
    if (!bootstrapBounds || containsBounds(bootstrapBounds, viewport.bounds)) {
      return
    }

    void ensureFullStationBasesEvent()
  }, [hasFullStationBases, status, viewport])

  useEffect(() => {
    if (status !== 'ready' || !selectedStationId) {
      return
    }

    if (stationBases.some((station) => station.id === selectedStationId)) {
      return
    }

    void ensureFullStationBasesEvent()
  }, [selectedStationId, stationBases, status])

  useEffect(() => {
    if (status !== 'ready' || !stationBases.length || !detailManifestRef.current) {
      return
    }

    const controller = new AbortController()
    const detailManifest = detailManifestRef.current
    const priorityShardIds = topPriorityShardIds(stationBases, detailManifest)
      .filter((shardId) => !prefetchedShardIdsRef.current.has(shardId))

    if (!priorityShardIds.length) {
      return
    }

    let timeoutId: number | null = null

    const prefetch = async () => {
      for (const shardId of priorityShardIds) {
        if (controller.signal.aborted) {
          return
        }

        try {
          await getDetailShardCached(
            detailShardCacheRef.current,
            shardId,
            runtimeGeneratedAt,
            controller.signal,
          )
          prefetchedShardIdsRef.current.add(shardId)
        } catch {
          return
        }
      }
    }

    if (typeof window !== 'undefined') {
      timeoutId = window.setTimeout(() => {
        void prefetch()
      }, 350)
    }

    return () => {
      controller.abort()
      if (typeof window !== 'undefined' && timeoutId !== null) {
        window.clearTimeout(timeoutId)
      }
    }
  }, [detailManifestReadyToken, runtimeGeneratedAt, stationBases, status])

  useEffect(() => {
    if (status !== 'ready') {
      return
    }

    if (!selectedStationId) {
      return
    }

    const controller = new AbortController()
    const activeStationId = selectedStationId

    async function run() {
      const detailManifest = await ensureDetailManifestEvent()
      if (controller.signal.aborted) {
        return
      }

      const shardId = detailManifest?.stationToShard[activeStationId]
      if (!shardId) {
        setSelectedStationDetail(null)
        setStationDetailStatus('error')
        setStationDetailErrorMessage(`missing_station_detail:${activeStationId}`)
        return
      }

      const cached = detailShardCacheRef.current.get(shardId)
      if (cached?.[activeStationId]) {
        touchCacheEntry(detailShardCacheRef.current, shardId, cached, DETAIL_CACHE_LIMIT)
        setSelectedStationDetail(cached[activeStationId] ?? null)
        setStationDetailStatus('ready')
        setStationDetailErrorMessage(undefined)
        return
      }

      setSelectedStationDetail(null)
      setStationDetailStatus('loading')
      setStationDetailErrorMessage(undefined)

      try {
        const shard = await getDetailShardCached(
          detailShardCacheRef.current,
          shardId,
          runtimeGeneratedAt,
          controller.signal,
        )

        if (controller.signal.aborted) {
          return
        }

        const nextStation = shard[activeStationId] ?? null
        setSelectedStationDetail(nextStation)
        setStationDetailStatus(nextStation ? 'ready' : 'error')
        setStationDetailErrorMessage(
          nextStation ? undefined : `missing_station_detail:${activeStationId}`,
        )
      } catch (error) {
        if (controller.signal.aborted) {
          return
        }

        setSelectedStationDetail(null)
        setStationDetailStatus('error')
        setStationDetailErrorMessage(
          error instanceof Error ? error.message : 'unknown_error',
        )
      }
    }

    run()

    return () => {
      controller.abort()
    }
  }, [runtimeGeneratedAt, selectedStationId, status])

  useEffect(() => {
    if (status !== 'ready' || !viewport || !OVERLAY_MODE_IDS.has(activeMode)) {
      return
    }

    const overlayMode = activeMode as OverlayModeId
    const runtimeIndex = runtimeIndexRef.current
    const activeViewport = viewport
    const manifestRef = pickRuntimeManifest(runtimeIndex, overlayMode, activeViewport.zoom)
    if (!manifestRef) {
      return
    }

    const activeManifestRef = manifestRef

    const controller = new AbortController()
    async function run() {
      try {
        const manifest = await getChunkManifestCached(
          manifestCacheRef.current,
          activeManifestRef.path,
          runtimeGeneratedAt,
          controller.signal,
        )
        const paddedViewport = padBounds(
          activeViewport.bounds,
          getViewportPaddingMultiplier(manifest.level ?? 'detail', activeViewport.zoom),
        )
        const matchedChunks = manifest.chunks.filter((chunk) =>
          intersectsBounds(chunk.bounds, paddedViewport),
        )
        const matchedChunkIds = matchedChunks.map((chunk) => chunk.id).sort()
        const nextOverlayKey = chunkKey(
          overlayMode,
          activeManifestRef.path,
          matchedChunkIds,
        )
        const nextOverlayInfo: OverlayRuntimeInfo = {
          mode: overlayMode,
          level: manifest.level ?? 'detail',
          manifestPath: activeManifestRef.path,
          matchedChunkCount: matchedChunks.length,
          featureCount: matchedChunks.reduce(
            (sum, chunk) => sum + chunk.featureCount,
            0,
          ),
        }

        if (lastOverlayKeyRef.current[overlayMode] === nextOverlayKey) {
          setOverlayInfo(nextOverlayInfo)
          setOverlayStatus('ready')
          return
        }

        setOverlayStatus('loading')
        setOverlayErrorMessage(undefined)
        setOverlayInfo(nextOverlayInfo)

        const payloads =
          manifest.kind === 'area' && manifest.catalogPath
            ? await Promise.all(
                matchedChunks.map((chunk) =>
                  getAreaChunkRefsCached(
                    chunkCacheRef.current,
                    chunk.path,
                    runtimeGeneratedAt,
                    controller.signal,
                  ),
                ),
              )
            : await Promise.all(
                matchedChunks.map((chunk) =>
                  getChunkPayloadCached(
                    chunkCacheRef.current,
                    chunk.path,
                    manifest.kind,
                    runtimeGeneratedAt,
                    controller.signal,
                  ),
                ),
              )

        if (controller.signal.aborted) {
          return
        }

        let resolvedPayload: PointLayerFeature[] | AreaLayerFeature[]
        if (manifest.kind === 'area' && manifest.catalogPath) {
          const catalog = await getAreaCatalogCached(
            areaCatalogCacheRef.current,
            manifest.catalogPath,
            runtimeGeneratedAt,
            controller.signal,
          )
          resolvedPayload = dedupeIds(payloads.flat() as string[])
            .map((id) => catalog[id])
            .filter((item): item is AreaLayerFeature => Boolean(item))
        } else {
          resolvedPayload = dedupePayload(
            payloads.flat() as Array<PointLayerFeature | AreaLayerFeature>,
          ) as PointLayerFeature[] | AreaLayerFeature[]
        }

        if (controller.signal.aborted) {
          return
        }

        lastOverlayKeyRef.current[overlayMode] = nextOverlayKey
        setOverlayInfo(nextOverlayInfo)

        setOverlays((current) => {
          const next = cloneOverlays(current)

          if (overlayMode === 'schools') {
            next.schools = resolvedPayload as PointLayerFeature[]
          } else if (overlayMode === 'convenience') {
            next.convenience = resolvedPayload as PointLayerFeature[]
          } else if (overlayMode === 'hazard') {
            next.hazards = resolvedPayload as AreaLayerFeature[]
          } else {
            next.population = resolvedPayload as AreaLayerFeature[]
          }

          return next
        })

        setOverlayStatus('ready')
      } catch (error) {
        if (controller.signal.aborted) {
          return
        }

        setOverlayStatus('error')
        setOverlayErrorMessage(error instanceof Error ? error.message : 'unknown_error')
      }
    }

    run()

    return () => {
      controller.abort()
    }
  }, [activeMode, runtimeGeneratedAt, status, viewport])

  return useMemo(() => {
    const effectiveOverlayStatus = OVERLAY_MODE_IDS.has(activeMode)
      ? overlayStatus
      : 'idle'
    const effectiveOverlayInfo = OVERLAY_MODE_IDS.has(activeMode)
      ? overlayInfo
      : null
    const effectiveOverlayErrorMessage = OVERLAY_MODE_IDS.has(activeMode)
      ? overlayErrorMessage
      : undefined

    if (status === 'loading') {
      return {
        status,
        stationBases,
        metadata,
        overlays,
        overlayStatus: effectiveOverlayStatus,
        overlayInfo: effectiveOverlayInfo,
        runtimeGeneratedAt,
        stationDetailStatus: selectedStationId ? stationDetailStatus : 'idle',
        selectedStationDetail: selectedStationId ? selectedStationDetail : null,
      }
    }

    if (status === 'error') {
      return {
        status,
        message: message ?? 'unknown_error',
        stationBases,
        metadata,
        overlays,
        overlayStatus: effectiveOverlayStatus,
        overlayInfo: effectiveOverlayInfo,
        runtimeGeneratedAt,
        stationDetailStatus: selectedStationId ? stationDetailStatus : 'idle',
        selectedStationDetail: selectedStationId ? selectedStationDetail : null,
      }
    }

    return {
      status,
      stationBases,
      metadata,
      overlays,
      overlayStatus: effectiveOverlayStatus,
      overlayInfo: effectiveOverlayInfo,
      runtimeGeneratedAt,
      stationDetailStatus: selectedStationId ? stationDetailStatus : 'idle',
      selectedStationDetail: selectedStationId ? selectedStationDetail : null,
      overlayErrorMessage: effectiveOverlayErrorMessage,
      stationDetailErrorMessage: selectedStationId
        ? stationDetailErrorMessage
        : undefined,
    }
  }, [
    activeMode,
    message,
    metadata,
    overlayErrorMessage,
    overlayInfo,
    overlays,
    overlayStatus,
    runtimeGeneratedAt,
    selectedStationDetail,
    stationBases,
    stationDetailErrorMessage,
    stationDetailStatus,
    status,
    selectedStationId,
  ])
}
