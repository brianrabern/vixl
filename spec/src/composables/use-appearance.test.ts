import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { defineComponent, nextTick, type Ref } from 'vue'
import { mockTauriCore } from '../test-utils/mocks/tauri-core'
import type { VixlSettings } from '@/types/vixl/vixl-settings'
import { defaultVixlSettings } from '@/schemas/vixl-settings'

const invoke = vi.hoisted(() =>
  vi.fn<(cmd: string, args?: Record<string, unknown>) => Promise<unknown>>(
    async () => undefined,
  ),
)

const applyWindowVibrancy = vi.hoisted(() =>
  vi.fn<(options: { dark: boolean; hue: number; intensity: number }) => Promise<void>>(
    async (options) => {
      await invoke('set_window_vibrancy', options)
    },
  ),
)

const clearWindowVibrancy = vi.hoisted(() =>
  vi.fn<() => Promise<void>>(async () => {
    await invoke('clear_window_vibrancy')
  }),
)

const harness = vi.hoisted(() => {
  const box: {
    effectiveSettings: Ref<VixlSettings> | null
    hydrated: Ref<boolean> | null
    modeValue: Ref<'dark' | 'light' | 'auto'> | null
    systemValue: Ref<'dark' | 'light'> | null
  } = {
    effectiveSettings: null,
    hydrated: null,
    modeValue: null,
    systemValue: null,
  }
  return box
})

vi.mock('@tauri-apps/api/core', () => mockTauriCore({ invoke }))

vi.mock('@/services/vibrancy', () => ({
  applyWindowVibrancy: (
    options: { dark: boolean; hue: number; intensity: number },
  ) => applyWindowVibrancy(options),
  clearWindowVibrancy: () => clearWindowVibrancy(),
  isVibrancySupported: () => true,
}))

vi.mock('@/composables/use-vixl-config', async () => {
  const { ref: vueRef } = await import('vue')
  const { defaultVixlSettings: defaults } = await import('@/schemas/vixl-settings')
  harness.effectiveSettings = vueRef({
    ...defaults(),
    'appearance.theme': 'light',
    'appearance.transparency': true,
  })
  harness.hydrated = vueRef(true)
  return {
    default: () => ({
      effectiveSettings: harness.effectiveSettings,
      hydrated: harness.hydrated,
    }),
  }
})

vi.mock('@vueuse/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@vueuse/core')>()
  const { computed, ref: vueRef } = await import('vue')
  harness.modeValue = vueRef<'dark' | 'light' | 'auto'>('light')
  harness.systemValue = vueRef<'dark' | 'light'>('light')
  const state = computed(() =>
    harness.modeValue!.value === 'auto'
      ? harness.systemValue!.value
      : harness.modeValue!.value,
  )
  const colorMode = Object.assign(harness.modeValue, {
    system: harness.systemValue,
    state,
  })
  return {
    ...actual,
    useColorMode: () => colorMode,
  }
})

vi.mock('vue-sonner', () => ({
  toast: {
    error: vi.fn<(...args: unknown[]) => void>(),
    success: vi.fn<(...args: unknown[]) => void>(),
  },
}))

const glassSettings = (): VixlSettings => ({
  ...defaultVixlSettings(),
  'appearance.theme': 'light',
  'appearance.transparency': true,
  'appearance.transparencyHue': 265,
  'appearance.transparencyIntensity': 0,
})

const flush = async (): Promise<void> => {
  for (let i = 0; i < 5; i += 1) {
    await nextTick()
    await Promise.resolve()
    await Promise.resolve()
  }
}

const createDeferred = (): {
  promise: Promise<void>
  resolve: () => void
} => {
  let resolve!: () => void
  const promise = new Promise<void>((res) => {
    resolve = res
  })
  return { promise, resolve }
}

const vibrancyInvokes = (): unknown[][] =>
  invoke.mock.calls.filter((call) => call[0] === 'set_window_vibrancy')

const resetHarness = (): void => {
  if (!harness.effectiveSettings || !harness.hydrated) {
    throw new Error('useVixlConfig mock did not initialize')
  }
  if (!harness.modeValue || !harness.systemValue) {
    throw new Error('useColorMode mock did not initialize')
  }
  harness.effectiveSettings.value = glassSettings()
  harness.hydrated.value = true
  harness.modeValue.value = 'light'
  harness.systemValue.value = 'light'
}

let wrapper: VueWrapper | undefined

const mountHost = async (options: {
  appearance: boolean
  transparency: boolean
}): Promise<void> => {
  const { default: useAppearance } = await import('@/composables/use-appearance')
  const { default: useTransparency } = await import('@/composables/use-transparency')
  resetHarness()

  const Host = defineComponent({
    setup() {
      const transparency = options.transparency ? useTransparency() : null
      if (options.appearance) {
        useAppearance()
      }
      return {
        previewTransparency: transparency?.previewTransparency,
      }
    },
    template: '<div />',
  })
  wrapper = mount(Host)
  await flush()
}

const previewTransparencyOf = (
  host: VueWrapper,
): ((hue: number, intensity: number) => void) => {
  const preview = (
    host.vm as {
      previewTransparency?: (hue: number, intensity: number) => void
    }
  ).previewTransparency
  if (!preview) {
    throw new Error('previewTransparency was not mounted')
  }
  return preview
}

describe('use-appearance glass vibrancy', () => {
  beforeEach(() => {
    vi.resetModules()
    invoke.mockReset()
    invoke.mockResolvedValue(undefined)
    applyWindowVibrancy.mockClear()
    clearWindowVibrancy.mockClear()
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      cb(0)
      return 0
    })
    document.documentElement.className = ''
  })

  afterEach(() => {
    wrapper?.unmount()
    wrapper = undefined
    vi.unstubAllGlobals()
    document.documentElement.className = ''
  })

  it('applies set_window_vibrancy once for a theme flip while glass is on', async () => {
    await mountHost({ appearance: true, transparency: true })
    expect(harness.effectiveSettings?.value['appearance.transparency']).toBe(true)

    invoke.mockClear()
    applyWindowVibrancy.mockClear()

    harness.effectiveSettings!.value = {
      ...harness.effectiveSettings!.value,
      'appearance.theme': 'dark',
    }
    await flush()

    expect(vibrancyInvokes()).toHaveLength(1)
    expect(applyWindowVibrancy).toHaveBeenCalledTimes(1)
    expect(applyWindowVibrancy).toHaveBeenCalledWith({
      dark: true,
      hue: 265,
      intensity: 0,
    })
  })

  it('does not apply vibrancy from the transparency watcher on a theme-only change', async () => {
    await mountHost({ appearance: false, transparency: true })

    invoke.mockClear()
    applyWindowVibrancy.mockClear()

    harness.effectiveSettings!.value = {
      ...harness.effectiveSettings!.value,
      'appearance.theme': 'dark',
    }
    harness.modeValue!.value = 'dark'
    await flush()

    expect(vibrancyInvokes()).toHaveLength(0)
    expect(applyWindowVibrancy).not.toHaveBeenCalled()
    expect(clearWindowVibrancy).not.toHaveBeenCalled()
  })

  it('keeps the later theme when an earlier glass sync finishes last', async () => {
    await mountHost({ appearance: true, transparency: true })

    const firstNative = createDeferred()
    const secondNative = createDeferred()
    let vibrancyCalls = 0
    invoke.mockReset()
    invoke.mockImplementation(async (cmd) => {
      if (cmd !== 'set_window_vibrancy') {
        return undefined
      }
      vibrancyCalls += 1
      if (vibrancyCalls === 1) {
        return firstNative.promise
      }
      return secondNative.promise
    })
    applyWindowVibrancy.mockClear()

    harness.effectiveSettings!.value = {
      ...harness.effectiveSettings!.value,
      'appearance.theme': 'dark',
    }
    await flush()

    expect(harness.modeValue!.value).toBe('dark')
    expect(vibrancyCalls).toBe(1)

    harness.effectiveSettings!.value = {
      ...harness.effectiveSettings!.value,
      'appearance.theme': 'light',
    }
    await flush()

    expect(harness.modeValue!.value).toBe('light')
    expect(vibrancyCalls).toBe(1)
    expect(applyWindowVibrancy).toHaveBeenNthCalledWith(1, {
      dark: true,
      hue: 265,
      intensity: 0,
    })

    firstNative.resolve()
    await flush()

    expect(vibrancyCalls).toBe(2)
    expect(applyWindowVibrancy).toHaveBeenNthCalledWith(2, {
      dark: false,
      hue: 265,
      intensity: 0,
    })

    secondNative.resolve()
    await flush()

    expect(harness.modeValue!.value).toBe('light')
  })

  it('keeps a later preview hue when a theme flip is still in flight', async () => {
    await mountHost({ appearance: true, transparency: true })

    const themeNative = createDeferred()
    const previewNative = createDeferred()
    let vibrancyCalls = 0
    invoke.mockReset()
    invoke.mockImplementation(async (cmd) => {
      if (cmd !== 'set_window_vibrancy') {
        return undefined
      }
      vibrancyCalls += 1
      if (vibrancyCalls === 1) {
        return themeNative.promise
      }
      return previewNative.promise
    })
    applyWindowVibrancy.mockClear()

    harness.effectiveSettings!.value = {
      ...harness.effectiveSettings!.value,
      'appearance.theme': 'dark',
    }
    await flush()

    expect(vibrancyCalls).toBe(1)
    expect(applyWindowVibrancy).toHaveBeenNthCalledWith(1, {
      dark: true,
      hue: 265,
      intensity: 0,
    })

    previewTransparencyOf(wrapper!)(120, 40)
    await flush()

    expect(vibrancyCalls).toBe(1)

    themeNative.resolve()
    await flush()

    expect(vibrancyCalls).toBe(2)
    expect(applyWindowVibrancy).toHaveBeenNthCalledWith(2, {
      dark: true,
      hue: 120,
      intensity: 40,
    })
    expect(applyWindowVibrancy.mock.calls.at(-1)?.[0]).toEqual({
      dark: true,
      hue: 120,
      intensity: 40,
    })

    previewNative.resolve()
    await flush()
  })
})
