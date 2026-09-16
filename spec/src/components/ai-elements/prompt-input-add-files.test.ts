import { defineComponent } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  usePromptInput,
  usePromptInputProvider,
} from '@/components/ai-elements/prompt-input/context'
import type { PromptInputContext } from '@/components/ai-elements/prompt-input/types'

const pngBytes = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])

const createPngFile = (name = 'shot.png'): File => {
  return new File([pngBytes], name, { type: 'image/png' })
}

const mountPromptInput = (options: {
  initialInput?: string
  onSubmit?: (message: { text: string, files: { url: string }[] }) => void | Promise<void>
  onError?: (err: { code: string, message: string }) => void
}): { ctx: PromptInputContext, unmount: () => void } => {
  const Host = defineComponent({
    setup() {
      const ctx = usePromptInputProvider(options)
      return { ctx }
    },
    template: '<div />',
  })

  const wrapper = mount(Host)
  const ctx = (wrapper.vm as unknown as { ctx: ReturnType<typeof usePromptInput> }).ctx
  return { ctx, unmount: () => wrapper.unmount() }
}

describe('PromptInput addFiles', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('stores a detached in-memory copy that submitForm can convert', async () => {
    const onSubmit = vi.fn<(message: {
      text: string
      files: { url: string }[]
    }) => Promise<void>>().mockResolvedValue(undefined)

    const file = createPngFile()
    const { ctx, unmount } = mountPromptInput({
      initialInput: 'caption',
      onSubmit,
    })

    await ctx.addFiles([file])
    await flushPromises()

    const stored = ctx.files.value[0]?.file
    expect(ctx.files.value).toHaveLength(1)
    expect(stored).toBeInstanceOf(File)
    expect(stored).not.toBe(file)

    vi.spyOn(file, 'arrayBuffer').mockRejectedValue(new Error('expired pasteboard'))

    await ctx.submitForm()
    await flushPromises()

    expect(onSubmit).toHaveBeenCalledTimes(1)
    const message = onSubmit.mock.calls[0]?.[0]
    expect(message?.files[0]?.url).toMatch(/^data:image\/png;base64,/)
    unmount()
  })

  it('skips a file whose bytes cannot be read and reports attach_read_failed', async () => {
    const onError = vi.fn<(err: { code: string, message: string }) => void>()
    const file = createPngFile()
    vi.spyOn(file, 'arrayBuffer').mockRejectedValue(new Error('expired pasteboard'))

    const { ctx, unmount } = mountPromptInput({ onError })

    await ctx.addFiles([file])
    await flushPromises()

    expect(ctx.files.value).toHaveLength(0)
    expect(onError).toHaveBeenCalledWith({
      code: 'attach_read_failed',
      message: 'Could not read the attached file. Try attaching it again.',
    })
    unmount()
  })

  it('converts via item.file without calling fetch when a File is present', async () => {
    const fetchMock = vi.fn<typeof fetch>(() => {
      throw new Error('fetch should not be called')
    })
    vi.stubGlobal('fetch', fetchMock)

    const onSubmit = vi.fn<(message: {
      text: string
      files: { url: string }[]
    }) => Promise<void>>().mockResolvedValue(undefined)

    const { ctx, unmount } = mountPromptInput({
      initialInput: 'caption',
      onSubmit,
    })

    await ctx.addFiles([createPngFile()])
    await flushPromises()

    await ctx.submitForm()
    await flushPromises()

    expect(fetchMock).not.toHaveBeenCalled()
    expect(onSubmit).toHaveBeenCalledTimes(1)
    const message = onSubmit.mock.calls[0]?.[0]
    expect(message?.files[0]?.url).toMatch(/^data:image\/png;base64,/)
    unmount()
  })

  it('waits for an in-flight addFiles before submitForm snapshots files', async () => {
    const onSubmit = vi.fn<(message: {
      text: string
      files: { url: string }[]
    }) => Promise<void>>().mockResolvedValue(undefined)

    const { ctx, unmount } = mountPromptInput({
      initialInput: 'caption',
      onSubmit,
    })

    const file = createPngFile()
    ctx.addFiles([file])
    await ctx.submitForm()
    await flushPromises()

    expect(onSubmit).toHaveBeenCalledTimes(1)
    const message = onSubmit.mock.calls[0]?.[0]
    expect(message?.files).toHaveLength(1)
    expect(message?.files[0]?.url).toMatch(/^data:image\/png;base64,/)
    unmount()
  })

  it('drops a stale in-flight addFiles after clearFiles', async () => {
    const file = createPngFile()
    const { ctx, unmount } = mountPromptInput({})

    const pending = ctx.addFiles([file])
    ctx.clearFiles()
    await pending
    await flushPromises()

    expect(ctx.files.value).toHaveLength(0)
    unmount()
  })
})
