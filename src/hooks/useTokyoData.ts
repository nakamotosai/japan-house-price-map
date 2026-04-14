import { useEffect, useMemo, useRef, useState } from 'react'
import {
  loadAreaChunk,
  loadChunkManifest,
  loadPointChunk,
  loadRuntimeIndex,
  loadStationBases,
  loadStationDetailManifest,
  loadStationDetailShard,
} from '../lib/dataLoader'
import type {
  AreaLayerFeature,
  AsyncStatus,
  Bounds,
  ChunkManifest,
  MapViewport,
  ModeId,
  PointLayerFeature,
  RuntimeIndex,
  RuntimeModeManifestRef,
  Station,
  StationBase,
  StationDetailManifest,
  StationDetailShard,
  TokyoOverlayData,
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

type OverlayModeId = 'schools' | 'convenience' | 'hazard' | 'population'
type ChunkPayload = PointLayerFeature[] | AreaLayerFeature[]

type UseTokyoDataArgs = {
  activeMode: ModeId
  viewport: MapViewport | null
  selectedStationId: string | null
}

type TokyoDataState =
  | {
      status: 'loading'
      stationBases: StationBase[]
      overlays: TokyoOverlayData
      overlayStatus: AsyncStatus
      stationDetailStatus: AsyncStatus
      selectedStationDetail: Station | null
    }
  | {
      status: 'error'
      message: string
      stationBases: StationBase[]
      overlays: TokyoOverlayData
      overlayStatus: AsyncStatus
      stationDetailStatus: AsyncStatus
      selectedStationDetail: Station | null
    }
  | {
      status: 'ready'
      stationBases: StationBase[]
      overlays: TokyoOverlayData
      overlayStatus: AsyncStatus
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

function pickRuntimeManifest(
  runtimeIndex: RuntimeIndex | null,
  mode: OverlayModeId,
  zoom: number,
): RuntimeModeManifestRef | null {
  const candidates = runtimeIndex?.modes[mode]?.manifests ?? []
  return (
    candidates.find((manifest) => zoom >= manifest.minZoom && zoom < manifest.maxZoom)
    ?? candidates.at(-1)
    ?? null
  )
}

function getViewportPaddingMultiplier(zoom: number) {
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

function chunkKey(mode: OverlayModeId, manifestPath: string, chunkIds: string[]) {
  return `${mode}:${manifestPath}:${chunkIds.join('|')}`
}

async function getChunkManifestCached(
  cache: Map<string, ChunkManifest>,
  path: string,
  signal: AbortSignal,
) {
  const cached = cache.get(path)
  if (cached) {
    touchCacheEntry(cache, path, cached, MANIFEST_CACHE_LIMIT)
    return cached
  }

  const manifest = await loadChunkManifest(path, undefined, signal)
  touchCacheEntry(cache, path, manifest, MANIFEST_CACHE_LIMIT)
  return manifest
}

async function getDetailShardCached(
  cache: Map<string, StationDetailShard>,
  shardId: string,
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
  )
  touchCacheEntry(cache, shardId, shard, DETAIL_CACHE_LIMIT)
  return shard
}

async function getChunkPayloadCached(
  cache: Map<string, ChunkPayload>,
  path: string,
  kind: 'point' | 'area',
  signal: AbortSignal,
) {
  const cached = cache.get(path)
  if (cached) {
    touchCacheEntry(cache, path, cached, CHUNK_CACHE_LIMIT)
    return cached
  }

  const payload =
    kind === 'point'
      ? await loadPointChunk(path, undefined, signal)
      : await loadAreaChunk(path, undefined, signal)

  touchCacheEntry(cache, path, payload, CHUNK_CACHE_LIMIT)
  return payload
}

export function useTokyoData(args: UseTokyoDataArgs): TokyoDataState {
  const { activeMode, selectedStationId, viewport } = args
  const [status, setStatus] = useState<'loading' | 'error' | 'ready'>('loading')
  const [message, setMessage] = useState<string | undefined>()
  const [stationBases, setStationBases] = useState<StationBase[]>([])
  const [overlays, setOverlays] = useState<TokyoOverlayData>(EMPTY_OVERLAYS)
  const [overlayStatus, setOverlayStatus] = useState<AsyncStatus>('idle')
  const [overlayErrorMessage, setOverlayErrorMessage] = useState<string | undefined>()
  const [stationDetailStatus, setStationDetailStatus] = useState<AsyncStatus>('idle')
  const [stationDetailErrorMessage, setStationDetailErrorMessage] = useState<string | undefined>()
  const [selectedStationDetail, setSelectedStationDetail] = useState<Station | null>(null)

  const runtimeIndexRef = useRef<RuntimeIndex | null>(null)
  const detailManifestRef = useRef<StationDetailManifest | null>(null)
  const manifestCacheRef = useRef(new Map<string, ChunkManifest>())
  const chunkCacheRef = useRef(new Map<string, ChunkPayload>())
  const detailShardCacheRef = useRef(new Map<string, StationDetailShard>())
  const lastOverlayKeyRef = useRef<Record<OverlayModeId, string>>({
    schools: '',
    convenience: '',
    hazard: '',
    population: '',
  })

  useEffect(() => {
    const controller = new AbortController()

    async function run() {
      try {
        const runtimeIndex = await loadRuntimeIndex(undefined, controller.signal)
        const [bases, detailManifest] = await Promise.all([
          loadStationBases(runtimeIndex.stations.basePath, undefined, controller.signal),
          loadStationDetailManifest(
            runtimeIndex.stations.detailsManifestPath,
            undefined,
            controller.signal,
          ),
        ])

        runtimeIndexRef.current = runtimeIndex
        detailManifestRef.current = detailManifest
        setStationBases(bases)
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
    if (status !== 'ready') {
      return
    }

    if (!selectedStationId) {
      return
    }

    const detailManifest = detailManifestRef.current
    const controller = new AbortController()
    const activeStationId = selectedStationId
    const shardId = detailManifest?.stationToShard[activeStationId]

    async function run() {
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
  }, [selectedStationId, status])

  useEffect(() => {
    if (status !== 'ready' || !viewport || !OVERLAY_MODE_IDS.has(activeMode)) {
      return
    }

    const overlayMode = activeMode as OverlayModeId
    const runtimeIndex = runtimeIndexRef.current
    const manifestRef = pickRuntimeManifest(runtimeIndex, overlayMode, viewport.zoom)
    if (!manifestRef) {
      return
    }

    const activeManifestRef = manifestRef

    const controller = new AbortController()
    const paddedViewport = padBounds(
      viewport.bounds,
      getViewportPaddingMultiplier(viewport.zoom),
    )

    async function run() {
      try {
        const manifest = await getChunkManifestCached(
          manifestCacheRef.current,
          activeManifestRef.path,
          controller.signal,
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

        if (lastOverlayKeyRef.current[overlayMode] === nextOverlayKey) {
          return
        }

        setOverlayStatus('loading')
        setOverlayErrorMessage(undefined)

        const payloads = await Promise.all(
          matchedChunks.map((chunk) =>
            getChunkPayloadCached(
              chunkCacheRef.current,
              chunk.path,
              manifest.kind,
              controller.signal,
            ),
          ),
        )

        if (controller.signal.aborted) {
          return
        }

        const mergedPayload = payloads.flat()
        lastOverlayKeyRef.current[overlayMode] = nextOverlayKey

        setOverlays((current) => {
          const next = cloneOverlays(current)

          if (overlayMode === 'schools') {
            next.schools = mergedPayload as PointLayerFeature[]
          } else if (overlayMode === 'convenience') {
            next.convenience = mergedPayload as PointLayerFeature[]
          } else if (overlayMode === 'hazard') {
            next.hazards = mergedPayload as AreaLayerFeature[]
          } else {
            next.population = mergedPayload as AreaLayerFeature[]
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
  }, [activeMode, status, viewport])

  return useMemo(() => {
    if (status === 'loading') {
      return {
        status,
        stationBases,
        overlays,
        overlayStatus,
        stationDetailStatus: selectedStationId ? stationDetailStatus : 'idle',
        selectedStationDetail: selectedStationId ? selectedStationDetail : null,
      }
    }

    if (status === 'error') {
      return {
        status,
        message: message ?? 'unknown_error',
        stationBases,
        overlays,
        overlayStatus,
        stationDetailStatus: selectedStationId ? stationDetailStatus : 'idle',
        selectedStationDetail: selectedStationId ? selectedStationDetail : null,
      }
    }

    return {
      status,
      stationBases,
      overlays,
      overlayStatus,
      stationDetailStatus: selectedStationId ? stationDetailStatus : 'idle',
      selectedStationDetail: selectedStationId ? selectedStationDetail : null,
      overlayErrorMessage,
      stationDetailErrorMessage: selectedStationId
        ? stationDetailErrorMessage
        : undefined,
    }
  }, [
    message,
    overlayErrorMessage,
    overlays,
    overlayStatus,
    selectedStationDetail,
    stationBases,
    stationDetailErrorMessage,
    stationDetailStatus,
    status,
    selectedStationId,
  ])
}
