import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { FileUIPart } from 'ai'
import type { QueuedChatMessage } from '@/types/chat/queued-chat-message'
import bytesToDataUrl from '@/utils/bytes-to-data-url'

const setTextInput = vi.hoisted(() => vi.fn<(value: string) => void>())
const clearFiles = vi.hoisted(() => vi.fn<() => void>())
const addFiles = vi.hoisted(
  () => vi.fn<(files: File[]) => Promise<void>>().mockResolvedValue(undefined),
)
const toastError = vi.hoisted(() => vi.fn<(...args: unknown[]) => void>())

vi.mock('@/components/ai-elements/prompt-input/context', () => ({
  usePromptInput: () => ({
    setTextInput,
    clearFiles,
    addFiles,
  }),
}))

vi.mock('vue-sonner', () => ({
  toast: {
    error: (...args: unknown[]) => toastError(...args),
  },
}))

import useQueueHydrate from '@/composables/use-queue-hydrate'

const pngBytes = new Uint8Array([137, 80, 78, 71])

const queued = (
  files: FileUIPart[],
): QueuedChatMessage => ({
  id: 'q1',
  text: 'hello',
  files,
  mode: 'agent',
  model: 'openai::gpt-4o',
})

describe('use-queue-hydrate', () => {
  beforeEach(() => {
    setTextInput.mockClear()
    clearFiles.mockClear()
    addFiles.mockClear()
    toastError.mockClear()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('restores a file from a data URL without fetch', async () => {
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)

    const url = bytesToDataUrl(pngBytes, 'image/png')
    const { hydrateQueuedMessage } = useQueueHydrate()

    await hydrateQueuedMessage(
      queued([
        {
          type: 'file',
          url,
          filename: 'shot.png',
          mediaType: 'image/png',
        },
      ]),
    )

    expect(fetchSpy).not.toHaveBeenCalled()
    expect(clearFiles).toHaveBeenCalledTimes(1)
    expect(setTextInput).toHaveBeenCalledWith('hello')
    expect(addFiles).toHaveBeenCalledTimes(1)

    const restored = addFiles.mock.calls[0]?.[0]
    expect(restored).toHaveLength(1)
    expect(restored?.[0]).toBeInstanceOf(File)
    expect(restored?.[0]?.name).toBe('shot.png')
    expect(restored?.[0]?.type).toBe('image/png')
    expect(restored?.[0]?.size).toBe(pngBytes.length)
    expect(new Uint8Array(await restored![0]!.arrayBuffer())).toEqual(pngBytes)
  })

  it('falls back to attachment filename and data-url media type', async () => {
    const url = bytesToDataUrl(pngBytes, 'image/jpeg')
    const { hydrateQueuedMessage } = useQueueHydrate()

    await hydrateQueuedMessage(
      queued([
        {
          type: 'file',
          url,
          mediaType: '',
        },
      ]),
    )

    const restored = addFiles.mock.calls[0]?.[0]
    expect(restored?.[0]?.name).toBe('attachment')
    expect(restored?.[0]?.type).toBe('image/jpeg')
  })

  it('skips malformed data URLs without fetch and without addFiles', async () => {
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)

    const { hydrateQueuedMessage } = useQueueHydrate()
    await hydrateQueuedMessage(
      queued([
        {
          type: 'file',
          url: 'data:image/png;base64',
          filename: 'bad.png',
          mediaType: 'image/png',
        },
      ]),
    )

    expect(fetchSpy).not.toHaveBeenCalled()
    expect(addFiles).not.toHaveBeenCalled()
    expect(toastError).not.toHaveBeenCalled()
  })
})
