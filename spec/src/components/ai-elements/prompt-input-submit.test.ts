import { defineComponent } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import {
  usePromptInput,
  usePromptInputProvider,
} from '@/components/ai-elements/prompt-input/context'

describe('PromptInput submitForm', () => {
  it('keeps draft text and files when onSubmit throws', async () => {
    const onError = vi.fn<(err: { code: string; message: string }) => void>()
    const Host = defineComponent({
      setup() {
        const ctx = usePromptInputProvider({
          initialInput: 'keep this draft',
          onSubmit: async () => {
            throw new Error(
              'Image could not be compressed under the 3.75MB provider limit',
            )
          },
          onError,
        })
        ctx.files.value = [
          {
            id: 'att-1',
            type: 'file',
            mediaType: 'image/png',
            url: 'data:image/png;base64,AAA',
            filename: 'shot.png',
          },
        ]
        return { ctx }
      },
      template: '<div />',
    })

    const wrapper = mount(Host)
    const ctx = (wrapper.vm as unknown as { ctx: ReturnType<typeof usePromptInput> }).ctx

    await ctx.submitForm()
    await flushPromises()

    expect(ctx.textInput.value).toBe('keep this draft')
    expect(ctx.files.value).toHaveLength(1)
    expect(ctx.files.value[0]?.filename).toBe('shot.png')
    expect(onError).toHaveBeenCalledWith({
      code: 'submit_error',
      message: 'Image could not be compressed under the 3.75MB provider limit',
    })
  })

  it('clears draft text after onSubmit resolves', async () => {
    const Host = defineComponent({
      setup() {
        const ctx = usePromptInputProvider({
          initialInput: 'send me',
          onSubmit: async () => undefined,
        })
        return { ctx }
      },
      template: '<div />',
    })

    const wrapper = mount(Host)
    const ctx = (wrapper.vm as unknown as { ctx: ReturnType<typeof usePromptInput> }).ctx

    await ctx.submitForm()
    await flushPromises()

    expect(ctx.textInput.value).toBe('')
  })

  it('drops failed blob conversions, toasts, and still sends remaining text', async () => {
    const onError = vi.fn<(err: { code: string; message: string }) => void>()
    const onSubmit = vi.fn<(message: {
      text: string
      files: { url: string }[]
    }) => Promise<void>>().mockResolvedValue(undefined)
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.reject(new Error('expired'))),
    )
    const Host = defineComponent({
      setup() {
        const ctx = usePromptInputProvider({
          initialInput: 'caption',
          onSubmit,
          onError,
        })
        ctx.files.value = [
          {
            id: 'att-1',
            type: 'file',
            mediaType: 'image/png',
            url: 'blob:https://app.local/shot-1',
            filename: 'shot.png',
          },
        ]
        return { ctx }
      },
      template: '<div />',
    })

    const wrapper = mount(Host)
    const ctx = (wrapper.vm as unknown as { ctx: ReturnType<typeof usePromptInput> }).ctx

    await ctx.submitForm()
    await flushPromises()

    expect(onError).toHaveBeenCalledWith({
      code: 'submit_error',
      message: 'Could not attach image. The preview expired. Try attaching it again.',
    })
    expect(onSubmit).toHaveBeenCalledWith({
      text: 'caption',
      files: [],
    })
    expect(ctx.textInput.value).toBe('')
    expect(ctx.files.value).toHaveLength(0)
    vi.unstubAllGlobals()
  })

  it('aborts submit when blob conversion fails and nothing remains to send', async () => {
    const onError = vi.fn<(err: { code: string; message: string }) => void>()
    const onSubmit = vi.fn<(...args: unknown[]) => Promise<void>>()
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.reject(new Error('expired'))),
    )
    const Host = defineComponent({
      setup() {
        const ctx = usePromptInputProvider({
          initialInput: '   ',
          onSubmit,
          onError,
        })
        ctx.files.value = [
          {
            id: 'att-1',
            type: 'file',
            mediaType: 'image/png',
            url: 'blob:https://app.local/shot-1',
            filename: 'shot.png',
          },
        ]
        return { ctx }
      },
      template: '<div />',
    })

    const wrapper = mount(Host)
    const ctx = (wrapper.vm as unknown as { ctx: ReturnType<typeof usePromptInput> }).ctx

    await ctx.submitForm()
    await flushPromises()

    expect(onError).toHaveBeenCalledWith({
      code: 'submit_error',
      message: 'Could not attach image. The preview expired. Try attaching it again.',
    })
    expect(onSubmit).not.toHaveBeenCalled()
    expect(ctx.textInput.value).toBe('   ')
    expect(ctx.files.value).toHaveLength(1)
    vi.unstubAllGlobals()
  })
})
