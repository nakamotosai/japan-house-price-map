import type {
  AreaLayerFeature,
  ChunkManifest,
  PointLayerFeature,
  RuntimeIndex,
  StationBase,
  StationDetailManifest,
  StationDetailShard,
} from '../types'

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>

async function readJson<T>(
  resource: string,
  fetcher: FetchLike = fetch,
  signal?: AbortSignal,
): Promise<T> {
  const response = await fetcher(resource, { signal })

  if (!response.ok) {
    throw new Error(`failed_to_load:${resource}:${response.status}`)
  }

  return (await response.json()) as T
}

export async function loadRuntimeIndex(fetcher?: FetchLike, signal?: AbortSignal) {
  return readJson<RuntimeIndex>('/data/tokyo/runtime/index.json', fetcher, signal)
}

export async function loadStationBases(
  path: string,
  fetcher?: FetchLike,
  signal?: AbortSignal,
) {
  return readJson<StationBase[]>(path, fetcher, signal)
}

export async function loadStationDetailManifest(
  path: string,
  fetcher?: FetchLike,
  signal?: AbortSignal,
) {
  return readJson<StationDetailManifest>(path, fetcher, signal)
}

export async function loadStationDetailShard(
  path: string,
  fetcher?: FetchLike,
  signal?: AbortSignal,
) {
  return readJson<StationDetailShard>(path, fetcher, signal)
}

export async function loadChunkManifest(
  path: string,
  fetcher?: FetchLike,
  signal?: AbortSignal,
) {
  return readJson<ChunkManifest>(path, fetcher, signal)
}

export async function loadPointChunk(path: string, fetcher?: FetchLike, signal?: AbortSignal) {
  return readJson<PointLayerFeature[]>(path, fetcher, signal)
}

export async function loadAreaChunk(path: string, fetcher?: FetchLike, signal?: AbortSignal) {
  return readJson<AreaLayerFeature[]>(path, fetcher, signal)
}
