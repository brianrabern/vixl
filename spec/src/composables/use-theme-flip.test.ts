import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { runAtomicFlip } from '@/composables/use-theme-flip'

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

describe('runAtomicFlip native apply queue', () => {
  beforeEach(() => {
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      cb(0)
      return 0
    })
    document.documentElement.className = ''
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    document.documentElement.className = ''
  })

  it('does not let a native-only apply overtake a theme flip still in nextTick', async () => {
    const themeHold = createDeferred()
    const themeStarted = createDeferred()
    const themeApply = vi.fn<() => Promise<void>>(async () => {
      themeStarted.resolve()
      await themeHold.promise
    })
    const previewApply = vi.fn<() => Promise<void>>(async () => undefined)

    const themeFlip = runAtomicFlip({
      cssFlip: () => {
        document.documentElement.classList.add('dark')
      },
      nativeApply: themeApply,
    })
    const previewFlip = runAtomicFlip({
      nativeApply: previewApply,
    })

    expect(themeApply).not.toHaveBeenCalled()
    expect(previewApply).not.toHaveBeenCalled()

    await themeStarted.promise
    expect(themeApply).toHaveBeenCalledTimes(1)
    expect(previewApply).not.toHaveBeenCalled()

    themeHold.resolve()
    await themeFlip
    await previewFlip

    expect(previewApply).toHaveBeenCalledTimes(1)
    expect(themeApply).toHaveBeenCalledBefore(previewApply)
  })

  it('surfaces a rejected apply without poisoning later applies', async () => {
    const failed = runAtomicFlip({
      nativeApply: async () => {
        throw new Error('native failed')
      },
    })
    await expect(failed).rejects.toThrow('native failed')

    const laterApply = vi.fn<() => Promise<void>>(async () => undefined)
    await runAtomicFlip({
      nativeApply: laterApply,
    })
    expect(laterApply).toHaveBeenCalledTimes(1)
  })
})
