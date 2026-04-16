import type {
  AreaCatalog,
  AreaLayerFeature,
  ChunkManifest,
  PointLayerFeature,
  RuntimeIndex,
  StationBase,
  StationDetailManifest,
  StationDetailShard,
  TokyoStationsMeta,
} from '../types'

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>
type CacheOptions = {
  cacheVersion?: string | null
  persistent?: boolean
}

const RUNTIME_CACHE_NAME = 'tokyo-map-runtime-v1'
const inflightJsonRequests = new Map<string, Promise<unknown>>()

function appendCacheVersion(resource: string, cacheVersion?: string | null) {
  if (!cacheVersion) {
    return resource
  }

  const origin =
    typeof window !== 'undefined' && window.location?.origin
      ? window.location.origin
      : 'http://local.invalid'
  const url = new URL(resource, origin)
  url.searchParams.set('v', cacheVersion)

  if (/^https?:\/\//.test(resource)) {
    return url.toString()
  }

  return `${url.pathname}${url.search}`
}

function canUsePersistentCache(fetcher?: FetchLike) {
  return (
    typeof window !== 'undefined'
    && typeof caches !== 'undefined'
    && typeof fetcher === 'undefined'
  )
}

async function readJsonFromPersistentCache<T>(resource: string) {
  const cache = await caches.open(RUNTIME_CACHE_NAME)
  const cached = await cache.match(resource)
  if (!cached) {
    return null
  }

  return (await cached.json()) as T
}

async function writeJsonToPersistentCache(resource: string, response: Response) {
  const cache = await caches.open(RUNTIME_CACHE_NAME)
  await cache.put(resource, response)
}

async function readJson<T>(
  resource: string,
  fetcher: FetchLike = fetch,
  signal?: AbortSignal,
  options: CacheOptions = {},
): Promise<T> {
  const resolvedResource = appendCacheVersion(resource, options.cacheVersion)
  const usePersistentCache = options.persistent && canUsePersistentCache(fetcher)
  const canShareInflightRequest = fetcher === fetch

  if (usePersistentCache) {
    const cached = await readJsonFromPersistentCache<T>(resolvedResource)
    if (cached) {
      return cached
    }
  }

  if (canShareInflightRequest) {
    const pending = inflightJsonRequests.get(resolvedResource)
    if (pending) {
      return pending as Promise<T>
    }
  }

  const requestPromise = (async () => {
    const response = await fetcher(resolvedResource, { signal })

    if (!response.ok) {
      throw new Error(`failed_to_load:${resource}:${response.status}`)
    }

    if (usePersistentCache) {
      await writeJsonToPersistentCache(resolvedResource, response.clone())
    }

    return (await response.json()) as T
  })()

  if (canShareInflightRequest) {
    inflightJsonRequests.set(resolvedResource, requestPromise)
  }

  try {
    return await requestPromise
  } finally {
    if (canShareInflightRequest) {
      inflightJsonRequests.delete(resolvedResource)
    }
  }
}

export async function loadRuntimeIndex(
  fetcher?: FetchLike,
  signal?: AbortSignal,
  options?: CacheOptions,
) {
  return readJson<RuntimeIndex>('/data/tokyo/runtime/index.json', fetcher, signal, options)
}

export async function loadStationBases(
  path: string,
  fetcher?: FetchLike,
  signal?: AbortSignal,
  options?: CacheOptions,
) {
  return readJson<StationBase[]>(path, fetcher, signal, options)
}

export async function loadStationDetailManifest(
  path: string,
  fetcher?: FetchLike,
  signal?: AbortSignal,
  options?: CacheOptions,
) {
  return readJson<StationDetailManifest>(path, fetcher, signal, options)
}

export async function loadStationDetailShard(
  path: string,
  fetcher?: FetchLike,
  signal?: AbortSignal,
  options?: CacheOptions,
) {
  return readJson<StationDetailShard>(path, fetcher, signal, options)
}

export async function loadTokyoStationsMeta(
  path: string,
  fetcher?: FetchLike,
  signal?: AbortSignal,
  options?: CacheOptions,
) {
  return readJson<TokyoStationsMeta>(path, fetcher, signal, options)
}

export async function loadChunkManifest(
  path: string,
  fetcher?: FetchLike,
  signal?: AbortSignal,
  options?: CacheOptions,
) {
  return readJson<ChunkManifest>(path, fetcher, signal, options)
}

export async function loadPointChunk(
  path: string,
  fetcher?: FetchLike,
  signal?: AbortSignal,
  options?: CacheOptions,
) {
  return readJson<PointLayerFeature[]>(path, fetcher, signal, options)
}

export async function loadAreaChunk(
  path: string,
  fetcher?: FetchLike,
  signal?: AbortSignal,
  options?: CacheOptions,
) {
  return readJson<AreaLayerFeature[]>(path, fetcher, signal, options)
}

export async function loadAreaCatalog(
  path: string,
  fetcher?: FetchLike,
  signal?: AbortSignal,
  options?: CacheOptions,
) {
  return readJson<AreaCatalog>(path, fetcher, signal, options)
}

export async function loadAreaChunkRefs(
  path: string,
  fetcher?: FetchLike,
  signal?: AbortSignal,
  options?: CacheOptions,
) {
  return readJson<string[]>(path, fetcher, signal, options)
}
