import type { VixlSettings } from '@/types/vixl/vixl-settings'
import createModel from '@/services/providers/create-model'
import resolveModelVision from '@/services/harness/resolve-model-vision'
import parseModelRef from '@/utils/parse-model-ref'

/**
 * Composer-side vision gate for attachment decisions.
 *
 * Uses the same createModel + resolveModelVision path as the orchestrator so
 * custom `vision` flags, catalog meta, and builtin Image Input tables stay
 * consistent. On parse/create failure, defaults to false (fail closed).
 */
export default async (args: {
  modelRef: string
  settings: VixlSettings
}): Promise<boolean> => {
  const parsed = parseModelRef(args.modelRef)
  if (!parsed) {
    return false
  }

  try {
    const model = await createModel({
      providerId: parsed.providerId,
      modelId: parsed.modelId,
      settings: args.settings,
    })
    return await resolveModelVision({
      model,
      providerId: parsed.providerId,
      modelId: parsed.modelId,
      settings: args.settings,
    })
  } catch {
    return false
  }
}
