import type { ModelRef } from '@/types/models/model-ref'
import loadModelsDevCatalog from '@/services/models/models-dev/catalog'

type ModelsDevCatalog = NonNullable<Awaited<ReturnType<typeof loadModelsDevCatalog>>>

/**
 * Maps vixl provider ids to models.dev catalog keys, not model capability data.
 * Only ids that differ from the api.json top-level key belong here.
 */
const MODELS_DEV_PROVIDER_KEYS: Record<string, string> = {
  gateway: 'vercel',
}

const catalogProviderKey = (providerId: string): string => {
  const id = providerId.trim().toLowerCase()
  return MODELS_DEV_PROVIDER_KEYS[id] ?? id
}

const inputModalities = (
  catalog: ModelsDevCatalog,
  providerKey: string,
  modelId: string,
): string[] | undefined => {
  const models = catalog[providerKey]?.models
  if (!models) {
    return undefined
  }
  const model = models[modelId] ?? models[modelId.toLowerCase()]
  return model?.modalities?.input
}

/**
 * Resolve vision from models.dev `modalities.input`.
 * Returns true, false, or undefined (unknown / fetch miss).
 */
const resolveModelsDevVision = async (
  ref: Pick<ModelRef, 'providerId' | 'modelId'>,
): Promise<boolean | undefined> => {
  const providerKey = catalogProviderKey(ref.providerId)
  const modelId = ref.modelId.trim()
  if (!providerKey || !modelId) {
    return undefined
  }

  const catalog = await loadModelsDevCatalog()
  if (!catalog) {
    return undefined
  }

  const input = inputModalities(catalog, providerKey, modelId)
  if (!input) {
    return undefined
  }
  return input.includes('image')
}

export default resolveModelsDevVision
