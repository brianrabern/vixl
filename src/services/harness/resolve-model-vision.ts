import type { LanguageModel } from 'ai'
import type {
  VixlCustomProviderModel,
  VixlSettings,
} from '@/types/vixl/vixl-settings'
import { getCustomProvider } from '@/services/providers/registry'
import { getModelCatalogMeta } from '@/services/models/model-catalog-meta'
import { resolveModelsDevVision } from '@/services/models/models-dev'

const hasConcreteImageSupportedUrls = async (
  model: LanguageModel,
): Promise<boolean> => {
  if (typeof model === 'string') {
    return false
  }
  if (!('supportedUrls' in model) || model.supportedUrls == null) {
    return false
  }
  const urls = await Promise.resolve(model.supportedUrls)
  return Object.keys(urls).some((mediaType) => {
    if (mediaType.includes('*')) {
      return false
    }
    return mediaType === 'image' || mediaType.startsWith('image/')
  })
}

const findCustomModel = (
  providerId: string,
  modelId: string,
  settings: VixlSettings,
): VixlCustomProviderModel | undefined => {
  const provider = getCustomProvider(settings, providerId)
  return provider?.models?.find((model) => model.id === modelId)
}

/**
 * Resolve whether the active model can consume image parts.
 *
 * 1. Custom providers: trust the user-configured `vision` flag.
 * 2. Catalog meta (`models.catalogMeta`), from gateway tags / OpenRouter
 *    `input_modalities`, when the field is an explicit boolean.
 * 3. models.dev `modalities.input` (image), when the lookup is definite.
 * 4. SDK `supportedUrls` only for concrete `image` / `image/<type>` keys.
 *    Ignore star-slash-star and `image/*` wildcards (gateway and openai
 *    advertise those for every model).
 * 5. Default false.
 */
export default async (args: {
  model: LanguageModel
  providerId: string
  modelId: string
  settings: VixlSettings
}): Promise<boolean> => {
  const custom = findCustomModel(args.providerId, args.modelId, args.settings)
  if (custom) {
    return custom.vision === true
  }

  const catalogVision = getModelCatalogMeta(args.settings, {
    providerId: args.providerId,
    modelId: args.modelId,
  }).vision
  if (typeof catalogVision === 'boolean') {
    return catalogVision
  }

  const modelsDev = await resolveModelsDevVision({
    providerId: args.providerId,
    modelId: args.modelId,
  })
  if (typeof modelsDev === 'boolean') {
    return modelsDev
  }

  if (await hasConcreteImageSupportedUrls(args.model)) {
    return true
  }

  return false
}
