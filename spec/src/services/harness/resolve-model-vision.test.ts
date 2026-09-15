import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { VixlSettings } from '@/types/vixl/vixl-settings'
import type { LanguageModelV3 } from '@ai-sdk/provider'

const resolveModelsDevVision = vi.hoisted(() =>
  vi.fn<(args: { providerId: string; modelId: string }) => Promise<boolean | undefined>>(),
)

vi.mock('@/services/models/models-dev', () => ({
  resolveModelsDevVision,
}))

import resolveModelVision from '@/services/harness/resolve-model-vision'

const baseSettings = (): VixlSettings => ({
  version: 1,
})

const stubModel = (supportedUrls: Record<string, RegExp[]>): LanguageModelV3 =>
  ({
    specificationVersion: 'v3',
    provider: 'test',
    modelId: 'test-model',
    supportedUrls,
    doGenerate: async () => {
      throw new Error('not implemented')
    },
    doStream: async () => {
      throw new Error('not implemented')
    },
  }) as LanguageModelV3

describe('resolveModelVision', () => {
  beforeEach(() => {
    resolveModelsDevVision.mockReset()
    resolveModelsDevVision.mockResolvedValue(undefined)
  })

  it('trusts custom model vision flag when true', async () => {
    const settings: VixlSettings = {
      ...baseSettings(),
      'providers.custom.local': {
        type: 'openai-compatible',
        baseURL: 'http://localhost:11434/v1',
        name: 'Local',
        models: [{ id: 'llava', vision: true }],
      },
    }
    expect(
      await resolveModelVision({
        model: stubModel({}),
        providerId: 'local',
        modelId: 'llava',
        settings,
      }),
    ).toBe(true)
    expect(resolveModelsDevVision).not.toHaveBeenCalled()
  })

  it('treats custom model without vision as text-only even if supportedUrls has images', async () => {
    const settings: VixlSettings = {
      ...baseSettings(),
      'providers.custom.local': {
        type: 'openai-compatible',
        baseURL: 'http://localhost:11434/v1',
        name: 'Local',
        models: [{ id: 'llama3' }],
      },
    }
    expect(
      await resolveModelVision({
        model: stubModel({ 'image/*': [/^https?:\/\//] }),
        providerId: 'local',
        modelId: 'llama3',
        settings,
      }),
    ).toBe(false)
  })

  it('does not treat gateway */* wildcards as vision', async () => {
    expect(
      await resolveModelVision({
        model: stubModel({ '*/*': [/^https?:\/\//] }),
        providerId: 'gateway',
        modelId: 'openai/gpt-3.5-turbo',
        settings: baseSettings(),
      }),
    ).toBe(false)
  })

  it('does not treat openai blanket image/* advertisement as vision on its own', async () => {
    expect(
      await resolveModelVision({
        model: stubModel({ 'image/*': [/^https?:\/\//] }),
        providerId: 'openai',
        modelId: 'gpt-3.5-turbo',
        settings: baseSettings(),
      }),
    ).toBe(false)
  })

  it('uses catalogMeta.vision when set', async () => {
    expect(
      await resolveModelVision({
        model: stubModel({ '*/*': [/^https?:\/\//] }),
        providerId: 'gateway',
        modelId: 'acme/text-only-9000',
        settings: {
          ...baseSettings(),
          'models.catalogMeta': {
            'gateway::acme/text-only-9000': { vision: true },
          },
        },
      }),
    ).toBe(true)
    expect(resolveModelsDevVision).not.toHaveBeenCalled()
  })

  it('uses models.dev when modalities.input includes image', async () => {
    resolveModelsDevVision.mockResolvedValue(true)
    expect(
      await resolveModelVision({
        model: stubModel({}),
        providerId: 'anthropic',
        modelId: 'claude-sonnet-4-5',
        settings: baseSettings(),
      }),
    ).toBe(true)
    expect(resolveModelsDevVision).toHaveBeenCalledWith({
      providerId: 'anthropic',
      modelId: 'claude-sonnet-4-5',
    })
  })

  it('uses models.dev when the model is known text-only', async () => {
    resolveModelsDevVision.mockResolvedValue(false)
    expect(
      await resolveModelVision({
        model: stubModel({ 'image/*': [/^https?:\/\//] }),
        providerId: 'openai',
        modelId: 'gpt-3.5-turbo',
        settings: baseSettings(),
      }),
    ).toBe(false)
  })

  it('defaults unknown models to false', async () => {
    expect(
      await resolveModelVision({
        model: stubModel({}),
        providerId: 'openai',
        modelId: 'some-model',
        settings: baseSettings(),
      }),
    ).toBe(false)
  })

  it('accepts concrete image mime keys on supportedUrls', async () => {
    expect(
      await resolveModelVision({
        model: stubModel({ 'image/png': [/^https?:\/\//] }),
        providerId: 'openai',
        modelId: 'unknown-vision-adapter',
        settings: baseSettings(),
      }),
    ).toBe(true)
  })
})
