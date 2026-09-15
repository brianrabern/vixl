import type { z } from 'zod'
import modelsDevCatalogSchema from '@/schemas/models/models-dev-catalog'
import proxyFetch from '@/services/providers/proxy-fetch'

type ModelsDevCatalog = z.infer<typeof modelsDevCatalogSchema>

const MODELS_DEV_CATALOG_URL = 'https://models.dev/api.json'
const { VITEST } = import.meta.env
const CACHE_TTL_MS = VITEST ? 0 : 60 * 60 * 1000

type CacheEntry = {
  catalog: ModelsDevCatalog
  fetchedAt: number
}

let cache: CacheEntry | null = null
let inflight: Promise<ModelsDevCatalog | undefined> | null = null

const parseCatalog = (value: unknown): ModelsDevCatalog | undefined => {
  const parsed = modelsDevCatalogSchema.safeParse(value)
  return parsed.success ? parsed.data : undefined
}

const fetchCatalog = async (): Promise<ModelsDevCatalog | undefined> => {
  try {
    const response = await proxyFetch()(MODELS_DEV_CATALOG_URL)
    if (!response.ok) {
      return undefined
    }
    return parseCatalog(await response.json())
  } catch {
    return undefined
  }
}

const loadModelsDevCatalog = async (): Promise<ModelsDevCatalog | undefined> => {
  if (cache && Date.now() - cache.fetchedAt < CACHE_TTL_MS) {
    return cache.catalog
  }
  if (inflight) {
    return inflight
  }

  inflight = fetchCatalog()
  try {
    const next = await inflight
    if (next) {
      cache = { catalog: next, fetchedAt: Date.now() }
      return next
    }
    if (CACHE_TTL_MS <= 0) {
      return undefined
    }
    return cache?.catalog
  } finally {
    inflight = null
  }
}

export default loadModelsDevCatalog
