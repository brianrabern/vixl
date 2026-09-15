import { z } from 'zod'

const modelsDevModalitiesSchema = z
  .object({
    input: z.array(z.string()).optional(),
  })
  .passthrough()

const modelsDevModelSchema = z
  .object({
    modalities: modelsDevModalitiesSchema.optional(),
  })
  .passthrough()

const modelsDevProviderSchema = z
  .object({
    models: z.record(z.string(), modelsDevModelSchema).optional(),
  })
  .passthrough()

const modelsDevCatalogSchema = z.record(z.string(), modelsDevProviderSchema)

export default modelsDevCatalogSchema
